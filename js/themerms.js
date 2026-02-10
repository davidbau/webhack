// themerms.js -- Themeroom definitions
// Faithful port of themerms.lua from NetHack 3.7.
// Each themeroom pick handler mirrors its Lua themerooms[] entry.
// C ref: dat/themerms.lua, dat/nhlib.lua

import {
    COLNO, ROWNO, STONE, VWALL, HWALL,
    DOOR, CORR, ROOM, SDOOR, SCORR, FOUNTAIN, THRONE, SINK,
    POOL, TREE, IRONBARS, LAVAPOOL, ICE, WATER, MOAT, LAVAWALL,
    AIR, CLOUD, CROSSWALL, MAX_TYPE, ALTAR, GRAVE,
    D_NODOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_SECRET,
    OROOM, THEMEROOM, ROOMOFFSET,
    isok,
    ARROW_TRAP, DART_TRAP, ROCKTRAP, BEAR_TRAP, LANDMINE, SLP_GAS_TRAP,
    RUST_TRAP, ANTI_MAGIC, ROLLING_BOULDER_TRAP, WEB, STATUE_TRAP,
    TELEP_TRAP, MKTRAP_NOFLAGS, MKTRAP_NOSPIDERONWEB,
} from './config.js';
import { FILL_NORMAL } from './map.js';
import { rn2, rnd, rn1, rnz, d } from './rng.js';
import { mksobj, mkobj, RANDOM_CLASS } from './mkobj.js';
import { mkclass, def_char_to_monclass, makemon, rndmonnum, rndmonst_adj, NO_MM_FLAGS } from './makemon.js';
import {
    CORPSE, STATUE, BOULDER, CHEST, OIL_LAMP, DAGGER, BOW, ARROW,
    objectData, CLASS_SYMBOLS,
    WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, SCROLL_CLASS, TOOL_CLASS,
} from './objects.js';
import {
    mons, G_NOGEN, G_IGNORE, MAXMCLASSES, PM_LIZARD, PM_LICHEN,
    PM_GHOST, PM_FOG_CLOUD, PM_WOOD_NYMPH, PM_GIANT_SPIDER,
    S_MIMIC, S_UNICORN, M2_MALE, M2_FEMALE, M2_NEUTER,
} from './monsters.js';
import {
    create_room, create_subroom, sp_create_door, floodFillAndRegister, enexto,
    mktrap, litstate_rnd,
} from './dungeon.js';

// ========================================================================
// nhlib.lua helpers
// ========================================================================

// C ref: nhlib.lua shuffle() — Fisher-Yates from back
// rn2(n), rn2(n-1), ..., rn2(2) = (n-1) calls
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = rn2(i + 1);
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

// ========================================================================
// des.door() wrappers — Lua-level door creation API
// C ref: sp_lev.c lspo_door() paths for state="random" and state="secret"
// ========================================================================

// C ref: sp_lev.c rnddoor() — random door state via ROLL_FROM
function rnddoor() {
    const states = [D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED];
    return states[rn2(5)];
}

// C ref: themerms.lua des.door("random") — rnddoor + create_door with random mask
function des_door_random(map, room) {
    rnddoor(); // rn2(5) always consumed even though result is unused
    sp_create_door(map, { secret: 0, mask: -1, pos: -1, wall: -1 }, room);
}

// C ref: themerms.lua des.door("secret") — secret door, no rnddoor
function des_door_secret(map, room) {
    sp_create_door(map, { secret: 1, mask: D_SECRET, pos: -1, wall: -1 }, room);
}

// ========================================================================
// des.map() themeroom data and placement (picks 11-29)
// C ref: themerms.lua themerooms[12..30] (Lua 1-based)
// ========================================================================

const CHAR_TO_TYP = {
    ' ': STONE, '#': CORR, '.': ROOM, '-': HWALL, '|': VWALL,
    '+': DOOR, 'S': SDOOR, 'H': SCORR, '{': FOUNTAIN, '\\': THRONE,
    'K': SINK, '}': MOAT, 'P': POOL, 'L': LAVAPOOL, 'Z': LAVAWALL,
    'I': ICE, 'W': WATER, 'T': TREE, 'F': IRONBARS, 'A': AIR,
    'C': CLOUD, 'B': CROSSWALL, 'x': MAX_TYPE,
};

// Map data for des.map() themerooms (JS picks 11-29).
// Each entry: { map: string, filler: [x, y] } or { map: string, special: true }
// 'x' = transparent (existing terrain preserved).
// C ref: themerms.lua themerooms[12..30] (Lua 1-based)
const THEMEROOM_MAPS = [
    // [0] = pick 11: L-shaped
    { map: '-----xxx\n|...|xxx\n|...|xxx\n|...----\n|......|\n|......|\n|......|\n--------', filler: [1, 1] },
    // [1] = pick 12: L-shaped, rot 1
    { map: 'xxx-----\nxxx|...|\nxxx|...|\n----...|\n|......|\n|......|\n|......|\n--------', filler: [5, 1] },
    // [2] = pick 13: L-shaped, rot 2
    { map: '--------\n|......|\n|......|\n|......|\n----...|\nxxx|...|\nxxx|...|\nxxx-----', filler: [1, 1] },
    // [3] = pick 14: L-shaped, rot 3
    { map: '--------\n|......|\n|......|\n|......|\n|...----\n|...|xxx\n|...|xxx\n-----xxx', filler: [1, 1] },
    // [4] = pick 15: Blocked center
    { map: '-----------\n|.........|\n|.........|\n|.........|\n|...LLL...|\n|...LLL...|\n|...LLL...|\n|.........|\n|.........|\n|.........|\n-----------', filler: [1, 1], blockedCenter: true },
    // [5] = pick 16: Circular, small
    { map: 'xx---xx\nx--.--x\n--...--\n|.....|\n--...--\nx--.--x\nxx---xx', filler: [3, 3] },
    // [6] = pick 17: Circular, medium
    { map: 'xx-----xx\nx--...--x\n--.....--\n|.......|\n|.......|\n|.......|\n--.....--\nx--...--x\nxx-----xx', filler: [4, 4] },
    // [7] = pick 18: Circular, big
    { map: 'xxx-----xxx\nx---...---x\nx-.......-x\n--.......--\n|.........|\n|.........|\n|.........|\n--.......--\nx-.......-x\nx---...---x\nxxx-----xxx', filler: [5, 5] },
    // [8] = pick 19: T-shaped
    { map: 'xxx-----xxx\nxxx|...|xxx\nxxx|...|xxx\n----...----\n|.........|\n|.........|\n|.........|\n-----------', filler: [5, 5] },
    // [9] = pick 20: T-shaped, rot 1
    { map: '-----xxx\n|...|xxx\n|...|xxx\n|...----\n|......|\n|......|\n|......|\n|...----\n|...|xxx\n|...|xxx\n-----xxx', filler: [2, 2] },
    // [10] = pick 21: T-shaped, rot 2
    { map: '-----------\n|.........|\n|.........|\n|.........|\n----...----\nxxx|...|xxx\nxxx|...|xxx\nxxx-----xxx', filler: [2, 2] },
    // [11] = pick 22: T-shaped, rot 3
    { map: 'xxx-----\nxxx|...|\nxxx|...|\n----...|\n|......|\n|......|\n|......|\n----...|\nxxx|...|\nxxx|...|\nxxx-----', filler: [5, 5] },
    // [12] = pick 23: S-shaped
    { map: '-----xxx\n|...|xxx\n|...|xxx\n|...----\n|......|\n|......|\n|......|\n----...|\nxxx|...|\nxxx|...|\nxxx-----', filler: [2, 2] },
    // [13] = pick 24: S-shaped, rot 1
    { map: 'xxx--------\nxxx|......|\nxxx|......|\n----......|\n|......----\n|......|xxx\n|......|xxx\n--------xxx', filler: [5, 5] },
    // [14] = pick 25: Z-shaped
    { map: 'xxx-----\nxxx|...|\nxxx|...|\n----...|\n|......|\n|......|\n|......|\n|...----\n|...|xxx\n|...|xxx\n-----xxx', filler: [5, 5] },
    // [15] = pick 26: Z-shaped, rot 1
    { map: '--------xxx\n|......|xxx\n|......|xxx\n|......----\n----......|\nxxx|......|\nxxx|......|\nxxx--------', filler: [2, 2] },
    // [16] = pick 27: Cross
    { map: 'xxx-----xxx\nxxx|...|xxx\nxxx|...|xxx\n----...----\n|.........|\n|.........|\n|.........|\n----...----\nxxx|...|xxx\nxxx|...|xxx\nxxx-----xxx', filler: [6, 6] },
    // [17] = pick 28: Four-leaf clover
    { map: '-----x-----\n|...|x|...|\n|...---...|\n|.........|\n---.....---\nxx|.....|xx\n---.....---\n|.........|\n|...---...|\n|...|x|...|\n-----x-----', filler: [6, 6] },
    // [18] = pick 29: Water-surrounded vault
    { map: '}}}}}}\n}----}\n}|...|}\n}|...|}\n}----}\n}}}}}}', special: 'water_vault' },
];

// Place a des.map() themeroom on the level grid.
// Returns true if placed, false if failed after 100 attempts.
// C ref: sp_lev.c lspo_map() with in_mk_themerooms=TRUE
function placeMapThemeroom(map, mapIdx, depth) {
    const tmData = THEMEROOM_MAPS[mapIdx - 11]; // picks 11-29 → array 0-18
    const lines = tmData.map.split('\n');
    const mfHei = lines.length;
    const mfWid = Math.max(...lines.map(l => l.length));

    let xstart, ystart;
    for (let tryct = 0; tryct < 100; tryct++) {
        // C ref: sp_lev.c:6201-6204 — random position for themeroom map
        xstart = 1 + rn2(COLNO - 1 - mfWid);
        ystart = rn2(ROWNO - mfHei);

        // C ref: sp_lev.c:6217 — bounds check
        if (ystart < 0 || ystart + mfHei > ROWNO) continue;
        if (xstart < 1 || xstart + mfWid >= COLNO) continue;

        // C ref: sp_lev.c:6236-6264 — overlap check (border + interior)
        let ok = true;
        for (let y = ystart - 1; y < ystart + mfHei + 1 && ok; y++) {
            for (let x = xstart - 1; x < xstart + mfWid + 1 && ok; x++) {
                if (!isok(x, y)) { ok = false; break; }
                const loc = map.at(x, y);
                if (y < ystart || y >= ystart + mfHei
                    || x < xstart || x >= xstart + mfWid) {
                    // Border cell: must be STONE with no room
                    if (loc.typ !== STONE || loc.roomno !== 0) ok = false;
                } else {
                    // Interior cell
                    const ch = (lines[y - ystart] || '')[x - xstart] || ' ';
                    const mptyp = CHAR_TO_TYP[ch];
                    if (mptyp === undefined || mptyp >= MAX_TYPE) continue;
                    if ((loc.typ !== STONE || loc.roomno !== 0)
                        && loc.typ !== mptyp) {
                        ok = false;
                    }
                }
            }
        }
        if (!ok) continue;

        // Success — write map characters to the grid
        // C ref: sp_lev.c:6267-6288
        for (let y = ystart; y < ystart + mfHei; y++) {
            for (let x = xstart; x < xstart + mfWid; x++) {
                const ch = (lines[y - ystart] || '')[x - xstart] || ' ';
                const mptyp = CHAR_TO_TYP[ch];
                if (mptyp === undefined || mptyp >= MAX_TYPE) continue;
                const loc = map.at(x, y);
                loc.flags = 0;
                loc.horizontal = (mptyp === HWALL || mptyp === IRONBARS);
                loc.roomno = 0;
                loc.edge = false;
                loc.typ = mptyp;
                if (mptyp === SDOOR) loc.flags = D_CLOSED;
            }
        }

        // Execute contents callback
        if (tmData.blockedCenter) {
            // C ref: themerms.lua Blocked center — percent(30) + maybe replace L
            desMapBlockedCenter(map, xstart, ystart, mfWid, mfHei);
        }

        if (tmData.special === 'water_vault') {
            // Water vault uses des.region instead of filler_region
            desMapWaterVault(map, xstart, ystart, depth);
        } else {
            // Standard filler_region
            const fx = xstart + tmData.filler[0];
            const fy = ystart + tmData.filler[1];
            fillerRegion(map, fx, fy, depth);
        }

        // C ref: lspo_map() does NOT modify the rect pool for des.map()
        // themeroms. Overlap avoidance for subsequent rooms is handled by
        // the overlap check inside create_room(), not by split_rects().
        return true;
    }

    // All 100 attempts failed
    return false;
}

// C ref: themerms.lua Blocked center contents — before filler_region
function desMapBlockedCenter(map, xstart, ystart, wid, hei) {
    if (rn2(100) < 30) { // percent(30)
        // shuffle({"-","P"}) = rn2(2) for 2-element shuffle
        rn2(2);
        // des.replace_terrain: rn2(100) per cell matching 'L' (9 cells)
        // C ref: sp_lev.c lspo_replace_terrain — each cell: rn2(100) < chance
        for (let i = 0; i < 9; i++) rn2(100);
    }
}

// C ref: themerms.lua Water-surrounded vault contents
function desMapWaterVault(map, xstart, ystart, depth) {
    // des.region({irregular=true}) → litstate_rnd + flood_fill
    const rndVal = rnd(1 + Math.abs(depth));
    let lit = false;
    if (rndVal < 11) {
        lit = rn2(77) !== 0;
    }
    // flood_fill_rm + add_room (register the room)
    floodFillAndRegister(map, xstart + 2, ystart + 2, THEMEROOM, lit);

    // shuffle(chest_spots) — 4-element: rn2(4), rn2(3), rn2(2)
    rn2(4); rn2(3); rn2(2);
    // math.random(#escape_items) — rn2(4)
    rn2(4);
    // obj.new(escape_item) — creates object, RNG varies
    // des.object({id="chest",...}) × up to 4 — complex RNG
    // shuffle(nasty_undead) — 3-element: rn2(3), rn2(2)
    rn2(3); rn2(2);
    // des.monster — complex RNG
    // We can't faithfully simulate all the object/monster RNG here,
    // so PRNG will diverge from this point for water vault rooms.
    // Mark room as needjoining=false
    if (map.nroom > 0) {
        map.rooms[map.nroom - 1].needjoining = false;
    }
}

// C ref: themerms.lua filler_region(x, y)
// Flood fills from (absX, absY) to register an irregular room, then maybe
// applies themeroom_fill.
function fillerRegion(map, absX, absY, depth) {
    // percent(30) → rn2(100)
    const isThemed = rn2(100) < 30;

    // litstate_rnd(-1): rnd(1+depth), maybe rn2(77)
    // C ref: mkmap.c litstate_rnd
    const rndVal = rnd(1 + Math.abs(depth));
    let lit = false;
    if (rndVal < 11) {
        lit = rn2(77) !== 0;
    }

    // flood_fill_rm from (absX, absY) + add_room
    const rtype = isThemed ? THEMEROOM : OROOM;
    floodFillAndRegister(map, absX, absY, rtype, lit);

    // C ref: themerms.lua filler_region passes filled=1 to des.region()
    if (map.nroom > 0) {
        map.rooms[map.nroom - 1].needfill = FILL_NORMAL;
    }

    // If themed, run themeroom_fill reservoir sampling + contents
    if (isThemed && map.nroom > 0) {
        const room = map.rooms[map.nroom - 1];
        simulateThemeroomFill(map, room, depth);
    }
}

// ========================================================================
// Selection API helpers — lightweight equivalents of C's selvar.c
// These operate on arrays of {x,y} coordinates. RNG consumption matches
// C's selection_filter_percent, selection_rndcoord, etc. exactly.
// ========================================================================

// C ref: selvar.c selection_from_mkroom() — collects room tiles.
// Iteration: y-major (y outer, x inner). Checks roomno match and !edge.
// No RNG consumed.
function selectionRoom(map, room) {
    const points = [];
    const rmno = room.roomno !== undefined ? room.roomno : 0;
    for (let y = room.ly; y <= room.hy; y++) {
        for (let x = room.lx; x <= room.hx; x++) {
            if (!isok(x, y)) continue;
            const loc = map.at(x, y);
            // C checks: !edge && roomno == rmno
            // For themerooms, all interior tiles qualify
            if (loc && !loc.edge && loc.typ === ROOM) {
                points.push({ x, y });
            }
        }
    }
    return points;
}

// C ref: selvar.c selection_filter_percent() — keep points where rn2(100) < pct.
// Iteration: x-major (x outer, y inner) over selection bounds.
// One rn2(100) per point in the ORIGINAL selection.
function selectionPercentage(points, pct) {
    // C iterates x-major over the bounding rect of the selection.
    // We must replicate x-major order: sort by x first, then y.
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const result = [];
    for (const p of sorted) {
        if (rn2(100) < pct) {
            result.push(p);
        }
    }
    return result;
}

// C ref: selvar.c selection_rndcoord() — pick random point.
// Counts points, calls rn2(count), finds the nth point in x-major order.
// If removeit, removes the chosen point from the array.
function selectionRndcoord(points, removeit) {
    if (points.length === 0) return { x: -1, y: -1 };
    // C iterates x-major for both counting and finding
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const idx = rn2(sorted.length);
    const chosen = sorted[idx];
    if (removeit) {
        // Remove from original array
        const origIdx = points.findIndex(p => p.x === chosen.x && p.y === chosen.y);
        if (origIdx >= 0) points.splice(origIdx, 1);
    }
    return chosen;
}

// C ref: selvar.c selection_filter_mapchar() — filter by terrain type.
// Iteration: x-major. Default lit=-2 means no RNG.
// No RNG consumed (we always use lit=-2 default).
function selectionFilterMapchar(map, points, ch) {
    const typ = CHAR_TO_TYP[ch];
    if (typ === undefined) return [];
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    return sorted.filter(p => {
        const loc = map.at(p.x, p.y);
        return loc && loc.typ === typ;
    });
}

// C ref: nhlsel.c l_selection_iterate() — iterate in y-major order.
// Calls callback(x, y) for each selected point.
function selectionIterate(points, callback) {
    const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const p of sorted) {
        callback(p.x, p.y);
    }
}

// ========================================================================
// des.object / des.monster / des.trap helpers for themeroom contents
// These simulate the RNG consumption of C's sp_lev.c create_object(),
// create_monster(), create_trap(), create_altar() without actually
// placing the entities. Only RNG alignment matters.
// ========================================================================

// Helper: resolve random position in room via somexy loop.
// C ref: sp_lev.c get_location() with croom → somexy(croom, &tmpc)
// somexy calls somex + somey per attempt, retries if wall or subroom.
// For irregular rooms (shaped themerooms), somexy checks !edge && roomno
// match (C ref: mkroom.c somexy irregular path), then get_location checks
// SPACE_POS(typ). For regular rooms, somexy returns immediately and only
// get_location's SPACE_POS check applies.
function des_get_location(map, room) {
    const irregular = room.irregular;
    const rmno = irregular ? (room.roomnoidx + ROOMOFFSET) : 0;
    for (let tries = 0; tries < 100; tries++) {
        const x = rn1(room.hx - room.lx + 1, room.lx); // somex
        const y = rn1(room.hy - room.ly + 1, room.ly); // somey
        const loc = map.at(x, y);
        if (!loc) continue;
        if (irregular) {
            // C ref: mkroom.c somexy() irregular path — !edge && roomno == i
            if (loc.edge || loc.roomno !== rmno) continue;
        }
        // C ref: sp_lev.c is_ok_location() — SPACE_POS(typ)
        if (loc.typ > DOOR) return { x, y };
    }
    return { x: room.lx, y: room.ly }; // fallback
}

// C ref: sp_lev.c create_monster() line 1977 — MON_AT check + enexto
// When a monster already occupies the target position, find a nearby free spot.
function sp_monster_at(map, x, y) {
    for (const m of map.monsters) {
        if (m.mx === x && m.my === y) return true;
    }
    return false;
}

// Helper: look up object index by name.
function objNameToIndex(name) {
    for (let i = 0; i < objectData.length; i++) {
        if (objectData[i].name === name) return i;
    }
    return -1;
}

// Helper: look up object class from display character.
// C ref: objnam.c def_char_to_objclass()
function def_char_to_objclass(ch) {
    for (let i = 0; i < 17; i++) {
        if (CLASS_SYMBOLS[i] === ch) return i;
    }
    return 17; // MAXOCLASSES
}

// Helper: look up monster index by name.
function monNameToIndex(name) {
    for (let i = 0; i < mons.length; i++) {
        if (mons[i].name === name) return i;
    }
    return -1;
}

// C ref: sp_lev.c create_object() for CORPSE with specific montype name.
// Simulates: get_location + mksobj(CORPSE) + set_corpsenm override.
// The mksobj creates a "wasted" random corpse (rndmonnum + rnz) that gets
// overridden by set_corpsenm (another rnz). Both consume RNG.
function des_object_corpse_named(map, room, montype, buried) {
    des_get_location(map, room);
    // mksobj(CORPSE, TRUE, TRUE) — creates random corpse then overrides
    mksobj(CORPSE, true, true);
    // create_object overrides corpsenm: second set_corpsenm → rnz(25)
    // C ref: mkobj.c:1399-1400 — lizard/lichen corpses skip start_corpse_timeout
    if (montype !== PM_LIZARD && montype !== PM_LICHEN) {
        rnz(25);
    }
    // C ref: dig.c bury_an_obj() → obj_resists(otmp, 0, 0) → rn2(100)
    if (buried) {
        rn2(100); // obj_resists
    }
}

// C ref: sp_lev.c create_object() for CORPSE with montype class char.
function des_object_corpse_class(map, room, classChar) {
    const monclass = def_char_to_monclass(classChar);
    mkclass(monclass, G_NOGEN | G_IGNORE);
    mksobj(CORPSE, true, true);
    rnz(25); // second set_corpsenm
}

// C ref: sp_lev.c create_object() for named object at random room pos.
// Used for: "boulder", "statue", "chest", "oil lamp", "dagger", "bow", "arrow"
// Flags: buc (0=random, 6=not-blessed), buried, lit, atCoord, contents
function des_object_named(map, room, objName, opts = {}) {
    const otyp = objNameToIndex(objName);
    if (otyp < 0) return;

    // Location: skip if explicit coord provided
    if (!opts.atCoord) {
        des_get_location(map, room);
    }

    // mksobj_at(otyp, x, y, TRUE, !named)
    // C's "named" = o->name.str (custom name string), NOT the object id.
    // Themeroom objects specify id but not name, so named=false, artif=true.
    const obj = mksobj(otyp, true, true);

    // Curse state: "not-blessed" = case 6 → unbless (no RNG)
    // Default (random) = keep what mksobj gave (no RNG)
    // No additional RNG for buc handling in either case.

    // Corpsenm override for corpse with named montype
    if (opts.montype !== undefined && objectData[otyp].name === 'corpse') {
        rnz(25); // second set_corpsenm timeout
    }

    // Buried: obj_resists + possibly organic rot
    if (opts.buried) {
        rn2(100); // obj_resists(otmp, 0, 0)
        // Chest is WOOD (organic), so: !obj_resists(5,95) + rnd(250) for rot timer
        if (objectData[otyp].material <= 8) { // material <= WOOD = organic
            rn2(100); // obj_resists(otmp, 5, 95)
            rnd(250); // start_timer rot
        }
    }

    // Lit: begin_burn — no RNG
    // Contents callback for containers
    if (opts.contents) {
        opts.contents(obj);
    }
}

// C ref: sp_lev.c create_object() for object by class char at coord.
// Used for ghost fill: des.object({ class = ")", coord, buc = "not-blessed" })
function des_object_class_char(map, room, classChar, opts = {}) {
    if (!opts.atCoord) {
        des_get_location(map, room);
    }
    const oclass = def_char_to_objclass(classChar);
    if (oclass === 11) { // COIN_CLASS
        // mkgold: rnd(level_difficulty+2) * rnd(75) or similar — simplified
        rnd(200); // gold amount
    } else {
        // mkobj_at(oclass, x, y, !named) — named=false so artif=true
        mkobj(oclass, true);
    }
    // buc = "not-blessed" = case 6 → unbless (no RNG)
}

// C ref: sp_lev.c create_object() with no id/class — completely random.
function des_object_random(map, room) {
    des_get_location(map, room);
    // mkobj_at(RANDOM_CLASS, x, y, !named) — artif=true
    mkobj(RANDOM_CLASS, true);
}

// C ref: sp_lev.c create_monster() for monster with specific id.
// Used for: "ghost", "fog cloud", "wood nymph", "giant spider"
function des_monster_named(map, room, monName, depth, opts = {}) {
    const mndx = monNameToIndex(monName);
    if (mndx < 0) return;

    // C ref: find_montype() in sp_lev.c:3144-3148
    // For monsters not explicitly male or female: rn2(2) for gender
    const ptr = mons[mndx];
    const is_m = !!(ptr.flags2 & M2_MALE);
    const is_f = !!(ptr.flags2 & M2_FEMALE);
    if (!is_m && !is_f) {
        rn2(2); // find_montype gender assignment
    }

    // sp_amask_to_amask(AM_SPLEV_RANDOM) → induced_align(80)
    // For regular dungeon: no special level align, no dungeon align → rn2(3)
    rn2(3); // induced_align

    // Location
    let pos;
    if (!opts.atCoord) {
        pos = des_get_location(map, room);
    } else {
        pos = { x: opts.x || room.lx, y: opts.y || room.ly };
    }

    // C ref: sp_lev.c:1977 — MON_AT check + enexto
    if (sp_monster_at(map, pos.x, pos.y)) {
        const alt = enexto(pos.x, pos.y, map);
        if (alt) pos = alt;
    }

    // makemon(pm, x, y, NO_MM_FLAGS)
    makemon(mndx, pos.x, pos.y, NO_MM_FLAGS, depth, map);
}

// C ref: sp_lev.c create_monster() for monster with class char.
// Used by Mausoleum and Storeroom (mimics).
function des_monster_class(map, room, classChar, depth, opts = {}) {
    rn2(3); // induced_align
    const monclass = def_char_to_monclass(classChar);
    const mndx = mkclass(monclass, G_NOGEN, depth);
    let pos;
    if (!opts.atCoord) {
        pos = des_get_location(map, room);
    } else {
        pos = { x: opts.x || room.lx, y: opts.y || room.ly };
    }
    if (mndx >= 0) {
        // C ref: sp_lev.c:1977 — MON_AT check + enexto
        if (sp_monster_at(map, pos.x, pos.y)) {
            const alt = enexto(pos.x, pos.y, map);
            if (alt) pos = alt;
        }
        makemon(mndx, pos.x, pos.y, NO_MM_FLAGS, depth, map);
    }
}

// C ref: sp_lev.c trap_types[] — trap name to constant mapping
const TRAP_NAME_MAP = {
    'arrow': ARROW_TRAP, 'dart': DART_TRAP, 'falling rock': ROCKTRAP,
    'bear': BEAR_TRAP, 'land mine': LANDMINE, 'sleep gas': SLP_GAS_TRAP,
    'rust': RUST_TRAP, 'anti magic': ANTI_MAGIC,
    'rolling boulder': ROLLING_BOULDER_TRAP, 'web': WEB,
    'statue': STATUE_TRAP, 'teleport': TELEP_TRAP,
};

// C ref: sp_lev.c create_trap() → mklev.c mktrap() — full trap creation.
// For themeroom fills, traps at explicit (x,y) skip location RNG.
// Non-statue traps go through mktrap() which handles maketrap(), the victim
// check (rnd(4)), and mktrap_victim().
function des_trap(map, room, trapType, opts = {}) {
    // Resolve trap type constant from string name or integer
    const trapConst = typeof trapType === 'string'
        ? (TRAP_NAME_MAP[trapType] ?? 0) : trapType;
    const depth = opts.depth ?? 1;

    if (trapConst === STATUE_TRAP) {
        // Statue traps: JS maketrap() doesn't implement mk_trap_statue(),
        // so we handle the statue RNG here, then consume rnd(4) for the victim
        // check (STATUE_TRAP=19 >= HOLE=13 and != MAGIC_TRAP=20 → always fails).
        if (!opts.atCoord) {
            des_get_location(map, room);
        }
        mk_trap_statue_rng(map, room);
        rnd(4); // victim check consumed but condition always false for statue
        return;
    }

    // For all other trap types, call mktrap() which handles:
    // - maketrap() (trap object creation + type-specific init)
    // - WEB spider creation (if applicable, currently stubbed)
    // - Victim check rnd(4) + mktrap_victim() when condition passes
    // C ref: sp_lev.c create_trap() calls mktrap(kind, 0, croom, &tm)
    let tm;
    if (opts.atCoord) {
        tm = { x: opts.x, y: opts.y };
    } else {
        // C ref: lspo_trap → get_location_coord → get_free_room_loc
        const pos = des_get_location(map, room);
        tm = pos;
    }
    const flags = opts.flags ?? MKTRAP_NOFLAGS;
    mktrap(map, trapConst, flags, room, tm, depth);
}

// C ref: trap.c mk_trap_statue() — create statue with embedded monster inventory.
// Picks a monster via rndmonst_adj(3,6), creates statue via mkcorpstat,
// then creates a temp monster via makemon(0,0) to populate the statue's inventory.
// The temp monster is immediately deleted. All RNG must match C exactly.
function mk_trap_statue_rng(map, room) {
    const depth = 1; // during mklev, depth context

    // C ref: do { mptr = &mons[rndmonnum_adj(3, 6)]; } while (unicorn check)
    // Retry if co-aligned unicorn (trycount <= 10)
    let mndx;
    let trycount = 10;
    do {
        mndx = rndmonst_adj(3, 6, depth);
        if (mndx < 0) return;
        const isUnicorn = mons[mndx].symbol === S_UNICORN;
        // During mklev, u.ualign.type is typically 0 (neutral/unset)
        // sgn(u.ualign.type) == sgn(mptr->maligntyp) check
        // For simplicity, assume alignment doesn't match (no retry needed)
        // This is correct for most cases; if a neutral unicorn is picked,
        // the retry would consume another rndmonst_adj
        if (!isUnicorn) break;
        // Conservative: break even for unicorns since alignment is uncertain
        break;
    } while (--trycount > 0);

    // C ref: mkcorpstat(STATUE, NULL, mptr, x, y, CORPSTAT_NONE)
    //   → mksobj(STATUE, FALSE, FALSE)
    //   which internally: rnd(2) for next_ident, rndmonnum() for corpsenm,
    //   rn2(2) for gender (if applicable)
    //   Then mkcorpstat overrides corpsenm with the actual mndx.
    mksobj(STATUE, false, false);

    // C ref: makemon(&mons[corpsenm], 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG)
    // Position (0,0) triggers makemon_rnd_goodpos: tries rn2(77)+rn2(21) pairs
    // Then full monster creation (newmonhp, gender, weapons, inventory, etc.)
    makemon(mndx, 0, 0, NO_MM_FLAGS, depth, map);
}

// C ref: sp_lev.c create_altar() — altar at random room pos.
// For temple fill: des.altar({ align = "law"/"neutral"/"chaos" })
// Explicit alignment → no sp_amask_to_amask RNG needed.
function des_altar(map, room, align) {
    // get_free_room_loc → somexy
    const { x, y } = des_get_location(map, room);
    // sp_amask_to_amask: explicit alignment (not random) → no RNG
    const loc = map.at(x, y);
    if (loc) loc.typ = ALTAR;
}

// C ref: sp_lev.c lspo_gold() — gold at random room pos.
function des_gold(map, room) {
    des_get_location(map, room);
    rnd(200); // gold amount
}

// C ref: sp_lev.c lspo_feature() for "fountain" — at random room pos.
function des_feature_fountain(map, room) {
    des_get_location(map, room);
    // No additional RNG — just sets terrain type
}

// ========================================================================
// Themeroom fill types (picks 5-7 and des.map filler_region)
// C ref: themerms.lua themeroom_fills[] and themeroom_fill()
// ========================================================================

// Themeroom fill types in order from themerms.lua themeroom_fills array.
// All have frequency=1. Eligibility depends on depth and room lit state.
const FILL_TYPES = [
    { name: 'ice' },
    { name: 'cloud' },
    { name: 'boulder', mindiff: 4 },
    { name: 'spider' },
    { name: 'trap' },
    { name: 'garden', needsLit: true },
    { name: 'buried_treasure' },
    { name: 'buried_zombies' },
    { name: 'massacre' },
    { name: 'statuary' },
    { name: 'light_source', needsUnlit: true },
    { name: 'temple' },
    { name: 'ghost' },
    { name: 'storeroom' },
    { name: 'teleport' },
];

// Simulate C's themeroom_fill() Lua function.
// Does reservoir sampling to pick a fill, then simulates the fill's RNG.
// C ref: themerms.lua themeroom_fill()
function simulateThemeroomFill(map, room, depth, forceLit) {
    const lit = (forceLit !== undefined) ? forceLit : room.rlit;
    const levelDiff = Math.max(0, depth - 1);

    // Reservoir sampling over eligible fills (all freq=1)
    let pickName = null;
    let totalFreq = 0;
    for (const fill of FILL_TYPES) {
        if (fill.mindiff && levelDiff < fill.mindiff) continue;
        if (fill.needsLit && !lit) continue;
        if (fill.needsUnlit && lit) continue;
        totalFreq++;
        if (rn2(totalFreq) === 0) {
            pickName = fill.name;
        }
    }

    // Simulate fill contents RNG consumption.
    // Each fill's contents function in themerms.lua calls des.altar/des.object/
    // des.monster/des.trap which consume RNG. We simulate the simple ones here.
    //
    // IMPORTANT: math.random in nhlib.lua is overridden to use NetHack RNG:
    //   math.random(n) → 1 + nh.rn2(n) → rn2(n)
    //   math.random(a, b) → nh.random(a, b-a+1) → rn2(b-a+1)
    //   percent(n) → math.random(0, 99) → rn2(100)
    //   d(n, x) → n × math.random(1, x) → n × rn2(x)
    //   shuffle(list) → (len-1) rn2 calls
    const w = room.hx - room.lx + 1;
    const h = room.hy - room.ly + 1;
    switch (pickName) {
        case 'ice': {
            // C ref: themerms.lua "Ice room"
            // selection.room() → des.terrain(ice, "I")
            const sel = selectionRoom(map, room);
            for (const p of sel) {
                const loc = map.at(p.x, p.y);
                if (loc) loc.typ = ICE;
            }
            // percent(25) → rn2(100)
            if (rn2(100) < 25) {
                // ice:iterate(ice_melter) — iterate y-major, rn2(1000) per point
                selectionIterate(sel, () => { rn2(1000); });
            }
            break;
        }
        case 'cloud': {
            // C ref: themerms.lua "Cloud room"
            // local fog = selection.room()
            const sel = selectionRoom(map, room);
            const npts = sel.length;
            // for i = 1, npts/4 do des.monster("fog cloud", asleep=true)
            const count = Math.floor(npts / 4);
            for (let i = 0; i < count; i++) {
                des_monster_named(map, room, 'fog cloud', depth, { asleep: true });
            }
            // des.gas_cloud({ selection = fog }) — no RNG
            break;
        }
        case 'boulder': {
            // C ref: themerms.lua "Boulder room" (mindiff=4)
            // selection.room():percentage(30) → iterate: percent(50) ? boulder : rolling boulder trap
            const sel = selectionRoom(map, room);
            const locs = selectionPercentage(sel, 30);
            selectionIterate(locs, (x, y) => {
                if (rn2(100) < 50) { // percent(50)
                    des_object_named(map, room, 'boulder', { atCoord: true });
                } else {
                    des_trap(map, room, ROLLING_BOULDER_TRAP, { atCoord: true, x, y, depth });
                }
            });
            break;
        }
        case 'spider': {
            // C ref: themerms.lua "Spider nest"
            // spooders = level_difficulty() > 8
            const spooders = depth > 8;
            const sel = selectionRoom(map, room);
            const locs = selectionPercentage(sel, 30);
            selectionIterate(locs, (x, y) => {
                // des.trap({ type="web", x=x, y=y, spider_on_web = spooders and percent(80) })
                // The percent(80) is ALWAYS evaluated when spooders is true (Lua short-circuit)
                // But in Lua: `spooders and percent(80)` → if spooders=false, percent not called
                if (spooders) {
                    rn2(100); // percent(80) — always consumed when spooders=true
                }
                des_trap(map, room, WEB, { atCoord: true, x, y, depth });
            });
            break;
        }
        case 'trap': {
            // C ref: themerms.lua "Trap room"
            // local traps = { "arrow", "dart", "falling rock", "bear",
            //                 "land mine", "sleep gas", "rust", "anti magic" }
            // shuffle(traps) → 7 rn2 calls (8 elements)
            const traps = [
                ARROW_TRAP, DART_TRAP, ROCKTRAP, BEAR_TRAP,
                LANDMINE, SLP_GAS_TRAP, RUST_TRAP, ANTI_MAGIC,
            ];
            shuffleArray(traps); // 7 rn2 calls
            const sel = selectionRoom(map, room);
            const locs = selectionPercentage(sel, 30);
            selectionIterate(locs, (x, y) => {
                des_trap(map, room, traps[0], { atCoord: true, x, y, depth });
            });
            break;
        }
        case 'garden': {
            // C ref: themerms.lua "Garden" (needsLit)
            // local s = selection.room(); npts = s:numpoints() / 6
            const sel = selectionRoom(map, room);
            const npts = Math.floor(sel.length / 6);
            for (let i = 0; i < npts; i++) {
                // des.monster({ id = "wood nymph", asleep = true })
                des_monster_named(map, room, 'wood nymph', depth, { asleep: true });
                // if percent(30) then des.feature("fountain")
                if (rn2(100) < 30) {
                    des_feature_fountain(map, room);
                }
            }
            // Postprocessor: make_garden_walls
            // table.insert(postprocess, { handler = make_garden_walls,
            //                             data = { sel = selection.room() } })
            // selection.room() is called again — no RNG, just collects points
            // Postprocessor runs after level gen: sel:grow() then replace_terrain
            // replace_terrain("w" → "T"): iterates all points, no RNG (chance=100%)
            // replace_terrain("S" → "A"): iterates all points, no RNG
            // The grow() + replace operations don't consume RNG.

            // Apply garden wall transformation: convert room walls to trees
            // C ref: make_garden_walls — sel:grow() expands selection by 1 in all dirs
            // then replace_terrain fromterrain="w" (any wall) toterrain="T" (tree)
            for (let y = room.ly - 1; y <= room.hy + 1; y++) {
                for (let x = room.lx - 1; x <= room.hx + 1; x++) {
                    if (!isok(x, y)) continue;
                    const loc = map.at(x, y);
                    if (!loc) continue;
                    if (loc.typ === HWALL || loc.typ === VWALL) {
                        loc.typ = TREE;
                    }
                }
            }
            break;
        }
        case 'buried_treasure': {
            // C ref: themerms.lua "Buried treasure"
            // des.object({ id="chest", buried=true, contents=function(otmp)
            //   ... for i=1,d(3,4) do des.object() end ... })
            des_object_named(map, room, 'chest', {
                buried: true,
                contents: () => {
                    // d(3,4) = 3 × rn2(4) → sum
                    const numObjs = (rn2(4) + 1) + (rn2(4) + 1) + (rn2(4) + 1);
                    for (let i = 0; i < numObjs; i++) {
                        des_object_random(map, room);
                    }
                },
            });
            // Postprocessor: make_dig_engraving
            // selection.negate():filter_mapchar(".") → no RNG (filter_mapchar default lit=-2)
            // floors:rndcoord(0) → rn2(count)
            // des.engraving — no RNG
            // We need to simulate the postprocessor RNG: rndcoord on all floor tiles
            // C ref: selection.negate() selects ALL map tiles, then filter_mapchar(".")
            // filters to ROOM type. Then rndcoord(0) picks one.
            // Count all ROOM tiles on the entire level for the negate+filter
            let floorCount = 0;
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    const loc = map.at(x, y);
                    if (loc && loc.typ === ROOM) floorCount++;
                }
            }
            if (floorCount > 0) {
                rn2(floorCount); // rndcoord(0) on all floor tiles
            }
            break;
        }
        case 'buried_zombies': {
            // C ref: themerms.lua "Buried zombies"
            const diff = depth;
            const zombifiable = ['kobold', 'gnome', 'orc', 'dwarf'];
            if (diff > 3) {
                zombifiable.push('elf', 'human');
                if (diff > 6) {
                    zombifiable.push('ettin', 'giant');
                }
            }
            const count = Math.floor((w * h) / 2);
            for (let i = 0; i < count; i++) {
                shuffleArray(zombifiable);
                des_object_corpse_named(map, room, zombifiable[0], true);
                rn2(21); // math.random(990, 1010)
            }
            break;
        }
        case 'massacre': {
            // C ref: themerms.lua "Massacre"
            // 27 monster names, math.random(#mon) → rn2(27), d(5,5) corpses
            const monNames = [
                'apprentice', 'warrior', 'ninja', 'thug',
                'hunter', 'acolyte', 'abbot', 'page',
                'attendant', 'neanderthal', 'chieftain',
                'student', 'wizard', 'valkyrie', 'tourist',
                'samurai', 'rogue', 'ranger', 'priestess',
                'priest', 'monk', 'knight', 'healer',
                'cavewoman', 'caveman', 'barbarian',
                'archeologist',
            ];
            let idx = rn2(monNames.length); // math.random(#mon) → rn2(27)
            // d(5,5) = 5 × math.random(1,5) = 5 × (rn2(5) + 1)
            const corpseCount = (rn2(5)+1) + (rn2(5)+1) + (rn2(5)+1) + (rn2(5)+1) + (rn2(5)+1);
            for (let i = 0; i < corpseCount; i++) {
                if (rn2(100) < 10) { // percent(10)
                    idx = rn2(monNames.length); // re-pick
                }
                // des.object({ id="corpse", montype=mon[idx] })
                // Look up the montype by name for set_corpsenm
                const mndx = monNameToIndex(monNames[idx]);
                des_object_corpse_named(map, room, mndx, false);
            }
            break;
        }
        case 'statuary': {
            // C ref: themerms.lua "Statuary"
            // for i = 1, d(5,5): des.object({ id = "statue" })
            const statueCount = (rn2(5)+1) + (rn2(5)+1) + (rn2(5)+1) + (rn2(5)+1) + (rn2(5)+1);
            for (let i = 0; i < statueCount; i++) {
                des_object_named(map, room, 'statue');
            }
            // for i = 1, d(3): des.trap("statue")
            // d(3) with single arg = math.random(1, 3) = rn2(3) + 1
            const trapCount = rn2(3) + 1;
            for (let i = 0; i < trapCount; i++) {
                des_trap(map, room, STATUE_TRAP, { depth });
            }
            break;
        }
        case 'light_source': {
            // C ref: themerms.lua "Light source" (needsUnlit)
            // des.object({ id = "oil lamp", lit = true })
            des_object_named(map, room, 'oil lamp', { lit: true });
            break;
        }
        case 'temple': {
            // C ref: themerms.lua "Temple of the gods"
            // 3 altars with explicit alignment — uses get_free_room_loc
            // des.altar({ align = align[1/2/3] })
            // align[] was shuffled at nhlib.lua load time (global, 3 rn2 calls)
            // but that shuffle is NOT per-fill — it's at Lua state init.
            // For themeroom fills, each altar just does get_free_room_loc.
            for (let i = 0; i < 3; i++) {
                des_altar(map, room, i);
            }
            break;
        }
        case 'ghost': {
            // C ref: themerms.lua "Ghost of an Adventurer"
            // local loc = selection.room():rndcoord(0)
            const sel = selectionRoom(map, room);
            const loc = selectionRndcoord(sel, 0);
            // des.monster({ id="ghost", asleep=true, waiting=true, coord=loc })
            des_monster_named(map, room, 'ghost', depth, { atCoord: true });
            // 6 percent checks with conditional object creation
            // percent(65) → dagger at coord, buc="not-blessed"
            if (rn2(100) < 65) {
                des_object_named(map, room, 'dagger', { atCoord: true });
            }
            // percent(55) → class ")" at coord, buc="not-blessed"
            if (rn2(100) < 55) {
                des_object_class_char(map, room, ')', { atCoord: true });
            }
            // percent(45) → bow + arrow at coord, buc="not-blessed"
            if (rn2(100) < 45) {
                des_object_named(map, room, 'bow', { atCoord: true });
                des_object_named(map, room, 'arrow', { atCoord: true });
            }
            // percent(65) → class "[" at coord, buc="not-blessed"
            if (rn2(100) < 65) {
                des_object_class_char(map, room, '[', { atCoord: true });
            }
            // percent(20) → class "=" at coord, buc="not-blessed"
            if (rn2(100) < 20) {
                des_object_class_char(map, room, '=', { atCoord: true });
            }
            // percent(20) → class "?" at coord, buc="not-blessed"
            if (rn2(100) < 20) {
                des_object_class_char(map, room, '?', { atCoord: true });
            }
            break;
        }
        case 'storeroom': {
            // C ref: themerms.lua "Storeroom"
            // selection.room():percentage(30) → iterate:
            //   percent(25) ? des.object("chest") : des.monster(class="m", appear_as="obj:chest")
            const sel = selectionRoom(map, room);
            const locs = selectionPercentage(sel, 30);
            selectionIterate(locs, (x, y) => {
                if (rn2(100) < 25) { // percent(25)
                    // des.object("chest") — named object, no coord (random pos)
                    // But we're iterating selected points, so the Lua passes no coord
                    // to des.object — it uses random room position
                    des_object_named(map, room, 'chest');
                } else {
                    // des.monster({ class="m", appear_as="obj:chest" })
                    des_monster_class(map, room, 'm', depth);
                }
            });
            break;
        }
        case 'teleport': {
            // C ref: themerms.lua "Teleportation hub"
            // local locs = selection.room():filter_mapchar(".")
            const sel = selectionRoom(map, room);
            const floorLocs = selectionFilterMapchar(map, sel, '.');
            // for i = 1, 2 + nh.rn2(3):
            const count = 2 + rn2(3);
            for (let i = 0; i < count; i++) {
                // local pos = locs:rndcoord(1) — remove=true
                const pos = selectionRndcoord(floorLocs, 1);
                // Postprocessor stored but no immediate RNG
                // pos.x/y adjusted by region offset — no RNG
            }
            // Postprocessors: make_a_trap for each stored position
            // make_a_trap: selection.negate():filter_mapchar(".") → no RNG
            //   repeat rndcoord(1) until dest != coord → rn2(count) per attempt
            // For each trap position, simulate make_a_trap postprocessor
            // Count all ROOM tiles on level for the negate+filter selection
            let totalFloor = 0;
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    const loc = map.at(x, y);
                    if (loc && loc.typ === ROOM) totalFloor++;
                }
            }
            // Each make_a_trap: repeat rndcoord(1) until teledest != coord
            // Typically 1-2 attempts. Each attempt: rn2(remaining_count).
            for (let i = 0; i < count; i++) {
                if (totalFloor > 0) {
                    // At least one rndcoord call; may need more if dest == coord
                    rn2(totalFloor);
                    totalFloor--;
                    // Rarely needs retry (only if same position picked)
                    // For RNG alignment, simulate the typical single-attempt case
                }
            }
            break;
        }
    }
}

// ========================================================================
// Themeroom pick handlers for des.room() themerooms (picks 0-10)
// Each handler returns true if room was created, false if creation failed.
// rn2(100) is consumed at the position matching C's build_room call.
// Pre-room RNG (for picks 3, 4, 9, 10) comes before rn2(100).
// C ref: themerms.lua themerooms array entries
// ========================================================================

function themeroom_pick1_fakeDelphi(map, depth) {
    // C ref: themerms.lua "Fake Delphi" (Lua index 2)
    // Outer 11×9 room with inner 3×3 sub-room at (4,3) + random door
    rn2(100); // build_room chance check (outer)
    if (!create_room(map, -1, -1, 11, 9, -1, -1, OROOM, -1, depth, true))
        return false;
    const outer = map.rooms[map.nroom - 1];
    outer.needfill = FILL_NORMAL;
    rn2(100); // build_room chance check (inner des.room)
    const inner = create_subroom(map, outer, 4, 3, 3, 3, OROOM, -1, depth);
    if (inner) {
        inner.needfill = FILL_NORMAL;
        des_door_random(map, inner);
    }
    return true;
}

function themeroom_pick2_roomInRoom(map, depth) {
    // C ref: themerms.lua "Room in a room" (Lua index 3)
    // Random outer room with random inner sub-room + random door
    rn2(100); // build_room chance check (outer)
    if (!create_room(map, -1, -1, -1, -1, -1, -1, OROOM, -1, depth, true))
        return false;
    const outer = map.rooms[map.nroom - 1];
    outer.needfill = FILL_NORMAL;
    rn2(100); // build_room chance check (inner des.room)
    const inner = create_subroom(map, outer, -1, -1, -1, -1, OROOM, -1, depth);
    if (inner) {
        // No filled=1 on inner room in Lua → FILL_NONE (default)
        des_door_random(map, inner);
    }
    return true;
}

function themeroom_pick3_hugeRoom(map, depth) {
    // C ref: themerms.lua "Huge room" (Lua index 4)
    // Pre-room RNG: nh.rn2(10), nh.rn2(5) for dimensions
    const wid = rn2(10);
    const hei = rn2(5);
    rn2(100);
    if (!create_room(map, -1, -1, 11 + wid, 8 + hei, -1, -1, OROOM, -1, depth, true))
        return false;
    const outer = map.rooms[map.nroom - 1];
    outer.needfill = FILL_NORMAL;
    if (rn2(100) < 90) { // percent(90)
        rn2(100); // build_room chance check (inner des.room)
        const inner = create_subroom(map, outer, -1, -1, -1, -1, OROOM, -1, depth);
        if (inner) {
            inner.needfill = FILL_NORMAL;
            des_door_random(map, inner);
            if (rn2(100) < 50) { // percent(50)
                des_door_random(map, inner);
            }
        }
    }
    return true;
}

function themeroom_pick4_nestingRooms(map, depth) {
    // C ref: themerms.lua "Nesting rooms" (Lua index 5)
    // Pre-room RNG: nh.rn2(4) × 2 for outer dimensions
    const outerW = rn2(4);
    const outerH = rn2(4);
    rn2(100);
    if (!create_room(map, -1, -1, 9 + outerW, 9 + outerH, -1, -1, OROOM, -1, depth, true))
        return false;
    const outer = map.rooms[map.nroom - 1];
    outer.needfill = FILL_NORMAL;
    // Middle room: math.random(floor(W/2), W-2) = floor(W/2) + rn2(W-2 - floor(W/2) + 1)
    const oW = outer.hx - outer.lx + 1;
    const oH = outer.hy - outer.ly + 1;
    const midW = Math.floor(oW / 2) + rn2(oW - 2 - Math.floor(oW / 2) + 1);
    const midH = Math.floor(oH / 2) + rn2(oH - 2 - Math.floor(oH / 2) + 1);
    rn2(100); // build_room chance check (middle des.room)
    const middle = create_subroom(map, outer, -1, -1, midW, midH, OROOM, -1, depth);
    if (middle) {
        middle.needfill = FILL_NORMAL;
        // In Lua: innermost room created first, then middle's doors
        if (rn2(100) < 90) { // percent(90)
            rn2(100); // build_room chance check (innermost des.room)
            const innermost = create_subroom(map, middle, -1, -1, -1, -1, OROOM, -1, depth);
            if (innermost) {
                innermost.needfill = FILL_NORMAL;
                des_door_random(map, innermost);
                if (rn2(100) < 15) des_door_random(map, innermost); // percent(15)
            }
        }
        des_door_random(map, middle);
        if (rn2(100) < 15) des_door_random(map, middle); // percent(15)
    }
    return true;
}

function themeroom_pick8_pillars(map, depth) {
    // C ref: themerms.lua "Pillars" (Lua index 9)
    // 10×10 room with 4 2×2 terrain pillars from shuffled array
    rn2(100);
    if (!create_room(map, -1, -1, 10, 10, -1, -1, THEMEROOM, -1, depth, true))
        return false;
    const room = map.rooms[map.nroom - 1];
    room.needfill = FILL_NORMAL;
    // Lua: { "-", "-", "-", "-", "L", "P", "T" }
    // → [HWALL, HWALL, HWALL, HWALL, LAVAPOOL, POOL, TREE]
    const terrains = [HWALL, HWALL, HWALL, HWALL, LAVAPOOL, POOL, TREE];
    shuffleArray(terrains); // 6 rn2 calls
    const pillarTyp = terrains[0];
    // Place 2×2 pillar blocks at grid positions
    for (let px = 0; px <= 1; px++) {
        for (let py = 0; py <= 1; py++) {
            const bx = room.lx + px * 4 + 2;
            const by = room.ly + py * 4 + 2;
            for (let dx = 0; dx <= 1; dx++) {
                for (let dy = 0; dy <= 1; dy++) {
                    const loc = map.at(bx + dx, by + dy);
                    if (loc) loc.typ = pillarTyp;
                }
            }
        }
    }
    return true;
}

function themeroom_pick9_mausoleum(map, depth) {
    // C ref: themerms.lua "Mausoleum" (Lua index 10)
    // Pre-room RNG: nh.rn2(3) × 2 for dimensions
    const w = rn2(3);
    const h = rn2(3);
    rn2(100);
    if (!create_room(map, -1, -1, 5 + w * 2, 5 + h * 2, -1, -1, THEMEROOM, -1, depth, true))
        return false;
    const outer = map.rooms[map.nroom - 1];
    outer.needfill = FILL_NORMAL;
    // Inner 1×1 sub-room at center
    const oW = outer.hx - outer.lx + 1;
    const oH = outer.hy - outer.ly + 1;
    const cx = Math.floor((oW - 1) / 2);
    const cy = Math.floor((oH - 1) / 2);
    // C: des.room calls build_room which consumes rn2(100) but room is created regardless
    // The build check may affect internal properties but doesn't gate creation
    rn2(100);
    const inner = create_subroom(map, outer, cx, cy, 1, 1, THEMEROOM, -1, depth);
    if (inner) {
        inner.needfill = FILL_NORMAL;
        inner.needjoining = false;
        if (rn2(100) < 50) { // percent(50) — monster
            const monClasses = ['M', 'V', 'L', 'Z']; // mummy, vampire, lich, zombie
            shuffleArray(monClasses); // 3 rn2 calls
            des_monster_class(map, inner, monClasses[0], depth, { atCoord: true });
        } else {
            // des.object({ id="corpse", montype="@", coord={0,0} })
            des_object_corpse_class(map, inner, '@');
        }
        if (rn2(100) < 20) { // percent(20) — secret door
            des_door_secret(map, inner);
        }
    }
    return true;
}

function themeroom_pick10_randomFeature(map, depth) {
    // C ref: themerms.lua "Random dungeon feature" (Lua index 11)
    // Pre-room RNG: nh.rn2(3) × 2 for dimensions (always odd)
    const wid = 3 + rn2(3) * 2;
    const hei = 3 + rn2(3) * 2;
    rn2(100);
    if (!create_room(map, -1, -1, wid, hei, -1, -1, OROOM, -1, depth, true))
        return false;
    const room = map.rooms[map.nroom - 1];
    room.needfill = FILL_NORMAL;
    // Lua: { "C", "L", "I", "P", "T" } → [CLOUD, LAVAPOOL, ICE, POOL, TREE]
    const features = [CLOUD, LAVAPOOL, ICE, POOL, TREE];
    shuffleArray(features); // 4 rn2 calls
    // Place single terrain tile at room center
    const cx = room.lx + Math.floor((room.hx - room.lx) / 2);
    const cy = room.ly + Math.floor((room.hy - room.ly) / 2);
    const loc = map.at(cx, cy);
    if (loc) loc.typ = features[0];
    return true;
}

// C ref: themerms.lua "default" — des.room({ type="ordinary", filled=1 })
// C ref: sp_lev.c build_room() consumes rn2(100) but room is created regardless
function themeroom_default(map, depth) {
    // The rn2(100) is for build probability, but room is created anyway
    // It may affect room properties or be used for statistics
    rn2(100);

    if (!create_room(map, -1, -1, -1, -1, -1, -1, OROOM, -1, depth, true))
        return false;
    map.rooms[map.nroom - 1].needfill = FILL_NORMAL;
    return true;
}

// C ref: themerms.lua picks 5-7 — des.room({ type="themed", ... })
// with themeroom_fill callback. Pick 6 is dark (lit=0).
// Only pick 7 has filled=1; picks 5 and 6 default to filled=0 in C
// (gi.in_mk_themerooms makes the default 0 in lspo_room).
function themeroom_desroom_fill(map, pick, depth) {
    rn2(100);
    const rlit = (pick === 6) ? 0 : -1;  // pick 6: lit=0 (dark); picks 5,7: random
    if (!create_room(map, -1, -1, -1, -1, -1, -1, OROOM, rlit, depth, true))
        return false;
    const room = map.rooms[map.nroom - 1];
    if (pick === 7) {
        room.needfill = FILL_NORMAL;
    }
    room.rtype = THEMEROOM;
    const forceLit = (pick === 6) ? false : undefined;
    simulateThemeroomFill(map, room, depth, forceLit);
    return true;
}

// ========================================================================
// themerooms_generate() — main entry point
// C ref: themerms.lua themerooms_generate()
// Reservoir sampling + dispatch to picked themeroom's contents callback.
// ========================================================================

// C ref: themerooms.lua — themerooms_generate calls rn2 with these args.
// Each cumulative frequency corresponds to a themeroom entry:
//   [0]=default(1000), [1]=FakeDelphi(+1), [2]=RoomInRoom(+1),
//   [3]=NestingRooms(+1), [4]=Pillars(+1), [5]=ThemedFill(+6),
//   [6]=UnlitThemedFill(+2), [7]=NormalAndThemedFill(+2), [8..29]=various(+1 each)
const THEMEROOM_ARGS = [
    1000, 1001, 1002, 1003, 1004, 1010, 1012, 1014,
    1015, 1016, 1017, 1018, 1019, 1020, 1021, 1022,
    1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030,
    1031, 1032, 1033, 1034, 1035, 1036
];

export function themerooms_generate(map, depth) {
    // Reservoir sampling
    let pick = 0;
    let prevFreq = 0;
    for (let i = 0; i < THEMEROOM_ARGS.length; i++) {
        const cumFreq = THEMEROOM_ARGS[i];
        const thisFreq = cumFreq - prevFreq;
        const val = rn2(cumFreq);
        if (thisFreq > 0 && val < thisFreq) {
            pick = i;
        }
        prevFreq = cumFreq;
    }

    // C ref: themerooms[pick].contents()
    switch (pick) {
        case 0:  return themeroom_default(map, depth);
        case 1:  return themeroom_pick1_fakeDelphi(map, depth);
        case 2:  return themeroom_pick2_roomInRoom(map, depth);
        case 3:  return themeroom_pick3_hugeRoom(map, depth);
        case 4:  return themeroom_pick4_nestingRooms(map, depth);
        case 5: case 6: case 7:
            return themeroom_desroom_fill(map, pick, depth);
        case 8:  return themeroom_pick8_pillars(map, depth);
        case 9:  return themeroom_pick9_mausoleum(map, depth);
        case 10: return themeroom_pick10_randomFeature(map, depth);
        default: // picks 11-29: des.map() themerooms
            return placeMapThemeroom(map, pick, depth);
    }
}
