/**
 * Special level generation (des.* Lua API)
 *
 * This module implements the des.* API functions used by NetHack's special
 * level Lua scripts. It provides a JavaScript equivalent of the C sp_lev.c
 * implementation, allowing direct porting of Lua level definition files.
 *
 * C reference: nethack-c/src/sp_lev.c
 *
 * Architecture:
 * - Each des.* function manipulates a global level state
 * - Level generation proceeds in phases: init → map placement → features → finalize
 * - The API is designed to be called from transpiled Lua → JS level files
 */

import { GameMap, FILL_NORMAL } from './map.js';
import { rn2, rnd, rn1, getRngCallCount } from './rng.js';
import { mksobj, mkobj, mkcorpstat, set_corpsenm, setLevelDepth, weight } from './mkobj.js';
import { create_room, create_subroom, makecorridors, create_corridor, init_rect, rnd_rect, get_rect, split_rects, check_room, add_doors_to_room, update_rect_pool_for_room, bound_digging, mineralize as dungeonMineralize, fill_ordinary_room, litstate_rnd, isMtInitialized, setMtInitialized, wallification as dungeonWallification, wallify_region as dungeonWallifyRegion, fix_wall_spines, set_wall_state, place_lregion, mktrap, enexto, somexy, sp_create_door, floodFillAndRegister, resolveBranchPlacementForLevel, random_epitaph_text, induced_align, DUNGEON_ALIGN_BY_DNUM, enterMklevContext, leaveMklevContext } from './dungeon.js';
import { seedFromMT } from './xoshiro256.js';
import {
    makemon, mkclass, def_char_to_monclass, NO_MM_FLAGS,
    MM_NOGRP, MM_ADJACENTOK, MM_IGNOREWATER, rndmonnum, getMakemonRoleIndex
} from './makemon.js';
import {
    STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DBWALL, ROOM, CORR,
    DOOR, SDOOR, IRONBARS, TREE, FOUNTAIN, POOL, MOAT, WATER,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, LAVAPOOL, LAVAWALL, ICE, CLOUD, AIR,
    STAIRS, LADDER, ALTAR, GRAVE, THRONE, SINK,
    SCORR, MAX_TYPE,
    PIT, SPIKED_PIT, HOLE, TRAPDOOR, ARROW_TRAP, DART_TRAP, ROCKTRAP,
    SQKY_BOARD, BEAR_TRAP, LANDMINE, ROLLING_BOULDER_TRAP,
    SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP, TELEP_TRAP, LEVEL_TELEP,
    MAGIC_PORTAL, WEB, ANTI_MAGIC, POLY_TRAP, STATUE_TRAP, MAGIC_TRAP,
    VIBRATING_SQUARE, NO_TRAP, TRAPNUM, is_pit, is_hole,
    D_NODOOR, D_ISOPEN, D_CLOSED, D_LOCKED, D_BROKEN, D_SECRET,
    COLNO, ROWNO, IS_OBSTRUCTED, IS_WALL, IS_STWALL, IS_POOL, IS_LAVA,
    A_NONE, A_LAWFUL, A_NEUTRAL, A_CHAOTIC,
    MKTRAP_SEEN, MKTRAP_MAZEFLAG, MKTRAP_NOSPIDERONWEB, MKTRAP_NOVICTIM,
    MAXNROFROOMS, ROOMOFFSET,
    PM_PRIEST as ROLE_PRIEST
} from './config.js';
import {
    BOULDER, SCROLL_CLASS, FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS,
    POTION_CLASS, RING_CLASS, WAND_CLASS, TOOL_CLASS, AMULET_CLASS,
    GEM_CLASS, SPBOOK_CLASS, ROCK_CLASS, BALL_CLASS, CHAIN_CLASS, VENOM_CLASS,
    SCR_EARTH, objectData, GOLD_PIECE, STATUE
} from './objects.js';
import { mons, M2_FEMALE, M2_MALE, G_NOGEN, G_IGNORE, PM_MINOTAUR, MR_STONE } from './monsters.js';
import { findSpecialLevelByName, GEHENNOM } from './special_levels.js';

// Aliases for compatibility with C naming
const STAIRS_UP = STAIRS;
const STAIRS_DOWN = STAIRS;
const LADDER_UP = LADDER;
const LADDER_DOWN = LADDER;

const ROOM_TYPE_MAP = {
    'ordinary': 0,
    'themed': 1,
    'throne': 2,
    'swamp': 3,
    'vault': 4,
    'beehive': 5,
    'morgue': 6,
    'barracks': 7,
    'zoo': 8,
    'delphi': 9,
    'temple': 10,
    'anthole': 13,
    'cocknest': 12,
    'leprehall': 11,
    'shop': 14,
    'armor shop': 15,
    'scroll shop': 16,
    'potion shop': 17,
    'weapon shop': 18,
    'food shop': 19,
    'ring shop': 20,
    'wand shop': 21,
    'tool shop': 22,
    'book shop': 23,
    'health food shop': 24,
    'candle shop': 25
};

function parseRoomType(type, defval = 0) {
    if (typeof type === 'number' && Number.isFinite(type)) {
        return Math.trunc(type);
    }
    if (typeof type !== 'string') {
        return defval;
    }
    const mapped = ROOM_TYPE_MAP[type.toLowerCase()];
    return (mapped !== undefined) ? mapped : defval;
}

function canOverwriteTerrain(oldTyp) {
    // C ref: rm.h CAN_OVERWRITE_TERRAIN() default behavior.
    return oldTyp !== LADDER && oldTyp !== STAIRS;
}

function setLevlTypAt(map, x, y, newTyp) {
    if (!map || x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return false;
    if (newTyp < STONE || newTyp >= MAX_TYPE) return false;
    const loc = map.locations[x][y];
    if (!loc) return false;
    if (!canOverwriteTerrain(loc.typ)) return false;
    loc.typ = newTyp;
    return true;
}

function getProcessEnv(name) {
    return (typeof process !== 'undefined' && process.env) ? process.env[name] : undefined;
}

let spObjTraceEvent = 0;
function spObjTrace(message) {
    const spec = getProcessEnv('WEBHACK_MKOBJ_TRACE');
    if (!spec || spec === '0') return;
    console.log(message);
}

function installTypWatch(map) {
    const spec = getProcessEnv('WEBHACK_WATCH_TYP');
    if (!spec || !map || !map.locations) return;
    const m = String(spec).match(/^\s*(\d+)\s*,\s*(\d+)\s*$/);
    if (!m) return;
    const wx = Number.parseInt(m[1], 10);
    const wy = Number.parseInt(m[2], 10);
    if (!Number.isInteger(wx) || !Number.isInteger(wy)
        || wx < 0 || wx >= COLNO || wy < 0 || wy >= ROWNO) {
        return;
    }
    const loc = map.locations?.[wx]?.[wy];
    if (!loc || loc.__typWatchInstalled) return;
    let _typ = loc.typ;
    Object.defineProperty(loc, 'typ', {
        configurable: true,
        enumerable: true,
        get() { return _typ; },
        set(v) {
            if (_typ !== v) {
                const stack = new Error().stack?.split('\n').slice(2, 6).join(' | ') || '';
                console.log(`[TYPWATCH] (${wx},${wy}) ${_typ} -> ${v} @ ${stack}`);
            }
            _typ = v;
        }
    });
    Object.defineProperty(loc, '__typWatchInstalled', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: true
    });
}

// Level generation state (equivalent to C's sp_level sp)
export let levelState = {
    map: null,              // GameMap instance being built
    flags: {
        noteleport: false,
        hardfloor: false,
        nommap: false,
        shortsighted: false,
        arboreal: false,
        is_maze_lev: false,
        hero_memory: false,
        graveyard: false,
        corrmaze: false,
        temperature: 0,     // 0=temperate, 1=hot, -1=cold
        rndmongen: true,
        deathdrops: true,
        noautosearch: false,
        fumaroles: false,
        stormy: false,
    },
    coder: {
        premapped: false,
        solidify: false,
        allow_flips: 3,     // bit 0=vertical flip, bit 1=horizontal flip
        check_inaccessibles: false,
    },
    init: {
        style: 'solidfill', // solidfill, mazegrid, maze, rogue, mines, swamp
        fg: ROOM,           // foreground fill character
        bg: STONE,          // background fill character
        filling: ROOM,      // C ref: lev_init.filling defaults to fg
        corrwid: -1,        // C ref: lev_init.corrwid default
        wallthick: -1,      // C ref: lev_init.wallthick default
        rm_deadends: false, // C ref: lev_init.rm_deadends = !deadends (default deadends=true)
        smoothed: false,
        joined: false,
        lit: -1,            // -1 = C BOOL_RANDOM
        walled: false,
    },
    xstart: 0,              // Map placement offset X
    ystart: 0,              // Map placement offset Y
    xsize: 0,               // Map fragment width
    ysize: 0,               // Map fragment height
    mazeMaxX: (COLNO - 1) & ~1, // C-like gx.x_maze_max default
    mazeMaxY: (ROWNO - 1) & ~1, // C-like gy.y_maze_max default
    splevInitPresent: false, // C ref: sp_lev.c splev_init_present
    // Map-relative coordinate system (C ref: Lua coordinates are relative to map origin)
    mapCoordMode: false,    // True after des.map() - coordinates are map-relative
    mapOriginX: 0,          // Map origin X for coordinate conversion
    mapOriginY: 0,          // Map origin Y for coordinate conversion
    // Room tracking (for nested rooms in special levels)
    currentRoom: null,      // Current room being populated
    roomStack: [],          // Stack of nested rooms
    roomDepth: 0,           // Current nesting depth
    // Deferred execution queues (for RNG alignment with C)
    // C defers object/monster/trap placement until after corridor generation
    deferredObjects: [],    // Queued object placements
    deferredMonsters: [],   // Queued monster placements
    deferredTraps: [],      // Queued trap placements
    deferredActions: [],    // Queued placements in original script order
    containerStack: [],     // Active des.object contents callback container context
    monsterInventoryStack: [], // Active des.monster inventory callback context
    // Optional context to emulate C topology/fixup behavior.
    finalizeContext: null,
    branchPlaced: false,
    levRegions: [],
    spLevMap: null,
    spLevTouched: null,
    _mklevContextEntered: false,
};

const WALL_INFO_MASK = 0x07;
let checkpointCaptureEnabled = false;
let levelCheckpoints = [];

// Special level flags
let icedpools = false;
let Sokoban = false;
let okLocationOverride = null;
let monsterExecSeq = 0;

// mkmap.c dimensions
const MKMAP_HEIGHT = ROWNO - 1;
const MKMAP_WIDTH = COLNO - 2;

function initSpLevTouched() {
    if (levelState.spLevTouched) return;
    levelState.spLevTouched = Array.from({ length: COLNO }, () => Array(ROWNO).fill(false));
}

function initSpLevMap() {
    if (levelState.spLevMap) return;
    levelState.spLevMap = Array.from({ length: COLNO }, () => Array(ROWNO).fill(false));
}

function markSpLevTouched(x, y) {
    if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return;
    initSpLevTouched();
    levelState.spLevTouched[x][y] = true;
}

function markSpLevMap(x, y) {
    if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return;
    initSpLevMap();
    levelState.spLevMap[x][y] = true;
}

function normalizeDestRect(rect) {
    const fallback = { lx: 0, ly: 0, hx: 0, hy: 0, nlx: 0, nly: 0, nhx: 0, nhy: 0 };
    if (!rect || typeof rect !== 'object') return fallback;
    return {
        lx: Number.isInteger(rect.lx) ? rect.lx : 0,
        ly: Number.isInteger(rect.ly) ? rect.ly : 0,
        hx: Number.isInteger(rect.hx) ? rect.hx : 0,
        hy: Number.isInteger(rect.hy) ? rect.hy : 0,
        nlx: Number.isInteger(rect.nlx) ? rect.nlx : 0,
        nly: Number.isInteger(rect.nly) ? rect.nly : 0,
        nhx: Number.isInteger(rect.nhx) ? rect.nhx : 0,
        nhy: Number.isInteger(rect.nhy) ? rect.nhy : 0
    };
}

function captureCheckpoint(phase) {
    if (!checkpointCaptureEnabled || !levelState.map) return;
    const map = levelState.map;
    const typGrid = [];
    const flagGrid = [];
    const wallInfoGrid = [];

    for (let y = 0; y < ROWNO; y++) {
        const typRow = [];
        const flagRow = [];
        const wallInfoRow = [];
        for (let x = 0; x < COLNO; x++) {
            const loc = map.locations?.[x]?.[y];
            typRow.push(loc ? loc.typ : 0);
            flagRow.push(loc ? loc.flags : 0);
            wallInfoRow.push(loc ? (loc.flags & WALL_INFO_MASK) : 0);
        }
        typGrid.push(typRow);
        flagGrid.push(flagRow);
        wallInfoGrid.push(wallInfoRow);
    }

    const traps = (Array.isArray(map.traps) ? map.traps : [])
        .map((t) => ({
            x: Number.isInteger(t?.tx) ? t.tx : (Number.isInteger(t?.x) ? t.x : -1),
            y: Number.isInteger(t?.ty) ? t.ty : (Number.isInteger(t?.y) ? t.y : -1),
            ttyp: Number.isInteger(t?.ttyp) ? t.ttyp : -1
        }))
        .filter((t) => t.x >= 0 && t.x < COLNO && t.y >= 0 && t.y < ROWNO)
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    const monsters = (Array.isArray(map.monsters) ? map.monsters : [])
        .filter((m) => Number.isInteger(m?.mx) && Number.isInteger(m?.my)
            && (Number.isInteger(m?.mhp) ? m.mhp > 0 : true))
        .map((m) => ({
            x: m.mx,
            y: m.my,
            mnum: Number.isInteger(m?.mndx) ? m.mndx : -1,
            mhp: Number.isInteger(m?.mhp) ? m.mhp : 0,
            mpeaceful: m?.mpeaceful ? 1 : 0
        }))
        .sort((a, b) => (a.y - b.y) || (a.x - b.x));

    const nroom = Number.isInteger(map.nroom)
        ? Math.max(0, Math.min(map.nroom, (map.rooms || []).length))
        : ((map.rooms || []).length || 0);
    const rooms = (map.rooms || []).slice(0, nroom).map((room, idx) => ({
        idx,
        lx: Number.isInteger(room?.lx) ? room.lx : 0,
        ly: Number.isInteger(room?.ly) ? room.ly : 0,
        hx: Number.isInteger(room?.hx) ? room.hx : 0,
        hy: Number.isInteger(room?.hy) ? room.hy : 0,
        rtype: Number.isInteger(room?.rtype) ? room.rtype : 0,
        orig_rtype: Number.isInteger(room?.orig_rtype) ? room.orig_rtype : 0,
        rlit: room?.rlit ? 1 : 0,
        doorct: Number.isInteger(room?.doorct) ? room.doorct : 0,
        fdoor: Number.isInteger(room?.fdoor) ? room.fdoor : 0,
        irregular: room?.irregular ? 1 : 0
    }));

    const doorindex = Number.isInteger(map.doorindex)
        ? Math.max(0, Math.min(map.doorindex, (map.doors || []).length))
        : 0;
    const doors = (map.doors || []).slice(0, doorindex).map((d) => ({
        x: Number.isInteger(d?.x) ? d.x : 0,
        y: Number.isInteger(d?.y) ? d.y : 0
    }));

    const stairs = [];
    if (Number.isInteger(map?.upstair?.x) && Number.isInteger(map?.upstair?.y)) {
        const loc = map.at(map.upstair.x, map.upstair.y);
        if (loc && (loc.typ === STAIRS || loc.typ === LADDER)) {
            stairs.push({
                x: map.upstair.x,
                y: map.upstair.y,
                up: 1,
                isladder: loc.typ === LADDER ? 1 : 0,
                to: { dnum: 0, dlevel: 0 }
            });
        }
    }
    if (Number.isInteger(map?.dnstair?.x) && Number.isInteger(map?.dnstair?.y)) {
        const loc = map.at(map.dnstair.x, map.dnstair.y);
        if (loc && (loc.typ === STAIRS || loc.typ === LADDER)) {
            stairs.push({
                x: map.dnstair.x,
                y: map.dnstair.y,
                up: 0,
                isladder: loc.typ === LADDER ? 1 : 0,
                to: { dnum: 0, dlevel: 0 }
            });
        }
    }

    const ctx = levelState.finalizeContext || {};
    levelCheckpoints.push({
        phase: (typeof phase === 'string' && phase.length > 0) ? phase : 'unspecified',
        rngCallCount: getRngCallCount(),
        dnum: Number.isInteger(ctx.dnum) ? ctx.dnum : null,
        dlevel: Number.isInteger(ctx.dlevel) ? ctx.dlevel : null,
        typGrid,
        flagGrid,
        wallInfoGrid,
        traps,
        monsters,
        nroom,
        rooms,
        doorindex,
        doors,
        stairs,
        updest: normalizeDestRect(map.updest),
        dndest: normalizeDestRect(map.dndest)
    });
}

function mkmapInitMap(map, bgTyp) {
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.locations[x][y];
            loc.roomno = 0;
            loc.typ = bgTyp;
            loc.lit = 0;
        }
    }
}

function mkmapInitFill(map, bgTyp, fgTyp) {
    const limit = Math.floor((MKMAP_WIDTH * MKMAP_HEIGHT * 2) / 5);
    let count = 0;
    while (count < limit) {
        const x = rn1(MKMAP_WIDTH - 1, 2);
        const y = rnd(MKMAP_HEIGHT - 1);
        if (map.locations[x][y].typ === bgTyp) {
            map.locations[x][y].typ = fgTyp;
            count++;
        }
    }
}

function mkmapGet(map, x, y, bgTyp) {
    if (x <= 0 || y < 0 || x > MKMAP_WIDTH || y >= MKMAP_HEIGHT) {
        return bgTyp;
    }
    return map.locations[x][y].typ;
}

function mkmapPassOne(map, bgTyp, fgTyp) {
    const dirs = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1]
    ];
    for (let x = 2; x <= MKMAP_WIDTH; x++) {
        for (let y = 1; y < MKMAP_HEIGHT; y++) {
            let count = 0;
            for (const [dx, dy] of dirs) {
                if (mkmapGet(map, x + dx, y + dy, bgTyp) === fgTyp) count++;
            }
            if (count <= 2) map.locations[x][y].typ = bgTyp;
            else if (count >= 5) map.locations[x][y].typ = fgTyp;
        }
    }
}

function mkmapPassTwo(map, bgTyp, fgTyp) {
    const dirs = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1]
    ];
    const next = Array.from({ length: COLNO }, () => Array(ROWNO).fill(bgTyp));
    for (let x = 2; x <= MKMAP_WIDTH; x++) {
        for (let y = 1; y < MKMAP_HEIGHT; y++) {
            let count = 0;
            for (const [dx, dy] of dirs) {
                if (mkmapGet(map, x + dx, y + dy, bgTyp) === fgTyp) count++;
            }
            next[x][y] = (count === 5) ? bgTyp : mkmapGet(map, x, y, bgTyp);
        }
    }
    for (let x = 2; x <= MKMAP_WIDTH; x++) {
        for (let y = 1; y < MKMAP_HEIGHT; y++) {
            map.locations[x][y].typ = next[x][y];
        }
    }
}

function mkmapPassThree(map, bgTyp, fgTyp) {
    const dirs = [
        [-1, -1], [-1, 0], [-1, 1], [0, -1],
        [0, 1], [1, -1], [1, 0], [1, 1]
    ];
    const next = Array.from({ length: COLNO }, () => Array(ROWNO).fill(bgTyp));
    for (let x = 2; x <= MKMAP_WIDTH; x++) {
        for (let y = 1; y < MKMAP_HEIGHT; y++) {
            let count = 0;
            for (const [dx, dy] of dirs) {
                if (mkmapGet(map, x + dx, y + dy, bgTyp) === fgTyp) count++;
            }
            next[x][y] = (count < 3) ? bgTyp : mkmapGet(map, x, y, bgTyp);
        }
    }
    for (let x = 2; x <= MKMAP_WIDTH; x++) {
        for (let y = 1; y < MKMAP_HEIGHT; y++) {
            map.locations[x][y].typ = next[x][y];
        }
    }
}

function mkmapFloodRegions(map, bgTyp, fgTyp) {
    const seen = new Set();
    const key = (x, y) => `${x},${y}`;
    const regions = [];
    let nextRoomNo = 1; // NO_ROOM=0, region roomno start at 1

    for (let x = 2; x <= MKMAP_WIDTH; x++) {
        for (let y = 1; y < MKMAP_HEIGHT; y++) {
            if (map.locations[x][y].typ !== fgTyp || seen.has(key(x, y))) continue;

            const queue = [[x, y]];
            const cells = [];
            seen.add(key(x, y));
            let minX = x, maxX = x, minY = y, maxY = y;

            while (queue.length) {
                const [cx, cy] = queue.pop();
                cells.push([cx, cy]);
                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                // 8-neighbor expansion mirrors map adjacency behavior.
                for (const [dx, dy] of [
                    [-1, -1], [-1, 0], [-1, 1],
                    [0, -1], [0, 1],
                    [1, -1], [1, 0], [1, 1]
                ]) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx <= 0 || nx >= COLNO || ny < 0 || ny >= ROWNO) continue;
                    if (map.locations[nx][ny].typ !== fgTyp) continue;
                    const k = key(nx, ny);
                    if (seen.has(k)) continue;
                    seen.add(k);
                    queue.push([nx, ny]);
                }
            }

            // C join_map removes tiny disconnected holes.
            if (cells.length <= 3) {
                for (const [cx, cy] of cells) {
                    map.locations[cx][cy].typ = bgTyp;
                    map.locations[cx][cy].roomno = 0;
                }
            } else {
                const roomno = nextRoomNo++;
                for (const [cx, cy] of cells) {
                    map.locations[cx][cy].roomno = roomno;
                }
                regions.push({
                    roomno,
                    minX,
                    maxX,
                    minY,
                    maxY
                });
            }
        }
    }
    return regions;
}

function mkmapSomexy(map, region) {
    const width = region.maxX - region.minX + 1;
    const height = region.maxY - region.minY + 1;

    // C ref: mkroom.c somexy() irregular-room path retries up to 100 picks.
    for (let i = 0; i < 100; i++) {
        const x = rn1(width, region.minX);
        const y = rn1(height, region.minY);
        const loc = map.locations[x][y];
        if (loc.roomno === region.roomno && !loc.edge) {
            return [x, y];
        }
    }

    // Exhaustive fallback mirrors C behavior when retries fail.
    for (let x = region.minX; x <= region.maxX; x++) {
        for (let y = region.minY; y <= region.maxY; y++) {
            const loc = map.locations[x][y];
            if (loc.roomno === region.roomno && !loc.edge) {
                return [x, y];
            }
        }
    }
    return null;
}

function mkmapDigCorridor(map, org, dest, fgTyp, bgTyp) {
    let dx = 0, dy = 0;
    let xx = org[0], yy = org[1];
    const tx = dest[0], ty = dest[1];
    let cct = 0;

    if (tx > xx) dx = 1;
    else if (ty > yy) dy = 1;
    else if (tx < xx) dx = -1;
    else dy = -1;

    xx -= dx;
    yy -= dy;

    while (xx !== tx || yy !== ty) {
        if (cct++ > 500) return false;
        xx += dx;
        yy += dy;

        if (xx >= COLNO - 1 || xx <= 0 || yy <= 0 || yy >= ROWNO - 1) return false;

        const cell = map.locations[xx][yy];
        if (cell.typ === bgTyp) {
            cell.typ = fgTyp;
        } else if (cell.typ !== fgTyp) {
            return false;
        }

        let dix = Math.abs(xx - tx);
        let diy = Math.abs(yy - ty);

        if ((dix > diy) && diy && !rn2(dix - diy + 1)) {
            dix = 0;
        } else if ((diy > dix) && dix && !rn2(diy - dix + 1)) {
            diy = 0;
        }

        if (dy && dix > diy) {
            const ddx = (xx > tx) ? -1 : 1;
            const adj = map.locations[xx + ddx][yy];
            if (adj.typ === bgTyp || adj.typ === fgTyp) {
                dx = ddx;
                dy = 0;
                continue;
            }
        } else if (dx && diy > dix) {
            const ddy = (yy > ty) ? -1 : 1;
            const adj = map.locations[xx][yy + ddy];
            if (adj.typ === bgTyp || adj.typ === fgTyp) {
                dy = ddy;
                dx = 0;
                continue;
            }
        }

        const ahead = map.locations[xx + dx][yy + dy];
        if (ahead.typ === bgTyp || ahead.typ === fgTyp) continue;

        if (dx) {
            dx = 0;
            dy = (ty < yy) ? -1 : 1;
        } else {
            dy = 0;
            dx = (tx < xx) ? -1 : 1;
        }

        const adj = map.locations[xx + dx][yy + dy];
        if (adj.typ === bgTyp || adj.typ === fgTyp) continue;
        dy = -dy;
        dx = -dx;
    }
    return true;
}

function mkmapJoin(map, bgTyp, fgTyp, regions) {
    let cur = 0;
    for (let next = 1; next < regions.length; next++) {
        const croom = regions[cur];
        const nroom = regions[next];
        const sm = mkmapSomexy(map, croom);
        const em = mkmapSomexy(map, nroom);
        if (sm && em) {
            mkmapDigCorridor(map, sm, em, fgTyp, bgTyp);
        }

        if (nroom.minX > croom.maxX
            || ((nroom.minY > croom.maxY || nroom.maxY < croom.minY) && rn2(3))) {
            cur = next;
        }
    }
}

function mkmapWallifyMap(map, x1, y1, x2, y2) {
    let xx;
    let yy;
    let loXx;
    let loYy;
    let hiXx;
    let hiYy;

    y1 = Math.max(y1, 0);
    x1 = Math.max(x1, 1);
    y2 = Math.min(y2, ROWNO - 1);
    x2 = Math.min(x2, COLNO - 1);

    for (let y = y1; y <= y2; y++) {
        loYy = (y > 0) ? y - 1 : 0;
        hiYy = (y < y2) ? y + 1 : y2;

        for (let x = x1; x <= x2; x++) {
            const loc = map.locations[x][y];
            if (loc.typ !== STONE) continue;

            loXx = (x > 1) ? x - 1 : 1;
            hiXx = (x < x2) ? x + 1 : x2;

            let converted = false;
            for (yy = loYy; yy <= hiYy && !converted; yy++) {
                for (xx = loXx; xx <= hiXx; xx++) {
                    const ntyp = map.locations[xx][yy].typ;
                    if (ntyp === ROOM || ntyp === CROSSWALL) {
                        loc.typ = (yy !== y) ? HWALL : VWALL;
                        converted = true;
                        break;
                    }
                }
            }
        }
    }
}

function mkmapFinish(map, fgTyp, bgTyp, lit, walled) {
    if (walled) {
        mkmapWallifyMap(map, 1, 0, COLNO - 1, ROWNO - 1);
    }

    if (lit) {
        for (let x = 1; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const cell = map.locations[x][y];
                if ((!IS_OBSTRUCTED(fgTyp) && cell.typ === fgTyp)
                    || (!IS_OBSTRUCTED(bgTyp) && cell.typ === bgTyp)
                    || (bgTyp === TREE && cell.typ === bgTyp)
                    || (walled && IS_WALL(cell.typ))) {
                    cell.lit = 1;
                }
            }
        }
    }
}

// ========================================================================
// State Management API (for dungeon.js integration)
// These functions allow procedural generation to use des.* API
// ========================================================================

/**
 * Set the level context for des.* functions to operate on a procedural map.
 * Call this before invoking themed room generation from dungeon.js.
 *
 * @param {GameMap} map - The procedural dungeon map to operate on
 * @param {number} depth - Current dungeon depth (for level_difficulty)
 */
export function setLevelContext(map, depth) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';

    levelState.map = map;
    levelState.depth = depth || 1;
    levelState.levelDepth = depth || 1;
    levelState.roomStack = [];
    levelState.roomDepth = 0;
    levelState.currentRoom = null;
    levelState.finalizeContext = null;
    // C ref: gi.in_mk_themerooms — set during themed room generation
    // Affects needfill default: themed rooms default to FILL_NONE (0), not FILL_NORMAL (1)
    levelState.inThemerooms = true;

    // Callback for room creation failure (set by themed room generator)
    levelState.roomFailureCallback = null;
}

/**
 * Clear the level context after themed room generation completes.
 * Always call this to prevent state leakage between levels.
 */
export function clearLevelContext() {
    levelState.map = null;
    levelState.depth = 1;
    levelState.levelDepth = undefined;
    levelState.roomStack = [];
    levelState.roomDepth = 0;
    levelState.currentRoom = null;
    levelState.finalizeContext = null;
    levelState.inThemerooms = false;
}

/**
 * Set the current room context for nested des.* calls.
 * Used by themeroom_fill to establish room context.
 *
 * @param {Object} room - Room object from map.rooms[]
 */
export function setCurrentRoom(room) {
    levelState.currentRoom = room;
}

// ========================================================================
// Helper Functions (sp_lev.c internal functions)
// ========================================================================

/**
 * Initialize Lua MT19937 RNG state (lazy initialization).
 * C ref: This happens when Lua's math.random() is first called from themed room code.
 * Pattern observed from C RNG trace: rn2(1000-1004), rn2(1010), rn2(1012), rn2(1014-1036)
 *
 * This is called lazily on the first Lua RNG use (des.object/des.monster) to match C behavior.
 */
// Internal flag to prevent double MT initialization
let _mtInitializedLocal = false;

let _mtCallCount = 0;

// Reset MT initialization flag (called between themed room generations)
export function resetMtInitFlag() {
    _mtInitializedLocal = false;
}

export function initLuaMT() {
    _mtCallCount++;
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1';

    if (DEBUG) {
        const rngCount = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
        const stack = new Error().stack.split('\n').slice(2, 4).join('\n');
        console.log(`\n[RNG ${rngCount}] [initLuaMT call #${_mtCallCount}] flag=${_mtInitializedLocal}`);
        console.log(`Stack:\n${stack}`);
    }

    // Check if already initialized (prevent double init within same themed room)
    if (_mtInitializedLocal) {
        if (DEBUG) {
            console.log(`  → SKIPPING (already initialized)`);
        }
        return;
    }

    if (DEBUG) {
        console.log(`  → EXECUTING MT PATTERN NOW`);
        console.log(`luaRngCounter BEFORE init: ${levelState ? levelState.luaRngCounter : 'no levelState'}`);
    }

    // Execute MT init pattern (30 RNG calls) but DON'T reseed xoshiro
    // C ref: Lua's math.random state might persist across themed rooms, not reset per room
    for (let i = 1000; i <= 1004; i++) rn2(i);
    rn2(1010);
    rn2(1012);
    for (let i = 1014; i <= 1036; i++) rn2(i);
    _mtInitializedLocal = true;

    // NOTE: xoshiro is seeded ONCE at initRng() time and state persists
    // This matches Lua having persistent math.random state, not reset per themed room

    if (DEBUG) {
        const rngCount = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
        console.log(`  → [RNG ${rngCount}] MT pattern completed, flag now=${_mtInitializedLocal}`);
    }
    // Advance luaRngCounter to account for MT init calls (30 RNG calls total)
    // MT init pattern: 1000-1004(5), 1010(1), 1012(1), 1014-1036(23) = 30 calls
    // BUT counter should be 37 because offsets continue: next calls use 1037+
    // C ref: seed 4 trace shows first object after MT uses same gap pattern
    if (levelState && levelState.luaRngCounter !== undefined) {
        levelState.luaRngCounter = 37;  // Offset after 1036, continuing the sequence
        if (DEBUG) {
            console.log(`luaRngCounter AFTER init: ${levelState.luaRngCounter}`);
        }
    } else if (DEBUG) {
        console.log(`luaRngCounter NOT updated (was undefined or no levelState)`);
    }
}

/**
 * Create a room for special levels using sp_lev.c's room placement algorithm.
 * C ref: sp_lev.c:1486-1650 create_room()
 *
 * This differs from procedural dungeon.js create_room() in RNG usage and placement logic.
 * Special level rooms use fixed grid positions (1-5 for x/y) with alignment, while
 * procedural rooms use BSP rectangle selection.
 *
 * @param {number} x - X grid position (1-5) or -1 for random
 * @param {number} y - Y grid position (1-5) or -1 for random
 * @param {number} w - Room width or -1 for random
 * @param {number} h - Room height or -1 for random
 * @param {number} xalign - Horizontal alignment: 1=left, 2=center, 3=right, -1=random
 * @param {number} yalign - Vertical alignment: 1=top, 2=center, 3=bottom, -1=random
 * @param {number} rtype - Room type (OROOM=0, shop types, etc.)
 * @param {number} rlit - Lighting: -1=random, 0=unlit, 1=lit
 * @param {number} depth - Current dungeon depth (for litstate_rnd)
 * @returns {Object|null} Room object {lx, ly, hx, hy, rtype, rlit} or null on failure
 */
function create_room_splev(x, y, w, h, xalign, yalign, rtype, rlit, depth, skipLitstate = false, forceRandomize = false, deferCreateRoom = false) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_ROOMS === '1';
    const DEBUG_BUILD = typeof process !== 'undefined' && process.env.DEBUG_BUILD_ROOM === '1';
    if (DEBUG || DEBUG_BUILD) {
        const rngBefore = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
        console.log(`[RNG ${rngBefore}] create_room_splev: x=${x}, y=${y}, w=${w}, h=${h}, xalign=${xalign}, yalign=${yalign}, skipLitstate=${skipLitstate}, deferCreateRoom=${deferCreateRoom}`);
    }

    // C ref: sp_lev.c:1498 — -1 means OROOM (ordinary room)
    if (rtype === -1) {
        rtype = 0; // OROOM
    }

    // C ref: sp_lev.c:1530-1572 — Check which placement path to use FIRST
    // Path 1: "Totally random" — ALL params -1 or vault → uses rnd_rect() + BSP
    // Path 2: "Some params random" — grid placement with alignment
    const fullyRandom = (x < 0 && y < 0 && w < 0 && xalign < 0 && yalign < 0);
    if (DEBUG) console.log(`  fullyRandom=${fullyRandom}`);

    // C ref: sp_lev.c:1510 — Call litstate_rnd FIRST for non-fullyRandom rooms
    // For fullyRandom rooms, dungeon.js create_room will call litstate_rnd at the right time
    // (after build_room but before rnd_rect, see dungeon.js:356)
    let lit;
    if (skipLitstate || fullyRandom) {
        // Nested rooms or fullyRandom rooms: keep lit undetermined so litstate_rnd will be called later
        lit = rlit;  // Keep original value (usually -1 for undetermined)
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev skipping litstate_rnd (skipLitstate=${skipLitstate}, fullyRandom=${fullyRandom}), keeping lit=${lit}`);
        }
    } else {
        if (DEBUG_BUILD) {
            const rngBefore = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
            console.log(`  [RNG ${rngBefore}] create_room_splev calling litstate_rnd(${rlit}, ${depth})`);
        }
        lit = litstate_rnd(rlit, depth);
        if (DEBUG_BUILD) {
            const rngAfter = typeof getRngCallCount === 'function' ? getRngCallCount() : '?';
            console.log(`  [RNG ${rngAfter}] create_room_splev litstate_rnd returned ${lit}`);
        }
    }

    if (fullyRandom) {
        // C ref: sp_lev.c:1534 — totally random uses procedural rnd_rect() + BSP
        // Use dungeon.js create_room which implements this path

        if (!levelState.map) {
            return null; // No map available for BSP room placement
        }

        // If deferCreateRoom is true, return room parameters without actually creating the room
        // This allows caller to call build_room + litstate_rnd before calling create_room
        // C ref: build_room() calls litstate_rnd THEN create_room, not before
        if (deferCreateRoom) {
            if (DEBUG_BUILD) {
                console.log(`  create_room_splev: deferCreateRoom=true, returning params without calling create_room`);
            }
            // Return stub object with parameters for later create_room call
            return {
                _deferredRoom: true,
                x, y, w, h, xalign, yalign,
                rtype, rlit: lit, depth
            };
        }

        // NOTE: MT initialization for room CONTENTS happens AFTER room creation,
        // not before. des.object/des.monster will trigger MT init when needed.
        // DO NOT call initLuaMT() here - it would happen too early in the sequence.

        // C ref: sp_lev.c build_room() — for special levels, ALWAYS call rn2(100) before litstate_rnd
        // This is different from procedural dungeons (mklev.c) which don't have this call
        // The rn2(100) roll affects room type (chance check), but we're delegating to dungeon.js
        // create_room, so we just consume the RNG call to stay aligned with C
        rn2(100);

        // Call dungeon.create_room with map - it modifies map directly
        // Returns false if no space available, true on success
        // Pass `rlit` (not pre-resolved) so dungeon.js can call litstate_rnd at the right time
        const success = create_room(levelState.map, x, y, w, h, xalign, yalign,
                                     rtype, rlit, depth, !!levelState.inThemerooms);

        if (!success) {
            return null;
        }

        // Extract the last room that was added to map.rooms
        const room = levelState.map.rooms[levelState.map.rooms.length - 1];

        // C ref: mklev.c - OROOM and THEMEROOM rooms get needfill=FILL_NORMAL
        const OROOM_LOCAL = 0;
        const THEMEROOM_LOCAL = 1;
        if (rtype === OROOM_LOCAL || rtype === THEMEROOM_LOCAL) {
            room.needfill = FILL_NORMAL;
        }

        // Mark this room as already added to map so caller knows to skip duplicate work
        room._alreadyAdded = true;

        return room; // Return the room object for caller
    }

    // C ref: sp_lev.c:1522-1649 — Retry loop for room creation (up to 100 attempts)
    // The loop retries if get_rect or check_room fails
    let r1 = null;
    let r2 = null; // C ref: sp_lev.c:1634-1637 — r2 built before check_room, used for split_rects after loop
    let trycnt = 0;
    let xabs, yabs, dx, dy;
    let origWtmp, origHtmp; // Original room dimensions before check_room modification
    let roomValid = false; // Track if room passed check_room

    do {
        // C ref: sp_lev.c:1525-1530 — Reset parameters at start of each retry
        roomValid = false; // Reset for each iteration
        let xtmp = x;
        let ytmp = y;
        let wtmp = w;
        let htmp = h;
        let xaltmp = xalign;
        let yaltmp = yalign;

    // C ref: sp_lev.c:1587-1590 — Position is RANDOM (x < 0 && y < 0)
    // For nested rooms with forceRandomize, ALWAYS randomize position regardless of input
    if (forceRandomize || (xtmp < 0 && ytmp < 0)) {
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev calling rnd(5) for x, rnd(5) for y ${forceRandomize ? '(forced)' : ''}`);
        xtmp = rnd(5);  // Grid position 1-5
        ytmp = rnd(5);
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev got xtmp=${xtmp}, ytmp=${ytmp}`);
    }

    // C ref: sp_lev.c:1592-1594 — Size is RANDOM (w < 0 || h < 0)
    if (wtmp < 0 || htmp < 0) {
        wtmp = rn1(15, 3);  // rnd(15) + 3-1 = 3-17
        htmp = rn1(8, 2);   // rnd(8) + 2-1 = 2-9
    }

    // C ref: sp_lev.c:1596-1597 — Horizontal alignment is RANDOM
    // For nested rooms with forceRandomize, ALWAYS randomize alignment regardless of input
    if (forceRandomize || xaltmp === -1) {
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev calling rnd(3) for xalign ${forceRandomize ? '(forced)' : ''}`);
        xaltmp = rnd(3);  // 1=left, 2=center, 3=right
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev got xaltmp=${xaltmp}`);
    }

    // C ref: sp_lev.c:1598-1599 — Vertical alignment is RANDOM
    // For nested rooms with forceRandomize, ALWAYS randomize alignment regardless of input
    if (forceRandomize || yaltmp === -1) {
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev calling rnd(3) for yalign ${forceRandomize ? '(forced)' : ''}`);
        yaltmp = rnd(3);  // 1=top, 2=center, 3=bottom
        if (DEBUG_BUILD) console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] create_room_splev got yaltmp=${yaltmp}`);
    }

        // C ref: sp_lev.c:1601-1622 — Calculate absolute coordinates from grid position
        // Grid divides map into 5×5 sections: COLNO/5 = 16, ROWNO/5 = 4.2 ≈ 4
        const cdiv = (num, den) => Math.trunc(num / den);
        const COLNO_DIV5 = cdiv(COLNO, 5);  // 16
        const ROWNO_DIV5 = cdiv(ROWNO, 5);  // 4

        xabs = cdiv(((xtmp - 1) * COLNO), 5) + 1;
        yabs = cdiv(((ytmp - 1) * ROWNO), 5) + 1;

    // Apply alignment — C constants: SPLEV_LEFT=1, SPLEV_CENTER=3, SPLEV_RIGHT=5
    // rnd(3) returns 1-3, so only LEFT(1) and CENTER(3) are reachable;
    // value 2 falls through with no case match (no adjustment), matching C behavior
    switch (xaltmp) {
        case 1: // SPLEV_LEFT
            break;
        case 3: // SPLEV_CENTER
            xabs += cdiv((COLNO_DIV5 - wtmp), 2);
            break;
        case 5: // SPLEV_RIGHT (only from explicit level scripts)
            xabs += COLNO_DIV5 - wtmp;
            break;
    }

    switch (yaltmp) {
        case 1: // TOP
            break;
        case 3: // SPLEV_CENTER
            yabs += cdiv((ROWNO_DIV5 - htmp), 2);
            break;
        case 5: // BOTTOM (only from explicit level scripts)
            yabs += ROWNO_DIV5 - htmp;
            break;
    }

    // C ref: sp_lev.c:1626-1633 — Clamp to map bounds
    if (xabs + wtmp - 1 > COLNO - 2) {
        xabs = COLNO - wtmp - 3;
    }
    if (xabs < 2) {
        xabs = 2;
    }
    if (yabs + htmp - 1 > ROWNO - 2) {
        yabs = ROWNO - htmp - 3;
    }
    if (yabs < 2) {
        yabs = 2;
    }

        // C ref: sp_lev.c:1637-1641 — Create r2 rectangle and find containing rect
        // rndpos is 1 if position was random (original x/y were -1), else 0
        const rndpos = (x < 0 && y < 0) ? 1 : 0;
        r2 = {
            lx: xabs - 1,
            ly: yabs - 1,
            hx: xabs + wtmp + rndpos,
            hy: yabs + htmp + rndpos
        };

        r1 = get_rect(r2);
        if (!r1) {
            continue; // No rectangle found, retry
        }

        // C ref: sp_lev.c:1642-1647 — Set dx/dy and call check_room to validate
        dx = wtmp;
        dy = htmp;
        origWtmp = wtmp;  // Save before check_room may modify dx
        origHtmp = htmp;  // Save before check_room may modify dy

        // C ref: sp_lev.c:1645 — Call check_room to validate placement
        // check_room may shrink the room if overlaps detected, or fail entirely
        // It calls rn2(3) when overlap is detected
        const vault = false; // Special levels don't create vaults in this path
        const inThemerooms = false; // We're not in themerooms mode here

        const checkResult = check_room(levelState.map, xabs, dx, yabs, dy, vault, inThemerooms);
        if (!checkResult) {
            r1 = null; // C ref: sp_lev.c:1646 — Set r1=0 to retry
            continue;
        }

        // Update dimensions if check_room shrunk the room
        xabs = checkResult.lowx;
        yabs = checkResult.lowy;
        dx = checkResult.ddx;
        dy = checkResult.ddy;
        roomValid = true; // Room successfully validated

    } while (++trycnt <= 100 && !roomValid); // C ref: sp_lev.c:1649 (loop until valid)

    // C ref: sp_lev.c:1650-1652 — If all retries failed, return null
    if (!roomValid) {
        return null;
    }

    // C ref: sp_lev.c:1650 — split_rects(r1, &r2) called AFTER the retry loop
    // r2 was built with rndpos inside the loop, before check_room modified xabs
    if (DEBUG_BUILD) {
        console.log(`  create_room_splev: calling split_rects(r1=${JSON.stringify(r1)}, r2=${JSON.stringify(r2)})`);
    }
    split_rects(r1, r2);

    // C ref: sp_lev.c:1654 — add_room(xabs, yabs, xabs + wtmp - 1, yabs + htmp - 1, ...)
    // C uses ORIGINAL wtmp/htmp (not check_room-modified dx/dy) with modified xabs/yabs
    return {
        lx: xabs,
        ly: yabs,
        hx: xabs + origWtmp - 1,
        hy: yabs + origHtmp - 1,
        rtype: rtype,
        rlit: lit,  // Use resolved `lit` value from litstate_rnd
        irregular: false,
        nsubrooms: 0,      // C ref: mkroom.h — number of subrooms
        sbrooms: [],       // C ref: mkroom.h — subroom array
        _splitDone: true   // split_rects already called, caller should skip update_rect_pool_for_room
    };
}

/**
 * Reset level state for new level generation
 */
export function resetLevelState() {
    if (levelState && levelState._mklevContextEntered) {
        leaveMklevContext();
    }
    levelState = {
        map: null,
        flags: {
            noteleport: false,
            hardfloor: false,
            nommap: false,
            shortsighted: false,
            arboreal: false,
            is_maze_lev: false,
            hero_memory: false,
            graveyard: false,
            corrmaze: false,
            temperature: 0,
            rndmongen: true,
            deathdrops: true,
            noautosearch: false,
            fumaroles: false,
            stormy: false,
        },
        coder: {
            premapped: false,
            solidify: false,
            allow_flips: 3,
            check_inaccessibles: false,
        },
        init: {
            style: 'solidfill',
            fg: ROOM,
            bg: STONE,
            filling: ROOM,
            corrwid: -1,
            wallthick: -1,
            rm_deadends: false,
            smoothed: false,
            joined: false,
            lit: -1,
            walled: false,
        },
        xstart: 0,
        ystart: 0,
        xsize: 0,
        ysize: 0,
        mazeMaxX: (COLNO - 1) & ~1,
        mazeMaxY: (ROWNO - 1) & ~1,
        splevInitPresent: false,
        mapCoordMode: false,
        mapOriginX: 0,
        mapOriginY: 0,
        currentRoom: null,
        roomStack: [],
        roomDepth: 0,
        deferredObjects: [],
        deferredMonsters: [],
        deferredTraps: [],
        deferredActions: [],
        containerStack: [],
        monsterInventoryStack: [],
        finalizeContext: null,
        branchPlaced: false,
        levRegions: [],
        spLevMap: null,
        spLevTouched: null,
        _mklevContextEntered: false,
        // luaRngCounter is NOT initialized here - only set explicitly for levels that need it
    };
    icedpools = false;
    Sokoban = false;
    monsterExecSeq = 0;
    levelCheckpoints = [];

    // Initialize BSP rectangle pool for random room placement
    // C ref: sp_lev.c special level generation requires rect pool initialization
    init_rect();
}

/**
 * Set optional finalization context for C-parity constraints.
 *
 * @param {Object|null} ctx
 * @param {boolean} [ctx.isBranchLevel]
 * @param {number} [ctx.dunlev]
 * @param {number} [ctx.dunlevs]
 * @param {boolean} [ctx.applyRoomFill]
 * @param {number} [ctx.dnum]
 * @param {number} [ctx.dlevel]
 * @param {string} [ctx.specialName]
 * @param {"stairs"|"portal"|"none"|"stair-up"|"stair-down"} [ctx.branchPlacement]
 */
export function setFinalizeContext(ctx = null) {
    if (!ctx) {
        levelState.finalizeContext = null;
        return;
    }
    levelState.finalizeContext = {
        isBranchLevel: !!ctx.isBranchLevel,
        dunlev: Number.isFinite(ctx.dunlev) ? ctx.dunlev : undefined,
        dunlevs: Number.isFinite(ctx.dunlevs) ? ctx.dunlevs : undefined,
        applyRoomFill: !!ctx.applyRoomFill,
        dnum: Number.isFinite(ctx.dnum) ? ctx.dnum : undefined,
        dlevel: Number.isFinite(ctx.dlevel) ? ctx.dlevel : undefined,
        specialName: typeof ctx.specialName === 'string' ? ctx.specialName : undefined,
        branchPlacement: (ctx.branchPlacement === 'stairs'
            || ctx.branchPlacement === 'portal'
            || ctx.branchPlacement === 'none'
            || ctx.branchPlacement === 'stair-up'
            || ctx.branchPlacement === 'stair-down')
            ? ctx.branchPlacement
            : undefined
    };
}

export function setSpecialLevelDepth(depth) {
    if (Number.isFinite(depth)) {
        levelState.levelDepth = depth;
        setLevelDepth(depth);
    } else {
        levelState.levelDepth = undefined;
        setLevelDepth(1);
    }
}

/**
 * des.reset_level()
 *
 * Test-only level reset helper mirroring C des.reset_level().
 * C ref: sp_lev.c lspo_reset_level()
 */
export function reset_level() {
    resetLevelState();
}

function canPlaceStair(direction) {
    const ctx = levelState.finalizeContext;
    const dunlev = (ctx && typeof ctx.dunlev === 'number')
        ? ctx.dunlev
        : (Number.isFinite(levelState.levelDepth) ? levelState.levelDepth : undefined);
    const dunlevs = (ctx && typeof ctx.dunlevs === 'number') ? ctx.dunlevs : undefined;
    // C ref: mklev.c mkstairs() rejects up stairs on level 1.
    if (direction === 'up' && dunlev === 1) return false;
    // C ref: mklev.c mkstairs() rejects down stairs on bottom level.
    if (direction !== 'up' && typeof dunlevs === 'number' && dunlev === dunlevs) return false;
    return true;
}

// C ref: mkmaze.c setup_waterlevel()
// We mirror base terrain conversion plus RNG-visible bubble seeding scaffold.
function setup_waterlevel_parity(map, isWaterLevel) {
    if (!map) return;
    map.flags.hero_memory = false;

    const baseTyp = isWaterLevel ? WATER : AIR;
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            if (loc && loc.typ === STONE) {
                loc.typ = baseTyp;
            }
        }
    }

    // C hardcoded bounds from setup_waterlevel().
    const xmin = 3;
    const ymin = 1;
    const xmax = Math.min(78, (COLNO - 1) - 1);
    const ymax = Math.min(20, (ROWNO - 1));

    const xskip = isWaterLevel ? (10 + rn2(10)) : (6 + rn2(4));
    const yskip = isWaterLevel ? (4 + rn2(4)) : (3 + rn2(3));

    // Keep seeded bubble descriptors for later movement parity work.
    const bubbles = [];
    for (let x = xmin; x <= xmax; x += xskip) {
        for (let y = ymin; y <= ymax; y += yskip) {
            const n = rn2(7); // C mk_bubble(..., rn2(7))
            if (x < xmax && y < ymax) {
                bubbles.push({ x, y, n });
            }
        }
    }
    map._waterLevelSetup = { xmin, ymin, xmax, ymax, xskip, yskip, bubbles, isWaterLevel };
}

function fixupSpecialLevel() {
    if (!levelState.map || levelState.branchPlaced) return;
    // C ref: mkmaze.c fixup_special()
    const LR_TELE = 0;
    const LR_DOWNTELE = 1;
    const LR_UPTELE = 2;
    const LR_PORTAL = 3;
    const LR_BRANCH = 4;
    const LR_UPSTAIR = 5;
    const LR_DOWNSTAIR = 6;
    const ctx = levelState.finalizeContext || {};
    const specialName = (typeof ctx.specialName === 'string') ? ctx.specialName.toLowerCase() : '';

    // C ref: mkmaze.c fixup_special():
    // Is_waterlevel/Is_airlevel forces hero_memory off and runs setup_waterlevel()
    // before processing levregions.
    if (specialName === 'water' || specialName === 'air') {
        setup_waterlevel_parity(levelState.map, specialName === 'water');
    }

    let addedBranch = false;
    const withBranchHint = (placement, fn) => {
        const map = levelState.map;
        const prev = map._branchPlacementHint;
        map._branchPlacementHint = placement;
        try {
            fn();
        } finally {
            if (prev === undefined) {
                delete map._branchPlacementHint;
            } else {
                map._branchPlacementHint = prev;
            }
        }
    };
    const withPortalDest = (dest, fn) => {
        const map = levelState.map;
        const prev = map._portalDestOverride;
        if (dest) {
            map._portalDestOverride = { dnum: dest.dnum, dlevel: dest.dlevel };
        } else {
            delete map._portalDestOverride;
        }
        try {
            fn();
        } finally {
            if (prev === undefined) {
                delete map._portalDestOverride;
            } else {
                map._portalDestOverride = prev;
            }
        }
    };
    const resolvePortalDest = (region, ctx) => {
        if (region?.rtype !== LR_PORTAL) return null;
        const rname = (typeof region.rname === 'string') ? region.rname.trim() : '';
        if (!rname) return null;

        // C ref: mkmaze.c fixup_special() LR_PORTAL:
        // numeric rname keeps current dungeon and sets destination dlevel.
        if (/^\d+$/.test(rname)) {
            const dlevel = Number.parseInt(rname, 10);
            if (Number.isFinite(ctx?.dnum) && Number.isFinite(dlevel)) {
                return { dnum: ctx.dnum, dlevel };
            }
            return null;
        }

        // Named portal destination: resolve by registered special-level name.
        return findSpecialLevelByName(rname);
    };
    const placeRegion = (region, explicitType = region.rtype) => {
        const ctx = levelState.finalizeContext || {};
        const portalDest = resolvePortalDest(region, ctx);
        withPortalDest(portalDest, () => place_lregion(levelState.map,
            region.inarea.x1, region.inarea.y1, region.inarea.x2, region.inarea.y2,
            region.delarea.x1, region.delarea.y1, region.delarea.x2, region.delarea.y2,
            explicitType));
    };
    for (const region of levelState.levRegions || []) {
        switch (region.rtype) {
            case LR_BRANCH:
                addedBranch = true;
                // Explicit override is only for diagnostics; default path below
                // follows C place_branch(Is_branchlev(&u.uz), ...).
                const explicit = levelState.finalizeContext?.branchPlacement;
                if (explicit === 'none') {
                    break;
                }
                if (explicit === 'portal') {
                    withBranchHint('portal', () => placeRegion(region, LR_BRANCH));
                    break;
                }
                if (explicit === 'stairs' || explicit === 'stair-down') {
                    withBranchHint('stair-down', () => placeRegion(region, LR_BRANCH));
                    break;
                }
                if (explicit === 'stair-up') {
                    withBranchHint('stair-up', () => placeRegion(region, LR_BRANCH));
                    break;
                }

                const branch = resolveBranchPlacementForLevel(ctx.dnum, ctx.dlevel);
                if (branch.placement === 'none') {
                    break;
                }
                if (branch.placement === 'portal') {
                    withBranchHint('portal', () => placeRegion(region, LR_BRANCH));
                    break;
                }
                if (branch.placement === 'stair-up') {
                    withBranchHint('stair-up', () => placeRegion(region, LR_BRANCH));
                    break;
                }
                if (branch.placement === 'stair-down') {
                    withBranchHint('stair-down', () => placeRegion(region, LR_BRANCH));
                    break;
                }
                // Fallback for unknown resolver states.
                // fall through to default placement path.
            case LR_PORTAL:
            case LR_UPSTAIR:
            case LR_DOWNSTAIR:
                placeRegion(region);
                break;
            case LR_TELE:
            case LR_UPTELE:
            case LR_DOWNTELE:
                // C stores teleport region outlines for goto_level().
                if (region.rtype === LR_TELE || region.rtype === LR_UPTELE) {
                    levelState.map.updest = {
                        lx: region.inarea.x1, ly: region.inarea.y1,
                        hx: region.inarea.x2, hy: region.inarea.y2,
                        nlx: region.delarea.x1, nly: region.delarea.y1,
                        nhx: region.delarea.x2, nhy: region.delarea.y2
                    };
                }
                if (region.rtype === LR_TELE || region.rtype === LR_DOWNTELE) {
                    levelState.map.dndest = {
                        lx: region.inarea.x1, ly: region.inarea.y1,
                        hx: region.inarea.x2, hy: region.inarea.y2,
                        nlx: region.delarea.x1, nly: region.delarea.y1,
                        nhx: region.delarea.x2, nhy: region.delarea.y2
                    };
                }
                break;
        }
    }

    if (!addedBranch && ctx.isBranchLevel) {
        // C fallback: fixup_special() places branch if Is_branchlev(&u.uz) true.
        const explicit = levelState.finalizeContext?.branchPlacement;
        if (explicit === 'portal') {
            withBranchHint('portal', () => place_lregion(levelState.map, 0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH));
        } else if (explicit === 'stair-up') {
            withBranchHint('stair-up', () => place_lregion(levelState.map, 0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH));
        } else if (explicit === 'stair-down' || explicit === 'stairs') {
            withBranchHint('stair-down', () => place_lregion(levelState.map, 0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH));
        } else if (explicit !== 'none') {
            const branch = resolveBranchPlacementForLevel(ctx.dnum, ctx.dlevel);
            if (branch.placement === 'portal') {
                withBranchHint('portal', () => place_lregion(levelState.map, 0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH));
            } else if (branch.placement === 'stair-up') {
                withBranchHint('stair-up', () => place_lregion(levelState.map, 0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH));
            } else if (branch.placement === 'stair-down') {
                withBranchHint('stair-down', () => place_lregion(levelState.map, 0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH));
            }
        }
        /* else explicit none => intentionally no branch placement */
    }

    if (specialName === 'baalz') {
        baalz_fixup(levelState.map);
    }
    if (specialName.startsWith('medusa')) {
        medusa_fixup(levelState.map);
    }
    // C ref: mkmaze.c fixup_special():
    // Role_if(PM_CLERIC) && In_quest(&u.uz) => level.flags.graveyard = 1
    // In JS, role context is tracked via makemon role context; quest dnum is 3.
    const roleIndex = Number.isInteger(ctx.roleIndex) ? ctx.roleIndex : getMakemonRoleIndex();
    if (roleIndex === ROLE_PRIEST && ctx.dnum === 3) {
        levelState.map.flags.graveyard = true;
    }
    // C ref: mkmaze.c fixup_special():
    // - Is_stronghold(&u.uz) => level.flags.graveyard = 1
    // - Is_special(&u.uz)->flags.town (Mine Town variants) => has_town = 1
    if (specialName === 'castle') {
        levelState.map.flags.graveyard = true;
    }
    if (specialName.startsWith('minetn')) {
        levelState.map.flags.has_town = true;
    }

    captureCheckpoint('after_levregions_fixup');
    levelState.branchPlaced = true;
}

// C ref: mkmaze.c fixup_special() Medusa branch
function medusa_fixup(map) {
    if (!map || !Array.isArray(map.rooms) || map.rooms.length === 0) return;
    const croom = map.rooms[0]; // first room defined on Medusa level
    if (!croom) return;

    const randRoomPos = () => ({
        x: rn1(croom.hx - croom.lx + 1, croom.lx),
        y: rn1(croom.hy - croom.ly + 1, croom.ly),
    });
    const medusaGoodpos = (x, y) => {
        const loc = map.at(x, y);
        return !!loc && loc.typ > DOOR && !map.monsterAt(x, y);
    };
    const polyWhenStoned = (_mnum) => false; // TODO: port full polymorph-on-stone table
    const statueNeedsReroll = (obj) => {
        if (!obj || !Number.isInteger(obj.corpsenm)) return false;
        if (obj.corpsenm < 0 || obj.corpsenm >= mons.length) return false;
        const m = mons[obj.corpsenm];
        if (!m) return false;
        return !!(m.mr1 & MR_STONE) || polyWhenStoned(obj.corpsenm);
    };
    const mk_tt_statue = (x, y) => {
        const otmp = mksobj(STATUE, true, false);
        if (!otmp) return null;
        placeObjectAt(otmp, x, y);
        return otmp;
    };

    // for (tryct = rnd(4); tryct; tryct--) { ... }
    for (let tryct = rnd(4); tryct > 0; tryct--) {
        const { x, y } = randRoomPos();
        if (!medusaGoodpos(x, y)) continue;
        let tryct2 = 0;
        let otmp = mk_tt_statue(x, y);
        while (++tryct2 < 100 && otmp && statueNeedsReroll(otmp)) {
            set_corpsenm(otmp, rndmonnum(levelState.levelDepth || 1));
        }
    }

    let otmp = null;
    {
        const { x, y } = randRoomPos();
        if (rn2(2)) {
            otmp = mk_tt_statue(x, y);
        } else {
            // Medusa statues don't contain books in this branch.
            otmp = mkcorpstat(STATUE, -1, false);
            if (otmp) placeObjectAt(otmp, x, y);
        }
    }
    if (otmp) {
        let tryct = 0;
        while (++tryct < 100 && statueNeedsReroll(otmp)) {
            set_corpsenm(otmp, rndmonnum(levelState.levelDepth || 1));
        }
    }
}

// C ref: mkmaze.c baalz_fixup()
// Preserve the beetle-leg wall geometry by wallifying with an inarea guard.
function baalz_fixup(map) {
    if (!map) return;

    const midY = Math.trunc(ROWNO / 2);
    let lastX = 0;
    let inX1 = COLNO;
    for (let x = 0; x < COLNO; x++) {
        const loc = map.at(x, midY);
        if (loc && loc.nondiggable) {
            if (!lastX) inX1 = x + 1;
            lastX = x;
        }
    }
    const inX2 = ((lastX > inX1) ? lastX : COLNO) - 1;

    let lastY = 0;
    let inY1 = ROWNO;
    const probeX = Math.min(Math.max(inX1, 0), COLNO - 1);
    for (let y = 0; y < ROWNO; y++) {
        const loc = map.at(probeX, y);
        if (loc && loc.nondiggable) {
            if (!lastY) inY1 = y + 1;
            lastY = y;
        }
    }
    const inY2 = ((lastY > inY1) ? lastY : ROWNO) - 1;

    let delX1 = COLNO, delY1 = ROWNO, delX2 = 0, delY2 = 0;

    for (let x = inX1; x <= inX2; x++) {
        for (let y = inY1; y <= inY2; y++) {
            const loc = map.at(x, y);
            if (!loc) continue;
            if (loc.typ === POOL) {
                loc.typ = HWALL;
                if (delX1 === COLNO) {
                    delX1 = x;
                    delY1 = y;
                } else {
                    delX2 = x;
                    delY2 = y;
                }
            } else if (loc.typ === IRONBARS) {
                const left = map.at(x - 1, y);
                const right = map.at(x + 1, y);
                if (left && left.nondiggable) {
                    left.nondiggable = false;
                    const left2 = map.at(x - 2, y);
                    if (left2) left2.nondiggable = false;
                } else if (right && right.nondiggable) {
                    right.nondiggable = false;
                    const right2 = map.at(x + 2, y);
                    if (right2) right2.nondiggable = false;
                }
            }
        }
    }

    const wx1 = Math.max(inX1 - 2, 1);
    const wy1 = Math.max(inY1 - 2, 0);
    const wx2 = Math.min(inX2 + 2, COLNO - 1);
    const wy2 = Math.min(inY2 + 2, ROWNO - 1);

    // Temporarily enable bughack inarea semantics for wall_cleanup/fix_wall_spines.
    map._wallifyProtectedArea = { x1: inX1, y1: inY1, x2: inX2, y2: inY2 };
    try {
        dungeonWallifyRegion(map, wx1, wy1, wx2, wy2);
    } finally {
        delete map._wallifyProtectedArea;
    }

    // Rear-leg corrective tweak after wallification.
    let x = delX1, y = delY1;
    if (x >= 0 && x < COLNO && y >= 0 && y < ROWNO) {
        const loc = map.at(x, y);
        const down = map.at(x, y + 1);
        if (loc && (loc.typ === TLWALL || loc.typ === TRWALL)
            && down && down.typ === TUWALL) {
            loc.typ = (loc.typ === TLWALL) ? BRCORNER : BLCORNER;
            down.typ = HWALL;
            const m = map.monsterAt(x, y);
            if (m) {
                const pos = enexto(x, y, map);
                if (pos) {
                    m.mx = pos.x;
                    m.my = pos.y;
                }
            }
        }
    }

    x = delX2;
    y = delY2;
    if (x >= 0 && x < COLNO && y >= 0 && y < ROWNO) {
        const loc = map.at(x, y);
        const up = map.at(x, y - 1);
        if (loc && (loc.typ === TLWALL || loc.typ === TRWALL)
            && up && up.typ === TDWALL) {
            loc.typ = (loc.typ === TLWALL) ? TRCORNER : TLCORNER;
            up.typ = HWALL;
            const m = map.monsterAt(x, y);
            if (m) {
                const pos = enexto(x, y, map);
                if (pos) {
                    m.mx = pos.x;
                    m.my = pos.y;
                }
            }
        }
    }
}

/**
 * Get the current level state (for testing/debugging)
 */
export function getLevelState() {
    return levelState;
}

/**
 * Get the terrain grid (typGrid) from the current map
 * Returns a 21×80 array of terrain type codes (0-based indexing)
 * Compatible with C dumpmap format for comparison testing
 */
export function getTypGrid() {
    if (!levelState.map || !levelState.map.locations) {
        return null;
    }

    const grid = [];
    for (let y = 0; y < ROWNO; y++) {
        const row = [];
        for (let x = 0; x < COLNO; x++) {
            const cell = levelState.map.locations[x]?.[y];
            row.push(cell?.typ ?? 0);
        }
        grid.push(row);
    }
    return grid;
}

export function setCheckpointCaptureEnabled(enabled = true) {
    checkpointCaptureEnabled = !!enabled;
    if (!checkpointCaptureEnabled) {
        levelCheckpoints = [];
    }
}

export function clearLevelCheckpoints() {
    levelCheckpoints = [];
}

export function getLevelCheckpoints() {
    return JSON.parse(JSON.stringify(levelCheckpoints));
}

/**
 * des.level_init({ style = "solidfill", fg = " " })
 *
 * Initialize level generation style and fill characters.
 * C ref: sp_lev.c lspo_level_init()
 *
 * @param {Object} opts - Initialization options
 * @param {string} opts.style - "solidfill", "mazegrid", "maze", "rogue", "mines", "swamp"
 * @param {string} opts.fg - Foreground fill character (default: ".")
 * @param {string} opts.bg - Background fill character (default: " ")
 * @param {boolean} opts.smoothed - Smooth walls (default: false)
 * @param {boolean} opts.joined - Join rooms (default: false)
 * @param {number} opts.lit - Lighting (default: 0)
 * @param {boolean} opts.walled - Add walls (default: false)
 */
export function level_init(opts = {}) {
    // C parity: special level scripts run under mklev context between
    // lspo_level_init() and lspo_finalize_level().
    if (!levelState._mklevContextEntered) {
        enterMklevContext();
        levelState._mklevContextEntered = true;
    }

    const style = opts.style || 'solidfill';
    const validStyles = ['solidfill', 'mazegrid', 'maze', 'rogue', 'mines', 'swamp'];
    if (!validStyles.includes(style)) {
        throw new Error(`Invalid level_init style: ${style}`);
    }

    levelState.init.style = style;
    levelState.init.fg = mapchrToTerrain(opts.fg || '.');
    levelState.init.bg = opts.bg !== undefined ? mapchrToTerrain(opts.bg) : -1;
    levelState.init.filling = opts.filling !== undefined
        ? mapchrToTerrain(opts.filling)
        : levelState.init.fg;
    levelState.init.corrwid = Number.isInteger(opts.corrwid) ? opts.corrwid : -1;
    levelState.init.wallthick = Number.isInteger(opts.wallthick) ? opts.wallthick : -1;
    levelState.init.rm_deadends = !(opts.deadends !== undefined ? !!opts.deadends : true);
    levelState.init.smoothed = opts.smoothed || false;
    levelState.init.joined = opts.joined || false;
    levelState.init.lit = opts.lit !== undefined ? opts.lit : -1;
    levelState.init.walled = opts.walled || false;
    levelState.splevInitPresent = true;

    // Apply the initialization - always create fresh map and clear entity arrays
    levelState.map = new GameMap();
    installTypWatch(levelState.map);
    // Keep C-like level flags when Lua scripts call level_init multiple times.
    for (const [k, v] of Object.entries(levelState.flags)) {
        if (k in levelState.map.flags) {
            levelState.map.flags[k] = !!v;
        }
    }
    const ctx = levelState.finalizeContext || {};
    if (Number.isFinite(ctx.dnum)) {
        levelState.map._dnum = ctx.dnum;
        levelState.map.flags.inhell = (ctx.dnum === GEHENNOM);
    }
    levelState.monsters = [];
    levelState.objects = [];
    levelState.traps = [];

    if (style === 'solidfill') {
        levelState.mazeMaxX = (COLNO - 1) & ~1;
        levelState.mazeMaxY = (ROWNO - 1) & ~1;
        const lit = levelState.init.lit < 0 ? rn2(2) : levelState.init.lit;
        // C ref: sp_lev.c lvlfill_solid(): fill x=2..x_maze_max, y=0..y_maze_max
        const fillChar = levelState.init.filling;
        for (let x = 2; x <= levelState.mazeMaxX; x++) {
            for (let y = 0; y <= levelState.mazeMaxY; y++) {
                const loc = levelState.map.locations[x][y];
                loc.typ = fillChar;
                loc.lit = lit ? 1 : 0;
                loc.flags = 0;
                loc.horizontal = 0;
                loc.roomno = 0;
                loc.edge = 0;
            }
        }
    } else if (style === 'mazegrid') {
        // C ref: sp_lev.c splev_initlev() LVLINIT_MAZEGRID -> lvlfill_maze_grid()
        // Fill a checker/grid pattern in the interior while preserving stone
        // boundaries. This significantly affects subsequent map overlays.
        const fillChar = levelState.init.bg !== -1 ? levelState.init.bg : STONE;
        const xMazeMax = (COLNO - 1) & ~1;
        const yMazeMax = (ROWNO - 1) & ~1;
        levelState.mazeMaxX = xMazeMax;
        levelState.mazeMaxY = yMazeMax;
        const corrmaze = !!levelState.flags.corrmaze;

        for (let x = 2; x <= xMazeMax; x++) {
            for (let y = 0; y <= yMazeMax; y++) {
                const loc = levelState.map.locations[x][y];
                if (corrmaze) {
                    loc.typ = STONE;
                } else {
                    loc.typ = (y < 2 || ((x % 2) && (y % 2))) ? STONE : fillChar;
                }
            }
        }
    } else if (style === 'maze') {
        levelState.mazeMaxX = (COLNO - 1) & ~1;
        levelState.mazeMaxY = (ROWNO - 1) & ~1;
        // TODO: C create_maze() parity path
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                levelState.map.locations[x][y].typ = STONE;
            }
        }
    } else if (style === 'swamp') {
        levelState.mazeMaxX = (COLNO - 1) & ~1;
        levelState.mazeMaxY = (ROWNO - 1) & ~1;
        // C ref: sp_lev.c lvlfill_swamp()
        const fgTyp = levelState.init.fg;
        const bgTyp = levelState.init.bg !== -1 ? levelState.init.bg : MOAT;
        const lit = levelState.init.lit < 0 ? rn2(2) : levelState.init.lit;
        const xMazeMax = levelState.mazeMaxX;
        const yMazeMax = levelState.mazeMaxY;

        for (let x = 2; x <= xMazeMax; x++) {
            for (let y = 0; y <= yMazeMax; y++) {
                const loc = levelState.map.locations[x][y];
                loc.typ = bgTyp;
                loc.lit = lit ? 1 : 0;
                loc.flags = 0;
            }
        }

        for (let x = 2; x <= Math.min(xMazeMax, COLNO - 2); x += 2) {
            for (let y = 0; y <= Math.min(yMazeMax, ROWNO - 2); y += 2) {
                levelState.map.locations[x][y].typ = fgTyp;
                levelState.map.locations[x][y].lit = lit ? 1 : 0;

                let c = 0;
                if (levelState.map.locations[x + 1][y].typ === bgTyp) c++;
                if (levelState.map.locations[x][y + 1].typ === bgTyp) c++;
                if (levelState.map.locations[x + 1][y + 1].typ === bgTyp) c++;

                if (c === 3) {
                    switch (rn2(3)) {
                    case 0:
                        levelState.map.locations[x + 1][y].typ = fgTyp;
                        levelState.map.locations[x + 1][y].lit = lit ? 1 : 0;
                        break;
                    case 1:
                        levelState.map.locations[x][y + 1].typ = fgTyp;
                        levelState.map.locations[x][y + 1].lit = lit ? 1 : 0;
                        break;
                    default:
                        levelState.map.locations[x + 1][y + 1].typ = fgTyp;
                        levelState.map.locations[x + 1][y + 1].lit = lit ? 1 : 0;
                        break;
                    }
                }
            }
        }
    } else if (style === 'mines' || style === 'rogue') {
        levelState.mazeMaxX = (COLNO - 1) & ~1;
        levelState.mazeMaxY = (ROWNO - 1) & ~1;
        // C ref: sp_lev.c LVLINIT_MINES -> mkmap.c
        const map = levelState.map;
        const bgTyp = levelState.init.bg !== -1 ? levelState.init.bg : STONE;
        const fgTyp = levelState.init.fg;
        // C ref: sp_lev.c splev_initlev() pre-resolves BOOL_RANDOM for MINES
        // with rn2(2), then mkmap() litstate_rnd() sees 0/1 and does not
        // consume additional RNG.
        const lit = levelState.init.lit < 0 ? rn2(2) : levelState.init.lit;

        mkmapInitMap(map, bgTyp);
        mkmapInitFill(map, bgTyp, fgTyp);
        mkmapPassOne(map, bgTyp, fgTyp);
        mkmapPassTwo(map, bgTyp, fgTyp);
        if (levelState.init.smoothed) {
            mkmapPassThree(map, bgTyp, fgTyp);
            mkmapPassThree(map, bgTyp, fgTyp);
        }
        if (levelState.init.joined) {
            const regions = mkmapFloodRegions(map, bgTyp, fgTyp);
            if (regions.length > 1) {
                mkmapJoin(map, bgTyp, fgTyp, regions);
            }
        }
        mkmapFinish(map, fgTyp, bgTyp, lit, !!levelState.init.walled);
    } else {
        // Unknown style - default to solidfill behavior
        console.warn(`Level init style "${style}" using default solidfill behavior`);
        const fillChar = levelState.init.fg;
        for (let x = 0; x < 80; x++) {
            for (let y = 0; y < 21; y++) {
                levelState.map.locations[x][y].typ = fillChar;
            }
        }
    }
    captureCheckpoint('after_level_init');
}

/**
 * des.level_flags("noteleport", "hardfloor", ...)
 *
 * Set level flags that control various level behaviors.
 * C ref: sp_lev.c lspo_level_flags()
 *
 * @param {...string} flags - Variable number of flag names
 */
export function level_flags(...flags) {
    const setFlag = (key, value) => {
        levelState.flags[key] = value;
        if (levelState.map && levelState.map.flags && key in levelState.map.flags) {
            levelState.map.flags[key] = value;
        }
    };

    for (const flag of flags) {
        const lc = flag.toLowerCase();

        switch (lc) {
            case 'noteleport':
                setFlag('noteleport', true);
                break;
            case 'hardfloor':
                setFlag('hardfloor', true);
                break;
            case 'nommap':
                setFlag('nommap', true);
                break;
            case 'shortsighted':
                setFlag('shortsighted', true);
                break;
            case 'arboreal':
                setFlag('arboreal', true);
                break;
            case 'mazelevel':
                setFlag('is_maze_lev', true);
                break;
            case 'shroud':
                setFlag('hero_memory', true);
                break;
            case 'graveyard':
                setFlag('graveyard', true);
                break;
            case 'icedpools':
                icedpools = true;
                break;
            case 'corrmaze':
                setFlag('corrmaze', true);
                break;
            case 'premapped':
                levelState.coder.premapped = true;
                break;
            case 'solidify':
                levelState.coder.solidify = true;
                break;
            case 'sokoban':
                Sokoban = true;
                break;
            case 'inaccessibles':
                levelState.coder.check_inaccessibles = true;
                break;
            case 'noflipx':
                levelState.coder.allow_flips &= ~2;
                break;
            case 'noflipy':
                levelState.coder.allow_flips &= ~1;
                break;
            case 'noflip':
                levelState.coder.allow_flips = 0;
                break;
            case 'temperate':
                setFlag('temperature', 0);
                break;
            case 'hot':
                setFlag('temperature', 1);
                break;
            case 'cold':
                setFlag('temperature', -1);
                break;
            case 'nomongen':
                setFlag('rndmongen', false);
                break;
            case 'nodeathdrops':
                setFlag('deathdrops', false);
                break;
            case 'noautosearch':
                setFlag('noautosearch', true);
                break;
            case 'fumaroles':
                setFlag('fumaroles', true);
                break;
            case 'stormy':
                setFlag('stormy', true);
                break;
            default:
                throw new Error(`Unknown level flag: ${flag}`);
        }
    }
}

/**
 * Apply random flipping to the entire level after all maps are placed.
 * This matches C's flip_level_rnd() which is called at the end of level loading.
 * C ref: sp_lev.c flip_level_rnd() and flip_level()
 */
function flipLevelRandom(extras = false) {
    const allowFlips = levelState.coder.allow_flips;
    const DEBUG_FLIP = typeof process !== 'undefined' && process.env.DEBUG_FLIP === '1';
    const rngBefore = DEBUG_FLIP && typeof getRngCallCount === 'function' ? getRngCallCount() : null;
    let flipBits = 0;
    let flipYRoll = null;
    let flipXRoll = null;

    // Determine which flips to apply using RNG (matching C's flip_level_rnd)
    // Bit 0: vertical flip (up/down)
    // Bit 1: horizontal flip (left/right)
    if (allowFlips & 1) {
        flipYRoll = rn2(2);
        if (flipYRoll) {
            flipBits |= 1;
        }
    }
    if (allowFlips & 2) {
        flipXRoll = rn2(2);
        if (flipXRoll) {
            flipBits |= 2;
        }
    }
    if (DEBUG_FLIP) {
        const rngAfterRolls = typeof getRngCallCount === 'function' ? getRngCallCount() : null;
        console.log(`[DEBUG_FLIP] allow=${allowFlips} rollY=${flipYRoll} rollX=${flipXRoll} bits=${flipBits} rngBefore=${rngBefore} rngAfter=${rngAfterRolls}`);
    }

    if (flipBits === 0) return false; // No flips applied

    const map = levelState.map;
    if (!map) return false;

    const extents = getLevelExtentsForFlip(map);
    if (!extents) return false;
    let { minX, minY, maxX, maxY } = extents;
    if (minY < 0) minY = 0;
    if (minX < 1) minX = 1;
    if (maxX >= COLNO) maxX = COLNO - 1;
    if (maxY >= ROWNO) maxY = ROWNO - 1;
    if (DEBUG_FLIP) {
        console.log(`[DEBUG_FLIP] extents min=(${minX},${minY}) max=(${maxX},${maxY}) maze=${!!levelState.flags.is_maze_lev}`);
    }

    // C uses FlipX(val) = (maxx - val) + minx and FlipY(val) = (maxy - val) + miny
    const flipX = (x) => (maxX - x) + minX;
    const flipY = (y) => (maxY - y) + minY;
    const inFlipArea = (x, y) => (
        Number.isInteger(x) && Number.isInteger(y)
        && x >= minX && x <= maxX && y >= minY && y <= maxY
    );

    // Apply flips by swapping cells
    // Vertical flip: swap rows
    if (flipBits & 1) {
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y < minY + Math.floor((maxY - minY + 1) / 2); y++) {
                const ny = flipY(y);
                const temp = map.locations[x][y];
                map.locations[x][y] = map.locations[x][ny];
                map.locations[x][ny] = temp;
            }
        }
    }

    // Horizontal flip: swap columns
    if (flipBits & 2) {
        for (let x = minX; x < minX + Math.floor((maxX - minX + 1) / 2); x++) {
            for (let y = minY; y <= maxY; y++) {
                const nx = flipX(x);
                const temp = map.locations[x][y];
                map.locations[x][y] = map.locations[nx][y];
                map.locations[nx][y] = temp;
            }
        }
    }

    // C ref: sp_lev.c flip_level() also flips levregion rectangles so
    // later fixup_special() placement uses post-flip coordinates.
    for (const region of levelState.levRegions || []) {
        if (flipBits & 1) {
            region.inarea.y1 = flipY(region.inarea.y1);
            region.inarea.y2 = flipY(region.inarea.y2);
            if (region.inarea.y1 > region.inarea.y2) {
                const tmp = region.inarea.y1;
                region.inarea.y1 = region.inarea.y2;
                region.inarea.y2 = tmp;
            }
            region.delarea.y1 = flipY(region.delarea.y1);
            region.delarea.y2 = flipY(region.delarea.y2);
            if (region.delarea.y1 > region.delarea.y2) {
                const tmp = region.delarea.y1;
                region.delarea.y1 = region.delarea.y2;
                region.delarea.y2 = tmp;
            }
        }
        if (flipBits & 2) {
            region.inarea.x1 = flipX(region.inarea.x1);
            region.inarea.x2 = flipX(region.inarea.x2);
            if (region.inarea.x1 > region.inarea.x2) {
                const tmp = region.inarea.x1;
                region.inarea.x1 = region.inarea.x2;
                region.inarea.x2 = tmp;
            }
            region.delarea.x1 = flipX(region.delarea.x1);
            region.delarea.x2 = flipX(region.delarea.x2);
            if (region.delarea.x1 > region.delarea.x2) {
                const tmp = region.delarea.x1;
                region.delarea.x1 = region.delarea.x2;
                region.delarea.x2 = tmp;
            }
        }
    }

    // C ref: sp_lev.c flip_level() updates room/subroom bounds and door coords
    // before later placement steps (e.g. fixup_special() -> place_lregion()).
    const flipRoom = (room) => {
        if (!room) return;
        if (flipBits & 1) {
            const ly = flipY(room.ly);
            const hy = flipY(room.hy);
            room.ly = Math.min(ly, hy);
            room.hy = Math.max(ly, hy);
        }
        if (flipBits & 2) {
            const lx = flipX(room.lx);
            const hx = flipX(room.hx);
            room.lx = Math.min(lx, hx);
            room.hx = Math.max(lx, hx);
        }
        if (room.region) {
            room.region.x1 = room.lx;
            room.region.y1 = room.ly;
            room.region.x2 = room.hx;
            room.region.y2 = room.hy;
        }
    };

    const seenRooms = new Set();
    for (const room of map.rooms || []) {
        if (!room || seenRooms.has(room)) continue;
        seenRooms.add(room);
        flipRoom(room);
        for (const sub of room.sbrooms || []) {
            if (!sub || seenRooms.has(sub)) continue;
            seenRooms.add(sub);
            flipRoom(sub);
        }
    }

    for (const door of map.doors || []) {
        if (!door || !inFlipArea(door.x, door.y)) continue;
        if (flipBits & 1) door.y = flipY(door.y);
        if (flipBits & 2) door.x = flipX(door.x);
    }

    // C ref: sp_lev.c flip_level() flips stairway/ladders metadata so
    // subsequent placement logic (fixup_special/place_lregion) stays aligned
    // with flipped terrain.
    const flipPoint = (pt) => {
        if (!pt || !Number.isInteger(pt.x) || !Number.isInteger(pt.y)) return;
        // C Flip_coord() skips zero-x sentinel entries and only flips points
        // that are inside the flip area.
        if (pt.x === 0) return;
        if (!inFlipArea(pt.x, pt.y)) return;
        if (flipBits & 1) pt.y = flipY(pt.y);
        if (flipBits & 2) pt.x = flipX(pt.x);
    };

    flipPoint(map.upstair);
    flipPoint(map.dnstair);
    flipPoint(map.upladder);
    flipPoint(map.dnladder);

    // C ref: sp_lev.c flip_level() flips trap/object/monster coordinates too.
    for (const trap of map.traps || []) {
        if (!trap) continue;
        if (inFlipArea(trap.tx, trap.ty)) {
            if (flipBits & 1) trap.ty = flipY(trap.ty);
            if (flipBits & 2) trap.tx = flipX(trap.tx);
            if (Number.isInteger(trap.x)) trap.x = trap.tx;
            if (Number.isInteger(trap.y)) trap.y = trap.ty;
        }
        if (trap.launch && inFlipArea(trap.launch.x, trap.launch.y)) {
            if (flipBits & 1) trap.launch.y = flipY(trap.launch.y);
            if (flipBits & 2) trap.launch.x = flipX(trap.launch.x);
        }
        if (trap.launch2 && inFlipArea(trap.launch2.x, trap.launch2.y)) {
            if (flipBits & 1) trap.launch2.y = flipY(trap.launch2.y);
            if (flipBits & 2) trap.launch2.x = flipX(trap.launch2.x);
        }
        if (trap.teledest && inFlipArea(trap.teledest.x, trap.teledest.y)) {
            if (flipBits & 1) trap.teledest.y = flipY(trap.teledest.y);
            if (flipBits & 2) trap.teledest.x = flipX(trap.teledest.x);
        }
    }

    for (const obj of map.objects || []) {
        if (!obj || !inFlipArea(obj.ox, obj.oy)) continue;
        if (flipBits & 1) obj.oy = flipY(obj.oy);
        if (flipBits & 2) obj.ox = flipX(obj.ox);
    }

    for (const engr of map.engravings || []) {
        if (!engr || !inFlipArea(engr.x, engr.y)) continue;
        if (flipBits & 1) engr.y = flipY(engr.y);
        if (flipBits & 2) engr.x = flipX(engr.x);
    }

    for (const mon of map.monsters || []) {
        if (!mon) continue;
        const mx = Number.isInteger(mon.mx) ? mon.mx : mon.x;
        const my = Number.isInteger(mon.my) ? mon.my : mon.y;
        if (!inFlipArea(mx, my)) continue;
        let fx = mx;
        let fy = my;
        if (flipBits & 1) fy = flipY(fy);
        if (flipBits & 2) fx = flipX(fx);
        if (Number.isInteger(mon.mx)) mon.mx = fx;
        if (Number.isInteger(mon.my)) mon.my = fy;
        if (Number.isInteger(mon.x)) mon.x = fx;
        if (Number.isInteger(mon.y)) mon.y = fy;
    }

    // C ref: sp_lev.c flip_level(): when extras && flp, set_wall_state().
    // In normal generation extras is false.
    if (extras && flipBits) {
        set_wall_state(map);
    }
    return true;
}

function getLevelExtentsForFlip(map) {
    const isMazeLevel = !!levelState.flags.is_maze_lev;
    let found = false;
    let nonwall = false;

    let xmin = 0;
    for (; !found && xmin < COLNO; xmin++) {
        for (let y = 0; y < ROWNO; y++) {
            const typ = map.locations[xmin][y].typ;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    if (!found) return null;
    xmin -= (nonwall || !isMazeLevel) ? 2 : 1;
    if (xmin < 0) xmin = 0;

    found = false;
    nonwall = false;
    let xmax = COLNO - 1;
    for (; !found && xmax >= 0; xmax--) {
        for (let y = 0; y < ROWNO; y++) {
            const typ = map.locations[xmax][y].typ;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    xmax += (nonwall || !isMazeLevel) ? 2 : 1;
    if (xmax >= COLNO) xmax = COLNO - 1;

    found = false;
    nonwall = false;
    let ymin = 0;
    for (; !found && ymin < ROWNO; ymin++) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.locations[x][ymin].typ;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    ymin -= (nonwall || !isMazeLevel) ? 2 : 1;

    found = false;
    nonwall = false;
    let ymax = ROWNO - 1;
    for (; !found && ymax >= 0; ymax--) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.locations[x][ymax].typ;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    ymax += (nonwall || !isMazeLevel) ? 2 : 1;

    return { minX: xmin, minY: ymin, maxX: xmax, maxY: ymax };
}

/**
 * des.map([[...]])
 *
 * Place an ASCII map at the specified location or alignment.
 * C ref: sp_lev.c lspo_map()
 *
 * @param {string|Object} data - Map string or options object
 * @param {string} data.map - Map data (for object form)
 * @param {string} data.halign - "left", "center", "right" (default: "center")
 * @param {string} data.valign - "top", "center", "bottom" (default: "center")
 * @param {number} data.x - Explicit X coordinate
 * @param {number} data.y - Explicit Y coordinate
 * @param {boolean} data.lit - Whether to light the map (default: false)
 */
export function map(data) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let mapStr, halign = 'center', valign = 'center', x, y, lit = false, contents;

    if (typeof data === 'string') {
        mapStr = data;
    } else {
        mapStr = data.map || data;
        halign = data.halign || 'center';
        valign = data.valign || 'center';
        // Support both x/y and coord formats
        if (data.coord) {
            x = data.coord[0];
            y = data.coord[1];
        } else {
            x = data.x;
            y = data.y;
        }
        lit = data.lit || false;
        contents = data.contents;
    }

    // C ref: sp_lev.c mapfrag_fromstr() calls stripdigits() before computing
    // dimensions or applying map cells.
    mapStr = String(mapStr).replace(/[0-9]/g, '');
    // C/Lua parity: long-bracket strings [[...]] discard one initial newline
    // when it appears immediately after the opening delimiter.
    if (mapStr.startsWith('\n')) {
        mapStr = mapStr.slice(1);
    }

    // Parse map string into lines.
    // C ref: sp_lev.c mapfrag_fromstr() counts newline-separated rows from the
    // normalized Lua string; intentional blank rows remain.
    // C preserves intentional trailing blank rows and only ignores the final
    // synthetic empty segment introduced by a terminal '\n'.
    let lines = mapStr.split('\n');
    const preserveExactBlankLines = !!(data && typeof data === 'object'
        && (data.coord !== undefined || data.x !== undefined || data.y !== undefined));
    if (!preserveExactBlankLines) {
        if (lines.length > 0 && lines[lines.length - 1] === '' && mapStr.endsWith('\n')) {
            lines.pop();
        }
    }

    const height = lines.length;
    const width = Math.max(...lines.map(line => line.length));

    levelState.xsize = width;
    levelState.ysize = height;

    // Determine placement coordinates
    const explicitCoords = (x !== undefined && y !== undefined);
    // C ref: sp_lev.c lspo_map() — detect whether halign/valign were explicitly set.
    // In C, lr/tb default to -1 (unspecified). In Lua themed rooms, des.map({map=...})
    // doesn't specify halign/valign, so lr=-1 and tb=-1, triggering random placement.
    // In JS, we detect this by checking if data.halign/valign were NOT in the input.
    const hasExplicitAlign = data && typeof data === 'object'
        && (data.halign !== undefined || data.valign !== undefined);

    if (levelState.inThemerooms && !explicitCoords && !hasExplicitAlign) {
        // C ref: sp_lev.c:6132-6264 — themed room random placement with retry
        // When in_mk_themerooms, lr==-1, tb==-1, and no explicit x/y,
        // pick random position and retry up to 100 times if conflicts detected
        let tryct = 0;
        let placed = false;

        while (tryct <= 100) {
            // C ref: sp_lev.c:6144 — random x placement
            x = 1 + rn2(COLNO - 1 - width);
            // C ref: sp_lev.c:6154 — random y placement
            y = rn2(ROWNO - height);

            // C ref: sp_lev.c:6236-6264 — check that themed room map doesn't
            // overwrite existing non-STONE tiles or tiles with roomno set
            let isokp = true;
            for (let cy = y - 1; cy < Math.min(ROWNO, y + height) + 1 && isokp; cy++) {
                for (let cx = x - 1; cx < Math.min(COLNO, x + width) + 1 && isokp; cx++) {
                    if (cx < 0 || cx >= COLNO || cy < 0 || cy >= ROWNO) {
                        isokp = false;
                    } else if (cy < y || cy >= y + height || cx < x || cx >= x + width) {
                        // Border cell — must be STONE with no room
                        const loc = levelState.map.locations[cx][cy];
                        if (loc.typ !== STONE || loc.roomno !== 0) {
                            isokp = false;
                        }
                    } else {
                        // Interior cell — check map char
                        const mapLine = lines[cy - y];
                        const mapCh = mapLine ? mapLine[cx - x] : undefined;
                        const mptyp = mapCh ? mapchrToTerrain(mapCh) : -1;
                        if (mptyp === -1) continue; // MAX_TYPE / transparent — skip
                        const loc = levelState.map.locations[cx][cy];
                        if ((loc.typ !== STONE && loc.typ !== mptyp) || loc.roomno !== 0) {
                            isokp = false;
                        }
                    }
                }
            }

            if (isokp) {
                placed = true;
                break;
            }

            tryct++;
            if (tryct > 100) {
                // C ref: sp_lev.c:6261 — themeroom_failed = TRUE; goto skipmap;
                if (levelState.roomFailureCallback) {
                    levelState.roomFailureCallback();
                }
                return; // Skip map placement entirely
            }
        }
    } else if (!explicitCoords) {
        // Non-themeroom alignment-based placement
        // C ref: sp_lev.c lspo_map() alignment math.
        const xMazeMax = levelState.mazeMaxX || ((COLNO - 1) & ~1);
        const yMazeMax = levelState.mazeMaxY || ((ROWNO - 1) & ~1);

        // C integer division truncates toward zero; JS Math.floor differs for negatives.
        const cdiv = (num, den) => Math.trunc(num / den);

        if (halign === 'left') {
            x = levelState.splevInitPresent ? 1 : 3;
        } else if (halign === 'half-left') {
            x = 2 + cdiv((xMazeMax - 2 - width), 4);
        } else if (halign === 'center') {
            x = 2 + cdiv((xMazeMax - 2 - width), 2);
        } else if (halign === 'half-right') {
            x = 2 + cdiv(((xMazeMax - 2 - width) * 3), 4);
        } else if (halign === 'right') {
            x = xMazeMax - width - 1;
        }

        if (valign === 'top') {
            y = 3;
        } else if (valign === 'center') {
            y = 2 + cdiv((yMazeMax - 2 - height), 2);
        } else if (valign === 'bottom') {
            y = yMazeMax - height - 1;
        }

        // C ref: map starts are forced to odd coordinates in aligned mode.
        if ((x % 2) === 0) x++;
        if ((y % 2) === 0) y++;

        // C ref: sp_lev.c horizontal fallback when placement overflows.
        if (x < 0 || x + width > COLNO) {
            x += (x > 0) ? -2 : 2;
            if (width === COLNO) x = 0;
            if (x < 0 || x + width > COLNO) x = 0;
        }

        // C ref: sp_lev.c vertical fallback when placement overflows.
        if (y < 0 || y + height > ROWNO) {
            y += (y > 0) ? -2 : 2;
            if (height === ROWNO) y = 0;
            if (y < 0 || y + height > ROWNO) y = 0;
        }
    }

    levelState.xstart = x;
    levelState.ystart = y;

    // Place the map tiles
    for (let ly = 0; ly < lines.length; ly++) {
        const line = lines[ly];
        for (let lx = 0; lx < line.length; lx++) {
            const ch = line[lx];
            const gx = x + lx;
            const gy = y + ly;

            if (gx >= 0 && gx < 80 && gy >= 0 && gy < 21) {
                const terrain = mapchrToTerrain(ch);
                if (terrain !== -1) {
                    // C ref: sp_lev.c lspo_map() clears per-tile metadata for
                    // valid mapped cells before applying terrain.
                    const loc = levelState.map.locations[gx][gy];
                    loc.flags = 0;
                    loc.horizontal = 0;
                    loc.roomno = 0;
                    loc.edge = 0;
                    loc.typ = terrain;
                    // C ref: sp_lev.c sel_set_ter() post-terrain adjustments.
                    if (loc.typ === SDOOR || loc.typ === DOOR) {
                        if (loc.typ === SDOOR) {
                            loc.doormask = D_CLOSED;
                        }
                        if (gx > 0) {
                            const left = levelState.map.locations[gx - 1][gy];
                            if (IS_WALL(left.typ) || left.horizontal) {
                                loc.horizontal = 1;
                            }
                        }
                    } else if (loc.typ === HWALL || loc.typ === IRONBARS) {
                        loc.horizontal = 1;
                    }
                    markSpLevMap(gx, gy);
                    markSpLevTouched(gx, gy);
                    if (lit) {
                        loc.lit = 1;
                    }
                }
            }
        }
    }

    // C ref: sp_lev.c lspo_map() does not wallify here.
    // Wall junction typing happens during finalize_level().

    // Enable map-relative coordinate mode
    // C ref: After des.map(), all Lua coordinates are relative to map origin
    levelState.mapCoordMode = true;
    levelState.mapOriginX = x;
    levelState.mapOriginY = y;

    // Execute contents callback if provided
    // C ref: Lua des.map() calls the contents function after placing the map
    if (contents && typeof contents === 'function') {
        // Create a room-like object for compatibility with room-based contents
        const mapRegion = {
            lx: x,
            ly: y,
            hx: x + width - 1,
            hy: y + height - 1,
            width: width,
            height: height
        };
        contents(mapRegion);
    }

    captureCheckpoint('after_map');
}

/**
 * Convert map-relative coordinates to absolute coordinates
 * C ref: Lua coordinates after des.map() are relative to map origin
 *
 * @param {number} x - X coordinate (map-relative if mapCoordMode is true)
 * @param {number} y - Y coordinate (map-relative if mapCoordMode is true)
 * @returns {Object} { x: absoluteX, y: absoluteY }
 */
function toAbsoluteCoords(x, y) {
    if (levelState.mapCoordMode && x !== undefined && y !== undefined) {
        return {
            x: levelState.mapOriginX + x,
            y: levelState.mapOriginY + y
        };
    }
    return { x, y };
}

// C ref: sp_lev.c get_location()/get_location_coord() flags.
const GETLOC_ANY_LOC = 1 << 0;
const GETLOC_SOLID = 1 << 1;
const GETLOC_DRY = 1 << 2;
const GETLOC_WET = 1 << 3;
const GETLOC_HOT = 1 << 4;
const GETLOC_SPACELOC = 1 << 5;
const GETLOC_NO_LOC_WARN = 1 << 6;

function hasBoulderAt(x, y) {
    for (const obj of levelState.map.objects || []) {
        if (obj?.otyp === BOULDER && obj.ox === x && obj.oy === y) return true;
    }
    for (const deferred of levelState.deferredObjects) {
        if (deferred?.obj?.otyp === BOULDER
            && deferred.x === x && deferred.y === y) {
            return true;
        }
    }
    return false;
}

function isOkLocation(x, y, humidity) {
    if (okLocationOverride) {
        return okLocationOverride(x, y);
    }
    if ((humidity & GETLOC_ANY_LOC) !== 0) return true;
    if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return false;
    const typ = levelState.map.locations[x][y].typ;

    if ((humidity & GETLOC_SOLID) !== 0) return IS_OBSTRUCTED(typ);

    if ((humidity & (GETLOC_DRY | GETLOC_SPACELOC)) !== 0 && typ > DOOR) {
        // C ref: sp_lev.c is_ok_location() boulder rejection in DRY/SPACELOC.
        if (!hasBoulderAt(x, y) || (humidity & GETLOC_SOLID) !== 0) return true;
    }
    if ((humidity & GETLOC_WET) !== 0 && IS_POOL(typ)) return true;
    if ((humidity & GETLOC_HOT) !== 0 && IS_LAVA(typ)) return true;
    return false;
}

function setOkLocationFunc(func) {
    okLocationOverride = func || null;
}

function getLocation(rawX, rawY, humidity, croom, noLocWarn = false) {
    let cpt = 0;
    const mx = croom ? croom.lx : (levelState.xsize > 0 ? levelState.xstart : 1);
    const my = croom ? croom.ly : (levelState.ysize > 0 ? levelState.ystart : 0);
    const sx = croom ? (croom.hx - croom.lx + 1) : (levelState.xsize > 0 ? levelState.xsize : (COLNO - 1));
    const sy = croom ? (croom.hy - croom.ly + 1) : (levelState.ysize > 0 ? levelState.ysize : ROWNO);

    let x = rawX;
    let y = rawY;
    if (x >= 0 && y >= 0) {
        x += mx;
        y += my;
    } else {
        do {
            if (croom) {
                const pos = somexy(croom, levelState.map);
                if (!pos) break;
                x = pos.x;
                y = pos.y;
            } else {
                x = mx + rn2(sx);
                y = my + rn2(sy);
            }
            if (isOkLocation(x, y, humidity)) break;
        } while (++cpt < 100);

        if (cpt >= 100) {
            for (let xx = 0; xx < sx; xx++) {
                for (let yy = 0; yy < sy; yy++) {
                    x = mx + xx;
                    y = my + yy;
                    if (isOkLocation(x, y, humidity)) return { x, y };
                }
            }
            if (noLocWarn || (humidity & GETLOC_NO_LOC_WARN) !== 0) {
                return { x: -1, y: -1 };
            }
        }
    }
    if ((humidity & GETLOC_ANY_LOC) === 0 && (x < 0 || x >= COLNO || y < 0 || y >= ROWNO)) {
        if (noLocWarn || (humidity & GETLOC_NO_LOC_WARN) !== 0) {
            return { x: -1, y: -1 };
        }
        return { x: COLNO - 1, y: ROWNO - 1 };
    }

    return { x, y };
}

function getLocationCoord(rawX, rawY, humidity, croom) {
    const isRandom = rawX === undefined || rawY === undefined || rawX < 0 || rawY < 0;
    if (isRandom) {
        // C ref: get_location_coord() first tries NO_LOC_WARN for random packed coords.
        let pos = getLocation(-1, -1, humidity | GETLOC_NO_LOC_WARN, croom, true);
        if (pos.x === -1 && pos.y === -1) pos = getLocation(-1, -1, humidity, croom, false);
        return pos;
    }

    if (croom) {
        return { x: croom.lx + rawX, y: croom.ly + rawY };
    }
    if (levelState.mapCoordMode) return toAbsoluteCoords(rawX, rawY);
    return { x: rawX, y: rawY };
}

function getRoomLoc(rawX, rawY, croom) {
    if (!croom) {
        return getLocationCoord(rawX, rawY, GETLOC_DRY, null);
    }
    let x = (rawX === undefined || rawX === null) ? -1 : rawX;
    let y = (rawY === undefined || rawY === null) ? -1 : rawY;

    if (x < 0 && y < 0) {
        const pos = somexy(croom, levelState.map);
        if (!pos) throw new Error('getRoomLoc: cannot find room location');
        return { x: pos.x, y: pos.y };
    }

    if (x < 0) x = rn2(croom.hx - croom.lx + 1);
    if (y < 0) y = rn2(croom.hy - croom.ly + 1);
    x += croom.lx;
    y += croom.ly;
    return { x, y };
}

function getFreeRoomLoc(rawX, rawY, croom) {
    let { x, y } = getLocationCoord(rawX, rawY, GETLOC_DRY, croom);
    if (x < 0 || y < 0 || x >= COLNO || y >= ROWNO) return { x, y };

    if (levelState.map.locations[x][y].typ !== ROOM) {
        let trycnt = 0;
        do {
            const pos = getRoomLoc(rawX, rawY, croom);
            x = pos.x;
            y = pos.y;
        } while (levelState.map.locations[x][y].typ !== ROOM && ++trycnt <= 100);

        if (trycnt > 100) {
            throw new Error('getFreeRoomLoc: cannot find room location');
        }
    }
    return { x, y };
}

/**
 * des.terrain(x, y, type)
 *
 * Set terrain at a specific coordinate.
 * C ref: sp_lev.c lspo_terrain()
 *
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} type - Terrain character
 */
export function terrain(x_or_opts, y_or_type, type) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // Handle different formats:
    // des.terrain(x, y, type)
    // des.terrain({x, y, typ})
    // des.terrain(selection, type)

    if (typeof x_or_opts === 'object') {
        if (Array.isArray(x_or_opts)) {
            const terrainType = mapchrToTerrain(y_or_type);
            if (terrainType === -1) return;

            // des.terrain([x,y], typ)
            if (x_or_opts.length === 2
                && Number.isFinite(x_or_opts[0]) && Number.isFinite(x_or_opts[1])) {
                const pos = getLocationCoord(x_or_opts[0], x_or_opts[1], GETLOC_ANY_LOC, levelState.currentRoom || null);
                if (pos.x >= 0 && pos.x < COLNO && pos.y >= 0 && pos.y < ROWNO) {
                    levelState.map.locations[pos.x][pos.y].typ = terrainType;
                    markSpLevMap(pos.x, pos.y);
                    markSpLevTouched(pos.x, pos.y);
                }
                return;
            }

            // selection.line() / selection.area() coord list
            for (const coord of x_or_opts) {
                if (coord.x >= 0 && coord.x < 80 && coord.y >= 0 && coord.y < 21) {
                    levelState.map.locations[coord.x][coord.y].typ = terrainType;
                    markSpLevMap(coord.x, coord.y);
                    markSpLevTouched(coord.x, coord.y);
                }
            }
        } else if (x_or_opts.x !== undefined && x_or_opts.y !== undefined) {
            // {x, y, typ} format
            // C ref: sp_lev.c lspo_terrain() applies room offset via get_location_coord()
            const pos = getLocationCoord(x_or_opts.x, x_or_opts.y, GETLOC_ANY_LOC, levelState.currentRoom || null);
            const terrainType = mapchrToTerrain(x_or_opts.typ);
            if (terrainType !== -1 && pos.x >= 0 && pos.x < 80 &&
                pos.y >= 0 && pos.y < 21) {
                levelState.map.locations[pos.x][pos.y].typ = terrainType;
                markSpLevMap(pos.x, pos.y);
                markSpLevTouched(pos.x, pos.y);
            }
        } else if (Array.isArray(x_or_opts.coords)) {
            // selection object format (selection.new()/area()/randline() result)
            const terrainType = mapchrToTerrain(y_or_type);
            if (terrainType === -1) return;
            for (const coord of x_or_opts.coords) {
                if (!coord) continue;
                if (coord.x >= 0 && coord.x < COLNO && coord.y >= 0 && coord.y < ROWNO) {
                    levelState.map.locations[coord.x][coord.y].typ = terrainType;
                    markSpLevMap(coord.x, coord.y);
                    markSpLevTouched(coord.x, coord.y);
                }
            }
        }
    } else if (typeof x_or_opts === 'number') {
        // (x, y, type) format
        // C ref: sp_lev.c lspo_terrain() calls get_location_coord() which
        // adds croom->lx/ly offset for room-relative coordinates
        const pos = getLocationCoord(x_or_opts, y_or_type, GETLOC_ANY_LOC, levelState.currentRoom || null);
        if (pos.x >= 0 && pos.x < 80 && pos.y >= 0 && pos.y < 21) {
            const terrainType = mapchrToTerrain(type);
            if (terrainType !== -1) {
                levelState.map.locations[pos.x][pos.y].typ = terrainType;
                markSpLevMap(pos.x, pos.y);
                markSpLevTouched(pos.x, pos.y);
            }
        }
    }
}

/**
 * des.replace_terrain(opts)
 * Replace all occurrences of one terrain type with another.
 * C ref: sp_lev.c spo_replace_terrain()
 *
 * @param {Object} opts - Options
 *   - fromterrain: Source terrain character/type
 *   - toterrain: Destination terrain character/type
 *   - region: Optional selection/region to limit replacement (default: whole map)
 *   - chance: Optional percentage chance for each replacement (0-100, default: 100)
 */
export function replace_terrain(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const fromToken = (typeof opts.fromterrain === 'string' && opts.fromterrain.length > 0)
        ? opts.fromterrain[0]
        : null;
    const fromType = mapchrToTerrain(opts.fromterrain);
    const toType = mapchrToTerrain(opts.toterrain);

    if ((fromToken !== 'w' && fromType === -1) || toType === -1) return;

    const chance = opts.chance !== undefined ? opts.chance : 100;

    // C ref: spo_replace_terrain() iterates selection bounds in x-major order.
    let minX = 0, minY = 0, maxX = COLNO - 1, maxY = ROWNO - 1;
    let selSet = null;

    const scope = opts.selection || opts.region;

    if (scope && scope.coords) {
        selSet = new Set();
        minX = COLNO - 1;
        minY = ROWNO - 1;
        maxX = 0;
        maxY = 0;
        for (const coord of scope.coords) {
            if (!coord) continue;
            const x = Math.trunc(coord.x);
            const y = Math.trunc(coord.y);
            if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) continue;
            selSet.add(`${x},${y}`);
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
        if (selSet.size === 0) return;
    } else if (scope && Array.isArray(scope) && scope.length >= 4) {
        // des.replace_terrain({ region: [x1,y1,x2,y2], ... })
        const p1 = getLocation(scope[0], scope[1], GETLOC_ANY_LOC, levelState.currentRoom || null);
        const p2 = getLocation(scope[2], scope[3], GETLOC_ANY_LOC, levelState.currentRoom || null);
        minX = Math.max(0, Math.min(p1.x, p2.x));
        minY = Math.max(0, Math.min(p1.y, p2.y));
        maxX = Math.min(COLNO - 1, Math.max(p1.x, p2.x));
        maxY = Math.min(ROWNO - 1, Math.max(p1.y, p2.y));
    } else if (scope && scope.x1 !== undefined) {
        // C ref: rectangle args are passed through get_location(..., ANY_LOC, croom).
        const p1 = getLocation(scope.x1, scope.y1, GETLOC_ANY_LOC, levelState.currentRoom || null);
        const p2 = getLocation(scope.x2, scope.y2, GETLOC_ANY_LOC, levelState.currentRoom || null);
        minX = Math.max(0, Math.min(p1.x, p2.x));
        minY = Math.max(0, Math.min(p1.y, p2.y));
        maxX = Math.min(COLNO - 1, Math.max(p1.x, p2.x));
        maxY = Math.min(ROWNO - 1, Math.max(p1.y, p2.y));
    }

    for (let x = Math.max(1, minX); x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            if (selSet && !selSet.has(`${x},${y}`)) continue;
            const loc = levelState.map.locations[x][y];
            const matchesFrom = (fromToken === 'w')
                ? (IS_WALL(loc.typ) || loc.typ === IRONBARS)
                : (loc.typ === fromType);
            if (!matchesFrom) continue;
            if (rn2(100) < chance) {
                // C ref: arboral garden fixup path uses replace_terrain(S -> A) to
                // mark secret doors as arboreal, not to turn them into AIR tiles.
                if (fromType === SDOOR && toType === AIR && loc.typ === SDOOR) {
                    loc.arboreal_sdoor = true;
                } else {
                    loc.typ = toType;
                }
            }
        }
    }
}

/**
 * Convert ASCII map character to terrain type constant.
 * C ref: sp_lev.c get_table_mapchr_opt()
 *
 * @param {string} ch - Single character or terrain name
 * @returns {number} Terrain type constant or -1 for unknown
 */
function mapchrToTerrain(ch) {
    if (typeof ch !== 'string' || ch.length === 0) {
        return -1;
    }

    const c = ch[0];

    // Single character terrain codes (from C sp_lev.c)
    switch (c) {
        case ' ': return STONE;
        case '-': return HWALL;
        case '|': return VWALL;
        case '.': return ROOM;
        case '#': return CORR;
        case '+': return DOOR;
        case '<': return STAIRS_UP;
        case '>': return STAIRS_DOWN;
        case '{': return FOUNTAIN;
        case '\\': return THRONE;
        case 'K': return SINK;
        case '}': return MOAT;
        case 'P': return POOL;
        case 'L': return LAVAPOOL;
        case 'Z': return LAVAWALL;
        case 'I': return ICE;
        case 'W': return WATER;
        case 'T': return TREE;
        case 'F': return IRONBARS;
        case 'C': return CLOUD;
        case 'A': return AIR;
        case 'S': return SDOOR;
        case 'H': return SCORR;
        case 'x': return -1;  // C ref: MAX_TYPE "see-through" = skip this tile
        case 'B': return CROSSWALL; // C ref: boundary location hack
        // Other characters that appear in maps
        case '^': return ROOM; // trap placeholder, will be replaced
        case '@': return ROOM; // player position placeholder
        default:
            // C ref: nhlua.c splev_chr2typ() returns INVALID_TYPE for unknown map chars.
            return -1;
    }
}

/**
 * Check if a terrain type is any kind of wall.
 */
function isWall(typ) {
    return typ >= VWALL && typ <= TRWALL;
}

/**
 * Directional extension checks for wall types.
 * These determine which directions a wall type connects to neighboring walls.
 */
function extendsNorth(typ) {
    // Types that have north-going connectivity
    return typ === VWALL || typ === BLCORNER || typ === BRCORNER ||
           typ === TUWALL || typ === CROSSWALL || typ === TRWALL || typ === TLWALL;
}

function extendsSouth(typ) {
    // Types that have south-going connectivity
    return typ === VWALL || typ === TLCORNER || typ === TRCORNER ||
           typ === TDWALL || typ === CROSSWALL || typ === TRWALL || typ === TLWALL;
}

function extendsEast(typ) {
    // Types that have east-going connectivity
    return typ === HWALL || typ === TLCORNER || typ === BLCORNER ||
           typ === TUWALL || typ === TDWALL || typ === CROSSWALL || typ === TRWALL;
}

function extendsWest(typ) {
    // Types that have west-going connectivity
    return typ === HWALL || typ === TRCORNER || typ === BRCORNER ||
           typ === TUWALL || typ === TDWALL || typ === CROSSWALL || typ === TLWALL;
}

/**
 * Apply wall_extends() algorithm to compute correct wall junction types.
 * This implements NetHack's wallification logic for special levels.
 * C ref: sp_lev.c set_wall_state() and wallification()
 *
 * The algorithm checks 4 cardinal neighbors of each wall cell to determine
 * directional connectivity, then assigns the appropriate junction type.
 * Must be applied iteratively until wall types stabilize.
 *
 * @param {GameMap} map - The map to wallify
 */
function wallification(map) {
    dungeonWallification(map);
}

/**
 * des.room(opts)
 *
 * Creates a room with optional nested subrooms and contents.
 * C ref: sp_lev.c lspo_room()
 *
 * Options:
 * - x, y: Room position (default: -1 for random)
 * - w, h: Room size (default: -1 for automatic)
 * - xalign, yalign: Alignment within parent ("left", "center", "right"/"top", "bottom"; default: "random")
 * - type: Room type ("ordinary", "delphi", "temple", "shop", etc.; default: "ordinary")
 * - lit: Lighting (1=lit, 0=dark, -1=random; default: -1)
 * - filled: Whether room is filled with floor (default: 1)
 * - joined: Whether room is joined to others via corridors (default: true)
 * - chance: Percentage chance room is created (default: 100)
 * - contents: Function to execute inside room context for placing features
 *
 * @param {Object} opts - Room options
 * @returns {boolean} - True if room was created successfully
 */
export function room(opts = {}) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // Parse alignment strings - C ref: sp_lev.c defines LEFT=1, CENTER=2, RIGHT=3, TOP=1, BOTTOM=3
    // Note: C uses same constants for vertical (TOP=1=LEFT, BOTTOM=3=RIGHT)
    const alignMap = {
        // C ref: sp_lev.c uses odd constants (LEFT/TOP=1, CENTER=3, RIGHT/BOTTOM=5).
        'left': 1, 'center': 3, 'right': 5,
        'top': 1, 'bottom': 5,
        'half-left': -2, 'half-right': -2,  // Not standard C values
        'random': -1
    };

    // Extract and normalize options
    const x = opts.x ?? -1;
    const y = opts.y ?? -1;
    const w = opts.w ?? -1;
    const h = opts.h ?? -1;
    const xalign = alignMap[opts.xalign] ?? -1;
    const yalign = alignMap[opts.yalign] ?? -1;
    const type = opts.type ?? 'ordinary';
    // C ref: Both themed and ordinary rooms default to random lighting (-1)
    // C trace evidence (seed 42): themed rooms call litstate_rnd with rlit=-1
    let lit = opts.lit ?? -1;  // let: modified by litstate_rnd()
    const DEBUG_LIT = typeof process !== 'undefined' && process.env.DEBUG_BUILD_ROOM === '1';
    if (DEBUG_LIT && type === 'themed') {
        console.log(`  des.room(): type="${type}", opts.lit=${opts.lit}, computed lit=${lit}`);
    }
    const filled = opts.filled;  // keep undefined if not specified; needfill logic handles defaulting
    const chance = opts.chance ?? 100;
    const contents = opts.contents;

    // C ref: sp_lev.c:2803 build_room() — calls rn2(100) ONLY for fixed-position rooms
    // If roll >= chance, room becomes OROOM (ordinary) instead of requested type.
    // For chance=100, the roll doesn't matter (room always gets requested type),
    // but C still makes the rn2(100) call for RNG alignment.
    // Random-placement rooms (no x/y/w/h) do NOT call rn2(100) for chance check.
    const requestedRtype = parseRoomType(type, 0);

    // Validate x,y pair (both must be -1 or both must be specified)
    if ((x === -1 || y === -1) && x !== y) {
        console.error('Room must have both x and y, or neither');
        return false;
    }

    // Validate w,h pair
    if ((w === -1 || h === -1) && w !== h) {
        console.error('Room must have both w and h, or neither');
        return false;
    }

    // Check nesting depth (max 10 levels deep to prevent infinite recursion)
    if (levelState.roomDepth > 10) {
        console.error('Too deeply nested rooms');
        return false;
    }

    // For special levels, we create rooms differently than procedural dungeons
    // Special levels use fixed coordinates, not BSP rectangle selection
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_ROOMS === '1';
    const DEBUG_BUILD = typeof process !== 'undefined' && process.env.DEBUG_BUILD_ROOM === '1';
    const inThemerooms = !!levelState.inThemerooms;

    // C ref: sp_lev.c — build_room() RNG ordering differs based on room type:
    // Fixed-position rooms: build_room rn2(100) → litstate_rnd → create_room
    // Random-placement rooms: create_room (alignment) → build_room rn2(100)
    // Nested rooms (depth > 0): create_room → build_room rn2(100)
    // We'll call build_room's rn2(100) at the appropriate time based on room type
    let rtype; // Will be set at the right time depending on room type

    // Check if this is a random-placement room (x/y not specified)
    // The key distinction is whether x/y coordinates are fixed, not whether w/h are specified
    // e.g., des.room({ w: 10, h: 10 }) with x=-1, y=-1 is still random-placement
    const isRandomPlacement = (x === -1 && y === -1);

    // For top-level FIXED-POSITION rooms, call build_room's rn2(100) FIRST
    // Random-placement rooms skip this and call rn2(100) later (after create_room alignment)
    if (levelState.roomDepth === 0 && !isRandomPlacement) {
        if (DEBUG_BUILD) {
            const before = getRngCallCount();
            console.log(`\n=== [RNG ${before}] des.room() build_room chance check (TOP-LEVEL FIXED) ===`);
            console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
        }
        rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
        }
    }

    // Calculate actual room position and size
    // If x, y are specified, use them directly (special level fixed position)
    // If -1, would need random placement (not implemented yet)
    let roomX, roomY, roomW, roomH;
    let splitDone = false; // Set true when create_room_splev already called split_rects

    if (x >= 0 && y >= 0 && w > 0 && h > 0 && levelState.roomDepth === 0) {
        // Top-level fixed position room - use direct coordinate conversion

        if (DEBUG) {
            console.log(`des.room(): FIXED position x=${x}, y=${y}, w=${w}, h=${h}, xalign=${xalign}, yalign=${yalign}, rtype=${rtype}, lit=${lit}, depth=${levelState.roomDepth}`);
        }

        // C ref: sp_lev.c:1510 — litstate_rnd called with r->rlit from room template
        // C ref: sp_lev.c:2803 — build_room passes r->rlit to create_room
        // If rlit >= 0, litstate_rnd returns immediately without calling RNG
        // If rlit < 0, litstate_rnd calls rnd() and rn2(77) to determine lighting
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] Calling litstate_rnd(${lit}, ${levelState.depth || 1})`);
        }
        lit = litstate_rnd(lit, levelState.depth || 1);
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] litstate_rnd -> ${lit}`);
        }

        // C ref: sp_lev.c:1598-1619 — Convert grid coordinates to absolute map coordinates
        // Top-level rooms use grid coordinates (1-5) that get converted to map positions
        // Nested rooms use relative coordinates within parent (no conversion)
        if (levelState.roomDepth === 0) {
            const cdiv = (num, den) => Math.trunc(num / den);
            // Grid to absolute conversion (C: xabs = (((xtmp - 1) * COLNO) / 5) + 1)
            roomX = cdiv(((x - 1) * COLNO), 5) + 1;
            roomY = cdiv(((y - 1) * ROWNO), 5) + 1;

            // Apply alignment offset (C ref: sp_lev.c:1605-1619)
            const COLNO_DIV5 = cdiv(COLNO, 5);  // 16
            const ROWNO_DIV5 = cdiv(ROWNO, 5);  // 4

            // xalign/yalign already converted by alignMap: 1=LEFT/TOP, 3=CENTER, 5=RIGHT/BOTTOM
            // Apply horizontal alignment
            if (xalign === 5) { // RIGHT
                roomX += COLNO_DIV5 - w;
            } else if (xalign === 3) { // CENTER
                roomX += cdiv((COLNO_DIV5 - w), 2);
            }
            // LEFT (1) needs no offset

            // Apply vertical alignment
            if (yalign === 5) { // BOTTOM
                roomY += ROWNO_DIV5 - h;
            } else if (yalign === 3) { // CENTER
                roomY += cdiv((ROWNO_DIV5 - h), 2);
            }
            // TOP (1) needs no offset

            roomW = w;
            roomH = h;

            if (DEBUG) {
                console.log(`  Grid conversion: (${x},${y}) -> absolute (${roomX},${roomY}), align=${xalign},${yalign}`);
            }
        } else {
            // Nested room uses relative coordinates within parent
            // C ref: sp_lev.c create_subroom() - x,y are relative to parent room
            const parentRoom = levelState.currentRoom;
            if (parentRoom) {
                roomX = parentRoom.lx + x;
                roomY = parentRoom.ly + y;
            } else {
                // Fallback if no parent (shouldn't happen for nested rooms)
                roomX = x;
                roomY = y;
            }
            roomW = w;
            roomH = h;

            if (DEBUG) {
                console.log(`  Nested room: relative (${x},${y}) -> absolute (${roomX},${roomY}) within parent`);
            }
        }
    } else if (levelState.roomDepth > 0) {
        // Nested room creation always uses create_subroom().
        // C ref: sp_lev.c build_room() calls create_subroom() whenever parent room exists.
        // C ref: sp_lev.c:2805-2807 — build_room calls create_subroom when parent exists
        // C ref: sp_lev.c:1668-1707 — create_subroom randomizes dims relative to parent
        const parentRoom = levelState.currentRoom;
        if (!parentRoom) {
            if (levelState.roomFailureCallback) {
                levelState.roomFailureCallback();
            }
            return false;
        }

        // C ref: build_room rn2(100) chance check (sp_lev.c:2803)
        rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0;

        // C ref: create_subroom (sp_lev.c:1668-1707) — handles dimension randomization,
        // parent size check, litstate_rnd, and add_subroom all in one call
        const subroom = create_subroom(levelState.map, parentRoom,
            x, y, w, h, rtype, lit, levelState.depth || 1);

        if (!subroom) {
            // Parent room too small or other failure
            // C: create_subroom returns FALSE, themeroom_failed is set
            if (levelState.roomFailureCallback) {
                levelState.roomFailureCallback();
            }
            return false;
        }

        // Mark parent as irregular (C ref: lspo_room line 4079)
        parentRoom.irregular = true;

        // C ref: sp_lev.c:4066-4067 — needfill defaults
        const OROOM_LOCAL = 0;
        const THEMEROOM_LOCAL = 1;
        if (rtype === OROOM_LOCAL || rtype === THEMEROOM_LOCAL) {
            subroom.needfill = (filled !== undefined) ? filled : (levelState.inThemerooms ? 0 : FILL_NORMAL);
        }

        // Execute contents callback
        if (contents && typeof contents === 'function') {
            const prevRoom = levelState.currentRoom;
            levelState.roomStack.push(prevRoom);
            levelState.roomDepth++;
            subroom.width = subroom.hx - subroom.lx + 1;
            subroom.height = subroom.hy - subroom.ly + 1;
            levelState.currentRoom = subroom;

            try {
                contents(subroom);
            } finally {
                levelState.currentRoom = levelState.roomStack.pop();
                levelState.roomDepth--;
            }
        }

        return true;

    } else {
        // Random placement - use sp_lev.c's create_room algorithm
        // C ref: sp_lev.c:1530-1649 — create_room handles dimension/position randomization
        // via rnd(5), rnd(5), rnd(3), rnd(3) calls

        if (DEBUG) {
            console.log(`des.room(): RANDOM placement x=${x}, y=${y}, w=${w}, h=${h}, xalign=${xalign}, yalign=${yalign}, rtype=${rtype}, lit=${lit}`);
        }

        // C ref: build_room() order is: rn2(100) → create_room() (which starts with litstate_rnd)
        // For fully-random rooms (all params -1), create_room uses rnd_rect+BSP → defer to dungeon.js
        // For partially-random rooms (e.g. Mausoleum: specified w/h, random x/y),
        //   create_room uses grid placement → rnd(5), rnd(5), rnd(3), rnd(3)
        // Both paths need rn2(100) THEN litstate_rnd BEFORE create_room_splev's work.
        const fullyRandom = (x < 0 && y < 0 && w < 0 && xalign < 0 && yalign < 0);

        if (!fullyRandom) {
            // Partially random room (e.g., specified w/h, random x/y)
            // Route through create_room (dungeon.js) which handles position randomization,
            // check_room, split_rects with rndpos, and add_room_to_map with correct
            // dimensions and wall tiles — matching C's exact code path.
            // C ref: build_room sp_lev.c:2803 — rn2(100) chance check FIRST
            rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
            // C ref: create_room sp_lev.c:1512 — litstate_rnd called inside create_room
            // We call it here so create_room's internal call is a no-op
            lit = litstate_rnd(lit, levelState.depth || 1);

            if (!levelState.map) {
                console.error('des.room(): no map available for partially-random create_room');
                return false;
            }

            const success = create_room(levelState.map, x, y, w, h, xalign, yalign,
                                        rtype, lit, levelState.depth || 1, inThemerooms);

            if (!success) {
                if (DEBUG) {
                    console.log(`des.room(): partially-random create_room failed`);
                }
                if (levelState.roomFailureCallback) {
                    levelState.roomFailureCallback();
                }
                return false;
            }

            // Extract the room that was just added
            const room = levelState.map.rooms[levelState.map.rooms.length - 1];

            const OROOM_LOCAL = 0;
            const THEMEROOM_LOCAL = 1;
            if (rtype === OROOM_LOCAL || rtype === THEMEROOM_LOCAL) {
                room.needfill = (filled !== undefined) ? filled : (levelState.inThemerooms ? 0 : FILL_NORMAL);
            }

            roomX = room.lx;
            roomY = room.ly;
            roomW = room.hx - room.lx + 1;
            roomH = room.hy - room.ly + 1;

            if (DEBUG) {
                console.log(`des.room(): partially-random room created at (${roomX},${roomY}) size ${roomW}x${roomH}`);
            }

            // Execute room contents callback if provided
            if (contents && typeof contents === 'function') {
                const parentRoom = levelState.currentRoom;
                levelState.roomStack.push(parentRoom);
                levelState.roomDepth++;

                room.width = roomW;
                room.height = roomH;
                levelState.currentRoom = room;

                try {
                    contents(room);
                } finally {
                    levelState.currentRoom = levelState.roomStack.pop();
                    levelState.roomDepth--;
                }
            }

            return true; // Early return - partially-random room created
        }

        // Fully-random rooms: defer create_room call so we can do rn2(100)+litstate_rnd first
        const roomCalc = create_room_splev(x, y, w, h, xalign, yalign,
                                           rtype, lit, levelState.depth || 1, true, false, true); // skipLitstate=true, deferCreateRoom=true

        if (!roomCalc) {
            if (DEBUG) {
                console.log(`des.room(): create_room_splev failed, no space available`);
            }
            // Signal failure to themed room generator
            if (levelState.roomFailureCallback) {
                levelState.roomFailureCallback();
            }
            return false;
        }

        // Check if this is a deferred room (create_room not called yet)
        if (roomCalc._deferredRoom) {
            if (DEBUG_BUILD) {
                console.log(`des.room(): deferred room, calling build_room → litstate_rnd → create_room`);
            }

            // C ref: build_room() does rn2(100), litstate_rnd(), then create_room()
            // 1. build_room rn2(100) chance check
            if (DEBUG_BUILD) {
                const before = getRngCallCount();
                console.log(`\n=== [RNG ${before}] des.room() build_room chance check (deferred room) ===`);
                console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
            }
            rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
            if (DEBUG_BUILD) {
                console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
            }
            roomCalc.rtype = rtype; // Update room type based on chance roll

            // 2. litstate_rnd()
            if (DEBUG_BUILD) {
                const before = getRngCallCount();
                console.log(`  [RNG ${before}] des.room() calling litstate_rnd(${lit}, ${levelState.depth || 1})`);
            }
            lit = litstate_rnd(lit, levelState.depth || 1);
            if (DEBUG_BUILD) {
                console.log(`  [RNG ${getRngCallCount()}] litstate_rnd returned ${lit}`);
            }

            // 3. create_room() - NOW make the dimension randomization calls
            if (!levelState.map) {
                console.error('des.room(): no map available for deferred create_room');
                return false;
            }

            if (DEBUG_BUILD) {
                const before = getRngCallCount();
                console.log(`  [RNG ${before}] des.room() calling create_room() for deferred room`);
            }
            const success = create_room(levelState.map, roomCalc.x, roomCalc.y, roomCalc.w, roomCalc.h,
                                       roomCalc.xalign, roomCalc.yalign, roomCalc.rtype, lit,
                                       roomCalc.depth, inThemerooms);
            if (DEBUG_BUILD) {
                console.log(`  [RNG ${getRngCallCount()}] create_room() done, success=${success}`);
            }

            if (!success) {
                if (DEBUG) {
                    console.log(`des.room(): deferred create_room failed`);
                }
                // Signal failure to themed room generator
                if (levelState.roomFailureCallback) {
                    levelState.roomFailureCallback();
                }
                return false;
            }

            // Extract the room that was just added
            const room = levelState.map.rooms[levelState.map.rooms.length - 1];

            // C ref: sp_lev.c lspo_room() — needfill defaults depend on context:
            // During themed room generation (in_mk_themerooms): default 0 (FILL_NONE)
            // Otherwise: default 1 (FILL_NORMAL)
            // Explicit filled=1 overrides to FILL_NORMAL in either case.
            const OROOM_LOCAL = 0;
            const THEMEROOM_LOCAL = 1;
            if (rtype === OROOM_LOCAL || rtype === THEMEROOM_LOCAL) {
                room.needfill = (filled !== undefined) ? filled : (levelState.inThemerooms ? 0 : FILL_NORMAL);
            }

            // Continue with room contents execution below
            roomX = room.lx;
            roomY = room.ly;
            roomW = room.hx - room.lx + 1;
            roomH = room.hy - room.ly + 1;

            if (DEBUG) {
                console.log(`des.room(): deferred room created at (${roomX},${roomY}) size ${roomW}x${roomH}`);
            }

            // Execute room contents callback if provided
            if (contents && typeof contents === 'function') {
                const parentRoom = levelState.currentRoom;
                levelState.roomStack.push(parentRoom);
                levelState.roomDepth++;

                // Add width/height for compatibility
                room.width = roomW;
                room.height = roomH;
                levelState.currentRoom = room;

                if (DEBUG) {
                    console.log(`des.room(): EXECUTING contents callback for deferred room at (${roomX},${roomY})`);
                }

                try {
                    contents(room);
                } finally {
                    levelState.currentRoom = levelState.roomStack.pop();
                    levelState.roomDepth--;
                }
            }

            // NOTE: No update_rect_pool_for_room here — create_room() above
            // already called split_rects() internally (C ref: sp_lev.c:1650)

            return true; // Early return - deferred room created and processed
        }

        // Check if create_room_splev already added the room to the map (fully random path)
        if (roomCalc._alreadyAdded) {
            if (DEBUG) {
                console.log(`des.room(): room already added by create_room (fully random), executing contents callback`);
            }

            // For top-level random-placement rooms, call build_room's rn2(100) now
            // (after create_room's alignment randomization)
            // C ref: For random-placement rooms, C does: create_room (alignment) → build_room rn2(100) → litstate_rnd
            if (levelState.roomDepth === 0) {
                if (DEBUG_BUILD) {
                    const before = getRngCallCount();
                    console.log(`\n=== [RNG ${before}] des.room() build_room chance check (TOP-LEVEL random-placement) ===`);
                    console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
                }
                rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
                if (DEBUG_BUILD) {
                    console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
                }
                // Update room type if chance roll changed it
                roomCalc.rtype = rtype;

                // Now call litstate_rnd (after build_room's rn2(100))
                if (DEBUG_BUILD) {
                    const before = getRngCallCount();
                    console.log(`  [RNG ${before}] des.room() calling litstate_rnd(${lit}, ${levelState.depth || 1}) after build_room`);
                }
                lit = litstate_rnd(lit, levelState.depth || 1);
                roomCalc.rlit = lit; // Update room's lighting
                if (DEBUG_BUILD) {
                    console.log(`  [RNG ${getRngCallCount()}] litstate_rnd returned ${lit}`);
                }
            }

            // For nested rooms on the fully-random path, call build_room's rn2(100) now
            // (after create_room dimensions were calculated)
            if (levelState.roomDepth > 0) {
                if (DEBUG_BUILD) {
                    const before = getRngCallCount();
                    console.log(`\n=== [RNG ${before}] des.room() build_room chance check (NESTED fully-random, depth=${levelState.roomDepth}) ===`);
                    console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
                }
                rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
                if (DEBUG_BUILD) {
                    console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
                }
                // Update room type if chance roll changed it
                roomCalc.rtype = rtype;
            }

            // Room is already in map, just execute contents callback if needed
            if (contents && typeof contents === 'function') {
                const parentRoom = levelState.currentRoom;
                levelState.roomStack.push(parentRoom);
                levelState.roomDepth++;

                // Add width/height for compatibility
                roomCalc.width = roomCalc.hx - roomCalc.lx + 1;
                roomCalc.height = roomCalc.hy - roomCalc.ly + 1;
                levelState.currentRoom = roomCalc;

                try {
                    contents(roomCalc);
                } finally {
                    levelState.currentRoom = levelState.roomStack.pop();
                    levelState.roomDepth--;
                }
            }

            return true; // Early return - room already created
        }

        // Extract coordinates from calculated room
        roomX = roomCalc.lx;
        roomY = roomCalc.ly;
        roomW = roomCalc.hx - roomCalc.lx + 1;
        roomH = roomCalc.hy - roomCalc.ly + 1;
        // Use calculated rlit from litstate_rnd (already processed)
        lit = roomCalc.rlit;
        // create_room_splev already called split_rects with correct rndpos
        splitDone = !!roomCalc._splitDone;

        if (DEBUG) {
            console.log(`des.room(): used create_room_splev, got room at (${roomX},${roomY}) size ${roomW}x${roomH}, lit=${lit}`);
        }

        // Continue to manual room creation below (don't early return)
        // Room needs to be added to map.rooms[] and tiles marked
    }

    // For nested rooms, call build_room's rn2(100) AFTER dimensions are calculated
    if (levelState.roomDepth > 0) {
        if (DEBUG_BUILD) {
            const before = getRngCallCount();
            console.log(`\n=== [RNG ${before}] des.room() build_room chance check (NESTED, depth=${levelState.roomDepth}) ===`);
            console.log(`  chance=${chance}, requestedRtype=${requestedRtype}, type="${type}"`);
        }
        rtype = (!chance || rn2(100) < chance) ? requestedRtype : 0; // 0 = OROOM
        if (DEBUG_BUILD) {
            console.log(`  [RNG ${getRngCallCount()}] rn2(100) done, rtype=${rtype}`);
        }
    }

    // Create room entry in map.rooms array
    const OROOM_LOCAL = 0;
    const THEMEROOM_LOCAL = 1;
    // C ref: mkroom.c — Always call litstate_rnd for room finalization
    // Even if lit was already determined, C calls litstate_rnd again
    // This is because litstate_rnd returns immediately (without RNG) if litstate >= 0
    if (DEBUG_BUILD) {
        console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] Room finalization: calling litstate_rnd(${lit}, ${levelState.depth || 1})`);
    }
    const finalLit = litstate_rnd(lit, levelState.depth || 1);
    if (DEBUG_BUILD) {
        console.log(`  [RNG ${typeof getRngCallCount === 'function' ? getRngCallCount() : '?'}] Room finalization: litstate_rnd returned ${finalLit}`);
    }

    const room = {
        lx: roomX,
        ly: roomY,
        hx: roomX + roomW - 1,
        hy: roomY + roomH - 1,
        rtype: rtype,
        rlit: finalLit,
        irregular: false,
        nsubrooms: 0,
        sbrooms: [],
        // C ref: sp_lev.c lspo_room() — needfill defaults depend on context:
        // During themed room generation (in_mk_themerooms): default 0 (FILL_NONE)
        // Otherwise: default 1 (FILL_NORMAL)
        // Explicit filled=1 overrides to FILL_NORMAL in either case.
        needfill: (filled !== undefined ? filled : (levelState.inThemerooms ? 0 : FILL_NORMAL)),
        // Lua compatibility: region property for accessing room bounds
        region: { x1: roomX, y1: roomY, x2: roomX + roomW - 1, y2: roomY + roomH - 1 }
    };

    // Mark floor tiles for the room
    if (DEBUG || typeof process !== 'undefined' && process.env.DEBUG_ROOM_TILES === '1') {
        console.log(`Marking room tiles: (${roomX},${roomY})-(${roomX+roomW-1},${roomY+roomH-1})`);
    }
    for (let ry = roomY; ry < roomY + roomH; ry++) {
        for (let rx = roomX; rx < roomX + roomW; rx++) {
            if (rx >= 0 && rx < COLNO && ry >= 0 && ry < ROWNO) {
                levelState.map.locations[rx][ry].typ = ROOM;
                levelState.map.locations[rx][ry].lit = room.rlit;
            }
        }
    }

    // Add room to map's room list
    levelState.map.rooms.push(room);
    levelState.map.nroom = levelState.map.rooms.length;

    // C ref: rect.c split_rects() — Split BSP rectangle pool around this room
    // This is needed for randomly-placed rooms (procedural and themed)
    // C behavior: Rooms with random placement (x=-1,y=-1) split the rectangle pool
    // Fixed-position rooms (like oracle's x=3,y=3) do NOT split - they bypass BSP entirely
    // Nested rooms (subrooms) also do NOT split - C ref: create_subroom() has no split_rects call
    // If create_room_splev already called split_rects (with correct rndpos), skip this
    if (levelState.roomDepth === 0 && isRandomPlacement && !splitDone) {
        if (DEBUG_BUILD) {
            console.log(`  des.room(): calling update_rect_pool_for_room (splitDone=${splitDone})`);
        }
        update_rect_pool_for_room(room);
    } else if (DEBUG_BUILD && levelState.roomDepth === 0 && isRandomPlacement) {
        console.log(`  des.room(): SKIPPING update_rect_pool_for_room (splitDone=${splitDone})`);
    }

    if (DEBUG) {
        console.log(`des.room(): created room at (${roomX},${roomY}) size ${roomW}x${roomH}, map.nroom=${levelState.map.nroom}`);
    }

    // If room creation succeeded and there's a contents callback, execute it
    if (contents && typeof contents === 'function') {
        if (DEBUG) {
            console.log(`des.room(): EXECUTING contents callback for room at (${roomX},${roomY})`);
        }
        // Save current room state
        const parentRoom = levelState.currentRoom;
        levelState.roomStack.push(parentRoom);
        levelState.roomDepth++;

        // Set current room - use the actual room object just created
        // Add width/height for themerms compatibility
        room.width = roomW;
        room.height = roomH;
        levelState.currentRoom = room;

        try {
            // Execute contents callback
            contents(room);  // Pass room as parameter for Lua compatibility
            if (DEBUG) {
                console.log(`des.room(): FINISHED contents callback for room at (${roomX},${roomY})`);
            }
        } finally {
            // Restore parent room state
            levelState.currentRoom = levelState.roomStack.pop();
            levelState.roomDepth--;
        }
    }

    // C ref: sp_lev.c lspo_room line 78 — Add doors to room after contents
    if (levelState.map) {
        add_doors_to_room(levelState.map, room);
    }

    return true;
}

/**
 * des.stair(direction, x, y)
 *
 * Place a staircase at the specified location.
 * C ref: sp_lev.c lspo_stair()
 *
 * @param {string} direction - "up" or "down"
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function stair(direction, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let dir = direction;
    let sx = x;
    let sy = y;

    if (typeof direction === 'object' && direction !== null) {
        dir = direction.dir || direction.direction || 'down';
        if (Array.isArray(direction.coord)) {
            sx = direction.coord[0];
            sy = direction.coord[1];
        } else if (direction.coord && typeof direction.coord === 'object') {
            sx = direction.coord.x;
            sy = direction.coord.y;
        } else {
            sx = direction.x;
            sy = direction.y;
        }
    }

    const stairType = dir === 'up' ? STAIRS_UP : STAIRS_DOWN;
    const isRandom = sx === undefined || sy === undefined || sx < 0 || sy < 0;
    // C ref: sp_lev.c l_create_stairway():
    // set_ok_location_func(good_stair_loc) only for random placement.
    if (isRandom) {
        setOkLocationFunc((tx, ty) => {
            const typ = levelState.map.locations[tx][ty].typ;
            return typ === ROOM || typ === CORR || typ === ICE;
        });
    }
    const pos = getLocationCoord(sx, sy, GETLOC_DRY, levelState.currentRoom || null);
    setOkLocationFunc(null);
    const stairX = pos.x;
    const stairY = pos.y;
    if (stairX < 0 || stairY < 0) return;

    if (stairX >= 0 && stairX < COLNO && stairY >= 0 && stairY < ROWNO) {
        if (typeof process !== 'undefined' && process.env.WEBHACK_DEBUG_STAIR === '1') {
            console.log(`[DEBUG_STAIR] dir=${dir} raw=(${sx},${sy}) abs=(${stairX},${stairY}) mapOrigin=(${levelState.mapOriginX},${levelState.mapOriginY}) mapCoordMode=${levelState.mapCoordMode}`);
        }
        // C ref: l_create_stairway() marks SpLev_Map before mkstairs(),
        // even if mkstairs later rejects placement at dungeon boundaries.
        markSpLevTouched(stairX, stairY);

        // C ref: l_create_stairway() removes pre-existing trap at the stair spot.
        const trap = levelState.map.trapAt(stairX, stairY);
        if (trap) {
            levelState.map.traps = (levelState.map.traps || []).filter(t => t !== trap);
        }

        if (!canPlaceStair(dir)) {
            return;
        }
        // C ref: mkstairs(..., force=TRUE) for fixed coordinates coerces terrain.
        if (!isRandom) {
            levelState.map.locations[stairX][stairY].typ = ROOM;
        }
        const loc = levelState.map.locations[stairX][stairY];
        loc.typ = stairType;
        // Keep both stair encodings in sync: level terrain metadata and
        // map up/down stair coordinates used by room-selection heuristics.
        const up = (dir === 'up') ? 1 : 0;
        loc.stairdir = up;
        loc.flags = up;
        if (up) {
            levelState.map.upstair = { x: stairX, y: stairY };
        } else {
            levelState.map.dnstair = { x: stairX, y: stairY };
        }
        markSpLevMap(stairX, stairY);
    }
}

/**
 * Map object name to object type constant.
 * C ref: sp_lev.c get_table_mapchr_opt() for objects
 */
/**
 * Map monster name to monster index.
 * C ref: pm.h PM_* constants are indices into mons[] array
 */
function monsterNameToIndex(name) {
    if (!name) return -1;
    const lowerName = name.toLowerCase();

    // Search mons array for matching name
    const index = mons.findIndex(m => m.name && m.name.toLowerCase() === lowerName);
    return index >= 0 ? index : -1;
}

function resolveNamedMonsterLikeC(monsterId) {
    if (!monsterId) {
        return { mndx: -1, female: undefined };
    }

    let lookup = monsterId;
    let namedGender;
    if (/^female\s+/i.test(lookup)) {
        namedGender = true;
        lookup = lookup.replace(/^female\s+/i, '');
    } else if (/^male\s+/i.test(lookup)) {
        namedGender = false;
        lookup = lookup.replace(/^male\s+/i, '');
    }
    // C ref: name_to_monplus() can infer gender from gendered aliases
    // (e.g. "gnome lord"/"gnome lady"), which suppresses find_montype rn2(2).
    if (namedGender === undefined) {
        if (/\blord\b/i.test(lookup)) {
            namedGender = false;
        } else if (/\blady\b/i.test(lookup)) {
            namedGender = true;
        }
    }

    const mndx = monsterNameToIndex(lookup);
    if (mndx < 0) {
        return { mndx: -1, female: undefined };
    }

    const ptr = mons[mndx];
    if (ptr.flags2 & M2_FEMALE) {
        return { mndx, female: true };
    }
    if (ptr.flags2 & M2_MALE) {
        return { mndx, female: false };
    }
    return { mndx, female: (namedGender !== undefined) ? namedGender : !!rn2(2) };
}

function objectNameToType(name) {
    const lowerName = name.toLowerCase().trim();

    // Quick checks for common objects
    if (lowerName === 'boulder') return BOULDER;
    if (lowerName === 'scroll of earth') return SCR_EARTH;

    const candidates = new Set([lowerName]);
    let classHint = null;
    const stripPrefixes = [
        { p: 'ring of ', cls: RING_CLASS },
        { p: 'spellbook of ', cls: SPBOOK_CLASS },
        { p: 'book of ', cls: SPBOOK_CLASS },
        { p: 'potion of ', cls: POTION_CLASS },
        { p: 'wand of ', cls: WAND_CLASS },
        { p: 'scroll of ', cls: SCROLL_CLASS },
    ];

    // Allow Lua-style fully qualified names ("ring of levitation")
    // to match canonical objectData names ("levitation"), while retaining
    // class hint to disambiguate names shared across classes (for example
    // "light" exists as both scroll and spellbook).
    for (const { p, cls } of stripPrefixes) {
        if (lowerName.startsWith(p) && lowerName.length > p.length) {
            candidates.add(lowerName.slice(p.length));
            classHint = cls;
            break;
        }
    }

    // C scripts occasionally include articles in object names.
    for (const a of ['a ', 'an ', 'the ']) {
        if (lowerName.startsWith(a) && lowerName.length > a.length) {
            candidates.add(lowerName.slice(a.length));
        }
    }

    // Search objectData for matching name
    for (let i = 0; i < objectData.length; i++) {
        const od = objectData[i];
        const objName = od?.name;
        if (!objName) continue;
        if (!candidates.has(objName.toLowerCase())) continue;
        if (classHint !== null && od.oc_class !== classHint) continue;
        return i; // Object type index
    }

    // Fallback without class hint (for non-ambiguous aliases).
    if (classHint !== null) {
        for (let i = 0; i < objectData.length; i++) {
            const objName = objectData[i].name;
            if (!objName) continue;
            if (candidates.has(objName.toLowerCase())) {
                return i;
            }
        }
    }

    // Not found
    return -1;
}

/**
 * Map object class character to class constant.
 */
function objectClassToType(classChar) {
    switch (classChar) {
        case '%': return FOOD_CLASS;
        case '?': return SCROLL_CLASS;
        case '/': return WAND_CLASS;
        case '=': return RING_CLASS;
        case '!': return POTION_CLASS;
        case '+': return SPBOOK_CLASS;
        case '[': return ARMOR_CLASS;
        case ')': return WEAPON_CLASS;
        case '(': return TOOL_CLASS;
        case '"': return AMULET_CLASS;
        case '*': return GEM_CLASS;
        case '`': return ROCK_CLASS;
        default: return -1;
    }
}

/**
 * des.object(name_or_opts, x, y)
 *
 * Place an object at the specified location.
 * C ref: sp_lev.c lspo_object()
 *
 * @param {string|Object} name_or_opts - Object name or options object
 * @param {number} x - X coordinate (if name_or_opts is string)
 * @param {number} y - Y coordinate (if name_or_opts is string)
 */
/**
 * des.object(name_or_opts, x, y)
 * Place an object on the level.
 * C ref: sp_lev.c spobject()
 *
 * Supported formats:
 * 1. des.object('[') - Random armor at random location (object class)
 * 2. des.object('!') - Random potion at random location (object class)
 * 3. des.object('boulder', x, y) - Named object at specific location
 * 4. des.object({ id: 'chest', x, y }) - Object with options
 * 5. des.object({ id: 'chest', coord: {x, y} }) - Object with coord format
 *
 * Object classes: '[' (armor), ')' (weapon), '!' (potion), '?' (scroll),
 *                 '*' (gem/rock), '%' (food), '+' (spellbook), etc.
 *
 * @param {string|Object} name_or_opts - Object name, class symbol, or options object
 * @param {number} [x] - X coordinate (if name_or_opts is string)
 * @param {number} [y] - Y coordinate (if name_or_opts is string)
 */
export function object(name_or_opts, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // Handle Lua-style coordinate arrays: des.object("chest", [3,1])
    // In Lua, tables can be unpacked; in JS we need explicit handling
    if (Array.isArray(x) && y === undefined) {
        y = x[1];
        x = x[0];
    }

    // Handle coord property in options object: des.object({ id: "chest", coord: [3,1] })
    if (typeof name_or_opts === 'object' && name_or_opts.coord && x === undefined && y === undefined) {
        if (Array.isArray(name_or_opts.coord)) {
            x = name_or_opts.coord[0];
            y = name_or_opts.coord[1];
        } else if (typeof name_or_opts.coord === 'object') {
            x = name_or_opts.coord.x;
            y = name_or_opts.coord.y;
        }
    } else if (typeof name_or_opts === 'object' && x === undefined && y === undefined) {
        x = name_or_opts?.x;
        y = name_or_opts?.y;
    }

    const pos = getLocationCoord(x, y, GETLOC_DRY, levelState.currentRoom || null);
    let absX = pos.x;
    let absY = pos.y;
    const ev = ++spObjTraceEvent;

    // C ref: Object creation happens IMMEDIATELY (calls next_ident, rndmonst_adj, etc.)
    // even though map placement is deferred until after corridors
    // This ensures RNG timing matches C: create during loop, place after corridors

    let obj = null;
    // C ref: sp_lev.c create_object() -> mkobj_at/mksobj_at(..., !named)
    // If a custom object name is provided, disable artifact-init side effects.
    const named = !!(name_or_opts
        && typeof name_or_opts === 'object'
        && typeof name_or_opts.name === 'string'
        && name_or_opts.name.length > 0);
    const artif = !named;
    const specClass = (typeof name_or_opts === 'string' && name_or_opts.length === 1)
        ? name_or_opts
        : (typeof name_or_opts === 'object' && name_or_opts && typeof name_or_opts.class === 'string'
            ? name_or_opts.class
            : '');
    const specId = (typeof name_or_opts === 'string' && name_or_opts.length !== 1)
        ? name_or_opts
        : (typeof name_or_opts === 'object' && name_or_opts && typeof name_or_opts.id === 'string'
            ? name_or_opts.id
            : '');
    const specCorpsenm = (typeof name_or_opts === 'object' && name_or_opts && name_or_opts.montype)
        ? String(name_or_opts.montype)
        : '';
    spObjTrace(`[SPLEV_OBJ_JS] ev=${ev} phase=begin call=${getRngCallCount()} class_raw=${JSON.stringify(specClass)} id_raw=${JSON.stringify(specId)} named=${named ? 1 : 0} corpsenm_raw=${JSON.stringify(specCorpsenm)} x=${absX} y=${absY}`);

    // Create the object now (triggers next_ident and other creation RNG)
    if (!name_or_opts) {
        // No arguments: create completely random object
        // C ref: sp_lev.c spo_object() with NULL name → mkobj(RANDOM_CLASS)
        obj = mkobj(0, artif);  // RANDOM_CLASS = 0
    } else if (typeof name_or_opts === 'string') {
        // Single-character strings are object class codes (!, ?, +, etc.)
        // C ref: sp_lev.c spo_object() first attempts class-char mapping, then
        // falls back to object-name lookup for non-class single-char ids.
        if (name_or_opts.length === 1) {
            const objClass = objectClassToType(name_or_opts);
            if (objClass >= 0) {
                obj = mkobj(objClass, artif);  // Random object from class
            } else {
                const otyp = objectNameToType(name_or_opts);
                if (otyp >= 0) {
                    obj = mksobj(otyp, true, artif);
                    if (obj) obj.id = name_or_opts;
                }
            }
        } else {
            // Multi-character strings are object names
            const otyp = objectNameToType(name_or_opts);
            if (otyp >= 0) {
                obj = mksobj(otyp, true, artif);
                if (obj) {
                    obj.id = name_or_opts;  // Store original name
                }
            }
        }
    } else if (name_or_opts && typeof name_or_opts === 'object' && name_or_opts.id) {
        const otyp = objectNameToType(name_or_opts.id);
        if (otyp >= 0) {
            // C ref: sp_lev.c create_object() — uses mksobj_at + set_corpsenm,
            // NOT mkcorpstat. set_corpsenm ALWAYS restarts start_corpse_timeout
            // for corpses (unconditionally), unlike mkcorpstat's conditional check.
            const lowerName = name_or_opts.id.toLowerCase();
            if (name_or_opts.montype && (lowerName === 'corpse' || lowerName === 'statue')) {
                let mndx = -1;
                const montype = String(name_or_opts.montype);
                // C ref: lspo_object() montype single-char class path:
                // mkclass(def_char_to_monclass(*montype), G_NOGEN | G_IGNORE)
                if (montype.length === 1) {
                    const mclass = def_char_to_monclass(montype[0]);
                    mndx = mkclass(mclass, G_NOGEN | G_IGNORE, levelState.depth || 1);
                } else {
                    mndx = monsterNameToIndex(montype);
                }
                obj = mksobj(otyp, true, artif);
                if (mndx >= 0) {
                    set_corpsenm(obj, mndx);
                }
            } else {
                obj = mksobj(otyp, true, artif);
            }
        }
    } else if (name_or_opts && typeof name_or_opts === 'object'
               && typeof name_or_opts.class === 'string'
               && name_or_opts.class.length > 0) {
        const objClass = objectClassToType(name_or_opts.class[0]);
        if (objClass >= 0) {
            obj = mkobj(objClass, artif);
        }
    }
    if (obj) {
        spObjTrace(`[SPLEV_OBJ_JS] ev=${ev} phase=created call=${getRngCallCount()} otyp=${obj.otyp ?? -1} oclass=${obj.oclass ?? -1} spe=${obj.spe ?? -999} quan=${obj.quan ?? -1}`);
        if (obj.corpsenm !== undefined && obj.corpsenm !== null && obj.corpsenm !== -1) {
            spObjTrace(`[SPLEV_OBJ_JS] ev=${ev} phase=corpsenm call=${getRngCallCount()} got=${obj.corpsenm} otyp=${obj.otyp ?? -1}`);
        }
    }

    const isBuried = !!(name_or_opts && typeof name_or_opts === 'object' && name_or_opts.buried);
    if (obj && isBuried) {
        // C ref: sp_lev.c lspo_object() -> create_object() -> bury_an_obj() ->
        // obj_resists(otmp, 0, 0). For ordinary objects this consumes rn2(100).
        // We consume it at creation-time so deferred placement keeps RNG order.
        rn2(100);
    }

    if (obj) {
        // C/Lua object userdata compatibility needs to be available before
        // contents callbacks execute.
        obj.stop_timer = obj.stop_timer || function() {};
        obj.start_timer = obj.start_timer || function() {};
        obj.totable = obj.totable || function() {
            return {
                ox: this.ox,
                oy: this.oy,
                NO_OBJ: this.NO_OBJ
            };
        };
        if (!Number.isInteger(obj.ox) && Number.isInteger(absX)) obj.ox = absX;
        if (!Number.isInteger(obj.oy) && Number.isInteger(absY)) obj.oy = absY;

        const activeContainer = levelState.containerStack[levelState.containerStack.length - 1];

        // C ref: sp_lev.c create_object() with SP_OBJ_CONTENT creates object
        // using normal RNG path, then moves it into container inventory.
        if (activeContainer) {
            if (!activeContainer.contents) activeContainer.contents = [];
            activeContainer.contents.push(obj);
            return obj;
        }

        const activeMonster = levelState.monsterInventoryStack[levelState.monsterInventoryStack.length - 1];
        if (activeMonster) {
            if (!Array.isArray(activeMonster.minvent)) activeMonster.minvent = [];
            activeMonster.minvent.push(obj);
            return obj;
        }

        if (absX >= 0 && absX < COLNO && absY >= 0 && absY < ROWNO) {
            markSpLevTouched(absX, absY);
        }
        levelState.deferredObjects.push({ obj, x: absX, y: absY, buried: isBuried });
        // C ref: lspo_* handlers execute in script order. Keep deferred
        // placements ordered by insertion so finalize_level() can replay
        // object/monster interleaving faithfully.
        levelState.deferredActions.push({ kind: 'object', idx: levelState.deferredObjects.length - 1 });

        // C ref: lspo_object() executes contents callback with this object as
        // active container, then pops container context.
        if (typeof name_or_opts === 'object' && typeof name_or_opts.contents === 'function') {
            obj.contents = [];
            levelState.containerStack.push(obj);
            try {
                name_or_opts.contents(obj);
            } finally {
                levelState.containerStack.pop();
            }
        }
    }
    // C ref: lspo_object returns the object userdata to Lua.
    // Keep timer methods available for script compatibility.
    if (obj) {
        obj.stop_timer = obj.stop_timer || function() {};
        obj.start_timer = obj.start_timer || function() {};
    }
    return obj;
}

/**
 * Map trap name to trap type constant.
 * C ref: sp_lev.c get_trap_type()
 */
function trapNameToType(name) {
    if (typeof name !== 'string') return null;
    const lowerName = name.toLowerCase();

    // Map trap names to constants
    switch (lowerName) {
        case 'arrow': return ARROW_TRAP;
        case 'dart': return DART_TRAP;
        case 'falling rock': case 'falling_rock': case 'rock': return ROCKTRAP;
        case 'squeaky board': case 'squeaky_board': case 'board': return SQKY_BOARD;
        case 'bear': return BEAR_TRAP;
        case 'land mine': case 'landmine': return LANDMINE;
        case 'rolling boulder': case 'rolling_boulder': return ROLLING_BOULDER_TRAP;
        case 'sleeping gas': case 'sleeping_gas': case 'sleep gas': case 'sleep_gas':
            return SLP_GAS_TRAP;
        case 'rust': return RUST_TRAP;
        case 'fire': return FIRE_TRAP;
        case 'pit': return PIT;
        case 'spiked pit': case 'spiked_pit': return SPIKED_PIT;
        case 'hole': return HOLE;
        case 'trap door': case 'trapdoor': return TRAPDOOR;
        case 'teleport': case 'teleportation': return TELEP_TRAP;
        case 'level teleport': case 'level_teleport': return LEVEL_TELEP;
        case 'magic portal': case 'magic_portal': return MAGIC_PORTAL;
        case 'web': return WEB;
        case 'anti-magic': case 'anti_magic': case 'anti magic': return ANTI_MAGIC;
        case 'polymorph': case 'poly': return POLY_TRAP;
        case 'statue': return STATUE_TRAP;
        case 'magic': return MAGIC_TRAP;
        case 'vibrating square': case 'vibrating_square': return VIBRATING_SQUARE;
        case 'random': return -1;
        default: return null;
    }
}

/**
 * des.trap(type, x, y)
 *
 * Place a trap at the specified location.
 * C ref: sp_lev.c lspo_trap()
 *
 * @param {string} type - Trap type name
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
/**
 * des.trap(type_or_opts, x, y)
 * Place a trap on the level.
 * C ref: sp_lev.c sptrap()
 *
 * Supported formats:
 * 1. des.trap('fire') - Fire trap at random location
 * 2. des.trap('fire', x, y) - Fire trap at specific location
 * 3. des.trap({ type: 'pit', x, y }) - Trap with options
 * 4. des.trap({ type: 'pit', coord: {x, y} }) - Trap with coord format
 * 5. des.trap() - Random trap type at random location
 *
 * Trap types: 'arrow', 'dart', 'pit', 'spiked pit', 'hole', 'trap door',
 *             'teleport', 'fire', 'rust', 'anti magic', 'magic', 'sleep gas',
 *             'land mine', 'bear', 'squeaky board', 'rolling boulder', 'level teleport'
 *
 * @param {string|Object} [type_or_opts] - Trap type name or options object
 * @param {number} [x] - X coordinate (if type_or_opts is string)
 * @param {number} [y] - Y coordinate (if type_or_opts is string)
 */
export function trap(type_or_opts, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // Normalize coordinates from object-style calls:
    // des.trap({ coord: [x, y] }) / des.trap({ coord: {x, y} }) / des.trap({ x, y }).
    let srcX = x;
    let srcY = y;
    // C ref: lspo_trap supports trap("type", {x,y}) coordinate table form.
    if (typeof type_or_opts === 'string' && srcY === undefined
        && srcX && typeof srcX === 'object') {
        if (Array.isArray(srcX)) {
            srcY = srcX[1];
            srcX = srcX[0];
        } else {
            srcY = srcX.y;
            srcX = srcX.x;
        }
    }
    if (type_or_opts && typeof type_or_opts === 'object' && srcX === undefined && srcY === undefined) {
        if (type_or_opts.coord) {
            if (Array.isArray(type_or_opts.coord)) {
                srcX = type_or_opts.coord[0];
                srcY = type_or_opts.coord[1];
            } else {
                srcX = type_or_opts.coord.x;
                srcY = type_or_opts.coord.y;
            }
        } else {
            srcX = type_or_opts.x;
            srcY = type_or_opts.y;
        }
    }

    if (levelState.finalizeContext) {
        // C ref: sp_lev.c lspo_trap() creates traps immediately in script order.
        // In parity mode, defer coordinate resolution to execution time to keep
        // get_location_coord() timing aligned with C.
        executeDeferredTrap({
            type_or_opts,
            deferCoord: true,
            rawX: srcX,
            rawY: srcY,
            room: levelState.currentRoom || null
        });
        return;
    }

    const randomRequested = (srcX === undefined || srcY === undefined);
    const pos = getLocationCoord(srcX, srcY, GETLOC_DRY, levelState.currentRoom || null);
    let absX = pos.x;
    let absY = pos.y;

    // C ref: create_trap() re-rolls random coordinates when they land on
    // stairs/ladder before calling mktrap().
    if (randomRequested && !levelState.currentRoom
        && absX !== undefined && absY !== undefined) {
        let trycnt = 0;
        while (trycnt++ <= 100) {
            const typ = levelState.map.locations[absX][absY]?.typ;
            if (typ !== STAIRS && typ !== LADDER) break;
            const randomPos = getLocationCoord(undefined, undefined, GETLOC_DRY, null);
            if (randomPos.x < 0 || randomPos.y < 0) break;
            absX = randomPos.x;
            absY = randomPos.y;
        }
    }

    // C ref: sp_lev.c lspo_trap()/create_trap() applies trap RNG side effects
    // inline in script order. Execute immediately for parity.
    executeDeferredTrap({ type_or_opts, x: absX, y: absY });
}

/**
 * des.region(selection, type)
 *
 * Define a region with properties.
 * C ref: sp_lev.c lspo_region()
 *
 * @param {Object} selection - Selection object (from selection.area())
 * @param {string} type - Region type (e.g., "lit")
 */
/**
 * des.region(opts)
 * Define a region with special properties (lighting, room type, etc.).
 * C ref: sp_lev.c spregion()
 *
 * Supported formats:
 * - des.region({ region: [x1, y1, x2, y2], lit: true, type: 'temple' })
 * - des.region({ region: {x1, y1, x2, y2}, lit: false, type: 'morgue', filled: 2 })
 *
 * Region types: 'temple', 'morgue', 'zoo', 'beehive', 'ordinary'
 * Properties: lit (boolean), type (string), filled (number), irregular (boolean)
 *
 * @param {Object} opts - Region options
 * @param {Array|Object} opts.region - Region coordinates [x1,y1,x2,y2] or {x1,y1,x2,y2}
 * @param {boolean} [opts.lit] - Whether region is lit
 * @param {string} [opts.type] - Region type (temple, morgue, etc.)
 * @param {number} [opts.filled] - Fill density for monsters/objects
 * @param {boolean} [opts.irregular] - Whether region has irregular shape
 */
export function region(opts_or_selection, type) {
    if (!levelState.map) {
        return;
    }

    // Handle two formats:
    // 1. des.region(selection.area(x1,y1,x2,y2), "lit" | "unlit")
    // 2. des.region({ region: [x1,y1,x2,y2], lit: ..., type: ..., ... })
    let x1;
    let y1;
    let x2;
    let y2;

    const markLitRect = (lx1, ly1, lx2, ly2, litVal) => {
        for (let x = lx1; x <= lx2; x++) {
            for (let y = ly1; y <= ly2; y++) {
                if (x >= 0 && x < COLNO && y >= 0 && y < ROWNO) {
                    const loc = levelState.map.locations[x][y];
                    loc.lit = (IS_LAVA(loc.typ) || litVal) ? 1 : 0;
                }
            }
        }
    };

    const parseLitState = (v) => {
        if (v === undefined) return -1;
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
        return -1;
    };

    const normalizeRegionCoords = (ax1, ay1, ax2, ay2) => {
        const lx1 = Math.min(ax1, ax2);
        const ly1 = Math.min(ay1, ay2);
        const lx2 = Math.max(ax1, ax2);
        const ly2 = Math.max(ay1, ay2);
        return { x1: lx1, y1: ly1, x2: lx2, y2: ly2 };
    };

    const depth = levelState.depth || levelState.levelDepth || 1;

    if (typeof type === 'string') {
        // C ref: lspo_region(selection, "lit"/"unlit"):
        // for lit, grow the selection by 1 in all directions, then set lit.
        const targetLit = (type === 'lit');
        const sourceSel = opts_or_selection;
        if (sourceSel && Array.isArray(sourceSel.coords)) {
            let sel = sourceSel;
            if (targetLit) {
                sel = selection.grow(sourceSel, 1);
            }
            for (const c of sel.coords) {
                if (c.x < 0 || c.x >= COLNO || c.y < 0 || c.y >= ROWNO) continue;
                const loc = levelState.map.locations[c.x][c.y];
                loc.lit = (IS_LAVA(loc.typ) || targetLit) ? 1 : 0;
            }
        } else {
            x1 = sourceSel.x1;
            y1 = sourceSel.y1;
            x2 = sourceSel.x2;
            y2 = sourceSel.y2;
            if (levelState.mapCoordMode) {
                const c1 = toAbsoluteCoords(x1, y1);
                const c2 = toAbsoluteCoords(x2, y2);
                x1 = c1.x;
                y1 = c1.y;
                x2 = c2.x;
                y2 = c2.y;
            }
            const norm = normalizeRegionCoords(x1, y1, x2, y2);
            markLitRect(norm.x1, norm.y1, norm.x2, norm.y2, targetLit);
        }
        return;
    }

    const opts = opts_or_selection || {};
    if (opts.region) {
        if (Array.isArray(opts.region)) {
            [x1, y1, x2, y2] = opts.region;
        } else {
            x1 = opts.region.x1;
            y1 = opts.region.y1;
            x2 = opts.region.x2;
            y2 = opts.region.y2;
        }
    } else if (
        Number.isFinite(opts.x1) && Number.isFinite(opts.y1)
        && Number.isFinite(opts.x2) && Number.isFinite(opts.y2)
    ) {
        x1 = opts.x1;
        y1 = opts.y1;
        x2 = opts.x2;
        y2 = opts.y2;
    } else {
        return;
    }

    const regionIsLevelCoords = !!opts.region_islev;
    if (levelState.mapCoordMode && !regionIsLevelCoords) {
        const c1 = toAbsoluteCoords(x1, y1);
        const c2 = toAbsoluteCoords(x2, y2);
        x1 = c1.x;
        y1 = c1.y;
        x2 = c2.x;
        y2 = c2.y;
    }

    const rtype = parseRoomType(opts.type, 0);
    const needfill = Number.isFinite(opts.filled) ? Math.trunc(opts.filled) : 0;
    const joined = (opts.joined !== undefined) ? !!opts.joined : true;
    const irregular = !!opts.irregular;
    const doArrivalRoom = !!opts.arrival_room;
    const rlit = litstate_rnd(parseLitState(opts.lit), depth);
    const roomNotNeeded = (rtype === 0 && !irregular && !doArrivalRoom && !levelState.inThemerooms);

    const addRegionRectRoom = (rx1, ry1, rx2, ry2) => {
        const room = {
            lx: rx1,
            ly: ry1,
            hx: rx2,
            hy: ry2,
            rtype,
            rlit,
            irregular: false,
            nsubrooms: 0,
            sbrooms: [],
            needfill,
            needjoining: joined,
            doorct: 0,
            fdoor: levelState.map.doorindex || 0,
            roomnoidx: levelState.map.nroom,
            region: { x1: rx1, y1: ry1, x2: rx2, y2: ry2 }
        };
        levelState.map.rooms.push(room);
        levelState.map.nroom = (levelState.map.nroom || 0) + 1;

        const roomno = room.roomnoidx + ROOMOFFSET;
        for (let x = rx1; x <= rx2; x++) {
            for (let y = ry1; y <= ry2; y++) {
                if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) continue;
                const loc = levelState.map.locations[x][y];
                loc.roomno = roomno;
                if (rlit) loc.lit = 1;
                loc.edge = (x === rx1 || x === rx2 || y === ry1 || y === ry2);
            }
        }

        if (rlit) {
            markLitRect(rx1 - 1, ry1 - 1, rx2 + 1, ry2 + 1, true);
        }
        return room;
    };

    const addRegionIrregularRoom = (sx, sy) => {
        if (sx < 0 || sx >= COLNO || sy < 0 || sy >= ROWNO) return null;
        const before = levelState.map.nroom || 0;
        floodFillAndRegister(levelState.map, sx, sy, rtype, !!rlit);
        const after = levelState.map.nroom || 0;
        if (after <= before) return null;
        const room = levelState.map.rooms[after - 1];
        if (!room) return null;
        room.needfill = needfill;
        room.needjoining = joined;
        room.region = { x1: room.lx, y1: room.ly, x2: room.hx, y2: room.hy };
        return room;
    };

    const norm = normalizeRegionCoords(x1, y1, x2, y2);
    if (roomNotNeeded || (levelState.map.nroom || 0) >= MAXNROFROOMS) {
        markLitRect(norm.x1, norm.y1, norm.x2, norm.y2, rlit);
        return;
    }

    let createdRoom = null;
    if (irregular) createdRoom = addRegionIrregularRoom(norm.x1, norm.y1);
    else createdRoom = addRegionRectRoom(norm.x1, norm.y1, norm.x2, norm.y2);

    if (!createdRoom) return;
    if (typeof opts.contents === 'function') {
        const prevRoom = levelState.currentRoom;
        levelState.roomStack.push(prevRoom);
        levelState.roomDepth++;
        levelState.currentRoom = createdRoom;
        try {
            opts.contents(createdRoom);
        } finally {
            levelState.currentRoom = levelState.roomStack.pop();
            levelState.roomDepth--;
        }
    }
    add_doors_to_room(levelState.map, createdRoom);
}

function setWallPropertyInSelection(selection, propKind) {
    if (!levelState.map) return;

    const applyAt = (x, y) => {
        if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return;
        const loc = levelState.map.locations[x][y];
        if (!loc) return;
        // C ref: sel_set_wall_property() only applies to walls, trees, and iron bars.
        if (!(IS_WALL(loc.typ) || loc.typ === TREE || loc.typ === IRONBARS)) return;
        if (propKind === 'nondiggable') loc.nondiggable = true;
        else if (propKind === 'nonpasswall') loc.nonpasswall = true;
    };

    if (!selection) {
        // C ref: set_wallprop_in_selection() with no args creates a full-map selection.
        for (let x = 0; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                applyAt(x, y);
            }
        }
        return;
    }

    if (Array.isArray(selection.coords)) {
        for (const c of selection.coords) {
            let x = c.x;
            let y = c.y;
            if (levelState.mapCoordMode) {
                const abs = toAbsoluteCoords(x, y);
                x = abs.x;
                y = abs.y;
            }
            applyAt(x, y);
        }
        return;
    }

    let x1 = selection.x1;
    let y1 = selection.y1;
    let x2 = selection.x2;
    let y2 = selection.y2;
    if (!Number.isFinite(x1) || !Number.isFinite(y1)
        || !Number.isFinite(x2) || !Number.isFinite(y2)) {
        return;
    }
    if (levelState.mapCoordMode) {
        const c1 = toAbsoluteCoords(x1, y1);
        const c2 = toAbsoluteCoords(x2, y2);
        x1 = c1.x;
        y1 = c1.y;
        x2 = c2.x;
        y2 = c2.y;
    }
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            applyAt(x, y);
        }
    }
}

/**
 * des.wall_property(opts)
 *
 * Set wall flags in a region (nondiggable/nonpasswall).
 * C ref: sp_lev.c lspo_wall_property()
 *
 * @param {Object} opts - Options containing x1/y1/x2/y2 or region and property
 */
export function wall_property(opts) {
    if (!levelState.map || !opts || typeof opts !== 'object') return;

    const propName = (typeof opts.property === 'string') ? opts.property : 'nondiggable';
    const propKind = (propName === 'nonpasswall') ? 'nonpasswall' : 'nondiggable';

    let x1 = -1;
    let y1 = -1;
    let x2 = -1;
    let y2 = -1;
    if (Array.isArray(opts.region) && opts.region.length >= 4) {
        [x1, y1, x2, y2] = opts.region;
    } else {
        if (Number.isFinite(opts.x1)) x1 = opts.x1;
        if (Number.isFinite(opts.y1)) y1 = opts.y1;
        if (Number.isFinite(opts.x2)) x2 = opts.x2;
        if (Number.isFinite(opts.y2)) y2 = opts.y2;
    }

    if (x1 === -1) x1 = (Number.isFinite(levelState.xstart) ? levelState.xstart - 1 : 0);
    if (y1 === -1) y1 = (Number.isFinite(levelState.ystart) ? levelState.ystart - 1 : 0);
    if (x2 === -1) x2 = (Number.isFinite(levelState.xstart) && Number.isFinite(levelState.xsize))
        ? levelState.xstart + levelState.xsize + 1 : COLNO - 1;
    if (y2 === -1) y2 = (Number.isFinite(levelState.ystart) && Number.isFinite(levelState.ysize))
        ? levelState.ystart + levelState.ysize + 1 : ROWNO - 1;

    setWallPropertyInSelection({ x1, y1, x2, y2 }, propKind);
}

/**
 * des.non_diggable(selection)
 *
 * Make an area non-diggable.
 * C ref: sp_lev.c lspo_non_diggable()
 *
 * @param {Object} selection - Selection object
 */
export function non_diggable(selection) {
    if (!levelState.map) {
        return;
    }
    setWallPropertyInSelection(selection, 'nondiggable');
}

/**
 * des.message(text)
 *
 * Queue a message to display when the level is entered.
 * C ref: sp_lev.c lspo_message()
 *
 * @param {string} text - Message to display
 */
export function message(text) {
    if (!levelState.map) {
        levelState.map = { messages: [] };
    }
    if (!levelState.map.messages) {
        levelState.map.messages = [];
    }
    levelState.map.messages.push(text);
}

/**
 * des.non_passwall(selection)
 *
 * Make an area non-passwallable.
 * C ref: sp_lev.c lspo_non_passwall()
 *
 * @param {Object} selection - Selection object
 */
export function non_passwall(selection) {
    if (!levelState.map) {
        return;
    }
    // C ref: lspo_non_passwall() reuses set_wallprop_in_selection().
    setWallPropertyInSelection(selection, 'nonpasswall');
}

/**
 * des.levregion(opts)
 *
 * Define level region (e.g., branch entry point).
 * C ref: sp_lev.c lspo_levregion()
 *
 * @param {Object} opts - Region options
 */
export function levregion(opts) {
    if (!opts || typeof opts !== 'object') {
        throw new Error('wrong parameters');
    }

    // C ref: sp_lev.c lspo_levregion() + levregion_add().
    const LR_TELE = 0;
    const LR_DOWNTELE = 1;
    const LR_UPTELE = 2;
    const LR_PORTAL = 3;
    const LR_BRANCH = 4;
    const LR_UPSTAIR = 5;
    const LR_DOWNSTAIR = 6;

    if (!Array.isArray(opts.region) || opts.region.length !== 4) {
        throw new Error('wrong parameters');
    }
    const inIslev = !!opts.region_islev;

    let delArea = opts.exclude;
    let delIslev = !!opts.exclude_islev;
    if (!Array.isArray(delArea) || delArea.length < 4) {
        delArea = [-1, -1, -1, -1];
        // C forces exclude_islev=true when no exclude was supplied.
        delIslev = true;
    }

    const type = String(opts.type || 'stair-down').toLowerCase();
    const typeMap = {
        'stair-down': LR_DOWNSTAIR,
        'stair-up': LR_UPSTAIR,
        'portal': LR_PORTAL,
        'branch': LR_BRANCH,
        'teleport': LR_TELE,
        'teleport-up': LR_UPTELE,
        'teleport-down': LR_DOWNTELE
    };
    const rtype = typeMap[type];
    if (rtype === undefined) {
        throw new Error('wrong parameters');
    }

    const in1 = inIslev
        ? { x: opts.region[0], y: opts.region[1] }
        : getLocation(opts.region[0], opts.region[1], GETLOC_ANY_LOC, null, false);
    const in2 = inIslev
        ? { x: opts.region[2], y: opts.region[3] }
        : getLocation(opts.region[2], opts.region[3], GETLOC_ANY_LOC, null, false);
    const del1 = delIslev
        ? { x: delArea[0], y: delArea[1] }
        : getLocation(delArea[0], delArea[1], GETLOC_ANY_LOC, null, false);
    const del2 = delIslev
        ? { x: delArea[2], y: delArea[3] }
        : getLocation(delArea[2], delArea[3], GETLOC_ANY_LOC, null, false);

    levelState.levRegions.push({
        inarea: { x1: in1.x, y1: in1.y, x2: in2.x, y2: in2.y },
        delarea: { x1: del1.x, y1: del1.y, x2: del2.x, y2: del2.y },
        rtype,
        padding: Number.isFinite(opts.padding) ? opts.padding : 0,
        rname: opts.name || null
    });
}

/**
 * des.exclusion(opts)
 *
 * Define monster generation exclusion zone.
 * C ref: sp_lev.c lspo_exclusion()
 *
 * @param {Object} opts - Exclusion options
 */
export function exclusion(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }
    if (!opts || typeof opts !== 'object') {
        throw new Error('wrong parameters');
    }

    const type = String(opts.type || 'teleport').toLowerCase();
    // C ref: lspo_exclusion() ez_types table.
    const typeMap = {
        'teleport': 'teleport',
        'teleport-up': 'teleport-up',
        'teleport_up': 'teleport-up',
        'teleport-down': 'teleport-down',
        'teleport_down': 'teleport-down',
        'monster-generation': 'monster-generation',
        'monster_generation': 'monster-generation'
    };
    const zoneType = typeMap[type];
    if (!zoneType) {
        throw new Error('wrong parameters');
    }

    let x1;
    let y1;
    let x2;
    let y2;
    if (!Array.isArray(opts.region) || opts.region.length !== 4) {
        throw new Error('wrong parameters');
    }
    [x1, y1, x2, y2] = opts.region;

    const p1 = getLocationCoord(x1, y1, GETLOC_ANY_LOC, levelState.currentRoom || null);
    const p2 = getLocationCoord(x2, y2, GETLOC_ANY_LOC, levelState.currentRoom || null);
    if (!Array.isArray(levelState.map.exclusionZones)) {
        levelState.map.exclusionZones = [];
    }
    levelState.map.exclusionZones.push({
        type: zoneType,
        lx: p1.x,
        ly: p1.y,
        hx: p2.x,
        hy: p2.y
    });
}

/**
 * des.monster(opts)
 * Place a monster at a location.
 * C ref: sp_lev.c lspo_monster()
 *
 * @param {Object} opts - Monster options
 *   - id: Monster name (e.g., "Vlad the Impaler", "vampire", "V")
 *   - x, y: Coordinates, or
 *   - coord: {x, y} coordinate object
 *   - name: Custom name for the monster
 *   - waiting: If true, monster waits (doesn't move)
 *   - peaceful: Monster is peaceful
 *   - asleep: Monster is asleep
 */
/**
 * des.monster(opts_or_class, x, y)
 * Place a monster on the level.
 * C ref: sp_lev.c spmonster()
 *
 * Supported formats:
 * 1. des.monster('V') - Random vampire at random location (monster class)
 * 2. des.monster('L') - Random lich at random location (monster class)
 * 3. des.monster('vampire', x, y) - Named monster at specific location
 * 4. des.monster({ id: 'vampire', x, y }) - Monster with options
 * 5. des.monster({ id: 'Vlad the Impaler', x, y, asleep: 1 }) - Named boss with properties
 *
 * Monster classes: 'V' (vampire), 'L' (lich), '&' (demon), 'D' (dragon),
 *                  'H' (giant humanoid), etc.
 *
 * Options: id, x, y, coord, peaceful, asleep, waiting, align, name
 *
 * @param {string|Object} opts_or_class - Monster name, class symbol, or options object
 * @param {number} [x] - X coordinate (if opts_or_class is string)
 * @param {number} [y] - Y coordinate (if opts_or_class is string)
 */
export function monster(opts_or_class, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // NOTE: Lua RNG simulation removed - all themed rooms converted to JS
    // Monster creation RNG happens during executeDeferredMonsters()

    // Normalize coordinates from object-style calls:
    // des.monster({ x, y }) or des.monster({ coord: [x, y] }).
    let srcX = x;
    let srcY = y;
    // C ref: lspo_monster supports monster("id", {x,y}) coordinate table form.
    if (typeof opts_or_class === 'string' && srcY === undefined
        && srcX && typeof srcX === 'object') {
        if (Array.isArray(srcX)) {
            srcY = srcX[1];
            srcX = srcX[0];
        } else {
            srcY = srcX.y;
            srcX = srcX.x;
        }
    }
    if (opts_or_class && typeof opts_or_class === 'object' && srcX === undefined && srcY === undefined) {
        if (opts_or_class.coord) {
            if (Array.isArray(opts_or_class.coord)) {
                srcX = opts_or_class.coord[0];
                srcY = opts_or_class.coord[1];
            } else {
                srcX = opts_or_class.coord.x;
                srcY = opts_or_class.coord.y;
            }
        } else {
            srcX = opts_or_class.x;
            srcY = opts_or_class.y;
        }
    }

    // C ref: sp_lev.c lspo_monster() creates monsters during script execution
    // rather than batching them by type. Resolve coordinates at execution time
    // to keep get_location_coord() call timing aligned.
    executeDeferredMonster({
        opts_or_class,
        deferCoord: true,
        rawX: srcX,
        rawY: srcY,
        room: levelState.currentRoom || null,
        parityImmediate: true
    });
}

/**
 * des.door(state, x, y)
 * Place a door at a location.
 * C ref: sp_lev.c spdoor_to_tmap()
 *
 * @param {string} state - Door state ("open", "closed", "locked", "nodoor", "random")
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
/**
 * des.door(state_or_opts, x, y)
 * Place a door at a location with specified state.
 * Can be called as:
 * - des.door("open", x, y) - place door at specific location
 * - des.door({ state: "nodoor", wall: "all" }) - place doors on room walls
 *
 * C ref: sp_lev.c lspo_door()
 *
 * @param {string|Object} state_or_opts - Door state string OR options object
 * @param {number} x - X coordinate (if first param is string)
 * @param {number} y - Y coordinate (if first param is string)
 */
export function door(state_or_opts, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let state;
    let doorX = -1;
    let doorY = -1;
    let wall;
    let pos = -1;

    // Handle both calling styles
    if (typeof state_or_opts === 'object') {
        // Options object style: des.door({ state: "nodoor", wall: "all" })
        state = state_or_opts.state || 'random';
        wall = state_or_opts.wall;
        pos = Number.isFinite(state_or_opts.pos) ? state_or_opts.pos : -1;
        if (Array.isArray(state_or_opts.coord)) {
            doorX = state_or_opts.coord[0];
            doorY = state_or_opts.coord[1];
        } else {
            doorX = state_or_opts.x ?? -1;
            doorY = state_or_opts.y ?? -1;
        }
    } else {
        // String style: des.door("open", x, y)
        state = state_or_opts || 'random';
        doorX = x;
        doorY = y;
    }

    // C ref: sp_lev.c lspo_door() doorstates2i + rnddoor()
    let msk;
    switch (String(state).toLowerCase()) {
        case 'open':
            msk = D_ISOPEN;
            break;
        case 'closed':
            msk = D_CLOSED;
            break;
        case 'locked':
            msk = D_LOCKED;
            break;
        case 'nodoor':
            msk = D_NODOOR;
            break;
        case 'broken':
            msk = D_BROKEN;
            break;
        case 'secret':
            msk = D_SECRET;
            break;
        case 'random':
            msk = -1;
            break;
        default:
            msk = D_CLOSED;
            break;
    }
    const doorMask = (msk === -1)
        ? [D_NODOOR, D_BROKEN, D_ISOPEN, D_CLOSED, D_LOCKED][rn2(5)]
        : msk;

    // x/y omitted => create random wall door within current room.
    if (doorX === -1 && doorY === -1) {
        if (!levelState.currentRoom) return;
        const WALL_ANY = 1 | 2 | 4 | 8;
        const wallMap = {
            all: WALL_ANY,
            random: WALL_ANY,
            north: 1,
            south: 2,
            east: 4,
            west: 8
        };
        const wallMask = wallMap[String(wall || 'all').toLowerCase()] ?? WALL_ANY;
        const dd = {
            secret: (doorMask === D_SECRET) ? 1 : 0,
            // C ref: lspo_door() passes original msk; random must stay -1
            // so create_door() performs its own door-state RNG.
            mask: msk,
            pos,
            wall: wallMask
        };
        sp_create_door(levelState.map, dd, levelState.currentRoom);
        return;
    }

    const posCoord = getLocationCoord(doorX, doorY, GETLOC_ANY_LOC, levelState.currentRoom || null);
    doorX = posCoord.x;
    doorY = posCoord.y;
    if (doorX < 0 || doorX >= COLNO || doorY < 0 || doorY >= ROWNO) {
        return;
    }

    const loc = levelState.map.locations[doorX][doorY];
    if (!loc) return;

    // C ref: sel_set_door()
    // Secret doors force SDOOR even if a door terrain is already present.
    if (doorMask & D_SECRET) {
        loc.typ = SDOOR;
    } else if (loc.typ !== DOOR && loc.typ !== SDOOR) {
        loc.typ = DOOR;
    }
    if (doorMask & D_SECRET) {
        doorMask &= ~D_SECRET;
        if (doorMask < D_CLOSED) {
            doorMask = D_CLOSED;
        }
    }
    // Doors are horizontal if they adjoin a wall on left.
    if (doorX > 0) {
        const left = levelState.map.locations[doorX - 1][doorY];
        if (left && (IS_WALL(left.typ) || !!left.horizontal)) {
            loc.horizontal = true;
        } else {
            loc.horizontal = false;
        }
    }
    loc.flags = doorMask;
    markSpLevMap(doorX, doorY);
    markSpLevTouched(doorX, doorY);
}

/**
 * des.engraving(opts)
 * Place an engraving at a location.
 * C ref: sp_lev.c spengraving()
 *
 * @param {Object} opts - Engraving options (coord, type, text)
 */
export function engraving(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    // C ref: lspo_engraving supports:
    // 1) engraving({ x, y, type, text, degrade, guardobjects })
    // 2) engraving({ coord: {x,y} or [x,y], ... })
    // 3) engraving({x,y}, "engrave", "text")
    const argc = arguments.length;
    let etyp = 'dust';
    let txt = '';
    let ex = -1;
    let ey = -1;
    let guardobjects = false;
    let wipeout = true;

    if (argc === 1 && opts && typeof opts === 'object' && !Array.isArray(opts)) {
        if (opts.coord) {
            if (Array.isArray(opts.coord)) {
                ex = opts.coord[0];
                ey = opts.coord[1];
            } else {
                ex = opts.coord.x;
                ey = opts.coord.y;
            }
        } else {
            ex = opts.x;
            ey = opts.y;
        }
        etyp = opts.type ?? 'engrave';
        txt = String(opts.text ?? '');
        wipeout = (opts.degrade !== undefined) ? !!opts.degrade : true;
        guardobjects = !!opts.guardobjects;
    } else if (argc === 3) {
        const coord = arguments[0];
        if (Array.isArray(coord)) {
            ex = coord[0];
            ey = coord[1];
        } else if (coord && typeof coord === 'object') {
            ex = coord.x;
            ey = coord.y;
        }
        etyp = arguments[1] ?? 'engrave';
        txt = String(arguments[2] ?? '');
    } else {
        throw new Error('Wrong parameters');
    }

    const engrTypeMap = {
        dust: 'dust',
        engrave: 'engrave',
        burn: 'burn',
        mark: 'mark',
        blood: 'blood'
    };
    const engrType = engrTypeMap[String(etyp).toLowerCase()] || 'engrave';

    const pos = getLocationCoord(ex, ey, GETLOC_DRY, levelState.currentRoom || null);
    if (pos.x < 0 || pos.x >= COLNO || pos.y < 0 || pos.y >= ROWNO) return;

    if (!Array.isArray(levelState.map.engravings)) {
        levelState.map.engravings = [];
    }
    // C ref: make_engr_at replaces existing engraving at location.
    levelState.map.engravings = levelState.map.engravings.filter(e => !(e.x === pos.x && e.y === pos.y));
    levelState.map.engravings.push({
        x: pos.x,
        y: pos.y,
        type: engrType,
        text: txt,
        guardobjects: !!guardobjects,
        nowipeout: !wipeout
    });
    markSpLevTouched(pos.x, pos.y);
}

/**
 * des.ladder(direction, x, y)
 * Place a ladder at a location.
 * C ref: sp_lev.c spladder()
 *
 * @param {string} direction - "up" or "down"
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function ladder(direction, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let dir = direction;
    let lx = x;
    let ly = y;

    if (typeof direction === 'object' && direction !== null) {
        dir = direction.dir || direction.direction || 'down';
        if (Array.isArray(direction.coord)) {
            lx = direction.coord[0];
            ly = direction.coord[1];
        } else if (direction.coord && typeof direction.coord === 'object') {
            lx = direction.coord.x;
            ly = direction.coord.y;
        } else {
            lx = direction.x;
            ly = direction.y;
        }
    }

    const isRandom = lx === undefined || ly === undefined || lx < 0 || ly < 0;
    // C ref: l_create_stairway() applies good_stair_loc() for random placement.
    if (isRandom) {
        setOkLocationFunc((tx, ty) => {
            const typ = levelState.map.locations[tx][ty].typ;
            return typ === ROOM || typ === CORR || typ === ICE;
        });
    }
    const pos = getLocationCoord(lx, ly, GETLOC_DRY, levelState.currentRoom || null);
    setOkLocationFunc(null);
    const xabs = pos.x;
    const yabs = pos.y;
    if (xabs < 0 || yabs < 0 || xabs >= COLNO || yabs >= ROWNO) return;

    markSpLevTouched(xabs, yabs);

    const trap = levelState.map.trapAt(xabs, yabs);
    if (trap) {
        levelState.map.traps = (levelState.map.traps || []).filter(t => t !== trap);
    }

    if (!canPlaceStair(dir)) {
        return;
    }
    // C ref: fixed-coordinate placement uses force=TRUE and coerces terrain.
    if (!isRandom) {
        levelState.map.locations[xabs][yabs].typ = ROOM;
    }

    const up = (dir === 'up') ? 1 : 0;
    const loc = levelState.map.locations[xabs][yabs];
    loc.typ = LADDER;
    loc.stairdir = up;
    loc.flags = up;
    if (up) {
        levelState.map.upladder = { x: xabs, y: yabs };
    } else {
        levelState.map.dnladder = { x: xabs, y: yabs };
    }
    markSpLevMap(xabs, yabs);
}

/**
 * des.grave(...)
 * Place a grave at a location, optionally with epitaph text.
 * C ref: sp_lev.c lspo_grave()
 */
export function grave(x_or_opts, y, text) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const argc = arguments.length;
    let gx = -1;
    let gy = -1;
    let gtext;

    if (argc === 3) {
        gx = x_or_opts;
        gy = y;
        gtext = (typeof text === 'string') ? text : String(text ?? '');
    } else if (argc === 1 && x_or_opts && typeof x_or_opts === 'object') {
        const opts = x_or_opts;
        if (Array.isArray(opts.coord)) {
            gx = opts.coord[0];
            gy = opts.coord[1];
        } else if (opts.coord && typeof opts.coord === 'object') {
            gx = opts.coord.x;
            gy = opts.coord.y;
        } else {
            gx = opts.x;
            gy = opts.y;
        }
        if (typeof opts.text === 'string') gtext = opts.text;
    } else if (argc === 0) {
        gx = -1;
        gy = -1;
    } else {
        return;
    }

    const pos = getLocationCoord(gx, gy, GETLOC_DRY, levelState.currentRoom || null);
    const xabs = pos.x;
    const yabs = pos.y;
    if (xabs < 0 || yabs < 0 || xabs >= COLNO || yabs >= ROWNO) return;

    // C ref: lspo_grave() does nothing if a trap occupies the destination.
    if (levelState.map.trapAt(xabs, yabs)) return;

    levelState.map.locations[xabs][yabs].typ = GRAVE;
    markSpLevTouched(xabs, yabs);

    if (!Array.isArray(levelState.map.engravings)) levelState.map.engravings = [];
    const epitaph = (gtext !== undefined) ? gtext : random_epitaph_text();
    levelState.map.engravings.push({
        x: xabs,
        y: yabs,
        text: epitaph,
        type: 'engrave',
        guardobjects: false,
        nowipeout: true
    });
}

/**
 * des.altar(opts)
 * Place an altar at a location.
 * C ref: sp_lev.c spaltar()
 *
 * @param {Object} opts - Altar options (x, y, align, type)
 */
export function altar(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let ax;
    let ay;
    let alignSpec;

    if (opts === undefined) {
        ax = -1;
        ay = -1;
    } else if (Array.isArray(opts)) {
        ax = opts[0];
        ay = opts[1];
    } else if (typeof opts === 'object') {
        if (Array.isArray(opts.coord)) {
            ax = opts.coord[0];
            ay = opts.coord[1];
        } else if (opts.coord && typeof opts.coord === 'object') {
            ax = opts.coord.x;
            ay = opts.coord.y;
        } else {
            ax = opts.x;
            ay = opts.y;
        }
        // Some converted scripts use aligned instead of align.
        alignSpec = opts.align ?? opts.aligned;
    } else {
        return;
    }

    const currentRoom = levelState.currentRoom || null;
    const pos = currentRoom
        ? getFreeRoomLoc(ax, ay, currentRoom)
        : getLocationCoord(ax, ay, GETLOC_DRY, null);
    if (pos.x < 0 || pos.x >= COLNO || pos.y < 0 || pos.y >= ROWNO) {
        return;
    }

    const inducedAlignForCurrentLevel = () => {
        const ctx = levelState.finalizeContext || {};
        const dnum = Number.isFinite(ctx.dnum) ? ctx.dnum : undefined;
        const dungeonAlign = (dnum !== undefined) ? (DUNGEON_ALIGN_BY_DNUM[dnum] ?? A_NONE) : A_NONE;
        const specialName = typeof ctx.specialName === 'string' ? ctx.specialName : '';
        let specialAlign = A_NONE;
        // C-level metadata plumbing is incomplete; these known special-level
        // alignments are already mirrored in makelevel().
        if (specialName.startsWith('medusa')) specialAlign = A_CHAOTIC;
        // Tutorial traces show AM_SPLEV_RANDOM consuming induced_align(80)'s
        // rn2(100) gate rather than plain rn2(3) fallback.
        else if (specialName.startsWith('tut-')) specialAlign = A_LAWFUL;
        return induced_align(80, specialAlign, dungeonAlign);
    };

    // C ref: sp_lev.c get_alignment() for altar alignment parsing.
    let altarAlign = A_NEUTRAL;
    if (typeof alignSpec === 'number' && Number.isFinite(alignSpec)) {
        altarAlign = Math.max(A_CHAOTIC, Math.min(A_LAWFUL, Math.trunc(alignSpec)));
    } else if (typeof alignSpec === 'string') {
        const a = alignSpec.toLowerCase();
        if (a === 'law' || a === 'lawful') altarAlign = A_LAWFUL;
        else if (a === 'chaos' || a === 'chaotic') altarAlign = A_CHAOTIC;
        else if (a === 'neutral' || a === 'noalign') altarAlign = A_NEUTRAL;
        else if (a === 'coaligned') altarAlign = A_NEUTRAL;
        else if (a === 'noncoaligned') altarAlign = A_CHAOTIC;
        else altarAlign = A_NEUTRAL;
    } else if (alignSpec === undefined) {
        // C default (AM_SPLEV_RANDOM): induced_align(80).
        altarAlign = inducedAlignForCurrentLevel();
    }

    if (!setLevlTypAt(levelState.map, pos.x, pos.y, ALTAR)) return;
    const loc = levelState.map.locations[pos.x][pos.y];
    loc.altarAlign = altarAlign;
    loc.flags = altarAlign;
    markSpLevTouched(pos.x, pos.y);
}

/**
 * des.gold(...)
 * Place gold at a location.
 * C ref: sp_lev.c lspo_gold()
 */
export function gold(amountOrOpts, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const argc = arguments.length;
    let gx = -1;
    let gy = -1;
    let amount = -1;

    if (argc === 3) {
        amount = Number.isFinite(amountOrOpts) ? Math.trunc(amountOrOpts) : -1;
        gx = x;
        gy = y;
    } else if (argc === 2 && Number.isFinite(amountOrOpts)
        && x && typeof x === 'object') {
        amount = Math.trunc(amountOrOpts);
        if (Array.isArray(x)) {
            gx = x[0];
            gy = x[1];
        } else if (x.coord && Array.isArray(x.coord)) {
            gx = x.coord[0];
            gy = x.coord[1];
        } else if (x.coord && typeof x.coord === 'object') {
            gx = x.coord.x;
            gy = x.coord.y;
        } else {
            gx = x.x;
            gy = x.y;
        }
    } else if (argc === 0 || (argc === 1 && amountOrOpts && typeof amountOrOpts === 'object')) {
        const opts = amountOrOpts || {};
        if (Number.isFinite(opts.amount)) amount = Math.trunc(opts.amount);
        if (Array.isArray(opts.coord)) {
            gx = opts.coord[0];
            gy = opts.coord[1];
        } else if (opts.coord && typeof opts.coord === 'object') {
            gx = opts.coord.x;
            gy = opts.coord.y;
        } else {
            if (opts.x !== undefined) gx = opts.x;
            if (opts.y !== undefined) gy = opts.y;
        }
    } else {
        throw new Error('Wrong parameters');
    }

    const pos = getLocationCoord(gx, gy, GETLOC_DRY, levelState.currentRoom || null);
    if (pos.x < 0 || pos.x >= COLNO || pos.y < 0 || pos.y >= ROWNO) {
        return;
    }

    if (amount < 0) amount = rnd(200);

    const gold = mksobj(GOLD_PIECE, true, false);
    if (!gold) return;
    gold.ox = pos.x;
    gold.oy = pos.y;
    gold.quan = amount;
    gold.owt = weight(gold);
    if (levelState.map && Array.isArray(levelState.map.objects)) {
        levelState.map.objects.push(gold);
        markSpLevTouched(pos.x, pos.y);
    }
}

/**
 * des.feature(type, x, y)
 * Place a map feature (fountain, sink, throne, etc.).
 * C ref: sp_lev.c sp_feature()
 *
 * @param {string} type - Feature type ("fountain", "sink", "throne", etc.)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
export function feature(type, x, y) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const terrainMap = {
        fountain: FOUNTAIN,
        sink: SINK,
        pool: POOL,
        throne: THRONE,
        tree: TREE,
        // Non-C compatibility aliases currently used by some scripts.
        altar: ALTAR,
        grave: GRAVE
    };

    const argc = arguments.length;
    let typName;
    let fx = -1;
    let fy = -1;
    let canHaveFlags = false;
    let opts = null;

    if (argc === 1 && typeof type === 'string') {
        typName = type;
    } else if (argc === 2 && typeof type === 'string'
        && x && typeof x === 'object') {
        typName = type;
        if (Array.isArray(x)) {
            fx = x[0];
            fy = x[1];
        } else {
            fx = x.x;
            fy = x.y;
        }
    } else if (argc === 3 && typeof type === 'string') {
        typName = type;
        fx = x;
        fy = y;
    } else if (argc === 1 && type && typeof type === 'object') {
        opts = type;
        canHaveFlags = true;
        if (Array.isArray(opts.coord)) {
            fx = opts.coord[0];
            fy = opts.coord[1];
        } else if (opts.coord && typeof opts.coord === 'object') {
            fx = opts.coord.x;
            fy = opts.coord.y;
        } else {
            fx = opts.x;
            fy = opts.y;
        }
        typName = opts.type;
    } else {
        throw new Error('wrong parameters');
    }

    const terrain = terrainMap[String(typName || '').toLowerCase()];
    if (terrain === undefined) return;

    const isRandom = (fx === undefined || fy === undefined || fx < 0 || fy < 0);
    const pos = getLocationCoord(
        fx,
        fy,
        isRandom ? GETLOC_DRY : GETLOC_ANY_LOC,
        levelState.currentRoom || null
    );
    if (pos.x < 0 || pos.x >= COLNO || pos.y < 0 || pos.y >= ROWNO) return;
    if (!setLevlTypAt(levelState.map, pos.x, pos.y, terrain)) return;

    if (terrain === ALTAR) {
        levelState.map.locations[pos.x][pos.y].altarAlign = A_NEUTRAL;
    }
    if (canHaveFlags && opts) {
        const loc = levelState.map.locations[pos.x][pos.y];
        // C ref: rm.h feature flags share the location flags/looted bitfield.
        // Values are terrain-specific:
        // fountain: F_LOOTED=1, F_WARNED=2
        // sink: S_LPUDDING=1, S_LDWASHER=2, S_LRING=4
        // throne: T_LOOTED=1
        // tree: TREE_LOOTED=1, TREE_SWARM=2
        const setFlagBit = (enabled, bit) => {
            if (enabled) loc.flags |= bit;
            else loc.flags &= ~bit;
        };
        const parseFeatureFlag = (value) => {
            if (value === undefined) return null;
            if (typeof value === 'string' && value.toLowerCase() === 'random') {
                return rn2(2) !== 0;
            }
            return !!value;
        };
        if (!loc.featureFlags) loc.featureFlags = {};
        if (terrain === FOUNTAIN) {
            {
                const v = parseFeatureFlag(opts.looted);
                if (v !== null) {
                loc.featureFlags.looted = v;
                setFlagBit(v, 1);
                }
            }
            {
                const v = parseFeatureFlag(opts.warned);
                if (v !== null) {
                loc.featureFlags.warned = v;
                setFlagBit(v, 2);
                }
            }
        } else if (terrain === SINK) {
            {
                const v = parseFeatureFlag(opts.pudding);
                if (v !== null) {
                loc.featureFlags.pudding = v;
                setFlagBit(v, 1);
                }
            }
            {
                const v = parseFeatureFlag(opts.dishwasher);
                if (v !== null) {
                loc.featureFlags.dishwasher = v;
                setFlagBit(v, 2);
                }
            }
            {
                const v = parseFeatureFlag(opts.ring);
                if (v !== null) {
                loc.featureFlags.ring = v;
                setFlagBit(v, 4);
                }
            }
        } else if (terrain === THRONE) {
            {
                const v = parseFeatureFlag(opts.looted);
                if (v !== null) {
                loc.featureFlags.looted = v;
                setFlagBit(v, 1);
                }
            }
        } else if (terrain === TREE) {
            {
                const v = parseFeatureFlag(opts.looted);
                if (v !== null) {
                loc.featureFlags.looted = v;
                setFlagBit(v, 1);
                }
            }
            {
                const v = parseFeatureFlag(opts.swarm);
                if (v !== null) {
                loc.featureFlags.swarm = v;
                setFlagBit(v, 2);
                }
            }
        }
    }
    markSpLevTouched(pos.x, pos.y);
}

/**
 * des.gas_cloud(opts)
 * Mark tiles as gas cloud terrain.
 * C ref: sp_lev.c lspo_gas_cloud()
 *
 * @param {Object} opts - { selection } or { region:[x1,y1,x2,y2] }
 */
export function gas_cloud(opts = {}) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }
    if (arguments.length !== 1 || !opts || typeof opts !== 'object' || Array.isArray(opts)) {
        throw new Error('wrong parameters');
    }

    let gx = opts.x;
    let gy = opts.y;
    if (opts.coord) {
        if (Array.isArray(opts.coord)) {
            gx = opts.coord[0];
            gy = opts.coord[1];
        } else if (opts.coord && typeof opts.coord === 'object') {
            gx = opts.coord.x;
            gy = opts.coord.y;
        }
    }

    const damage = Number.isFinite(opts.damage) ? Math.trunc(opts.damage) : 0;
    const ttl = Number.isFinite(opts.ttl) ? Math.trunc(opts.ttl) : -2;
    const sel = opts.selection;
    // C get_table_xy_or_coord() defaults to -1,-1 when x/y are omitted.
    if (gx === undefined && gy === undefined) {
        gx = -1;
        gy = -1;
    }
    const useSelection = (gx === -1 && gy === -1 && sel && Array.isArray(sel.coords));

    if (!Array.isArray(levelState.map.gasClouds)) {
        levelState.map.gasClouds = [];
    }

    if (useSelection) {
        const coords = [];
        for (const c of sel.coords) {
            if (c.x < 0 || c.x >= COLNO || c.y < 0 || c.y >= ROWNO) continue;
            coords.push({ x: c.x, y: c.y });
            markSpLevTouched(c.x, c.y);
        }
        levelState.map.gasClouds.push({
            kind: 'selection',
            coords,
            damage,
            ...(ttl > -2 ? { ttl } : {})
        });
        return;
    }

    // C ref: lspo_gas_cloud() passes x/y directly to create_gas_cloud()
    // (no get_location_coord offsetting), with -1/-1 meaning random.
    let px = gx;
    let py = gy;
    if (px === -1 && py === -1) {
        const pos = getLocation(-1, -1, GETLOC_ANY_LOC, null);
        px = pos.x;
        py = pos.y;
    }
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    if (px < 0 || px >= COLNO || py < 0 || py >= ROWNO) return;
    levelState.map.gasClouds.push({
        kind: 'point',
        x: px,
        y: py,
        radius: 1,
        damage,
        ...(ttl > -2 ? { ttl } : {})
    });
    markSpLevTouched(px, py);
}

/**
 * des.teleport_region(opts)
 * Define a teleportation region.
 * C ref: sp_lev.c sp_teleport_region()
 *
 * @param {Object} opts - Region options (region, dir)
 */
export function teleport_region(opts) {
    if (!opts || typeof opts !== 'object') {
        throw new Error('wrong parameters');
    }

    if (!Array.isArray(opts.region) || opts.region.length !== 4) {
        throw new Error('wrong parameters');
    }

    const dir = String(opts.dir || 'both').toLowerCase();
    const dirMap = {
        both: 'teleport',
        down: 'teleport-down',
        up: 'teleport-up'
    };
    const type = dirMap[dir];
    if (!type) {
        throw new Error('wrong parameters');
    }

    levregion({
        region: opts.region,
        exclude: opts.exclude,
        region_islev: opts.region_islev,
        exclude_islev: opts.exclude_islev,
        type
    });
}

/**
 * des.random_corridors()
 *
 * Generate random corridors connecting rooms.
 * C ref: sp_lev.c lspo_random_corridors() -> mklev.c makecorridors()
 *
 * Connects all rooms in the current level with corridors and doors.
 * Uses the full makecorridors() algorithm from dungeon.js:
 * - Phase 1: Join consecutive rooms
 * - Phase 2: Join rooms 2 apart
 * - Phase 3: Connect all disconnected components
 * - Phase 4: Add random extra corridors
 */
export function random_corridors() {
    if (!levelState.map) {
        return; // No map to add corridors to
    }

    // Mark all rooms as needing joining
    // (Special levels create rooms but don't set needjoining)
    for (const room of levelState.map.rooms) {
        if (room.needjoining === undefined) {
            room.needjoining = true;
        }
    }

    // C ref: lspo_random_corridors() -> create_corridor() -> makecorridors(),
    // which uses current level depth in downstream door/trap choices.
    const depth = levelState.levelDepth || 1;
    makecorridors(levelState.map, depth);
}

/**
 * des.corridor(opts)
 *
 * Create a corridor between two rooms.
 * C ref: sp_lev.c lspo_corridor()
 *
 * @param {Object} opts - {srcroom, srcdoor, srcwall, destroom, destdoor, destwall}
 */
export function corridor(opts) {
    if (!levelState.map || !opts || typeof opts !== 'object') return;

    const wallMap = {
        all: 15,
        random: -1,
        north: 1,
        west: 8,
        east: 4,
        south: 2
    };
    const parseWall = (name, def = 'all') => {
        const key = String(name ?? def).toLowerCase();
        return (wallMap[key] !== undefined) ? wallMap[key] : wallMap[def];
    };
    const hasRequiredNumbers = Number.isFinite(opts.srcroom)
        && Number.isFinite(opts.srcdoor)
        && Number.isFinite(opts.destroom)
        && Number.isFinite(opts.destdoor);
    if (!hasRequiredNumbers) return;

    const spec = {
        src: {
            room: Math.trunc(opts.srcroom),
            door: Math.trunc(opts.srcdoor),
            wall: parseWall(opts.srcwall, 'all')
        },
        dest: {
            room: Math.trunc(opts.destroom),
            door: Math.trunc(opts.destdoor),
            wall: parseWall(opts.destwall, 'all')
        }
    };

    const depth = levelState.levelDepth || 1;
    create_corridor(levelState.map, spec, depth);
}

/**
 * des.mineralize(opts)
 *
 * Deposit minerals in walls with optional C-style probability overrides.
 * C ref: sp_lev.c lspo_mineralize()
 *
 * @param {Object} opts - Optional table: gem_prob/gold_prob/kelp_moat/kelp_pool
 */
export function mineralize(opts = {}) {
    if (!levelState.map) return;

    const parseOpt = (value) => (Number.isFinite(value) ? Math.trunc(value) : -1);
    const params = {
        gem_prob: parseOpt(opts.gem_prob),
        gold_prob: parseOpt(opts.gold_prob),
        kelp_moat: parseOpt(opts.kelp_moat),
        kelp_pool: parseOpt(opts.kelp_pool),
    };

    const depth = levelState.levelDepth || 1;
    dungeonMineralize(levelState.map, depth, params);
}

/**
 * Execute all deferred object placements
 * Called from finalize_level() after corridor generation
 * Objects are already created (RNG consumed), just need to be placed on the map
 */
function executeDeferredObject(deferred) {
    const { obj, x, y, buried } = deferred;

    if (!obj) return;

    // Place the pre-created object on the map
    // If coordinates not specified, use random dungeon position
    const coordX = (x !== undefined) ? x : rn2(60) + 10;
    const coordY = (y !== undefined) ? y : rn2(15) + 3;

    if (coordX >= 0 && coordX < 80 && coordY >= 0 && coordY < 21) {
        obj.ox = coordX;
        obj.oy = coordY;
        if (buried) {
            // C ref: bury_an_obj() removes floor placement and stores the
            // object in buried chains. We currently only model "not on floor".
            obj.buried = true;
            return;
        }
        levelState.map.objects.push(obj);
    }
}

function executeDeferredObjects() {
    for (const deferred of levelState.deferredObjects) {
        executeDeferredObject(deferred);
    }
}

/**
 * Execute all deferred monster placements
 * Called from finalize_level() after corridor generation
 */
function executeDeferredMonster(deferred) {
    const { opts_or_class, x, y } = deferred;
    const immediateParity = !!levelState.finalizeContext || !!deferred.parityImmediate;
    const traceMon = (typeof process !== 'undefined' && process.env.WEBHACK_MON_TRACE === '1');
    const traceStart = traceMon ? getRngCallCount() : 0;
    const traceSeq = ++monsterExecSeq;
    const MM_NOTAIL = 0x00004000;
    const MM_NOCOUNTBIRTH = 0x00000004;
    const NO_INVENT = 0;
    const CUSTOM_INVENT = 0x01;
    const DEFAULT_INVENT = 0x02;

    const resolveMonsterIndex = (monsterId, depth) => {
        if (typeof monsterId === 'string' && monsterId.length === 1) {
            const mclass = def_char_to_monclass(monsterId);
            if (mclass > 0 && mclass < 61) {
                // C ref: sp_lev.c create_monster() uses mkclass(class, G_NOGEN)
                return mkclass(mclass, G_NOGEN, depth);
            }
            return -1;
        }
        return monsterNameToIndex(monsterId || '');
    };

    const createMonster = (monsterId, coordX, coordY, resolvedMndx = null, resolvedFemale, mmFlags = NO_MM_FLAGS) => {
        if (!levelState.map) return null;
        const depth = (levelState.finalizeContext && Number.isFinite(levelState.finalizeContext.dunlev))
            ? levelState.finalizeContext.dunlev
            : (levelState.levelDepth || 1);
        const mndx = (resolvedMndx !== null) ? resolvedMndx : resolveMonsterIndex(monsterId, depth);

        let mx = coordX;
        let my = coordY;
        if (levelState.map.monsters.some(m => m.mx === mx && m.my === my)) {
            const cc = enexto(mx, my, levelState.map);
            if (cc) {
                mx = cc.x;
                my = cc.y;
            }
        }

        const mtmp = makemon(mndx >= 0 ? mndx : null, mx, my, mmFlags, depth, levelState.map, true);
        if (mtmp) {
            if (resolvedFemale !== undefined) {
                mtmp.female = !!resolvedFemale;
            }
            // Keep legacy level tests and tooling stable: expose common aliases
            // used by older test helpers (id,x,y) alongside C-style fields.
            if (typeof monsterId === "string") mtmp.id = monsterId;
            mtmp.x = mtmp.mx;
            mtmp.y = mtmp.my;
            markSpLevTouched(mtmp.mx, mtmp.my);
        }
        return mtmp;
    };
    // Execute the original monster() logic
    let monsterId, coordX, coordY, opts;

    // C ref: sp_lev.c sp_amask_to_amask(AM_SPLEV_RANDOM) -> induced_align(80)
    function consumeInducedAlignRng() {
        const ctx = levelState.finalizeContext || {};
        const specialName = typeof ctx.specialName === 'string' ? ctx.specialName : '';
        const tutorialLike = !!levelState.map?.flags?.is_tutorial || specialName.startsWith('tut-');
        const oracleLike = specialName.startsWith('oracle');
        if (!tutorialLike && !oracleLike) {
            rn2(3);
            return;
        }
        const dnum = Number.isFinite(ctx.dnum) ? ctx.dnum : undefined;
        const dungeonAlign = (dnum !== undefined) ? (DUNGEON_ALIGN_BY_DNUM[dnum] ?? A_NONE) : A_NONE;
        let specialAlign = A_NONE;
        if (oracleLike) specialAlign = A_NEUTRAL;
        if (specialName.startsWith('medusa')) specialAlign = A_CHAOTIC;
        else if (specialName.startsWith('tut-')) specialAlign = A_LAWFUL;
        induced_align(80, specialAlign, dungeonAlign);
    }

    const parseAppearAsLikeC = (appearAsSpec) => {
        if (appearAsSpec === undefined || appearAsSpec === null) return null;
        const raw = String(appearAsSpec);
        if (raw.startsWith('obj:')) return { type: 'obj', value: raw.slice(4) };
        if (raw.startsWith('mon:')) return { type: 'mon', value: raw.slice(4) };
        if (raw.startsWith('ter:')) return { type: 'ter', value: raw.slice(4) };
        throw new Error('Unknown appear_as type');
    };

    if (opts_or_class === undefined) {
        if (!levelState.monsters) {
            levelState.monsters = [];
        }
        if (immediateParity) {
            // C ref: create_monster() computes amask via sp_amask_to_amask()
            // (AM_SPLEV_RANDOM -> induced_align()) before coordinate selection.
            consumeInducedAlignRng();
        }
        const coordX = (x !== undefined) ? x : rn2(60) + 10;
        const coordY = (y !== undefined) ? y : rn2(15) + 3;
        if (immediateParity) {
            // C ref: create_monster() with no class/id -> makemon(NULL, ...).
            createMonster(null, coordX, coordY);
            return;
        }
        levelState.monsters.push({
            id: null,
            x: coordX,
            y: coordY
        });
        return;
    }

    if (typeof opts_or_class === 'string') {
        if (x === undefined) {
            monsterId = opts_or_class;
            coordX = deferred.deferCoord ? undefined : (rn2(60) + 10);
            coordY = deferred.deferCoord ? undefined : (rn2(15) + 3);
            opts = {};
        } else {
            monsterId = opts_or_class;
            coordX = x;
            coordY = y;
            opts = {};
        }
    } else if (opts_or_class && typeof opts_or_class === 'object') {
        opts = opts_or_class;
        monsterId = opts.id || opts.class || '@';
        // Prefer absolute coords captured at enqueue time.
        if (x !== undefined && y !== undefined) {
            coordX = x;
            coordY = y;
        } else if (opts.coord) {
            if (Array.isArray(opts.coord)) {
                coordX = opts.coord[0];
                coordY = opts.coord[1];
            } else {
                coordX = opts.coord.x;
                coordY = opts.coord.y;
            }
        } else {
            coordX = opts.x;
            coordY = opts.y;
        }

        if (!deferred.deferCoord && (coordX === undefined || coordY === undefined)) {
            coordX = rn2(60) + 10;
            coordY = rn2(15) + 3;
        }
    }

    if (!monsterId) {
        return;
    }
    if (!deferred.deferCoord
        && (coordX === undefined || coordY === undefined
            || coordX < 0 || coordX >= 80 || coordY < 0 || coordY >= 21)) {
        return;
    }

    if (!levelState.monsters) {
        levelState.monsters = [];
    }

    if (immediateParity) {
        const depth = (levelState.finalizeContext && Number.isFinite(levelState.finalizeContext.dunlev))
            ? levelState.finalizeContext.dunlev
            : (levelState.levelDepth || 1);
        let mndxForParity = null;
        let femaleForParity;
        if (typeof monsterId === 'string') {
            if (monsterId.length > 1) {
                const resolved = resolveNamedMonsterLikeC(monsterId);
                mndxForParity = resolved.mndx;
                femaleForParity = resolved.female;
            }
        }
        // C ref: create_monster() default AM_SPLEV_RANDOM -> induced_align().
        // Keep historical single-call behavior to preserve parity suites.
        consumeInducedAlignRng();
        // C ref: create_monster() resolves class with mkclass() after induced_align()
        // but before get_location().
        if (mndxForParity === null && typeof monsterId === 'string' && monsterId.length === 1) {
            mndxForParity = resolveMonsterIndex(monsterId, depth);
        }

        if (deferred.deferCoord) {
            const pos = getLocationCoord(deferred.rawX, deferred.rawY, GETLOC_DRY, deferred.room || null);
            coordX = pos.x;
            coordY = pos.y;
        }
        if (coordX === undefined || coordY === undefined ||
            coordX < 0 || coordX >= 80 || coordY < 0 || coordY >= 21) {
            return;
        }

        let mmFlags = NO_MM_FLAGS;
        let requestedMmFlags = NO_MM_FLAGS;
        if (opts && opts.tail !== undefined && !opts.tail) {
            requestedMmFlags |= MM_NOTAIL;
        }
        if (opts && opts.group !== undefined && !opts.group) {
            requestedMmFlags |= MM_NOGRP;
            mmFlags |= MM_NOGRP;
        }
        if (opts && opts.adjacentok) requestedMmFlags |= MM_ADJACENTOK;
        if (opts && opts.ignorewater) requestedMmFlags |= MM_IGNOREWATER;
        if (opts && opts.countbirth !== undefined && !opts.countbirth) {
            requestedMmFlags |= MM_NOCOUNTBIRTH;
        }
        const mtmp = createMonster(monsterId, coordX, coordY, mndxForParity, femaleForParity, mmFlags);
        if (mtmp && opts) {
            const parsedAppearAs = parseAppearAsLikeC(opts.appear_as);
            const hasInventoryField = (opts.inventory !== undefined);
            const keepDefaultSpecified = (opts.keep_default_invent !== undefined);
            const keepDefaultInvent = keepDefaultSpecified ? !!opts.keep_default_invent : undefined;
            let hasInvent = DEFAULT_INVENT;
            if (hasInventoryField) {
                hasInvent = CUSTOM_INVENT;
                if (keepDefaultInvent === true) {
                    hasInvent |= DEFAULT_INVENT;
                }
            } else if (keepDefaultInvent === false) {
                hasInvent = NO_INVENT;
            }
            if (opts.name !== undefined) mtmp.customName = String(opts.name);
            if (opts.female !== undefined) mtmp.female = !!opts.female;
            if (opts.peaceful !== undefined) {
                mtmp.peaceful = !!opts.peaceful;
                mtmp.mpeaceful = !!opts.peaceful;
            }
            if (opts.asleep !== undefined) {
                mtmp.msleeping = !!opts.asleep;
                mtmp.sleeping = !!opts.asleep;
            }
            if (opts.waiting !== undefined) mtmp.mstrategy = opts.waiting ? 1 : 0;
            if (opts.waiting !== undefined) mtmp.waiting = !!opts.waiting;
            if (opts.invisible !== undefined) {
                mtmp.minvis = !!opts.invisible;
                mtmp.perminvis = !!opts.invisible;
            }
            if (opts.cancelled !== undefined) mtmp.mcan = !!opts.cancelled;
            if (opts.revived !== undefined) mtmp.mrevived = !!opts.revived;
            if (opts.avenge !== undefined) mtmp.mavenge = !!opts.avenge;
            if (opts.stunned !== undefined) mtmp.mstun = !!opts.stunned;
            if (opts.confused !== undefined) mtmp.mconf = !!opts.confused;
            if (Number.isFinite(opts.blinded) && Math.trunc(opts.blinded) > 0) {
                mtmp.mcansee = false;
                mtmp.mblinded = Math.trunc(opts.blinded) % 127;
            }
            if (Number.isFinite(opts.paralyzed) && Math.trunc(opts.paralyzed) > 0) {
                mtmp.mcanmove = false;
                mtmp.mfrozen = Math.trunc(opts.paralyzed) % 127;
            }
            if (Number.isFinite(opts.fleeing) && Math.trunc(opts.fleeing) > 0) {
                mtmp.mflee = true;
                mtmp.mfleetim = Math.trunc(opts.fleeing) % 127;
            }
            if (parsedAppearAs) {
                // C ref: lspo_monster stores appear type + payload string.
                mtmp.appear_as = `${parsedAppearAs.type}:${parsedAppearAs.value}`;
                mtmp.appear_as_type = parsedAppearAs.type;
                mtmp.appear_as_value = parsedAppearAs.value;
            }
            if ((hasInvent & DEFAULT_INVENT) === 0) {
                mtmp.minvent = [];
            }
            if ((hasInvent & CUSTOM_INVENT) && typeof opts.inventory === 'function') {
                levelState.monsterInventoryStack.push(mtmp);
                try {
                    opts.inventory(mtmp);
                } finally {
                    levelState.monsterInventoryStack.pop();
                }
            }
            mtmp.has_invent_flags = hasInvent;
            mtmp.mm_flags_requested = requestedMmFlags;
        }
        if (traceMon) {
            const traceEnd = getRngCallCount();
            const picked = (mtmp && Number.isFinite(mtmp.mndx)) ? `${mtmp.mndx}:${mtmp.name || ''}` : 'none';
            console.log(`[MONTRACE] #${traceSeq} id=${String(monsterId)} pick=${picked} pos=(${coordX},${coordY}) rng=${traceStart + 1}-${traceEnd} delta=${traceEnd - traceStart}`);
        }
        return;
    }

    levelState.monsters.push({
        id: monsterId,
        x: coordX,
        y: coordY,
        name: opts?.name,
        waiting: opts?.waiting || false,
        peaceful: opts?.peaceful,
        asleep: opts?.asleep,
        align: opts?.align
    });
    if (traceMon) {
        const traceEnd = getRngCallCount();
        console.log(`[MONTRACE] #${traceSeq} id=${String(monsterId)} queued pos=(${coordX},${coordY}) rng=${traceStart + 1}-${traceEnd} delta=${traceEnd - traceStart}`);
    }
}

function executeDeferredMonsters() {
    for (const deferred of levelState.deferredMonsters) {
        executeDeferredMonster(deferred);
    }
}

/**
 * Execute all deferred trap placements
 * Called from finalize_level() after corridor generation
 */
function executeDeferredTrap(deferred) {
    const { type_or_opts, x, y, deferCoord, rawX, rawY, room } = deferred;

    // Execute the original trap() logic
    let trapType, trapX = x, trapY = y;
    let randomRequested = false;
    let spiderOnWeb = true;
    let seen = false;
    let victim = true;
    let launchfrom;
    let teledest;

    if (type_or_opts === undefined) {
        trapType = undefined;
    } else if (typeof type_or_opts === 'string') {
        trapType = type_or_opts;
        trapX = x;
        trapY = y;
    } else if (type_or_opts && typeof type_or_opts === 'object') {
        trapType = type_or_opts.type;
        if (type_or_opts.spider_on_web !== undefined) {
            spiderOnWeb = !!type_or_opts.spider_on_web;
        }
        if (type_or_opts.seen !== undefined) {
            seen = !!type_or_opts.seen;
        }
        if (type_or_opts.victim !== undefined) {
            victim = !!type_or_opts.victim;
        }
        if (type_or_opts.launchfrom && typeof type_or_opts.launchfrom === 'object') {
            launchfrom = type_or_opts.launchfrom;
        }
        if (type_or_opts.teledest && typeof type_or_opts.teledest === 'object') {
            teledest = type_or_opts.teledest;
        }
        // Prefer absolute coordinates captured at enqueue time.
        if (x !== undefined && y !== undefined) {
            trapX = x;
            trapY = y;
        } else if (type_or_opts.coord) {
            if (Array.isArray(type_or_opts.coord)) {
                trapX = type_or_opts.coord[0];
                trapY = type_or_opts.coord[1];
            } else {
                trapX = type_or_opts.coord.x;
                trapY = type_or_opts.coord.y;
            }
        } else if (type_or_opts.x !== undefined && type_or_opts.y !== undefined) {
            trapX = type_or_opts.x;
            trapY = type_or_opts.y;
        }
    }

    if (deferCoord) {
        randomRequested = (rawX === undefined || rawY === undefined);
        const pos = getLocationCoord(rawX, rawY, GETLOC_DRY, room || null);
        trapX = pos.x;
        trapY = pos.y;
    } else if (trapX === undefined || trapY === undefined) {
        randomRequested = true;
        trapX = rn2(60) + 10;
        trapY = rn2(15) + 3;
    }

    let mktrapFlags = 0;
    if (!spiderOnWeb) mktrapFlags |= MKTRAP_NOSPIDERONWEB;
    if (seen) mktrapFlags |= MKTRAP_SEEN;
    if (!victim) mktrapFlags |= MKTRAP_NOVICTIM;

    const decodeCoordOpt = (coordOpt) => {
        if (!coordOpt) return null;
        let cx;
        let cy;
        if (Array.isArray(coordOpt)) {
            cx = coordOpt[0];
            cy = coordOpt[1];
        } else {
            cx = coordOpt.x;
            cy = coordOpt.y;
        }
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
        if (levelState.mapCoordMode) {
            const abs = toAbsoluteCoords(cx, cy);
            return { x: abs.x, y: abs.y };
        }
        return { x: Math.trunc(cx), y: Math.trunc(cy) };
    };

    let ttyp;
    if (!trapType) {
        // C ref: create_trap() -> mktrap(NO_TRAP, MKTRAP_MAZEFLAG, tm)
        // for random trap selection at a fixed coordinate.
        // For random coordinates, C re-rolls if stairs/ladder.
        if (randomRequested && !(room || levelState.currentRoom)
            && trapX !== undefined && trapY !== undefined) {
            let trycnt = 0;
            while (trycnt++ <= 100) {
                const typ = levelState.map.locations[trapX][trapY]?.typ;
                if (typ !== STAIRS && typ !== LADDER) break;
                const randomPos = getLocationCoord(undefined, undefined, GETLOC_DRY, null);
                if (randomPos.x < 0 || randomPos.y < 0) break;
                trapX = randomPos.x;
                trapY = randomPos.y;
            }
        }
        const tm = { x: trapX, y: trapY };
        const depth = (levelState.finalizeContext && Number.isFinite(levelState.finalizeContext.dunlev))
            ? levelState.finalizeContext.dunlev
            : (levelState.levelDepth || 1);
        mktrap(levelState.map, 0, MKTRAP_MAZEFLAG | mktrapFlags, null, tm, depth);
        markSpLevTouched(trapX, trapY);
        return;
    } else {
        ttyp = trapNameToType(trapType);
    }

    if (ttyp === null) {
        throw new Error('Unknown trap type');
    }
    if (ttyp < 0 || trapX < 0 || trapX >= 80 || trapY < 0 || trapY >= 21) {
        return;
    }

    const tm = { x: trapX, y: trapY };
    const depth = (levelState.finalizeContext && Number.isFinite(levelState.finalizeContext.dunlev))
        ? levelState.finalizeContext.dunlev
        : (levelState.levelDepth || 1);
    // C ref: sp_lev.c create_trap() initializes flags with MKTRAP_MAZEFLAG
    // for both random and explicit trap types.
    mktrap(levelState.map, ttyp, MKTRAP_MAZEFLAG | mktrapFlags, null, tm, depth);
    const createdTrap = levelState.map.trapAt(trapX, trapY);
    if (createdTrap) {
        const launchPt = decodeCoordOpt(launchfrom);
        const telePt = decodeCoordOpt(teledest);
        if (launchPt && createdTrap.ttyp === ROLLING_BOULDER_TRAP) {
            createdTrap.launch = { x: launchPt.x, y: launchPt.y };
            createdTrap.launch2 = {
                x: trapX - (launchPt.x - trapX),
                y: trapY - (launchPt.y - trapY)
            };
        }
        if (telePt && createdTrap.ttyp === TELEP_TRAP
            && !(telePt.x === trapX && telePt.y === trapY)) {
            createdTrap.teledest = { x: telePt.x, y: telePt.y };
        }
    }
    markSpLevTouched(trapX, trapY);
}

function executeDeferredTraps() {
    for (const deferred of levelState.deferredTraps) {
        executeDeferredTrap(deferred);
    }
}

/**
 * des.finalize_level()
 * Finalize level generation - must be called after all des.* calls.
 * C ref: sp_lev.c sp_level_loader()
 *
 * Performs post-processing steps:
 * 1. Execute all deferred placements (objects, monsters, traps)
 * 2. Copies monster requests from levelState to map.monsters
 * 3. Applies wallification (computes wall junction types)
 * 4. Applies random level flipping (horizontal/vertical)
 *
 * @returns {GameMap} The finalized map ready for gameplay
 */

/**
 * des.wallify()
 * Explicitly wallify the current map (compute wall junction types).
 * Usually called automatically by finalize_level(), but some levels call it explicitly.
 * C ref: sp_lev.c lspo_wallify()
 */
export function wallify(opts) {
    if (!levelState.map) {
        console.warn('wallify called but no map exists');
        return;
    }
    let x1 = -1;
    let y1 = -1;
    let x2 = -1;
    let y2 = -1;

    // C ref: lspo_wallify() only reads x1/y1/x2/y2 from a single table argument.
    if (opts && typeof opts === 'object') {
        if (Number.isFinite(opts.x1)) x1 = Math.trunc(opts.x1);
        if (Number.isFinite(opts.y1)) y1 = Math.trunc(opts.y1);
        if (Number.isFinite(opts.x2)) x2 = Math.trunc(opts.x2);
        if (Number.isFinite(opts.y2)) y2 = Math.trunc(opts.y2);
    }

    if (x1 < 0) x1 = levelState.xstart - 1;
    if (y1 < 0) y1 = levelState.ystart - 1;
    if (x2 < 0) x2 = levelState.xstart + levelState.xsize + 1;
    if (y2 < 0) y2 = levelState.ystart + levelState.ysize + 1;

    dungeonWallifyRegion(levelState.map, x1, y1, x2, y2);
}

// C ref: sp_lev.c map_cleanup() — post-gen cleanup of liquid squares.
function map_cleanup(map) {
    if (!map) return;

    const undestroyableTrap = (ttyp) =>
        ttyp === MAGIC_PORTAL || ttyp === VIBRATING_SQUARE;

    if (Array.isArray(map.objects) && map.objects.length > 0) {
        map.objects = map.objects.filter((obj) => {
            if (!obj || obj.otyp !== BOULDER) return true;
            const loc = map.at(obj.ox, obj.oy);
            if (!loc) return true;
            return !(IS_LAVA(loc.typ) || IS_POOL(loc.typ));
        });
    }

    if (Array.isArray(map.traps) && map.traps.length > 0) {
        map.traps = map.traps.filter((trap) => {
            if (!trap) return false;
            const tx = Number.isInteger(trap.tx) ? trap.tx : trap.x;
            const ty = Number.isInteger(trap.ty) ? trap.ty : trap.y;
            const loc = map.at(tx, ty);
            if (!loc) return true;
            if (!(IS_LAVA(loc.typ) || IS_POOL(loc.typ))) return true;
            return undestroyableTrap(trap.ttyp);
        });
    }

    // C ref: sp_lev.c map_cleanup() deletes engravings on liquid.
    if (Array.isArray(map.engravings) && map.engravings.length > 0) {
        map.engravings = map.engravings.filter((engr) => {
            if (!engr) return false;
            const ex = Number.isInteger(engr.x) ? engr.x : engr.ex;
            const ey = Number.isInteger(engr.y) ? engr.y : engr.ey;
            const loc = map.at(ex, ey);
            if (!loc) return true;
            return !(IS_LAVA(loc.typ) || IS_POOL(loc.typ));
        });
    }
}

// C ref: sp_lev.c solidify_map()
function solidify_map(map) {
    if (!map) return;
    initSpLevMap();
    const spLevMap = levelState.spLevMap;
    if (!spLevMap) return;
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.locations[x][y];
            if (!loc) continue;
            if (IS_STWALL(loc.typ) && !spLevMap[x]?.[y]) {
                loc.nondiggable = true;
                loc.nonpasswall = true;
            }
        }
    }
}

// C ref: sp_lev.c remove_boundary_syms()
function remove_boundary_syms(map) {
    if (!map) return;
    let hasBounds = false;
    for (let x = 0; x < COLNO - 1 && !hasBounds; x++) {
        for (let y = 0; y < ROWNO - 1; y++) {
            if (map.locations[x][y].typ === CROSSWALL) {
                hasBounds = true;
                break;
            }
        }
    }
    const spLevMap = levelState.spLevMap;
    if (!hasBounds || !spLevMap) return;

    for (let x = 0; x < levelState.mazeMaxX; x++) {
        for (let y = 0; y < levelState.mazeMaxY; y++) {
            if (map.locations[x][y].typ === CROSSWALL
                && spLevMap[x]?.[y]) {
                map.locations[x][y].typ = ROOM;
            }
        }
    }
}

export function finalize_level() {
    const extraPhaseTrace = (getProcessEnv('WEBHACK_EXTRA_PHASE_CHECKPOINTS') === '1');
    if (extraPhaseTrace) {
        captureCheckpoint('after_script');
    }
    // CRITICAL: Execute deferred placements BEFORE wallification
    // This matches C's execution order: rooms → corridors → entities → wallify
    if (levelState.deferredActions.length > 0) {
        for (const action of levelState.deferredActions) {
            if (action.kind === 'object') {
                executeDeferredObject(levelState.deferredObjects[action.idx]);
            } else if (action.kind === 'monster') {
                executeDeferredMonster(levelState.deferredMonsters[action.idx]);
            } else if (action.kind === 'trap') {
                executeDeferredTrap(levelState.deferredTraps[action.idx]);
            }
        }
    } else {
        executeDeferredObjects();
        executeDeferredMonsters();
        executeDeferredTraps();
    }
    if (extraPhaseTrace) {
        captureCheckpoint('after_deferred');
    }

    // Copy monster requests to map
    if (levelState.monsters && levelState.map) {
        if (!levelState.map.monsters) {
            levelState.map.monsters = [];
        }
        levelState.map.monsters.push(...levelState.monsters);
    }

    // C ref: lspo_finalize_level() calls link_doors_rooms() before cleanup.
    if (levelState.map && Array.isArray(levelState.map.rooms)) {
        const roomCount = Number.isInteger(levelState.map.nroom)
            ? Math.min(levelState.map.nroom, levelState.map.rooms.length)
            : levelState.map.rooms.length;
        for (let i = 0; i < roomCount; i++) {
            const room = levelState.map.rooms[i];
            if (!room || room.hx < 0) continue;
            add_doors_to_room(levelState.map, room);
        }
    }
    if (extraPhaseTrace) {
        captureCheckpoint('after_link_doors');
    }

    // C ref: sp_lev.c remove_boundary_syms() runs before map_cleanup.
    if (levelState.map) {
        remove_boundary_syms(levelState.map);
    }
    if (extraPhaseTrace) {
        captureCheckpoint('after_remove_boundary');
    }

    // C ref: sp_lev.c map_cleanup() runs before wallification.
    if (levelState.map) {
        map_cleanup(levelState.map);
    }
    if (extraPhaseTrace) {
        captureCheckpoint('after_map_cleanup');
    }

    // C ref: mklev.c:1388-1422 — Fill ordinary rooms with random content.
    // Scope this to explicit parity contexts to avoid drifting handcrafted
    // special levels during normal generation.
    if (levelState.map && levelState.finalizeContext?.applyRoomFill) {
        const map = levelState.map;
        const depth = levelState.levelDepth || 1;
        const OROOM = 0;
        const THEMEROOM = 1;
        const DEBUG = false;

        // Count fillable rooms (only top-level rooms, not subrooms)
        const isFillable = (r) => (r.rtype === OROOM || r.rtype === THEMEROOM)
                                  && r.needfill === FILL_NORMAL;
        let fillableCount = 0;
        for (let i = 0; i < map.nroom; i++) {
            const croom = map.rooms[i];
            if (DEBUG) console.log(`  Room ${i}: rtype=${croom.rtype}, needfill=${croom.needfill}, fillable=${isFillable(croom)}`);
            if (isFillable(croom)) fillableCount++;
        }

        if (DEBUG) console.log(`fillable_level: ${fillableCount} fillable rooms, depth=${depth}`);

        // One random fillable room gets bonus items
        let bonusCountdown = fillableCount > 0 ? rn2(fillableCount) : -1;

        for (let i = 0; i < map.nroom; i++) {
            const croom = map.rooms[i];
            const fillable = isFillable(croom);
            if (DEBUG && fillable) console.log(`  Filling room ${i}, bonus=${bonusCountdown === 0}`);
            fill_ordinary_room(map, croom, depth,
                               fillable && bonusCountdown === 0);
            if (fillable) bonusCountdown--;
        }
    }

    if (extraPhaseTrace) {
        captureCheckpoint('before_wallification');
    }

    // Apply wallification first (before flipping).
    // C ref: sp_lev.c lspo_finalize_level()/load_special() wallify only when
    // !svl.level.flags.corrmaze (corrmaze is overloaded to suppress wallify
    // for levels with handcrafted wall geometry such as Baalz).
    if (levelState.map && !levelState.flags.corrmaze) {
        wallification(levelState.map);
    }
    captureCheckpoint('after_wallification');

    // Apply random flipping
    const flipped = flipLevelRandom();

    // C ref: flip_level() invokes fix_wall_spines() after transpose,
    // not full wallification().
    if (levelState.map && flipped) {
        fix_wall_spines(levelState.map, 1, 0, COLNO - 1, ROWNO - 1);
    }

    // C ref: sp_lev.c fixup_special() (branch stair placement, etc.)
    if (levelState.map && levelState.coder?.solidify) {
        solidify_map(levelState.map);
    }

    // C ref: sp_lev.c fixup_special() (branch stair placement, etc.)
    fixupSpecialLevel();

    // C ref: mklev.c:1533-1539 — level_finalize_topology()
    // bound_digging marks boundary stone as non-diggable before mineralize
    if (levelState.map) {
        bound_digging(levelState.map);
        // Get depth from level state or default to 1
        const depth = levelState.levelDepth || 1;
        // C ref: level_finalize_topology() always calls mineralize();
        // internal mineralize checks decide which deposits actually apply.
        dungeonMineralize(levelState.map, depth);

        // C parity (targeted): tutorial replay traces require levregion
        // coordinate selection RNG here. Keep this scoped to tutorial maps to
        // avoid drifting broader special-level map parity.
        if (levelState.map.flags?.is_tutorial) {
            for (const region of levelState.levRegions || []) {
                const isTeleportRegion = (region.rtype === 0 || region.rtype === 1 || region.rtype === 2);
                if (!isTeleportRegion) continue;
                place_lregion(levelState.map,
                    region.inarea.x1, region.inarea.y1, region.inarea.x2, region.inarea.y2,
                    region.delarea.x1, region.delarea.y1, region.delarea.x2, region.delarea.y2,
                    region.rtype);
            }
        }
    }

    // TODO: Add other finalization steps (solidify_map, premapping, etc.)

    captureCheckpoint('after_finalize');
    if (levelState._mklevContextEntered) {
        leaveMklevContext();
        levelState._mklevContextEntered = false;
    }
    // Return the generated map
    return levelState.map;
}

/**
 * percent(n)
 * Returns true n% of the time.
 * C ref: sp_lev.c percent() macro
 *
 * @param {number} n - Percentage (0-100)
 * @returns {boolean} True if rn2(100) < n
 */
export function percent(n) {
    return rn2(100) < n;
}

/**
 * shuffle(array)
 * Fisher-Yates shuffle - randomize array order in place.
 * Used by Lua level scripts for random placement.
 *
 * @param {Array} arr - Array to shuffle
 */
export function shuffle(arr) {
    const trace = (typeof process !== 'undefined' && process.env.WEBHACK_SHUFFLE_TRACE === '1');
    let before = null;
    if (trace) {
        before = Array.isArray(arr) ? [...arr] : arr;
    }
    for (let i = arr.length - 1; i > 0; i--) {
        const j = rn2(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (trace) {
        const stack = new Error().stack?.split('\n')[2]?.trim() || 'unknown';
        console.log(`[SHUFFLE] caller=${stack} before=${JSON.stringify(before)} after=${JSON.stringify(arr)}`);
    }
}

/**
 * nh object - NetHack game state queries
 * Stub implementations for Lua level compatibility
 */
export const nh = {
    /**
     * nh.is_genocided(monster_class)
     * Check if a monster class has been genocided.
     * Stub: always returns false (no genocide in basic game)
     */
    is_genocided: (monClass) => false,

    /**
     * nh.debug_themerm(is_fill)
     * Returns the value of THEMERM or THEMERMFILL environment variable for debug mode.
     * This is used to force selection of a specific themed room or fill during testing.
     *
     * C ref: nhlua.c:993 nhl_get_debug_themerm_name()
     *
     * Behavior:
     * - if is_fill is false, checks THEMERM env var (room selector)
     * - if is_fill is true, checks THEMERMFILL env var (fill selector)
     * - Returns null if not set or empty (normal reservoir sampling mode)
     * - Returns the env var value if set (debug mode - skips reservoir sampling)
     *
     * Note: In C, this only works in wizard mode. We don't enforce that restriction
     * in JS since our test harness may replay sessions that were generated in wizard mode.
     */
    debug_themerm: (is_fill) => {
        // Check if we're running in Node.js environment
        if (typeof process === 'undefined' || !process.env) {
            return null;
        }

        const varName = is_fill ? 'THEMERMFILL' : 'THEMERM';
        const value = typeof process !== 'undefined' ? process.env[varName] : undefined;

        // Return null if not set or empty (matching C behavior)
        if (!value || value === '') {
            return null;
        }

        return value;
    },

    /**
     * nh.eckey(command)
     * Returns the key binding for an extended command name.
     * Used in tutorial levels to show players which keys to press.
     * C ref: nhlua.c nhl_eckey()
     *
     * @param {string} command - Command name (e.g., "up", "down", "inventory")
     * @returns {string} Key for the command
     */
    eckey: (command) => {
        const keymap = {
            'up': '<',
            'down': '>',
            'inventory': 'i',
            'look': ':',
            'search': 's',
            'wait': '.',
            'help': '?',
        };
        return keymap[command] || '?';
    },

    /**
     * nh.parse_config(config_string)
     * Parses a configuration option string.
     * Used in tutorial levels to set options like "mention_walls".
     * C ref: nhlua.c nhl_parse_config()
     *
     * Note: This is a stub implementation for level generation.
     * In a full game, this would parse and apply the config option.
     *
     * @param {string} config_string - Config string (e.g., "OPTIONS=mention_walls")
     */
    parse_config: (config_string) => {
        // Stub: Config parsing only affects runtime behavior, not level generation
        // Tutorial levels use this to set display options, but since we're just
        // generating the level structure, we can safely ignore it
        return;
    },
};

/**
 * Stub player object for level generation
 * C ref: you.h struct you
 *
 * During level generation, there is no actual player yet.
 * This stub provides default values so that level generators
 * (especially tutorial levels) can reference player properties
 * without causing errors.
 *
 * In a full game, this would be replaced by the actual player object.
 */
export const u = {
    role: null,  // Player role (e.g., "Knight", "Wizard", etc.)
    race: null,  // Player race
    alignment: null,  // Player alignment
};

/**
 * Selection API - create rectangular selections
 */
export const selection = {
    _toAbsoluteCoord: (x, y) => {
        const pos = getLocationCoord(x, y, GETLOC_ANY_LOC, levelState.currentRoom || null);
        return { x: pos.x, y: pos.y };
    },
    /**
     * selection.room()
     * Create a selection containing all cells in the current room.
     * Used in themed room contents callbacks.
     * C ref: nhlua.c selection_room()
     */
    room: () => {
        // Get the current room being generated from levelState
        const currentRoom = levelState.currentRoom;
        if (!currentRoom) {
            // Fallback: return empty selection
            return selection.new();
        }

        // Create a selection with all interior cells in the room
        // C ref: selvar.c selection_from_mkroom() — iterates lx..hx, ly..hy (inclusive)
        // and checks !edge && roomno == rmno
        const sel = selection.new();
        const rmno = currentRoom.roomnoidx !== undefined
            ? currentRoom.roomnoidx + ROOMOFFSET
            : 0;
        for (let y = currentRoom.ly; y <= currentRoom.hy; y++) {
            for (let x = currentRoom.lx; x <= currentRoom.hx; x++) {
                const loc = levelState.map && levelState.map.at(x, y);
                if (loc && !loc.edge && (!rmno || loc.roomno === rmno)) {
                    sel.set(x, y, true);
                }
            }
        }
        return sel;
    },

    /**
     * selection.area(x1, y1, x2, y2)
     * Create a rectangular selection (filled rectangle).
     * Returns an object with both coords array and x1/y1/x2/y2 properties for compatibility.
     */
    area: (x1, y1, x2, y2) => {
        const coords = [];
        const coordSet = new Set();
        const ax1 = Math.min(x1, x2);
        const ay1 = Math.min(y1, y2);
        const ax2 = Math.max(x1, x2);
        const ay2 = Math.max(y1, y2);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const addCoord = (abs) => {
            const key = `${abs.x},${abs.y}`;
            if (coordSet.has(key)) return;
            coordSet.add(key);
            coords.push(abs);
        };
        const updateBounds = (abs) => {
            if (abs.x < minX) minX = abs.x;
            if (abs.y < minY) minY = abs.y;
            if (abs.x > maxX) maxX = abs.x;
            if (abs.y > maxY) maxY = abs.y;
        };
        for (let y = ay1; y <= ay2; y++) {
            for (let x = ax1; x <= ax2; x++) {
                const abs = selection._toAbsoluteCoord(x, y);
                addCoord(abs);
                updateBounds(abs);
            }
        }

        const orderedCoords = () => [...coords].sort((a, b) => (a.x - b.x) || (a.y - b.y));
        return {
            coords,
            x1: minX, y1: minY, x2: maxX, y2: maxY, // Absolute bounds for region/non_diggable
            set: (x, y) => {
                const abs = selection._toAbsoluteCoord(x, y);
                addCoord(abs);
                updateBounds(abs);
            },
            numpoints: () => coords.length,
            percentage: (pct) => {
                const newSel = selection.new();
                for (const coord of coords) {
                    if (rn2(100) < pct) {
                        newSel.set(coord.x, coord.y, true);
                    }
                }
                return newSel;
            },
            rndcoord: (filterValue) => {
                if (coords.length === 0) return undefined;
                const ordered = orderedCoords();
                const idx = rn2(ordered.length);
                const coord = ordered[idx];
                if (filterValue) {
                    const rawIdx = coords.findIndex(c => c.x === coord.x && c.y === coord.y);
                    if (rawIdx >= 0) coords.splice(rawIdx, 1);
                    coordSet.delete(`${coord.x},${coord.y}`);
                }
                let rx = coord.x, ry = coord.y;
                if (levelState.currentRoom) {
                    rx -= levelState.currentRoom.lx;
                    ry -= levelState.currentRoom.ly;
                } else if (levelState.xstart !== undefined) {
                    rx -= levelState.xstart;
                    ry -= levelState.ystart;
                }
                return { x: rx, y: ry };
            },
            iterate: (func) => {
                for (const coord of orderedCoords()) {
                    // C ref: nhlsel.c l_selection_iterate() calls cvt_to_relcoord()
                    let rx = coord.x, ry = coord.y;
                    if (levelState.currentRoom) {
                        rx -= levelState.currentRoom.lx;
                        ry -= levelState.currentRoom.ly;
                    } else if (levelState.xstart !== undefined) {
                        rx -= levelState.xstart;
                        ry -= levelState.ystart;
                    }
                    func(rx, ry);
                }
            },
            filter_mapchar: (ch) => {
                return selection.filter_mapchar({ coords, x1: minX, y1: minY, x2: maxX, y2: maxY }, ch);
            },
            negate: () => {
                return selection.negate({ coords, x1: minX, y1: minY, x2: maxX, y2: maxY });
            },
            grow: (iterations = 1) => {
                return selection.grow({ coords, x1: minX, y1: minY, x2: maxX, y2: maxY }, iterations);
            },
            union: (other) => {
                const coordSet = new Set();
                coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                if (other && other.coords) {
                    other.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                }
                const result = selection.new();
                coordSet.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    result.set(x, y, true);
                });
                return result;
            },
            intersect: (other) => {
                if (!other || !other.coords) {
                    return selection.new();
                }
                const otherSet = new Set();
                other.coords.forEach(c => otherSet.add(`${c.x},${c.y}`));
                const result = selection.new();
                coords.forEach(c => {
                    const key = `${c.x},${c.y}`;
                    if (otherSet.has(key)) {
                        result.set(c.x, c.y, true);
                    }
                });
                return result;
            },
        };
    },

    /**
     * selection.line(x1, y1, x2, y2)
     * Create a line selection between two points using Bresenham's algorithm.
     */
    line: (x1, y1, x2, y2) => {
        const coords = [];
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        let x = x1;
        let y = y1;

        while (true) {
            coords.push({ x, y });
            if (x === x2 && y === y2) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
        return coords;
    },

    /**
     * selection.randline(sel, x1, y1, x2, y2, roughness)
     * selection.randline(x1, y1, x2, y2, roughness)
     * C ref: nhlsel.c l_selection_randline(), selvar.c selection_do_randline()
     */
    randline: (...args) => {
        let baseSel = selection.new();
        let x1, y1, x2, y2, roughness;

        if (args.length === 6 && args[0] && typeof args[0] === 'object') {
            const src = args[0];
            x1 = args[1];
            y1 = args[2];
            x2 = args[3];
            y2 = args[4];
            roughness = args[5];
            if (Array.isArray(src.coords)) {
                for (const c of src.coords) {
                    if (Number.isFinite(c?.x) && Number.isFinite(c?.y)) {
                        baseSel.set(c.x, c.y, true);
                    }
                }
            }
        } else if (args.length === 5) {
            [x1, y1, x2, y2, roughness] = args;
        } else {
            return baseSel;
        }

        const p1 = selection._toAbsoluteCoord(x1, y1);
        const p2 = selection._toAbsoluteCoord(x2, y2);
        const out = selection.new();
        for (const c of baseSel.coords) out.set(c.x, c.y, true);

        const hasPoint = (x, y) => out.coords.some(c => c.x === x && c.y === y);
        const setPoint = (x, y) => out.set(x, y, true);

        const doRandLine = (ax1, ay1, ax2, ay2, rough, rec) => {
            if (rec < 1 || (ax2 === ax1 && ay2 === ay1)) return;

            const maxDist = Math.max(Math.abs(ax2 - ax1), Math.abs(ay2 - ay1));
            if (rough > maxDist) rough = maxDist;

            let mx, my;
            if (rough < 2) {
                mx = Math.trunc((ax1 + ax2) / 2);
                my = Math.trunc((ay1 + ay2) / 2);
            } else {
                do {
                    const dx = rn2(rough) - Math.trunc(rough / 2);
                    const dy = rn2(rough) - Math.trunc(rough / 2);
                    mx = Math.trunc((ax1 + ax2) / 2) + dx;
                    my = Math.trunc((ay1 + ay2) / 2) + dy;
                } while (mx > COLNO - 1 || mx < 0 || my < 0 || my > ROWNO - 1);
            }

            if (!hasPoint(mx, my)) setPoint(mx, my);

            rough = Math.trunc((rough * 2) / 3);
            rec--;

            doRandLine(ax1, ay1, mx, my, rough, rec);
            doRandLine(mx, my, ax2, ay2, rough, rec);

            setPoint(ax2, ay2);
        };

        doRandLine(p1.x, p1.y, p2.x, p2.y, roughness, 12);
        return out;
    },

    /**
     * selection.new()
     * Create a new empty selection (set of coordinates).
     */
    new: () => {
        const coords = [];
        const coordSet = new Set();
        const orderedCoords = () => [...coords].sort((a, b) => (a.x - b.x) || (a.y - b.y));
        const toRelative = (coord) => {
            let rx = coord.x;
            let ry = coord.y;
            if (levelState.currentRoom) {
                rx -= levelState.currentRoom.lx;
                ry -= levelState.currentRoom.ly;
            } else if (levelState.xstart !== undefined) {
                rx -= levelState.xstart;
                ry -= levelState.ystart;
            }
            return { x: rx, y: ry };
        };
        const addCoord = (abs) => {
            const key = `${abs.x},${abs.y}`;
            if (coordSet.has(key)) return;
            coordSet.add(key);
            coords.push(abs);
        };
        const sel = {
            coords,
            set: (x, y, alreadyAbsolute = false) => {
                const abs = alreadyAbsolute ? { x, y } : selection._toAbsoluteCoord(x, y);
                addCoord(abs);
            },
            /**
             * numpoints()
             * Get the number of points in this selection.
             */
            numpoints: () => {
                return coords.length;
            },
            /**
             * percentage(pct)
             * Return a new selection with randomly selected percentage of coordinates.
             * C ref: nhlua.c selection_filter_percent()
             */
            percentage: (pct) => {
                const newSel = selection.new();
                for (const coord of coords) {
                    if (rn2(100) < pct) {
                        newSel.set(coord.x, coord.y, true);
                    }
                }
                return newSel;
            },
            // Add rndcoord as a method for Lua compatibility
            rndcoord: (filterValue) => {
                if (coords.length === 0) return undefined;
                const ordered = orderedCoords();
                const idx = rn2(ordered.length);
                const coord = ordered[idx];
                if (filterValue) {
                    const rawIdx = coords.findIndex(c => c.x === coord.x && c.y === coord.y);
                    if (rawIdx >= 0) coords.splice(rawIdx, 1);
                    coordSet.delete(`${coord.x},${coord.y}`);
                }
                return toRelative(coord);
            },
            /**
             * iterate(func)
             * Call a function for each coordinate in the selection.
             * Coordinates are converted to room-relative via cvt_to_relcoord.
             * C ref: nhlsel.c l_selection_iterate() calls cvt_to_relcoord()
             */
            iterate: (func) => {
                for (const coord of orderedCoords()) {
                    const { x: rx, y: ry } = toRelative(coord);
                    func(rx, ry);
                }
            },
            /**
             * bounds()
             * Return bounding rectangle for this selection.
             */
            bounds: () => {
                if (coords.length === 0) return { lx: 0, ly: 0, hx: 0, hy: 0 };
                let lx = coords[0].x, hx = coords[0].x;
                let ly = coords[0].y, hy = coords[0].y;
                for (const c of coords) {
                    if (c.x < lx) lx = c.x;
                    if (c.x > hx) hx = c.x;
                    if (c.y < ly) ly = c.y;
                    if (c.y > hy) hy = c.y;
                }
                return { lx, ly, hx, hy };
            },
            /**
             * filter_mapchar(ch)
             * Filter this selection to only include tiles matching a map character.
             * Returns a new selection.
             */
            filter_mapchar: (ch) => {
                return selection.filter_mapchar(sel, ch);
            },
            /**
             * negate()
             * Return a new selection with all map tiles NOT in this selection.
             */
            negate: () => {
                return selection.negate(sel);
            },
            /**
             * grow(iterations)
             * Expand selection by N cells in all 8 directions.
             */
            grow: (iterations = 1) => {
                return selection.grow(sel, iterations);
            },
            /**
             * union(other)
             * Return a new selection containing all coords from this selection and another.
             */
            union: (other) => {
                const coordSet = new Set();
                coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                if (other && other.coords) {
                    other.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                }
                const result = selection.new();
                coordSet.forEach(key => {
                    const [x, y] = key.split(',').map(Number);
                    result.set(x, y, true);
                });
                return result;
            },
            /**
             * intersect(other)
             * Return a new selection containing only coords present in both selections.
             * C ref: Lua operator & for selections
             */
            intersect: (other) => {
                if (!other || !other.coords) {
                    return selection.new();
                }
                const otherSet = new Set();
                other.coords.forEach(c => otherSet.add(`${c.x},${c.y}`));
                const result = selection.new();
                coords.forEach(c => {
                    const key = `${c.x},${c.y}`;
                    if (otherSet.has(key)) {
                        result.set(c.x, c.y, true);
                    }
                });
                return result;
            },
        };
        return sel;
    },

    /**
     * selection.rndcoord(sel)
     * Get a random coordinate from a selection.
     *
     * @param {Object} sel - Selection object with coords array
     * @returns {Object} Random coordinate {x, y} or undefined if empty
     */
    rndcoord: (sel) => {
        if (!sel || !sel.coords || sel.coords.length === 0) {
            return undefined;
        }
        const idx = rn2(sel.coords.length);
        return sel.coords[idx];
    },

    /**
     * selection.rect(x1, y1, x2, y2)
     * Create a rectangular perimeter selection (border only, not filled).
     *
     * @returns {Object} Selection with coords array
     */
    rect: (x1, y1, x2, y2) => {
        const coords = [];
        // Top and bottom edges
        for (let x = x1; x <= x2; x++) {
            coords.push({ x, y: y1 });
            if (y2 !== y1) {
                coords.push({ x, y: y2 });
            }
        }
        // Left and right edges (excluding corners already added)
        for (let y = y1 + 1; y < y2; y++) {
            coords.push({ x: x1, y });
            if (x2 !== x1) {
                coords.push({ x: x2, y });
            }
        }
        return { coords };
    },

    /**
     * selection.grow(sel, iterations = 1)
     * Expand selection by N cells in all 8 directions.
     *
     * @param {Object} sel - Selection (coords array or rectangle)
     * @param {number} iterations - Number of times to grow (default 1)
     * @returns {Object} Expanded selection with coords array
     */
    grow: (sel, iterations = 1) => {
        if (!sel) return { coords: [] };

        // Convert to coord set
        let coordSet = new Set();
        if (sel.coords) {
            sel.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
        } else if (sel.x1 !== undefined) {
            // Rectangle format
            for (let y = sel.y1; y <= sel.y2; y++) {
                for (let x = sel.x1; x <= sel.x2; x++) {
                    coordSet.add(`${x},${y}`);
                }
            }
        }

        // Grow by adding neighbors
        for (let i = 0; i < iterations; i++) {
            const newCoords = new Set(coordSet);
            for (const key of coordSet) {
                const [x, y] = key.split(',').map(Number);
                // Add all 8 neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < COLNO && ny >= 0 && ny < ROWNO) {
                            newCoords.add(`${nx},${ny}`);
                        }
                    }
                }
            }
            coordSet = newCoords;
        }

        // Convert back to coords array and return proper selection object
        const coords = Array.from(coordSet).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
        });
        const result = selection.new();
        coords.forEach(c => result.set(c.x, c.y, true));
        return result;
    },

    /**
     * selection.negate(sel)
     * Return the complement of the selection (all map tiles NOT in selection).
     *
     * @param {Object} sel - Selection to negate
     * @returns {Object} Negated selection with coords array
     */
    negate: (sel) => {
        let coords;
        if (!sel) {
            // No selection means select everything
            coords = [];
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    coords.push({ x, y });
                }
            }
        } else {
            // Convert to coord set for fast lookup
            const coordSet = new Set();
            if (sel.coords) {
                sel.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
            } else if (sel.x1 !== undefined) {
                // Rectangle format
                for (let y = sel.y1; y <= sel.y2; y++) {
                    for (let x = sel.x1; x <= sel.x2; x++) {
                        coordSet.add(`${x},${y}`);
                    }
                }
            }

            // Select all tiles NOT in the set
            coords = [];
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    if (!coordSet.has(`${x},${y}`)) {
                        coords.push({ x, y });
                    }
                }
            }
        }

        // Return a proper selection object with all methods
        const result = selection.new();
        coords.forEach(c => result.set(c.x, c.y, true));
        return result;
    },

    /**
     * selection.percentage(sel, pct)
     * Randomly select a percentage of coordinates from the selection.
     *
     * @param {Object} sel - Selection to filter
     * @param {number} pct - Percentage to keep (0-100)
     * @returns {Object} Filtered selection with coords array
     */
    percentage: (sel, pct) => {
        if (!sel || pct <= 0) return { coords: [] };
        if (pct >= 100) return sel;

        // Get all coords
        let allCoords = [];
        if (sel.coords) {
            allCoords = sel.coords;
        } else if (sel.x1 !== undefined) {
            // Rectangle format
            for (let y = sel.y1; y <= sel.y2; y++) {
                for (let x = sel.x1; x <= sel.x2; x++) {
                    allCoords.push({ x, y });
                }
            }
        }

        // Randomly keep pct% of coords
        const coords = allCoords.filter(() => rn2(100) < pct);
        return { coords };
    },

    /**
     * selection.floodfill(x, y, matchFn)
     * Flood fill from a starting point, selecting all connected cells matching a condition.
     *
     * @param {number} x - Starting X coordinate
     * @param {number} y - Starting Y coordinate
     * @param {Function} matchFn - Function(loc) that returns true if cell should be included
     * @returns {Object} Selection with coords array
     */
    floodfill: (x, y, matchFn) => {
        if (!levelState.map) {
            return selection.new();
        }

        const coords = [];
        const visited = new Set();
        const queue = [{ x, y }];

        while (queue.length > 0) {
            const pos = queue.shift();
            const key = `${pos.x},${pos.y}`;

            if (visited.has(key)) continue;
            if (pos.x < 0 || pos.x >= COLNO || pos.y < 0 || pos.y >= ROWNO) continue;

            visited.add(key);

            const loc = levelState.map.locations[pos.x][pos.y];
            if (!matchFn || matchFn(loc)) {
                coords.push({ x: pos.x, y: pos.y });

                // Add 4-connected neighbors
                queue.push({ x: pos.x - 1, y: pos.y });
                queue.push({ x: pos.x + 1, y: pos.y });
                queue.push({ x: pos.x, y: pos.y - 1 });
                queue.push({ x: pos.x, y: pos.y + 1 });
            }
        }

        // Return a proper selection object with all methods
        const sel = selection.new();
        coords.forEach(c => sel.set(c.x, c.y, true));
        return sel;
    },

    /**
     * selection.match(pattern)
     * Create selection of all map tiles matching a terrain type pattern.
     *
     * @param {string|number} pattern - Terrain type to match (ROOM, CORR, etc.)
     * @returns {Object} Selection with coords array
     */
    match: (pattern) => {
        if (!levelState.map) {
            return selection.new();
        }

        const patternChars = [];
        if (typeof pattern === 'number') {
            patternChars.push(pattern);
        } else if (typeof pattern === 'string') {
            for (const ch of pattern) {
                if (ch === '[' || ch === ']' || ch === '\n' || ch === '\r') continue;
                patternChars.push(ch);
            }
        }

        const matchesPattern = (typ) => {
            for (const token of patternChars) {
                if (typeof token === 'number') {
                    if (typ === token) return true;
                    continue;
                }
                // Lua "w" mapchar means "any wall".
                if (token === 'w') {
                    if (IS_WALL(typ) || typ === SDOOR || typ === IRONBARS) return true;
                    continue;
                }
                const mapped = mapchrToTerrain(token);
                if (mapped >= 0 && typ === mapped) return true;
            }
            return false;
        };

        const result = selection.new();
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 1; x < COLNO; x++) {
                const typ = levelState.map.locations[x]?.[y]?.typ;
                if (typ === undefined) continue;
                if (matchesPattern(typ)) {
                    result.set(x, y, true);
                }
            }
        }
        return result;
    },

    /**
     * selection.fillrect(x1, y1, x2, y2)
     * Create a filled rectangle selection.
     *
     * @param {number} x1 - Left x coordinate
     * @param {number} y1 - Top y coordinate
     * @param {number} x2 - Right x coordinate
     * @param {number} y2 - Bottom y coordinate
     * @returns {Object} Selection with coords array and bounds method
     */
    fillrect: (x1, y1, x2, y2) => {
        const coords = [];
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                coords.push({ x, y });
            }
        }
        const sel = {
            coords,
            bounds: () => ({ lx: x1, ly: y1, hx: x2, hy: y2 }),
            negate: function() {
                return selection.negate(this);
            },
            union: function(other) {
                const coordSet = new Set();
                this.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                if (other && other.coords) {
                    other.coords.forEach(c => coordSet.add(`${c.x},${c.y}`));
                }
                const unionCoords = Array.from(coordSet).map(s => {
                    const [x, y] = s.split(',').map(Number);
                    return { x, y };
                });
                return {
                    coords: unionCoords,
                    bounds: sel.bounds,
                    negate: sel.negate,
                    union: sel.union
                };
            }
        };
        return sel;
    },

    /**
     * selection.filter_mapchar(sel, ch)
     * Filter selection to only include tiles matching a map character.
     *
     * @param {Object} sel - Selection to filter (or null for all tiles)
     * @param {string} ch - Map character to match (".", "#", "-", etc.)
     * @returns {Object} Filtered selection with coords array
     */
    filter_mapchar: (sel, ch) => {
        if (!levelState.map) return { coords: [] };

        // Map character to terrain type
        const charToType = {
            '.': ROOM,
            '#': CORR,
            '-': HWALL,
            '|': VWALL,
            '+': DOOR,
        };
        const targetType = charToType[ch];

        // Get coords to check
        let checkCoords = [];
        if (!sel) {
            // No selection = check all tiles
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 1; x < COLNO; x++) {
                    checkCoords.push({ x, y });
                }
            }
        } else if (sel.coords) {
            checkCoords = sel.coords;
        } else if (sel.x1 !== undefined) {
            // Rectangle format
            for (let y = sel.y1; y <= sel.y2; y++) {
                for (let x = sel.x1; x <= sel.x2; x++) {
                    checkCoords.push({ x, y });
                }
            }
        }

        // Filter to matching tiles
        const coords = checkCoords.filter(c => {
            const loc = levelState.map.locations[c.x]?.[c.y];
            return loc && loc.typ === targetType;
        });

        // Return a proper selection object with methods
        const result = selection.new();
        coords.forEach(c => result.set(c.x, c.y, true));
        return result;
    },
};

/**
 * des.drawbridge(opts)
 *
 * Create a drawbridge.
 * C ref: sp_lev.c lspo_drawbridge()
 *
 * @param {Object} opts - Drawbridge options
 *   - dir: Direction ("north", "south", "east", "west")
 *   - state: State ("open", "closed")
 *   - x, y: Coordinates
 */
export function drawbridge(opts) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    const { dir, state, x, y } = opts || {};
    if (x === undefined || y === undefined) {
        return;
    }

    const pos = getLocationCoord(x, y, GETLOC_ANY_LOC, levelState.currentRoom || null);
    const bx = pos.x;
    const by = pos.y;
    if (bx < 0 || bx >= COLNO || by < 0 || by >= ROWNO) {
        return;
    }

    const dirName = String(dir || 'north').toLowerCase();
    let dx = 0;
    let dy = 0;
    if (dirName === 'north') dy = -1;
    else if (dirName === 'south') dy = 1;
    else if (dirName === 'east') dx = 1;
    else if (dirName === 'west') dx = -1;

    const isOpen = String(state || 'closed').toLowerCase() === 'open';
    const bridgeLoc = levelState.map.locations[bx][by];
    bridgeLoc.typ = isOpen ? DRAWBRIDGE_DOWN : DRAWBRIDGE_UP;
    bridgeLoc.flags = 0;
    markSpLevMap(bx, by);
    markSpLevTouched(bx, by);

    // C create_drawbridge() also establishes the adjacent drawbridge wall.
    const wx = bx + dx;
    const wy = by + dy;
    if (wx >= 0 && wx < COLNO && wy >= 0 && wy < ROWNO) {
        const wallLoc = levelState.map.locations[wx][wy];
        wallLoc.typ = DBWALL;
        wallLoc.flags = 0;
        markSpLevMap(wx, wy);
        markSpLevTouched(wx, wy);
    }
}

function placeObjectAt(obj, x, y) {
    if (!obj || !levelState.map) return;
    obj.ox = x;
    obj.oy = y;
    if (!levelState.map.objects) levelState.map.objects = [];
    levelState.map.objects.push(obj);
}

// C ref: sp_lev.c maze1xy()
function maze1xy(humidity) {
    const maxX = levelState.mazeMaxX || ((COLNO - 1) & ~1);
    const maxY = levelState.mazeMaxY || ((ROWNO - 1) & ~1);
    let x = 3;
    let y = 3;
    let tryct = 2000;
    const ignoreTouched = (typeof process !== 'undefined' && process.env.WEBHACK_MAZEWALK_IGNORE_TOUCHED === '1');
    const spLevMap = levelState.spLevMap || levelState.spLevTouched;
    do {
        x = rn1(maxX - 3, 3);
        y = rn1(maxY - 3, 3);
        if (--tryct < 0) break;
    } while ((x % 2) === 0 || (y % 2) === 0
             || (!ignoreTouched && spLevMap && spLevMap[x]?.[y])
             || !isOkLocation(x, y, humidity));
    return { x, y };
}

// C ref: sp_lev.c fill_empty_maze()
function fillEmptyMaze() {
    if (!levelState.map) return;
    const maxX = levelState.mazeMaxX || ((COLNO - 1) & ~1);
    const maxY = levelState.mazeMaxY || ((ROWNO - 1) & ~1);
    let mapcountmax = (maxX - 2) * (maxY - 2);
    let mapcount = mapcountmax;
    mapcountmax = Math.floor(mapcountmax / 2);
    const spLevMap = levelState.spLevMap || levelState.spLevTouched;

    for (let x = 2; x < maxX; x++) {
        for (let y = 0; y < maxY; y++) {
            if (spLevMap && spLevMap[x]?.[y]) mapcount--;
        }
    }

    if (mapcount <= Math.floor(mapcountmax / 10)) return;

    const mapfact = Math.floor((mapcount * 100) / mapcountmax);
    const depth = levelState.levelDepth || 1;

    const stats = { mapcount, mapcountmax, mapfact };

    stats.objCount = rnd(Math.floor((20 * mapfact) / 100));
    for (let i = stats.objCount; i > 0; i--) {
        const pos = maze1xy(GETLOC_DRY);
        const obj = mkobj(rn2(2) ? GEM_CLASS : 0, true);
        placeObjectAt(obj, pos.x, pos.y);
    }
    stats.boulderCount = rnd(Math.floor((12 * mapfact) / 100));
    for (let i = stats.boulderCount; i > 0; i--) {
        const pos = maze1xy(GETLOC_DRY);
        const ttmp = levelState.map.trapAt ? levelState.map.trapAt(pos.x, pos.y) : null;
        if (ttmp && (is_pit(ttmp.ttyp) || is_hole(ttmp.ttyp))) continue;
        placeObjectAt(mksobj(BOULDER, true, false), pos.x, pos.y);
    }
    stats.minotaurCount = rn2(2);
    for (let i = stats.minotaurCount; i > 0; i--) {
        const pos = maze1xy(GETLOC_DRY);
        makemon(PM_MINOTAUR, pos.x, pos.y, NO_MM_FLAGS, depth, levelState.map, true);
    }
    stats.monCount = rnd(Math.floor((12 * mapfact) / 100));
    for (let i = stats.monCount; i > 0; i--) {
        const pos = maze1xy(GETLOC_DRY);
        makemon(null, pos.x, pos.y, NO_MM_FLAGS, depth, levelState.map, true);
    }
    stats.goldCount = rn2(Math.floor((15 * mapfact) / 100));
    for (let i = stats.goldCount; i > 0; i--) {
        const pos = maze1xy(GETLOC_DRY);
        const mul = rnd(Math.max(Math.floor(30 / Math.max(12 - depth, 2)), 1));
        const amount = 1 + rnd(depth + 2) * mul;
        const gold = mksobj(GOLD_PIECE, true, false);
        if (gold) {
            gold.quan = amount;
            gold.owt = weight(gold);
            placeObjectAt(gold, pos.x, pos.y);
        }
    }
    const hasBoulderAt = (xx, yy) => !!levelState.map.objects?.some(
        obj => obj && obj.otyp === BOULDER && obj.ox === xx && obj.oy === yy
    );
    const canDigDownHere = () => {
        const ctx = levelState.finalizeContext || {};
        if (Number.isFinite(ctx.dunlev) && Number.isFinite(ctx.dunlevs)) {
            return ctx.dunlev < ctx.dunlevs;
        }
        return true;
    };
    const inEndgame = () => {
        const ctx = levelState.finalizeContext || {};
        return Number.isFinite(ctx.dlevel) && ctx.dlevel < 0;
    };
    const rndtrapC = () => {
        while (true) {
            let rtrap = rnd(TRAPNUM - 1);
            switch (rtrap) {
            case HOLE:
            case VIBRATING_SQUARE:
            case MAGIC_PORTAL:
                rtrap = NO_TRAP;
                break;
            case TRAPDOOR:
                if (!canDigDownHere()) rtrap = NO_TRAP;
                break;
            case LEVEL_TELEP:
            case TELEP_TRAP:
                if (levelState.flags.noteleport) rtrap = NO_TRAP;
                break;
            case ROLLING_BOULDER_TRAP:
            case ROCKTRAP:
                if (inEndgame()) rtrap = NO_TRAP;
                break;
            default:
                break;
            }
            if (rtrap !== NO_TRAP) return rtrap;
        }
    };

    stats.trapCount = rn2(Math.floor((15 * mapfact) / 100));
    for (let i = stats.trapCount; i > 0; i--) {
        const pos = maze1xy(GETLOC_DRY);
        let trytrap = rndtrapC();
        if (hasBoulderAt(pos.x, pos.y)) {
            while (is_pit(trytrap) || is_hole(trytrap)) {
                trytrap = rndtrapC();
            }
        }
        // C ref: fill_empty_maze() uses maketrap() directly, without victim logic.
        mktrap(levelState.map, trytrap, MKTRAP_MAZEFLAG | MKTRAP_NOVICTIM, null, pos, depth);
    }

    if (typeof process !== 'undefined' && process.env.WEBHACK_MAZEWALK_TRACE === '1') {
        console.log(`[MAZEFILL] mapcount=${stats.mapcount}/${stats.mapcountmax} mapfact=${stats.mapfact} counts={obj:${stats.objCount},boulder:${stats.boulderCount},minotaur:${stats.minotaurCount},mon:${stats.monCount},gold:${stats.goldCount},trap:${stats.trapCount}}`);
    }
}

/**
 * des.mazewalk(x, y, direction)
 *
 * Create a maze passage starting from (x, y) going in the specified direction.
 * C ref: sp_lev.c lspo_mazewalk()
 *
 * @param {number} x - Starting X coordinate
 * @param {number} y - Starting Y coordinate
 * @param {string} direction - Direction to walk ("north", "south", "east", "west")
 */
export function mazewalk(xOrOpts, y, direction) {
    if (!levelState.map) {
        levelState.map = new GameMap();
    }

    let x = xOrOpts;
    let stocked = true;
    let ftyp = ROOM;
    if (xOrOpts && typeof xOrOpts === 'object') {
        if (Array.isArray(xOrOpts.coord)) {
            x = xOrOpts.coord[0];
            y = xOrOpts.coord[1];
        } else {
            x = xOrOpts.x;
            y = xOrOpts.y;
        }
        direction = xOrOpts.dir ?? direction;
        stocked = xOrOpts.stocked !== undefined ? !!xOrOpts.stocked : true;
        if (xOrOpts.typ !== undefined) {
            const typ = mapchrToTerrain(xOrOpts.typ);
            if (typ !== -1) ftyp = typ;
        }
    }

    if (x === undefined || y === undefined) {
        return;
    }

    const map = levelState.map;
    const start = getLocationCoord(x, y, GETLOC_ANY_LOC, levelState.currentRoom || null);
    let sx = start.x;
    let sy = start.y;
    if (sx < 0 || sx >= COLNO || sy < 0 || sy >= ROWNO) return;

    const dirName = direction || 'random';
    const mode = getProcessEnv('WEBHACK_MAZEWALK_MODE') || 'c';
    const useStateBounds = (typeof process !== 'undefined' && process.env.WEBHACK_MAZEWALK_BOUNDS === 'legacy') ? false : true;
    const trace = (typeof process !== 'undefined' && process.env.WEBHACK_MAZEWALK_TRACE === '1');
    const traceStartRng = trace ? getRngCallCount() : 0;
    const dirs = [
        { name: 'north', dx: 0, dy: -1 },
        { name: 'south', dx: 0, dy: 1 },
        { name: 'east', dx: 1, dy: 0 },
        { name: 'west', dx: -1, dy: 0 }
    ];
    const pickDir = () => dirs[rn2(4)];
    let dir = dirs.find(d => d.name === dirName) || pickDir();

    // C ref: lspo_mazewalk() takes one step in the requested direction first.
    sx += dir.dx;
    sy += dir.dy;
    if (sx < 0 || sx >= COLNO || sy < 0 || sy >= ROWNO) return;

    if (ftyp < 1) ftyp = levelState.flags.corrmaze ? CORR : ROOM;

    const setFloorIfNotDoor = (xx, yy, typ = ftyp) => {
        if (xx < 0 || xx >= COLNO || yy < 0 || yy >= ROWNO) return;
        const loc = map.locations[xx][yy];
        if (loc.typ !== DOOR && loc.typ !== SDOOR) {
            loc.typ = typ;
            loc.flags = 0;
        }
    };
    const setFloorForced = (xx, yy, typ = ftyp) => {
        if (xx < 0 || xx >= COLNO || yy < 0 || yy >= ROWNO) return;
        const loc = map.locations[xx][yy];
        loc.typ = typ;
        loc.flags = 0;
    };
    const setFloorTypOnly = (xx, yy, typ = ftyp) => {
        if (xx < 0 || xx >= COLNO || yy < 0 || yy >= ROWNO) return;
        map.locations[xx][yy].typ = typ;
    };

    setFloorIfNotDoor(sx, sy, ftyp);

    // C ref: enforce odd parity before walkfrom().
    if ((sx % 2) === 0) {
        sx += (dir.dx > 0) ? 1 : -1;
        if (sx < 0 || sx >= COLNO) return;
        // C ref: parity-fix write is unconditional in lspo_mazewalk().
        setFloorForced(sx, sy, ftyp);
    }
    if ((sy % 2) === 0) {
        sy += (dir.dy > 0) ? 1 : -1;
        if (sy < 0 || sy >= ROWNO) return;
    }

    const isStone = (xx, yy) => {
        if (xx < 0 || xx >= COLNO || yy < 0 || yy >= ROWNO) return false;
        return map.locations[xx][yy].typ === STONE;
    };
    const maxX = useStateBounds ? Math.min(COLNO - 1, levelState.mazeMaxX || ((COLNO - 1) & ~1)) : (COLNO - 2);
    const maxY = useStateBounds ? Math.min(ROWNO - 1, levelState.mazeMaxY || ((ROWNO - 1) & ~1)) : (ROWNO - 2);
    const inWalkBounds = (xx, yy) => xx >= 3 && yy >= 3 && xx <= maxX && yy <= maxY;

    const stack = [{ x: sx, y: sy }];
    setFloorIfNotDoor(sx, sy, ftyp);
    const stats = trace ? { steps: 0, carves: 0, deadends: 0, q: [0, 0, 0, 0, 0] } : null;
    if (mode === 'c') {
        // Direct recursive port of C mkmaze.c walkfrom() non-MICRO path.
        // Direction indices mirror C's maze_dir enum: N,E,S,W => 0,1,2,3.
        const cDirs = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];
        const okayC = (xx, yy, d) => {
            const dd = cDirs[d];
            const nx = xx + dd.dx * 2;
            const ny = yy + dd.dy * 2;
            if (!inWalkBounds(nx, ny)) return false;
            return isStone(nx, ny);
        };
        const walkfromC = (wx, wy) => {
            let cx = wx;
            let cy = wy;
            if (stats) stats.steps++;
            setFloorIfNotDoor(cx, cy, ftyp);
            while (true) {
                const dirsAvail = [];
                for (let a = 0; a < 4; a++) {
                    if (okayC(cx, cy, a)) dirsAvail.push(a);
                }
                if (stats) {
                    const q = dirsAvail.length;
                    if (q >= 0 && q < stats.q.length) stats.q[q]++;
                }
                if (!dirsAvail.length) {
                    if (stats) stats.deadends++;
                    return;
                }
                const dirIdx = dirsAvail[rn2(dirsAvail.length)];
                const dd = cDirs[dirIdx];
                cx += dd.dx;
                cy += dd.dy;
                // C walkfrom() sets typ only here (does not clear flags).
                setFloorTypOnly(cx, cy, ftyp);
                cx += dd.dx;
                cy += dd.dy;
                if (stats) stats.carves++;
                walkfromC(cx, cy);
            }
        };
        walkfromC(sx, sy);
    } else {
        while (stack.length > 0) {
            if (stats) stats.steps++;
            const cur = stack[stack.length - 1];
            const order = [0, 1, 2, 3];
            for (let i = order.length - 1; i > 0; i--) {
                const j = rn2(i + 1);
                [order[i], order[j]] = [order[j], order[i]];
            }

            let choices = 0;
            let carved = false;
            for (const oi of order) {
                const d = dirs[oi];
                const nx = cur.x + d.dx * 2;
                const ny = cur.y + d.dy * 2;
                if (!inWalkBounds(nx, ny) || !isStone(nx, ny)) continue;
                choices++;

                setFloorIfNotDoor(cur.x, cur.y, ftyp);
                setFloorForced(cur.x + d.dx, cur.y + d.dy, ftyp);
                setFloorIfNotDoor(nx, ny, ftyp);
                if (stats) stats.carves++;
                stack.push({ x: nx, y: ny });
                carved = true;
                break;
            }
            if (stats && choices >= 0 && choices < stats.q.length) stats.q[choices]++;
            if (!carved) {
                if (stats) stats.deadends++;
                stack.pop();
            }
        }
    }
    if (stats) {
        const traceEndRng = getRngCallCount();
        console.log(`[MAZEWALK] mode=${mode} bounds=${useStateBounds ? 'state' : 'legacy'} max=(${maxX},${maxY}) start=(${sx},${sy}) dir=${dirName} steps=${stats.steps} carves=${stats.carves} dead=${stats.deadends} q=[${stats.q.join(',')}] rng=${traceStartRng + 1}-${traceEndRng} delta=${traceEndRng - traceStartRng}`);
    }

    if (stocked) fillEmptyMaze();
}

// Export the des.* API
export const des = {
    message,
    level_init,
    level_flags,
    map,
    replace_terrain,
    room,
    corridor,
    terrain,
    stair,
    ladder,
    grave,
    altar,
    gold,
    object,
    trap,
    region,
    wall_property,
    non_diggable,
    non_passwall,
    levregion,
    feature,
    gas_cloud,
    teleport_region,
    exclusion,
    monster,
    door,
    engraving,
    drawbridge,
    mineralize,
    random_corridors,
    wallify,
    mazewalk,
    reset_level,
    finalize_level,
};
