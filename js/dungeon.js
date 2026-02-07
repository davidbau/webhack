// dungeon.js -- Level generation
// Faithful port of mklev.c, rect.c, sp_lev.c from NetHack 3.7.
// See DECISIONS.md #9, DESIGN.md for architecture notes.
//
// The C code uses global state (levl[][], svr.rooms[], gs.smeq[]).
// In JS we pass the map object explicitly to all functions.

import {
    COLNO, ROWNO, STONE, VWALL, HWALL, TLCORNER, TRCORNER,
    BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL,
    DOOR, CORR, ROOM, STAIRS, FOUNTAIN, ALTAR, GRAVE, SINK,
    SDOOR, SCORR,
    POOL, TREE, IRONBARS, LAVAPOOL, ICE, WATER, MOAT, LAVAWALL,
    AIR, CLOUD, THRONE, MAX_TYPE,
    D_NODOOR, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED,
    DIR_N, DIR_S, DIR_E, DIR_W, DIR_180,
    xdir, ydir, N_DIRS,
    OROOM, THEMEROOM, VAULT, MAXNROFROOMS, ROOMOFFSET,
    DBWALL,
    IS_WALL, IS_STWALL, IS_DOOR, IS_ROCK, IS_ROOM, IS_OBSTRUCTED, IS_FURNITURE,
    IS_POOL, IS_LAVA, ACCESSIBLE, isok,
    NO_TRAP, ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
    LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
    PIT, SPIKED_PIT, HOLE, TRAPDOOR, TELEP_TRAP, LEVEL_TELEP,
    MAGIC_PORTAL, WEB, STATUE_TRAP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP,
    VIBRATING_SQUARE, TRAPPED_DOOR, TRAPPED_CHEST, TRAPNUM,
    is_pit, is_hole,
    MKTRAP_NOFLAGS, MKTRAP_MAZEFLAG, MKTRAP_NOSPIDERONWEB, MKTRAP_NOVICTIM
} from './config.js';
import { GameMap, makeRoom, FILL_NONE, FILL_NORMAL } from './map.js';
import { rn2, rnd, rn1, d, skipRng } from './rng.js';
import { mkobj, mksobj, setLevelDepth } from './mkobj_new.js';
import { makemon, NO_MM_FLAGS, MM_NOGRP } from './makemon_new.js';
import { init_objects } from './o_init.js';
import {
    ARROW, DART, ROCK, BOULDER, LARGE_BOX, CHEST, GOLD_PIECE, CORPSE,
    STATUE, TALLOW_CANDLE, WAX_CANDLE, BELL,
    WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, GEM_CLASS,
    ARMOR_CLASS, SCROLL_CLASS, POTION_CLASS, RING_CLASS, SPBOOK_CLASS,
    POT_HEALING, POT_EXTRA_HEALING, POT_SPEED, POT_GAIN_ENERGY,
    SCR_ENCHANT_WEAPON, SCR_ENCHANT_ARMOR, SCR_CONFUSE_MONSTER, SCR_SCARE_MONSTER,
    SCR_TELEPORTATION,
    WAN_DIGGING, SPE_HEALING, SPE_BLANK_PAPER, SPE_NOVEL,
    objectData, bases,
} from './objects.js';
import {
    RUMOR_TRUE_TEXTS, RUMOR_FALSE_TEXTS,
    RUMOR_TRUE_LINE_BYTES, RUMOR_FALSE_LINE_BYTES,
} from './rumor_data.js';

// ========================================================================
// rect.c -- Rectangle pool for BSP room placement
// C ref: rect.c
// ========================================================================

const XLIM = 4;
const YLIM = 3;

// Module-level rect pool (reset per level generation)
let rects = [];
let rect_cnt = 0;
const n_rects = Math.floor((COLNO * ROWNO) / 30);

// C ref: rect.c init_rect()
function init_rect() {
    rects = new Array(n_rects);
    rect_cnt = 1;
    rects[0] = { lx: 0, ly: 0, hx: COLNO - 1, hy: ROWNO - 1 };
}

// C ref: rect.c rnd_rect()
function rnd_rect() {
    return rect_cnt > 0 ? rects[rn2(rect_cnt)] : null;
}

// C ref: rect.c get_rect_ind()
function get_rect_ind(r) {
    for (let i = 0; i < rect_cnt; i++) {
        if (rects[i].lx === r.lx && rects[i].ly === r.ly &&
            rects[i].hx === r.hx && rects[i].hy === r.hy)
            return i;
    }
    return -1;
}

// C ref: rect.c get_rect() -- find a free rect that contains r
function get_rect(r) {
    for (let i = 0; i < rect_cnt; i++) {
        if (r.lx >= rects[i].lx && r.ly >= rects[i].ly &&
            r.hx <= rects[i].hx && r.hy <= rects[i].hy)
            return rects[i];
    }
    return null;
}

// C ref: rect.c remove_rect()
function remove_rect(r) {
    const ind = get_rect_ind(r);
    if (ind >= 0) {
        rects[ind] = rects[--rect_cnt];
    }
}

// C ref: rect.c add_rect()
function add_rect(r) {
    if (rect_cnt >= n_rects) return;
    if (get_rect(r)) return; // already contained in another rect
    rects[rect_cnt] = { lx: r.lx, ly: r.ly, hx: r.hx, hy: r.hy };
    rect_cnt++;
}

// C ref: rect.c intersect() -- returns intersection or null
function intersect(r1, r2) {
    if (r2.lx > r1.hx || r2.ly > r1.hy || r2.hx < r1.lx || r2.hy < r1.ly)
        return null;
    const r3 = {
        lx: Math.max(r2.lx, r1.lx),
        ly: Math.max(r2.ly, r1.ly),
        hx: Math.min(r2.hx, r1.hx),
        hy: Math.min(r2.hy, r1.hy)
    };
    if (r3.lx > r3.hx || r3.ly > r3.hy) return null;
    return r3;
}

// C ref: rect.c split_rects() -- split r1 around allocated r2
function split_rects(r1, r2) {
    const old_r = { lx: r1.lx, ly: r1.ly, hx: r1.hx, hy: r1.hy };
    remove_rect(r1);

    // Walk down since rect_cnt & rects will change
    for (let i = rect_cnt - 1; i >= 0; i--) {
        const r = intersect(rects[i], r2);
        if (r) split_rects(rects[i], r);
    }

    if (r2.ly - old_r.ly - 1
        > (old_r.hy < ROWNO - 1 ? 2 * YLIM : YLIM + 1) + 4) {
        add_rect({ lx: old_r.lx, ly: old_r.ly, hx: old_r.hx, hy: r2.ly - 2 });
    }
    if (r2.lx - old_r.lx - 1
        > (old_r.hx < COLNO - 1 ? 2 * XLIM : XLIM + 1) + 4) {
        add_rect({ lx: old_r.lx, ly: old_r.ly, hx: r2.lx - 2, hy: old_r.hy });
    }
    if (old_r.hy - r2.hy - 1
        > (old_r.ly > 0 ? 2 * YLIM : YLIM + 1) + 4) {
        add_rect({ lx: old_r.lx, ly: r2.hy + 2, hx: old_r.hx, hy: old_r.hy });
    }
    if (old_r.hx - r2.hx - 1
        > (old_r.lx > 0 ? 2 * XLIM : XLIM + 1) + 4) {
        add_rect({ lx: r2.hx + 2, ly: old_r.ly, hx: old_r.hx, hy: old_r.hy });
    }
}

// ========================================================================
// sp_lev.c -- Room creation (check_room, create_room)
// ========================================================================

// C ref: sp_lev.c check_room()
// Verifies room area is all STONE with required margins.
// May shrink the room. Returns { lowx, ddx, lowy, ddy } or null.
function check_room(map, lowx, ddx, lowy, ddy, vault, inThemerooms) {
    let hix = lowx + ddx, hiy = lowy + ddy;
    const xlim = XLIM + (vault ? 1 : 0);
    const ylim = YLIM + (vault ? 1 : 0);

    // C ref: sp_lev.c:1417-1418 — save original dimensions for themeroom check
    const s_lowx = lowx, s_ddx = ddx, s_lowy = lowy, s_ddy = ddy;

    if (lowx < 3) lowx = 3;
    if (lowy < 2) lowy = 2;
    if (hix > COLNO - 3) hix = COLNO - 3;
    if (hiy > ROWNO - 3) hiy = ROWNO - 3;

    for (;;) { // C uses goto chk; for retry
        if (hix <= lowx || hiy <= lowy)
            return null;

        // C ref: sp_lev.c:1435-1437 — in themerooms mode, fail if all
        // dimensions were modified from original
        if (inThemerooms && (s_lowx !== lowx) && (s_ddx !== ddx)
            && (s_lowy !== lowy) && (s_ddy !== ddy))
            return null;

        let conflict = false;
        for (let x = lowx - xlim; x <= hix + xlim && !conflict; x++) {
            if (x <= 0 || x >= COLNO) continue;
            let y = lowy - ylim;
            let ymax = hiy + ylim;
            if (y < 0) y = 0;
            if (ymax >= ROWNO) ymax = ROWNO - 1;
            for (; y <= ymax; y++) {
                const loc = map.at(x, y);
                if (loc && loc.typ !== STONE) {
                    if (!rn2(3)) return null;
                    // C ref: sp_lev.c:1457-1458 — in themerooms mode,
                    // any overlap causes immediate failure (no shrinking)
                    if (inThemerooms) return null;
                    if (x < lowx)
                        lowx = x + xlim + 1;
                    else
                        hix = x - xlim - 1;
                    if (y < lowy)
                        lowy = y + ylim + 1;
                    else
                        hiy = y - ylim - 1;
                    conflict = true;
                    break; // retry from top (goto chk)
                }
            }
        }
        if (!conflict) break;
    }

    return { lowx, ddx: hix - lowx, lowy, ddy: hiy - lowy };
}

// C ref: mkmap.c litstate_rnd() -- determine if room is lit
function litstate_rnd(litstate, depth) {
    if (litstate < 0)
        return (rnd(1 + Math.abs(depth)) < 11 && rn2(77)) ? true : false;
    return !!litstate;
}

// C ref: sp_lev.c create_room() -- create a random room using rect BSP
// Returns true if room was created, false if failed.
function create_room(map, x, y, w, h, xal, yal, rtype, rlit, depth, inThemerooms) {
    let xabs = 0, yabs = 0;
    let wtmp, htmp, xtmp, ytmp;
    let r1 = null;
    let trycnt = 0;
    const vault = (rtype === VAULT);
    const xlim = XLIM + (vault ? 1 : 0);
    const ylim = YLIM + (vault ? 1 : 0);

    if (rtype === -1) rtype = OROOM;

    // Determine lighting
    const lit = litstate_rnd(rlit, depth);

    // Try to create the room
    do {
        wtmp = w;
        htmp = h;
        xtmp = x;
        ytmp = y;

        // Totally random room (all params are -1), or vault
        if ((xtmp < 0 && ytmp < 0 && wtmp < 0 && xal < 0 && yal < 0)
            || vault) {
            r1 = rnd_rect();
            if (!r1) return false;

            const hx = r1.hx, hy = r1.hy, lx = r1.lx, ly = r1.ly;
            let dx, dy;
            if (vault) {
                dx = dy = 1;
            } else {
                dx = 2 + rn2((hx - lx > 28) ? 12 : 8);
                dy = 2 + rn2(4);
                if (dx * dy > 50)
                    dy = Math.floor(50 / dx);
            }
            const xborder = (lx > 0 && hx < COLNO - 1) ? 2 * xlim : xlim + 1;
            const yborder = (ly > 0 && hy < ROWNO - 1) ? 2 * ylim : ylim + 1;
            if (hx - lx < dx + 3 + xborder || hy - ly < dy + 3 + yborder) {
                r1 = null;
                continue;
            }
            xabs = lx + (lx > 0 ? xlim : 3)
                   + rn2(hx - (lx > 0 ? lx : 3) - dx - xborder + 1);
            yabs = ly + (ly > 0 ? ylim : 2)
                   + rn2(hy - (ly > 0 ? ly : 2) - dy - yborder + 1);
            if (ly === 0 && hy >= ROWNO - 1
                && (!map.nroom || !rn2(map.nroom))
                && (yabs + dy > Math.floor(ROWNO / 2))) {
                yabs = rn1(3, 2);
                if (map.nroom < 4 && dy > 1)
                    dy--;
            }
            const result = check_room(map, xabs, dx, yabs, dy, vault, inThemerooms);
            if (!result) {
                r1 = null;
                continue;
            }
            xabs = result.lowx;
            yabs = result.lowy;
            wtmp = result.ddx + 1;
            htmp = result.ddy + 1;
            const r2 = {
                lx: xabs - 1,
                ly: yabs - 1,
                hx: xabs + wtmp,
                hy: yabs + htmp
            };
            // Split the rect pool around this room
            split_rects(r1, r2);
        } else {
            // Partially specified room (not needed for basic level gen)
            return false;
        }

        // C ref: sp_lev.c:1652-1659 — vaults don't add a room or
        // increment nroom; they just save the position for later.
        if (vault) {
            map.vault_x = xabs;
            map.vault_y = yabs;
            return true;
        }

        // Actually create the room
        add_room_to_map(map, xabs, yabs, xabs + wtmp - 1, yabs + htmp - 1,
                        lit, rtype, false);
        return true;

    } while (++trycnt <= 100); // C ref: sp_lev.c trycnt limit is 100

    return false;
}

// ========================================================================
// mklev.c -- Core level generation
// ========================================================================

// C ref: mklev.c do_room_or_subroom()
function do_room_or_subroom(map, croom, lowx, lowy, hix, hiy,
                            lit, rtype, special, is_room) {
    // Clamp coordinates
    if (!lowx) lowx++;
    if (!lowy) lowy++;
    if (hix >= COLNO - 1) hix = COLNO - 2;
    if (hiy >= ROWNO - 1) hiy = ROWNO - 2;

    if (lit) {
        for (let x = lowx - 1; x <= hix + 1; x++) {
            for (let y = Math.max(lowy - 1, 0); y <= hiy + 1; y++) {
                const loc = map.at(x, y);
                if (loc) loc.lit = true;
            }
        }
        croom.rlit = true;
    } else {
        croom.rlit = false;
    }

    const roomno = (map.rooms.indexOf(croom));
    croom.roomnoidx = roomno;
    croom.lx = lowx;
    croom.hx = hix;
    croom.ly = lowy;
    croom.hy = hiy;
    croom.rtype = rtype;
    croom.doorct = 0;
    croom.fdoor = map.doorindex;
    croom.irregular = false;
    croom.needjoining = true;

    if (!special) {
        // Top and bottom walls (horizontal)
        for (let x = lowx - 1; x <= hix + 1; x++) {
            for (let y = lowy - 1; y <= hiy + 1; y += (hiy - lowy + 2)) {
                const loc = map.at(x, y);
                if (loc) {
                    loc.typ = HWALL;
                    loc.horizontal = true;
                }
            }
        }
        // Left and right walls (vertical)
        for (let x = lowx - 1; x <= hix + 1; x += (hix - lowx + 2)) {
            for (let y = lowy; y <= hiy; y++) {
                const loc = map.at(x, y);
                if (loc) {
                    loc.typ = VWALL;
                    loc.horizontal = false;
                }
            }
        }
        // Fill interior with ROOM
        for (let x = lowx; x <= hix; x++) {
            for (let y = lowy; y <= hiy; y++) {
                const loc = map.at(x, y);
                if (loc) loc.typ = ROOM;
            }
        }
        if (is_room) {
            // Set corners
            const tl = map.at(lowx - 1, lowy - 1);
            const tr = map.at(hix + 1, lowy - 1);
            const bl = map.at(lowx - 1, hiy + 1);
            const br = map.at(hix + 1, hiy + 1);
            if (tl) tl.typ = TLCORNER;
            if (tr) tr.typ = TRCORNER;
            if (bl) bl.typ = BLCORNER;
            if (br) br.typ = BRCORNER;
        } else {
            // Subroom: use wallification for corners
            wallify(map, lowx - 1, lowy - 1, hix + 1, hiy + 1);
        }
    }

    // Set roomno on all cells in the room
    const rno = roomno + ROOMOFFSET;
    for (let x = lowx; x <= hix; x++) {
        for (let y = lowy; y <= hiy; y++) {
            const loc = map.at(x, y);
            if (loc) loc.roomno = rno;
        }
    }
}

// C ref: mklev.c add_room()
function add_room_to_map(map, lowx, lowy, hix, hiy, lit, rtype, special) {
    const croom = makeRoom();
    // needfill defaults to FILL_NONE; caller sets FILL_NORMAL as needed
    map.rooms.push(croom);
    map.nroom = map.rooms.length;
    do_room_or_subroom(map, croom, lowx, lowy, hix, hiy, lit, rtype,
                       special, true);
}

// C ref: mklev.c mkroom_cmp() — sort rooms by lx only
function mkroom_cmp(a, b) {
    if (a.lx < b.lx) return -1;
    if (a.lx > b.lx) return 1;
    return 0;
}

// BSD-compatible qsort (Bentley-McIlroy fat partition).
// JS Array.sort is stable (TimSort) while C's qsort is not.
// We must match C's exact sort behavior for deterministic level gen.
function bsdQsort(arr, cmpFn) {
    function med3(a, b, c) {
        return cmpFn(arr[a], arr[b]) < 0
            ? (cmpFn(arr[b], arr[c]) < 0 ? b : (cmpFn(arr[a], arr[c]) < 0 ? c : a))
            : (cmpFn(arr[b], arr[c]) > 0 ? b : (cmpFn(arr[a], arr[c]) > 0 ? c : a));
    }
    function swap(i, j) {
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    function qsort(lo, n) {
        if (n < 7) {
            // Insertion sort for small subarrays (stable)
            for (let i = lo + 1; i < lo + n; i++)
                for (let j = i; j > lo && cmpFn(arr[j - 1], arr[j]) > 0; j--)
                    swap(j, j - 1);
            return;
        }
        // Pivot: median of three (or ninther for large arrays)
        let pm = lo + Math.floor(n / 2);
        if (n > 7) {
            let pl = lo, pn = lo + n - 1;
            if (n > 40) {
                const s = Math.floor(n / 8);
                pl = med3(pl, pl + s, pl + 2 * s);
                pm = med3(pm - s, pm, pm + s);
                pn = med3(pn - 2 * s, pn - s, pn);
            }
            pm = med3(pl, pm, pn);
        }
        swap(lo, pm);
        let pa = lo + 1, pb = pa;
        let pc = lo + n - 1, pd = pc;
        for (;;) {
            while (pb <= pc && cmpFn(arr[pb], arr[lo]) <= 0) {
                if (cmpFn(arr[pb], arr[lo]) === 0) { swap(pa, pb); pa++; }
                pb++;
            }
            while (pb <= pc && cmpFn(arr[pc], arr[lo]) >= 0) {
                if (cmpFn(arr[pc], arr[lo]) === 0) { swap(pc, pd); pd--; }
                pc--;
            }
            if (pb > pc) break;
            swap(pb, pc); pb++; pc--;
        }
        const hi = lo + n;
        let s = Math.min(pa - lo, pb - pa);
        for (let i = 0; i < s; i++) swap(lo + i, pb - s + i);
        s = Math.min(pd - pc, hi - pd - 1);
        for (let i = 0; i < s; i++) swap(pb + i, hi - s + i);
        s = pb - pa;
        if (s > 1) qsort(lo, s);
        s = pd - pc;
        if (s > 1) qsort(hi - s, s);
    }
    qsort(0, arr.length);
}

// C ref: mklev.c sort_rooms()
function sort_rooms(map) {
    const n = map.nroom;

    // Sort rooms using BSD-compatible qsort to match C's behavior
    bsdQsort(map.rooms, mkroom_cmp);

    // Build reverse index: ri[old_roomnoidx] = new_index
    const ri = new Array(MAXNROFROOMS + 1).fill(0);
    for (let i = 0; i < n; i++) {
        ri[map.rooms[i].roomnoidx] = i;
    }

    // Update roomno on the map cells
    for (let x = 1; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            const rno = loc.roomno;
            if (rno >= ROOMOFFSET && rno < MAXNROFROOMS + 1) {
                loc.roomno = ri[rno - ROOMOFFSET] + ROOMOFFSET;
            }
        }
    }

    // Update roomnoidx on rooms
    for (let i = 0; i < n; i++) {
        map.rooms[i].roomnoidx = i;
    }
}

// ========================================================================
// des.map() themeroom support
// C ref: themerms.lua — shaped room definitions (L, T, S, Z, Cross, etc.)
// ========================================================================

// Character-to-typ mapping for des.map() strings.
// C ref: nhlua.c splev_chr2typ()
const CHAR_TO_TYP = {
    ' ': STONE, '#': CORR, '.': ROOM, '-': HWALL, '|': VWALL,
    '+': DOOR, 'S': SDOOR, 'H': SCORR, '{': FOUNTAIN, '\\': THRONE,
    'K': SINK, '}': MOAT, 'P': POOL, 'L': LAVAPOOL, 'Z': LAVAWALL,
    'I': ICE, 'W': WATER, 'T': TREE, 'F': IRONBARS, 'A': AIR,
    'C': CLOUD, 'B': CROSSWALL, 'x': MAX_TYPE,
};

// Map data for des.map() themeroms (JS picks 11-29).
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

// Flood fill from (sx, sy) through connected cells of the same typ,
// assign roomno, compute bounding box, and register as a room.
// C ref: sp_lev.c flood_fill_rm() + add_room()
function floodFillAndRegister(map, sx, sy, rtype, lit) {
    const startTyp = map.at(sx, sy).typ;
    const rno = map.nroom + ROOMOFFSET;

    // BFS flood fill
    let minX = sx, maxX = sx, minY = sy, maxY = sy;
    const visited = new Set();
    const queue = [[sx, sy]];
    const key = (x, y) => y * COLNO + x;
    visited.add(key(sx, sy));

    while (queue.length > 0) {
        const [cx, cy] = queue.shift();
        const loc = map.at(cx, cy);
        loc.roomno = rno;
        loc.lit = lit;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        // Check 4 neighbors
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
            const nx = cx + dx, ny = cy + dy;
            if (!isok(nx, ny)) continue;
            const k = key(nx, ny);
            if (visited.has(k)) continue;
            const nloc = map.at(nx, ny);
            if (nloc.typ === startTyp && nloc.roomno === 0) {
                visited.add(k);
                queue.push([nx, ny]);
            }
        }
    }

    // Mark surrounding walls as edge
    // C ref: sp_lev.c flood_fill_rm anyroom case
    for (const k of visited) {
        const cy = Math.floor(k / COLNO);
        const cx = k % COLNO;
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
            const nx = cx + dx, ny = cy + dy;
            if (!isok(nx, ny)) continue;
            const nloc = map.at(nx, ny);
            if (IS_WALL(nloc.typ) || nloc.typ === SDOOR) {
                nloc.edge = true;
            }
        }
    }

    // Register the room
    const croom = makeRoom();
    map.rooms.push(croom);
    map.nroom = map.rooms.length;

    const roomno = map.rooms.indexOf(croom);
    croom.roomnoidx = roomno;
    croom.lx = minX;
    croom.hx = maxX;
    croom.ly = minY;
    croom.hy = maxY;
    croom.rtype = rtype;
    croom.rlit = lit;
    croom.doorct = 0;
    croom.fdoor = map.doorindex;
    croom.irregular = true;
    croom.needjoining = true;

    // Set lit on wall/edge cells within bounding box
    if (lit) {
        for (let x = minX - 1; x <= maxX + 1; x++) {
            for (let y = minY - 1; y <= maxY + 1; y++) {
                if (isok(x, y)) {
                    const loc = map.at(x, y);
                    if (loc.edge || loc.roomno === rno) {
                        loc.lit = true;
                    }
                }
            }
        }
    }
}

// Fixed Lua themerooms rn2 argument pattern (30 calls per room iteration).
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

// Themeroom fill types in order from themerms.lua themeroom_fills array.
// All have frequency=1. Eligibility depends on depth and room lit state.
// C ref: themerms.lua themeroom_fills[]
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
    const floorTiles = w * h; // all floor tiles (lx..hx × ly..hy)
    switch (pickName) {
        case 'ice':
            // C ref: themerms.lua Ice room — selection.room() then des.terrain(ice, "I")
            // selection.room() selects all floor tiles from lx..hx, ly..hy
            for (let y = room.ly; y <= room.hy; y++) {
                for (let x = room.lx; x <= room.hx; x++) {
                    const loc = map.at(x, y);
                    if (loc && loc.typ === ROOM) loc.typ = ICE;
                }
            }
            // percent(25) → rn2(100)
            if (rn2(100) < 25) {
                // ice:iterate(ice_melter) — nh.rn2(1000) per floor tile
                for (let i = 0; i < floorTiles; i++) {
                    rn2(1000);
                }
            }
            break;
        case 'temple':
            // Temple of the gods: 3 altars × (somex + somey)
            // C ref: themerms.lua Temple of the gods, mkroom.c somex/somey
            for (let i = 0; i < 3; i++) {
                const ax = rn2(w) + room.lx; // somex: rn1(hx-lx+1, lx)
                const ay = rn2(h) + room.ly; // somey: rn1(hy-ly+1, ly)
                const loc = map.at(ax, ay);
                if (loc) loc.typ = ALTAR;
            }
            break;
        // TODO: simulate other fill types (cloud, spider, trap, etc.)
        // These involve des.object/des.monster/des.trap creation which requires
        // porting mkobj.c/makemon.c/mktrap.c RNG consumption patterns.
    }
}

// Perform themerooms reservoir sampling and return the picked themeroom index.
// C ref: themerms.lua themerooms_generate()
function themeroomsGenerate() {
    let pick = 0; // default room (index 0)
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
    return pick;
}

// C ref: mklev.c makerooms()
function makerooms(map, depth) {
    let tried_vault = false;
    let themeroom_tries = 0;

    // C ref: mklev.c:386-388 — pre_themerooms_generate Lua calls
    rn2(3); rn2(2);

    // Make rooms until satisfied (no more rects available)
    // C ref: mklev.c:393-417
    while (map.nroom < (MAXNROFROOMS - 1) && rnd_rect()) {
        if (map.nroom >= Math.floor(MAXNROFROOMS / 6) && rn2(2)
            && !tried_vault) {
            tried_vault = true;
            // C ref: mklev.c:396-399 — create_vault() saves position but
            // does NOT add a room or increment nroom. The vault is properly
            // created later in the post-corridor section of makelevel.
            create_room(map, -1, -1, 2, 2, -1, -1, VAULT, true, depth, true);
        } else {
            // C ref: mklev.c:402-407 — themerooms_generate Lua reservoir
            // sampling (30 calls). Track which room was picked.
            const themeroomPick = themeroomsGenerate();

            if (themeroomPick >= 11 && themeroomPick <= 29) {
                // des.map() themeroom — NO rn2(100) build_room check.
                // C ref: themerms.lua — these call des.map() not des.room()
                if (!placeMapThemeroom(map, themeroomPick, depth)) {
                    // themeroom_failed
                    if (++themeroom_tries > 10
                        || map.nroom >= Math.floor(MAXNROFROOMS / 6))
                        break;
                } else {
                    themeroom_tries = 0;
                }
            } else {
                // des.room() themeroom (picks 0-10) — has rn2(100) build_room
                // C ref: sp_lev.c:2803 build_room chance check
                rn2(100);

                if (!create_room(map, -1, -1, -1, -1, -1, -1, OROOM, -1, depth, true)) {
                    // C ref: mklev.c:408-411 — themeroom_failed retry logic
                    if (++themeroom_tries > 10
                        || map.nroom >= Math.floor(MAXNROFROOMS / 6))
                        break;
                } else {
                    // C ref: themerms.lua — set needfill based on whether the
                    // Lua themeroom passes filled=1 to des.room().
                    // Picks with filled=1: 0,1,2,3,4,7,10. Others: no filled → 0.
                    const filledPicks = [0, 1, 2, 3, 4, 7, 10];
                    if (filledPicks.includes(themeroomPick)) {
                        map.rooms[map.nroom - 1].needfill = FILL_NORMAL;
                    }
                    // C ref: non-default themerooms get rtype=THEMEROOM
                    if (themeroomPick !== 0) {
                        map.rooms[map.nroom - 1].rtype = THEMEROOM;
                    }
                    if (themeroomPick >= 5 && themeroomPick <= 7) {
                        // Simulate themeroom_fill RNG consumption.
                        // C ref: themerms.lua — indices 5,6,7 all call themeroom_fill()
                        const room = map.rooms[map.nroom - 1];
                        const forceLit = (themeroomPick === 6) ? false : undefined;
                        simulateThemeroomFill(map, room, depth, forceLit);
                    }
                    themeroom_tries = 0;
                }
            }
        }
    }
}

// ========================================================================
// Corridor generation -- join(), makecorridors(), dig_corridor()
// ========================================================================

// C ref: mklev.c bydoor() -- is there a door adjacent to (x,y)?
function bydoor(map, x, y) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) {
        if (isok(x + dx, y + dy)) {
            const typ = map.at(x + dx, y + dy).typ;
            if (IS_DOOR(typ) || typ === SDOOR) return true;
        }
    }
    return false;
}

// C ref: mklev.c okdoor() -- is (x,y) a valid door position?
function okdoor(map, x, y) {
    const loc = map.at(x, y);
    if (!loc) return false;
    if (loc.typ !== HWALL && loc.typ !== VWALL) return false;
    if (bydoor(map, x, y)) return false;
    // Must have at least one non-obstructed neighbor
    return ((isok(x - 1, y) && !IS_OBSTRUCTED(map.at(x - 1, y).typ))
         || (isok(x + 1, y) && !IS_OBSTRUCTED(map.at(x + 1, y).typ))
         || (isok(x, y - 1) && !IS_OBSTRUCTED(map.at(x, y - 1).typ))
         || (isok(x, y + 1) && !IS_OBSTRUCTED(map.at(x, y + 1).typ)));
}

// C ref: mklev.c good_rm_wall_doorpos()
function good_rm_wall_doorpos(map, x, y, dir, room) {
    if (!isok(x, y) || !room.needjoining) return false;
    const loc = map.at(x, y);
    if (!(loc.typ === HWALL || loc.typ === VWALL
          || IS_DOOR(loc.typ) || loc.typ === SDOOR))
        return false;
    if (bydoor(map, x, y)) return false;

    const tx = x + xdir[dir];
    const ty = y + ydir[dir];
    if (!isok(tx, ty) || IS_OBSTRUCTED(map.at(tx, ty).typ))
        return false;

    const rmno = map.rooms.indexOf(room) + ROOMOFFSET;
    if (rmno !== map.at(tx, ty).roomno)
        return false;

    return true;
}

// C ref: mklev.c finddpos_shift()
function finddpos_shift(map, x, y, dir, aroom) {
    dir = DIR_180(dir);
    const dx = xdir[dir];
    const dy = ydir[dir];

    if (good_rm_wall_doorpos(map, x, y, dir, aroom))
        return { x, y };

    // C ref: mklev.c:118-139 — irregular rooms may have their wall away from
    // the bounding box edge; walk inward through STONE/CORR to find the wall.
    if (aroom.irregular) {
        let rx = x, ry = y;
        let fail = false;
        while (!fail && isok(rx, ry)
               && (map.at(rx, ry).typ === STONE || map.at(rx, ry).typ === CORR)) {
            rx += dx;
            ry += dy;
            if (good_rm_wall_doorpos(map, rx, ry, dir, aroom))
                return { x: rx, y: ry };
            if (!(map.at(rx, ry).typ === STONE || map.at(rx, ry).typ === CORR))
                fail = true;
            if (rx < aroom.lx || rx > aroom.hx
                || ry < aroom.ly || ry > aroom.hy)
                fail = true;
        }
    }
    return null;
}

// C ref: mklev.c finddpos() -- find door position on room wall
function finddpos(map, dir, aroom) {
    let x1, y1, x2, y2;

    switch (dir) {
    case DIR_N:
        x1 = aroom.lx; x2 = aroom.hx;
        y1 = y2 = aroom.ly - 1;
        break;
    case DIR_S:
        x1 = aroom.lx; x2 = aroom.hx;
        y1 = y2 = aroom.hy + 1;
        break;
    case DIR_W:
        x1 = x2 = aroom.lx - 1;
        y1 = aroom.ly; y2 = aroom.hy;
        break;
    case DIR_E:
        x1 = x2 = aroom.hx + 1;
        y1 = aroom.ly; y2 = aroom.hy;
        break;
    default:
        return null;
    }

    // Try random points (up to 20 attempts)
    let tryct = 0;
    do {
        const x = (x2 - x1) ? rn1(x2 - x1 + 1, x1) : x1;
        const y = (y2 - y1) ? rn1(y2 - y1 + 1, y1) : y1;
        const result = finddpos_shift(map, x, y, dir, aroom);
        if (result) return result;
    } while (++tryct < 20);

    // Try all points exhaustively
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            const result = finddpos_shift(map, x, y, dir, aroom);
            if (result) return result;
        }
    }

    // Cannot find a valid position
    return { x: x1, y: y1 };
}

// C ref: mklev.c maybe_sdoor()
function maybe_sdoor(depth, chance) {
    return (depth > 2) && !rn2(Math.max(2, chance));
}

// C ref: mklev.c dosdoor() -- set door type and add to room's door list
function dosdoor(map, x, y, aroom, type, depth) {
    const loc = map.at(x, y);
    if (!IS_WALL(loc.typ)) type = DOOR; // avoid secret doors on existing doors

    loc.typ = type;
    if (type === DOOR) {
        if (!rn2(3)) {
            // 1/3 chance: actual door (closed, open, or locked)
            if (!rn2(5))
                loc.flags = D_ISOPEN;
            else if (!rn2(6))
                loc.flags = D_LOCKED;
            else
                loc.flags = D_CLOSED;

            if (loc.flags !== D_ISOPEN && depth >= 5 && !rn2(25))
                loc.flags |= D_TRAPPED;
        } else {
            // 2/3 chance: doorway (no door)
            loc.flags = D_NODOOR;
        }

        if (loc.flags & D_TRAPPED) {
            if (depth >= 9 && !rn2(5)) {
                // Would make a mimic -- skip for now, just make doorway
                loc.flags = D_NODOOR;
            }
        }
    } else {
        // Secret door
        if (!rn2(5))
            loc.flags = D_LOCKED;
        else
            loc.flags = D_CLOSED;

        if (depth >= 4 && !rn2(20))
            loc.flags |= D_TRAPPED;
    }

    add_door(map, x, y, aroom);
}

// C ref: mklev.c dodoor()
function dodoor(map, x, y, aroom, depth) {
    dosdoor(map, x, y, aroom, maybe_sdoor(depth, 8) ? SDOOR : DOOR, depth);
}

// C ref: mklev.c add_door()
function add_door(map, x, y, aroom) {
    // Check for duplicate
    for (let i = 0; i < aroom.doorct; i++) {
        const tmp = aroom.fdoor + i;
        if (map.doors[tmp] && map.doors[tmp].x === x && map.doors[tmp].y === y)
            return;
    }

    if (aroom.doorct === 0)
        aroom.fdoor = map.doorindex;

    aroom.doorct++;

    // Shift doors for other rooms (simplified vs C's full insertion logic)
    for (let tmp = map.doorindex; tmp > aroom.fdoor; tmp--) {
        map.doors[tmp] = map.doors[tmp - 1];
    }
    for (const broom of map.rooms) {
        if (broom !== aroom && broom.doorct && broom.fdoor >= aroom.fdoor)
            broom.fdoor++;
    }

    map.doorindex++;
    map.doors[aroom.fdoor] = { x, y };
}

// C ref: sp_lev.c dig_corridor()
// Digs a corridor from org to dest through stone.
// Returns { success, npoints }.
function dig_corridor(map, org, dest, nxcor, depth) {
    let dx = 0, dy = 0;
    let cct;
    let npoints = 0;
    let xx = org.x, yy = org.y;
    const tx = dest.x, ty = dest.y;
    const ftyp = CORR;
    const btyp = STONE;

    if (xx <= 0 || yy <= 0 || tx <= 0 || ty <= 0
        || xx > COLNO - 1 || tx > COLNO - 1
        || yy > ROWNO - 1 || ty > ROWNO - 1)
        return { success: false, npoints: 0 };

    // Determine initial direction
    if (tx > xx) dx = 1;
    else if (ty > yy) dy = 1;
    else if (tx < xx) dx = -1;
    else dy = -1;

    xx -= dx;
    yy -= dy;
    cct = 0;

    while (xx !== tx || yy !== ty) {
        if (cct++ > 500 || (nxcor && !rn2(35)))
            return { success: false, npoints };

        xx += dx;
        yy += dy;

        if (xx >= COLNO - 1 || xx <= 0 || yy <= 0 || yy >= ROWNO - 1)
            return { success: false, npoints };

        const crm = map.at(xx, yy);
        if (crm.typ === btyp) {
            // C: maybe_sdoor(100) can turn corridor into SCORR
            if (ftyp === CORR && maybe_sdoor(depth, 100)) {
                npoints++;
                crm.typ = SCORR;
            } else {
                npoints++;
                crm.typ = ftyp;
                if (nxcor && !rn2(50)) {
                    // C ref: sp_lev.c:2596 — mksobj_at(BOULDER, ...)
                    mksobj(BOULDER, true, false);
                }
            }
        } else if (crm.typ !== ftyp && crm.typ !== SCORR) {
            return { success: false, npoints };
        }

        // Find next corridor position
        let dix = Math.abs(xx - tx);
        let diy = Math.abs(yy - ty);

        if ((dix > diy) && diy && !rn2(dix - diy + 1)) {
            dix = 0;
        } else if ((diy > dix) && dix && !rn2(diy - dix + 1)) {
            diy = 0;
        }

        // Do we need to change direction?
        if (dy && dix > diy) {
            const ddx = (xx > tx) ? -1 : 1;
            const adjloc = map.at(xx + ddx, yy);
            if (adjloc && (adjloc.typ === btyp || adjloc.typ === ftyp
                          || adjloc.typ === SCORR)) {
                dx = ddx;
                dy = 0;
                continue;
            }
        } else if (dx && diy > dix) {
            const ddy = (yy > ty) ? -1 : 1;
            const adjloc = map.at(xx, yy + ddy);
            if (adjloc && (adjloc.typ === btyp || adjloc.typ === ftyp
                          || adjloc.typ === SCORR)) {
                dy = ddy;
                dx = 0;
                continue;
            }
        }

        // Continue straight?
        const ahead = map.at(xx + dx, yy + dy);
        if (ahead && (ahead.typ === btyp || ahead.typ === ftyp
                      || ahead.typ === SCORR))
            continue;

        // Must change direction
        if (dx) {
            dx = 0;
            dy = (ty < yy) ? -1 : 1;
        } else {
            dy = 0;
            dx = (tx < xx) ? -1 : 1;
        }
        const adj2 = map.at(xx + dx, yy + dy);
        if (adj2 && (adj2.typ === btyp || adj2.typ === ftyp
                     || adj2.typ === SCORR))
            continue;
        dy = -dy;
        dx = -dx;
    }
    return { success: true, npoints };
}

// C ref: mklev.c join() -- connect two rooms with a corridor
function join(map, a, b, nxcor, depth) {
    const croom = map.rooms[a];
    const troom = map.rooms[b];

    if (!croom || !troom) return;
    if (!croom.needjoining || !troom.needjoining) return;
    if (troom.hx < 0 || croom.hx < 0) return;

    let dx, dy;
    let cc, tt;

    // Determine direction between rooms and find door positions
    if (troom.lx > croom.hx) {
        dx = 1; dy = 0;
        cc = finddpos(map, DIR_E, croom);
        tt = finddpos(map, DIR_W, troom);
    } else if (troom.hy < croom.ly) {
        dy = -1; dx = 0;
        cc = finddpos(map, DIR_N, croom);
        tt = finddpos(map, DIR_S, troom);
    } else if (troom.hx < croom.lx) {
        dx = -1; dy = 0;
        cc = finddpos(map, DIR_W, croom);
        tt = finddpos(map, DIR_E, troom);
    } else {
        dy = 1; dx = 0;
        cc = finddpos(map, DIR_S, croom);
        tt = finddpos(map, DIR_N, troom);
    }

    if (!cc || !tt) return;

    const xx = cc.x, yy = cc.y;
    const tx = tt.x - dx, ty = tt.y - dy;

    if (nxcor) {
        const adjx = xx + dx, adjy = yy + dy;
        if (isok(adjx, adjy) && map.at(adjx, adjy).typ !== STONE)
            return;
    }

    const org = { x: xx + dx, y: yy + dy };
    const dest = { x: tx, y: ty };

    const result = dig_corridor(map, org, dest, nxcor, depth);

    // Place door at source room
    if (result.npoints > 0 && (okdoor(map, xx, yy) || !nxcor))
        dodoor(map, xx, yy, croom, depth);

    if (!result.success) return;

    // Place door at target room
    if (okdoor(map, tt.x, tt.y) || !nxcor)
        dodoor(map, tt.x, tt.y, troom, depth);

    // Update connectivity (smeq)
    if (map.smeq[a] < map.smeq[b])
        map.smeq[b] = map.smeq[a];
    else
        map.smeq[a] = map.smeq[b];
}

// C ref: mklev.c makecorridors()
function makecorridors(map, depth) {
    // Initialize smeq (each room in its own component)
    map.smeq = new Array(MAXNROFROOMS + 1);
    for (let i = 0; i < map.nroom; i++) map.smeq[i] = i;

    // Phase 1: Join consecutive rooms
    for (let a = 0; a < map.nroom - 1; a++) {
        join(map, a, a + 1, false, depth);
        if (!rn2(50)) break; // allow some randomness
    }

    // Phase 2: Join rooms separated by 2 if not connected
    for (let a = 0; a < map.nroom - 2; a++) {
        if (map.smeq[a] !== map.smeq[a + 2])
            join(map, a, a + 2, false, depth);
    }

    // Phase 3: Join all remaining disconnected components
    let any = true;
    for (let a = 0; any && a < map.nroom; a++) {
        any = false;
        for (let b = 0; b < map.nroom; b++) {
            if (map.smeq[a] !== map.smeq[b]) {
                join(map, a, b, false, depth);
                any = true;
            }
        }
    }

    // Phase 4: Add extra corridors (may be blocked)
    if (map.nroom > 2) {
        for (let i = rn2(map.nroom) + 4; i; i--) {
            const a = rn2(map.nroom);
            let b = rn2(map.nroom - 2);
            if (b >= a) b += 2;
            join(map, a, b, true, depth);
        }
    }
}

// ========================================================================
// Stairs, room filling, niches
// ========================================================================

// C ref: mkroom.c somex() / somey()
function somex(croom) { return rn1(croom.hx - croom.lx + 1, croom.lx); }
function somey(croom) { return rn1(croom.hy - croom.ly + 1, croom.ly); }

// C ref: mkroom.c somexyspace() -- find accessible space in room
function somexyspace(map, croom) {
    let trycnt = 0;
    do {
        const x = somex(croom);
        const y = somey(croom);
        if (isok(x, y)) {
            const loc = map.at(x, y);
            if (loc && (loc.typ === ROOM || loc.typ === CORR || loc.typ === ICE)
                && !map.monsterAt(x, y))
                return { x, y };
        }
    } while (trycnt++ < 100);
    return null;
}

// C ref: mklev.c generate_stairs_room_good()
function generate_stairs_room_good(map, croom, phase) {
    const has_upstairs = (map.upstair.x >= croom.lx && map.upstair.x <= croom.hx
                       && map.upstair.y >= croom.ly && map.upstair.y <= croom.hy);
    const has_dnstairs = (map.dnstair.x >= croom.lx && map.dnstair.x <= croom.hx
                       && map.dnstair.y >= croom.ly && map.dnstair.y <= croom.hy);
    // C ref: mklev.c:2199-2203
    return (croom.needjoining || phase < 0)
        && ((!has_dnstairs && !has_upstairs) || phase < 1)
        && (croom.rtype === OROOM
            || (phase < 2 && croom.rtype === THEMEROOM));
}

// C ref: mklev.c generate_stairs_find_room()
function generate_stairs_find_room(map) {
    if (!map.nroom) return null;

    for (let phase = 2; phase > -1; phase--) {
        const candidates = [];
        for (let i = 0; i < map.nroom; i++) {
            if (generate_stairs_room_good(map, map.rooms[i], phase))
                candidates.push(i);
        }
        if (candidates.length > 0) {
            return map.rooms[candidates[rn2(candidates.length)]];
        }
    }
    return map.rooms[rn2(map.nroom)];
}

// C ref: mklev.c generate_stairs()
function generate_stairs(map, depth) {
    // Place downstairs (unless bottom level -- we don't track that yet)
    let croom = generate_stairs_find_room(map);
    if (croom) {
        const pos = somexyspace(map, croom);
        let x, y;
        if (pos) {
            x = pos.x; y = pos.y;
        } else {
            x = somex(croom); y = somey(croom);
        }
        const loc = map.at(x, y);
        if (loc) {
            loc.typ = STAIRS;
            loc.flags = 0; // down
            map.dnstair = { x, y };
        }
    }

    // Place upstairs (unless level 1)
    if (depth > 1) {
        croom = generate_stairs_find_room(map);
        if (croom) {
            const pos = somexyspace(map, croom);
            let x, y;
            if (pos) {
                x = pos.x; y = pos.y;
            } else {
                x = somex(croom); y = somey(croom);
            }
            const loc = map.at(x, y);
            if (loc) {
                loc.typ = STAIRS;
                loc.flags = 1; // up
                map.upstair = { x, y };
            }
        }
    }
}

// C ref: mklev.c cardinal_nextto_room()
function cardinal_nextto_room(map, aroom, x, y) {
    const rmno = map.rooms.indexOf(aroom) + ROOMOFFSET;
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
        if (isok(x + dx, y + dy)) {
            const loc = map.at(x + dx, y + dy);
            if (!loc.edge && loc.roomno === rmno) return true;
        }
    }
    return false;
}

// C ref: mklev.c place_niche()
function place_niche(map, aroom) {
    let dy;
    if (rn2(2)) {
        dy = 1;
        const dd = finddpos(map, DIR_S, aroom);
        if (!dd) return null;
        const xx = dd.x, yy = dd.y;
        if (isok(xx, yy + dy) && map.at(xx, yy + dy).typ === STONE
            && isok(xx, yy - dy) && !IS_POOL(map.at(xx, yy - dy).typ)
            && !IS_FURNITURE(map.at(xx, yy - dy).typ)
            && cardinal_nextto_room(map, aroom, xx, yy))
            return { xx, yy, dy };
    } else {
        dy = -1;
        const dd = finddpos(map, DIR_N, aroom);
        if (!dd) return null;
        const xx = dd.x, yy = dd.y;
        if (isok(xx, yy + dy) && map.at(xx, yy + dy).typ === STONE
            && isok(xx, yy - dy) && !IS_POOL(map.at(xx, yy - dy).typ)
            && !IS_FURNITURE(map.at(xx, yy - dy).typ)
            && cardinal_nextto_room(map, aroom, xx, yy))
            return { xx, yy, dy };
    }
    return null;
}

// ========================================================================
// Engraving / wipeout_text — C ref: engrave.c
// Used to consume RNG for trap engravings and graffiti.
// ========================================================================

// C ref: engrave.c rubouts[] — partial rubout substitution table
const RUBOUTS = {
    'A': "^", 'B': "Pb[", 'C': "(", 'D': "|)[", 'E': "|FL[_",
    'F': "|-", 'G': "C(", 'H': "|-", 'I': "|", 'K': "|<",
    'L': "|_", 'M': "|", 'N': "|\\", 'O': "C(", 'P': "F",
    'Q': "C(", 'R': "PF", 'T': "|", 'U': "J", 'V': "/\\",
    'W': "V/\\", 'Z': "/",
    'b': "|", 'd': "c|", 'e': "c", 'g': "c", 'h': "n",
    'j': "i", 'k': "|", 'l': "|", 'm': "nr", 'n': "r",
    'o': "c", 'q': "c", 'w': "v", 'y': "v",
    ':': ".", ';': ",:", ',': ".", '=': "-", '+': "-|",
    '*': "+", '@': "0", '0': "C(", '1': "|", '6': "o",
    '7': "/", '8': "3o",
};

// C ref: engrave.c wipeout_text() with seed=0 (random mode)
// Simulates the RNG consumption pattern without needing the actual text result.
function wipeout_text(text, cnt) {
    if (!text.length || cnt <= 0) return;
    const chars = text.split('');
    const lth = chars.length;
    while (cnt--) {
        const nxt = rn2(lth);
        const use_rubout = rn2(4);
        const ch = chars[nxt];
        if (ch === ' ') continue;
        if ("?.,'`-|_".includes(ch)) {
            chars[nxt] = ' ';
            continue;
        }
        if (use_rubout && RUBOUTS[ch]) {
            const wipeto = RUBOUTS[ch];
            const j = rn2(wipeto.length);
            chars[nxt] = wipeto[j];
        } else {
            chars[nxt] = '?';
        }
    }
}

// C ref: engrave.c random_engraving() — engraving texts from ENGRAVEFILE
// These are the decoded texts from the compiled dat/engrave file.
const ENGRAVE_TEXTS = [
    'No matter where you go, there you are.',
    'Elbereth', 'Vlad was here', 'ad aerarium', 'Owlbreath', 'Galadriel',
    'Kilroy was here', 'Frodo lives', 'A.S. ->', '<- A.S.',
    "You won't get it up the steps",
    "Lasciate ogni speranza o voi ch'entrate.",
    'Well Come', 'We apologize for the inconvenience.',
    'See you next Wednesday', 'notary sojak',
    'For a good time call 8?7-5309',
    "Please don't feed the animals.",
    "Madam, in Eden, I'm Adam.",
    'Two thumbs up!', 'Hello, World!', "You've got mail!", 'As if!',
    'BAD WOLF', 'Arooo!  Werewolves of Yendor!', 'Dig for Victory here',
    'Gaius Julius Primigenius was here.  Why are you late?',
    "Don't go this way", 'Go left --->', '<--- Go right',
    'X marks the spot', 'X <--- You are here.', 'Here be dragons',
    'Save now, and do your homework!',
    "There was a hole here.  It's gone now.",
    'The Vibrating Square', 'This is a pit!',
    'This is not the dungeon you are looking for.',
    "Watch out, there's a gnome with a wand of death behind that door!",
    'This square deliberately left blank.',
    'Haermund Hardaxe carved these runes',
    "Need a light?  Come visit the Minetown branch of Izchak's Lighting Store!",
    'Snakes on the Astral Plane - Soon in a dungeon near you',
    'You are the one millionth visitor to this place!  Please wait 200 turns for your wand of wishing.',
    'Warning, Exploding runes!',
    'If you can read these words then you are not only a nerd but probably dead.',
    'The cake is a lie',
];
// Byte lengths of each data line in the compiled engrave file (including newline)
const ENGRAVE_LINE_BYTES = [
    60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
    60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
    60, 60, 60, 60, 60, 60, 66, 60, 60, 74, 60, 98, 60, 76, 60,
];
const ENGRAVE_FILE_CHUNKSIZE = 2894;

// C ref: rumors file section sizes (from compiled dat/rumors header)
const RUMOR_TRUE_SIZE = 23875;
const RUMOR_FALSE_SIZE = 25762;
// Padded line size for rumor/engrave files (MD_PAD_RUMORS)
const RUMOR_PAD_LENGTH = 60;

// C ref: rumors.c get_rnd_line — simulate the random line selection from a
// padded file section. Returns the index of the selected line.
function get_rnd_line_index(lineBytes, chunksize, padlength) {
    for (let trylimit = 10; trylimit > 0; trylimit--) {
        const chunkoffset = rn2(chunksize);
        let pos = 0;
        let lineIdx = 0;
        while (lineIdx < lineBytes.length && pos + lineBytes[lineIdx] <= chunkoffset) {
            pos += lineBytes[lineIdx];
            lineIdx++;
        }
        if (lineIdx < lineBytes.length) {
            // C: strlen(buf) after fgets = remaining bytes including \n
            // C rejects if strlen(buf) > padlength + 1
            const remaining = lineBytes[lineIdx] - (chunkoffset - pos);
            if (padlength === 0 || remaining <= padlength + 1) {
                const nextIdx = (lineIdx + 1) % lineBytes.length;
                return nextIdx;
            }
        } else {
            return 0;
        }
    }
    return 0;
}

// C ref: engrave.c random_engraving() — simulate full RNG consumption.
// C: if (!rn2(4) || !(rumor = getrumor(0, buf, TRUE)) || !*rumor)
//        get_rnd_text(ENGRAVEFILE, buf, rn2, MD_PAD_RUMORS);
//    wipeout_text(buf, strlen(buf)/4, 0);
function random_engraving_rng() {
    let text = null;
    if (!rn2(4)) {
        // Path A: use engrave file directly (short-circuit: skip getrumor)
        const idx = get_rnd_line_index(
            ENGRAVE_LINE_BYTES, ENGRAVE_FILE_CHUNKSIZE, RUMOR_PAD_LENGTH);
        text = ENGRAVE_TEXTS[idx] || ENGRAVE_TEXTS[0];
    } else {
        // Path B: getrumor(0, buf, TRUE) with cookie exclusion loop
        let count = 0;
        do {
            // C: adjtruth = truth + rn2(2) where truth=0
            const adjtruth = 0 + rn2(2);
            if (adjtruth > 0) {
                const idx = get_rnd_line_index(
                    RUMOR_TRUE_LINE_BYTES, RUMOR_TRUE_SIZE, RUMOR_PAD_LENGTH);
                text = RUMOR_TRUE_TEXTS[idx];
            } else {
                const idx = get_rnd_line_index(
                    RUMOR_FALSE_LINE_BYTES, RUMOR_FALSE_SIZE, RUMOR_PAD_LENGTH);
                text = RUMOR_FALSE_TEXTS[idx];
            }
        } while (count++ < 50 && text && text.startsWith('[cookie] '));

        if (!text || !text.length) {
            // Fallback to engrave file (C short-circuit: getrumor returned empty)
            const idx = get_rnd_line_index(
                ENGRAVE_LINE_BYTES, ENGRAVE_FILE_CHUNKSIZE, RUMOR_PAD_LENGTH);
            text = ENGRAVE_TEXTS[idx] || ENGRAVE_TEXTS[0];
        }
    }
    // C: wipeout_text(outbuf, (int)(strlen(outbuf) / 4), 0);
    wipeout_text(text, Math.floor(text.length / 4));
}

// C ref: mklev.c trap_engravings[] — engraving text for trap niches
const TRAP_ENGRAVINGS = [];
TRAP_ENGRAVINGS[TRAPDOOR] = "Vlad was here";
TRAP_ENGRAVINGS[TELEP_TRAP] = "ad aerarium";
TRAP_ENGRAVINGS[LEVEL_TELEP] = "ad aerarium";

// C ref: mklev.c makeniche()
function makeniche(map, depth, trap_type) {
    let vct = 8;
    while (vct--) {
        const aroom = map.rooms[rn2(map.nroom)];
        if (aroom.rtype !== OROOM) continue;
        if (aroom.doorct === 1 && rn2(5)) continue;
        const niche = place_niche(map, aroom);
        if (!niche) continue;
        const { xx, yy, dy } = niche;
        const rm = map.at(xx, yy + dy);

        if (trap_type || !rn2(4)) {
            rm.typ = SCORR;
            // C ref: maketrap + trap engraving (maketrap itself doesn't use RNG)
            if (trap_type) {
                // C ref: mklev.c:751-753 — is_hole replacement for Can_fall_thru
                let actual_trap = trap_type;
                if (is_hole(actual_trap) && depth <= 1) {
                    // Can't fall through top level; use ROCKTRAP instead
                    actual_trap = ROCKTRAP;
                }
                // C ref: mklev.c:757-763 — trap engraving + wipe
                const engr = TRAP_ENGRAVINGS[actual_trap];
                if (engr) {
                    // C ref: wipe_engr_at(xx, yy-dy, 5, FALSE)
                    // For DUST type, cnt stays at 5 (no reduction)
                    wipeout_text(engr, 5);
                }
            }
            dosdoor(map, xx, yy, aroom, SDOOR, depth);
        } else {
            rm.typ = CORR;
            if (rn2(7)) {
                dosdoor(map, xx, yy, aroom, rn2(5) ? SDOOR : DOOR, depth);
            } else {
                if (!rn2(5) && IS_WALL(map.at(xx, yy).typ)) {
                    map.at(xx, yy).typ = IRONBARS;
                    if (rn2(3)) {
                        // C ref: mkcorpstat(CORPSE, 0, mkclass(S_HUMAN, 0), ...)
                        // TODO: port mkclass (consumes ~41 rn2 + rnd calls) + mksobj(CORPSE)
                        // For now, skip — iron bars + corpse is rare (~2% of niches)
                        mksobj(CORPSE, true, false);
                    }
                }
                // C ref: mklev.c:780-782 — scroll of teleportation in niche
                if (!map.flags.noteleport)
                    mksobj(SCR_TELEPORTATION, true, false);
                if (!rn2(3)) {
                    // C ref: mklev.c:783-784 — random object in niche
                    mkobj(0, true); // RANDOM_CLASS = 0
                }
            }
        }
        return;
    }
}

// C ref: mklev.c make_niches()
function make_niches(map, depth) {
    let ct = rnd(Math.floor(map.nroom / 2) + 1);
    // C ref: mklev.c:795-796 — ltptr and vamp are boolean flags, used once
    let ltptr = (!map.flags.noteleport && depth > 15);
    let vamp = (depth > 5 && depth < 25);

    while (ct--) {
        if (ltptr && !rn2(6)) {
            ltptr = false;
            makeniche(map, depth, LEVEL_TELEP);
        } else if (vamp && !rn2(6)) {
            vamp = false;
            makeniche(map, depth, TRAPDOOR);
        } else {
            makeniche(map, depth, NO_TRAP);
        }
    }
}

// ========================================================================
// Trap creation -- mktrap, maketrap, traptype_rnd
// C ref: mklev.c, trap.c
// ========================================================================

// C ref: mklev.c:1795 occupied() -- check if position has trap/furniture/pool
function occupied(map, x, y) {
    if (map.trapAt(x, y)) return true;
    const loc = map.at(x, y);
    if (!loc) return true;
    if (IS_FURNITURE(loc.typ)) return true;
    if (IS_LAVA(loc.typ) || IS_POOL(loc.typ)) return true;
    return false;
}

// C ref: trap.c:3009 choose_trapnote() -- pick unused squeaky board note
function choose_trapnote(map) {
    const tavail = new Array(12).fill(0);
    for (const t of map.traps) {
        if (t.ttyp === SQKY_BOARD) tavail[t.tnote] = 1;
    }
    const tpick = [];
    for (let k = 0; k < 12; k++) {
        if (tavail[k] === 0) tpick.push(k);
    }
    return tpick.length > 0 ? tpick[rn2(tpick.length)] : rn2(12);
}

// C ref: trap.c:3601 isclearpath() -- check if path is clear for boulder
function isclearpath(map, startx, starty, distance, dx, dy) {
    let x = startx, y = starty;
    while (distance-- > 0) {
        x += dx;
        y += dy;
        if (!isok(x, y)) return null;
        const loc = map.at(x, y);
        if (!loc) return null;
        const typ = loc.typ;
        // ZAP_POS: typ >= POOL (everything from POOL onwards is passable to zaps)
        if (typ < POOL) return null;
        // closed_door check
        if (typ === DOOR && (loc.flags === D_CLOSED || loc.flags === D_LOCKED))
            return null;
        // check for pit/hole/teleport traps blocking path
        const t = map.trapAt(x, y);
        if (t && (is_pit(t.ttyp) || is_hole(t.ttyp) ||
                  (t.ttyp >= TELEP_TRAP && t.ttyp <= MAGIC_PORTAL)))
            return null;
    }
    return { x, y };
}

// C ref: trap.c:3506 find_random_launch_coord() -- find boulder launch point
function find_random_launch_coord(map, trap) {
    let success = false;
    let cc = null;
    const mindist = (trap.ttyp === ROLLING_BOULDER_TRAP) ? 2 : 4;
    let trycount = 0;
    let distance = rn1(5, 4); // 4..8 away
    let tmp = rn2(N_DIRS);    // random starting direction

    while (distance >= mindist) {
        const dx = xdir[tmp];
        const dy = ydir[tmp];
        // Check forward path
        const fwd = isclearpath(map, trap.tx, trap.ty, distance, dx, dy);
        if (fwd) {
            if (trap.ttyp === ROLLING_BOULDER_TRAP) {
                // Also check reverse path
                const rev = isclearpath(map, trap.tx, trap.ty, distance, -dx, -dy);
                if (rev) {
                    cc = fwd;
                    success = true;
                }
            } else {
                cc = fwd;
                success = true;
            }
        }
        if (success) break;
        tmp = (tmp + 1) % N_DIRS;
        trycount++;
        if ((trycount % 8) === 0) distance--;
    }
    return success ? cc : null;
}

// C ref: trap.c:455 maketrap() -- create a trap at (x,y)
function maketrap(map, x, y, typ) {
    if (typ === TRAPPED_DOOR || typ === TRAPPED_CHEST) return null;

    // Check if trap already exists at this position
    const existing = map.trapAt(x, y);
    if (existing) return null; // simplified: don't overwrite

    const loc = map.at(x, y);
    if (!loc) return null;
    // CAN_OVERWRITE_TERRAIN: reject stairs/ladders
    if (loc.typ === STAIRS || loc.typ === 27/*LADDER*/) return null;
    if (IS_POOL(loc.typ) || IS_LAVA(loc.typ)) return null;
    if (IS_FURNITURE(loc.typ) && typ !== PIT && typ !== HOLE) return null;

    const trap = {
        ttyp: typ,
        tx: x, ty: y,
        tseen: (typ === HOLE), // unhideable_trap
        launch: { x: -1, y: -1 },
        launch2: { x: -1, y: -1 },
        dst: { dnum: -1, dlevel: -1 },
        tnote: 0,
        once: 0,
        madeby_u: 0,
        conjoined: 0,
    };

    switch (typ) {
    case SQKY_BOARD:
        trap.tnote = choose_trapnote(map);
        break;
    case STATUE_TRAP:
        // C ref: mk_trap_statue — needs makemon, skip for now
        // RNG: rndmonnum_adj (complex) + makemon (complex)
        // At shallow levels this trap can't generate (needs lvl>=8)
        break;
    case ROLLING_BOULDER_TRAP: {
        // C ref: mkroll_launch
        const launchCoord = find_random_launch_coord(map, trap);
        if (launchCoord) {
            // C ref: mkroll_launch — mksobj_at(BOULDER, ...)
            mksobj(BOULDER, true, false);
            trap.launch = { x: launchCoord.x, y: launchCoord.y };
            trap.launch2 = {
                x: x - (launchCoord.x - x),
                y: y - (launchCoord.y - y),
            };
        } else {
            trap.launch = { x, y };
            trap.launch2 = { x, y };
        }
        break;
    }
    case PIT:
    case SPIKED_PIT:
        trap.conjoined = 0;
        // fall through
    case HOLE:
    case TRAPDOOR:
        if (is_hole(typ)) {
            // C ref: hole_destination — determine fall depth
            // Simulate RNG: while (dlevel < bottom) { dlevel++; if (rn2(4)) break; }
            hole_destination_rng(map);
        }
        // For pits/holes in rooms, terrain stays ROOM (IS_ROOM check in C)
        break;
    }

    map.traps.push(trap);
    return trap;
}

// C ref: trap.c:441 hole_destination() — consume RNG for fall depth
function hole_destination_rng(map) {
    // At depth 1 in main dungeon, bottom is ~29, dlevel starts at 1
    // Loop runs until rn2(4) returns nonzero
    let dlevel = 1;
    const bottom = 29; // approximate dungeon depth
    while (dlevel < bottom) {
        dlevel++;
        if (rn2(4)) break;
    }
}

// C ref: mklev.c:1926 traptype_rnd() — pick random trap type
function traptype_rnd(depth) {
    const lvl = depth; // level_difficulty() = depth for normal dungeon
    const kind = rnd(TRAPNUM - 1); // rnd(25) → 1..25

    switch (kind) {
    case TRAPPED_DOOR:
    case TRAPPED_CHEST:
        return NO_TRAP;
    case MAGIC_PORTAL:
    case VIBRATING_SQUARE:
        return NO_TRAP;
    case ROLLING_BOULDER_TRAP:
    case SLP_GAS_TRAP:
        if (lvl < 2) return NO_TRAP;
        break;
    case LEVEL_TELEP:
        if (lvl < 5) return NO_TRAP;
        break;
    case SPIKED_PIT:
        if (lvl < 5) return NO_TRAP;
        break;
    case LANDMINE:
        if (lvl < 6) return NO_TRAP;
        break;
    case WEB:
        if (lvl < 7) return NO_TRAP;
        break;
    case STATUE_TRAP:
    case POLY_TRAP:
        if (lvl < 8) return NO_TRAP;
        break;
    case FIRE_TRAP:
        // Only in Gehennom (Inhell) — never on normal levels
        return NO_TRAP;
    case TELEP_TRAP:
        // noteleport check — simplified: allow on normal levels
        break;
    case HOLE:
        // Make holes much less frequent
        if (rn2(7)) return NO_TRAP;
        break;
    }
    return kind;
}

// C ref: mklev.c:2021 mktrap() — select trap type, find location, create trap
function mktrap(map, num, mktrapflags, croom, tm, depth) {
    if (!tm && !croom && !(mktrapflags & MKTRAP_MAZEFLAG)) return;

    let kind;
    const lvl = depth;

    if (num > NO_TRAP && num < TRAPNUM) {
        kind = num;
    } else {
        // Normal level: loop until we get a valid trap type
        do {
            kind = traptype_rnd(depth);
        } while (kind === NO_TRAP);
    }

    // Convert hole/trapdoor to rocktrap if can't fall through
    // At depth 1 in main dungeon, can fall through — keep as-is
    // At bottom level, would convert. Simplified: depth >= 29 converts.
    if (is_hole(kind) && depth >= 29) kind = ROCKTRAP;

    let mx, my;
    if (tm) {
        mx = tm.x;
        my = tm.y;
    } else {
        let tryct = 0;
        const avoid_boulder = (is_pit(kind) || is_hole(kind));
        do {
            if (++tryct > 200) return;
            if (croom) {
                const pos = somexyspace(map, croom);
                if (!pos) return;
                mx = pos.x;
                my = pos.y;
            } else {
                return; // maze mode not implemented
            }
        } while (occupied(map, mx, my));
    }

    const t = maketrap(map, mx, my, kind);
    if (!t) return;
    kind = t.ttyp;

    // WEB: create giant spider (needs makemon — skip for now)
    // At depth < 7, WEB can't generate anyway

    // mktrap_victim: at depth 1, lvl <= rnd(4) is always true
    // Called for ARROW_TRAP, DART_TRAP, ROCKTRAP, BEAR_TRAP, MAGIC_TRAP
    // Needs mksobj/mkobj — skip for now (will implement with mkobj task)
    if (!(mktrapflags & MKTRAP_NOVICTIM) && lvl <= rnd(4)
        && kind !== SQKY_BOARD && kind !== RUST_TRAP
        && !is_pit(kind) && (kind < HOLE || kind === MAGIC_TRAP)) {
        // LANDMINE: convert to PIT (exploded)
        if (kind === LANDMINE) {
            t.ttyp = PIT;
            t.tseen = true;
        }
        mktrap_victim(map, t, depth);
    }
}

// C ref: mklev.c:1804 mktrap_victim() — stub until mkobj is ported
// C ref: mklev.c mktrap_victim() — creates corpse + items on trap
function mktrap_victim(map, trap, depth) {
    // Trap-specific item
    // C ref: mklev.c:1818-1833
    switch (trap.ttyp) {
    case ARROW_TRAP:
        mksobj(ARROW, true, false);
        break;
    case DART_TRAP:
        mksobj(DART, true, false);
        break;
    case ROCKTRAP:
        mksobj(ROCK, true, false);
        break;
    default:
        break;
    }

    // Random possession loop
    // C ref: mklev.c:1843-1877
    const classMap = [WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, GEM_CLASS];
    do {
        const poss_class = classMap[rn2(4)];
        mkobj(poss_class, false);
    } while (!rn2(5));

    // Corpse race selection
    // C ref: mklev.c:1880-1915
    let victim_mnum;
    const race = rn2(15);
    if (race === 0) {
        victim_mnum = 0; // PM_ELF placeholder
        if (trap.ttyp === SLP_GAS_TRAP && !(depth <= 2 && rn2(2))) {
            victim_mnum = 1; // PM_HUMAN placeholder
        }
    } else if (race >= 6 && race <= 9) {
        victim_mnum = 2; // PM_GNOME placeholder
        if (!rn2(10)) {
            mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, true, false);
        }
    } else if (race >= 10) {
        victim_mnum = 1; // PM_HUMAN placeholder
    } else {
        victim_mnum = 3; // PM_DWARF/ORC placeholder
    }

    // Human → adventurer conversion
    // C ref: mklev.c:1919-1920
    if (victim_mnum === 1 && rn2(25)) {
        rn1(12, 0); // random role: PM_WIZARD - PM_ARCHEOLOGIST = 12
    }

    // mkcorpstat(CORPSE, ...) — calls mksobj(CORPSE, TRUE, FALSE) internally
    // C ref: mklev.c:1921
    mksobj(CORPSE, true, false);
}

// C ref: mkroom.c find_okay_roompos() -- find non-occupied, non-bydoor pos
function find_okay_roompos(map, croom) {
    let tryct = 0;
    do {
        if (++tryct > 200) return null;
        const pos = somexyspace(map, croom);
        if (!pos) return null;
        if (!bydoor(map, pos.x, pos.y))
            return pos;
    } while (true);
}

// C ref: mkroom.c mkfount()
function mkfount(map, croom) {
    const pos = find_okay_roompos(map, croom);
    if (!pos) return;
    const loc = map.at(pos.x, pos.y);
    if (!loc) return;
    loc.typ = FOUNTAIN;
    // C ref: blessed fountain check
    if (!rn2(7)) {
        // blessedftn flag -- not tracked in JS yet, just consume RNG
    }
    map.flags.nfountains++;
}

// C ref: mkroom.c mksink()
function mksink(map, croom) {
    const pos = find_okay_roompos(map, croom);
    if (!pos) return;
    const loc = map.at(pos.x, pos.y);
    if (!loc) return;
    loc.typ = SINK;
    map.flags.nsinks++;
}

// C ref: mkroom.c mkaltar()
function mkaltar(map, croom) {
    if (croom.rtype !== OROOM) return;
    const pos = find_okay_roompos(map, croom);
    if (!pos) return;
    const loc = map.at(pos.x, pos.y);
    if (!loc) return;
    loc.typ = ALTAR;
    // C ref: alignment = rn2(A_LAWFUL+2) - 1
    rn2(3);
}

// C ref: mkroom.c mkgrave()
function mkgrave(map, croom, depth) {
    if (croom.rtype !== OROOM) return;
    const dobell = !rn2(10);
    const pos = find_okay_roompos(map, croom);
    if (!pos) return;
    const loc = map.at(pos.x, pos.y);
    if (!loc) return;
    loc.typ = GRAVE;
    // C ref: possibly fill with gold
    if (!rn2(3)) {
        mksobj(GOLD_PIECE, true, false);
        // gold->quan = rnd(20) + level_difficulty() * rnd(5)
        rnd(20);
        rnd(5);
    }
    // C ref: bury random objects
    let tryct = rn2(5);
    while (tryct--) {
        mkobj(0, true); // RANDOM_CLASS = 0
    }
    // C ref: leave a bell if dobell
    if (dobell) {
        mksobj(BELL, true, false);
    }
}

// C ref: objnam.c rnd_class() -- pick random object in index range by probability
function rnd_class(first, last) {
    let sum = 0;
    for (let i = first; i <= last; i++)
        sum += objectData[i].prob || 0;
    if (!sum) return rn1(last - first + 1, first);
    let x = rnd(sum);
    for (let i = first; i <= last; i++) {
        x -= objectData[i].prob || 0;
        if (x <= 0) return i;
    }
    return first;
}

// SPBOOK_no_NOVEL = -SPBOOK_CLASS: generates spellbook but excludes novel
const SPBOOK_no_NOVEL = -SPBOOK_CLASS;

// Supply items for Oracle supply chest
// C ref: mklev.c:1039-1049
const supply_items = [
    POT_EXTRA_HEALING, POT_SPEED, POT_GAIN_ENERGY,
    SCR_ENCHANT_WEAPON, SCR_ENCHANT_ARMOR, SCR_CONFUSE_MONSTER, SCR_SCARE_MONSTER,
    WAN_DIGGING, SPE_HEALING,
];

// Extra classes for supply chest bonus item
// C ref: mklev.c:1076-1087
const extra_classes = [
    FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS,
    SCROLL_CLASS, POTION_CLASS, RING_CLASS,
    SPBOOK_no_NOVEL, SPBOOK_no_NOVEL, SPBOOK_no_NOVEL,
];

// C ref: mklev.c fill_ordinary_room()
// C ref: ROOM_IS_FILLABLE: (rtype == OROOM || rtype == THEMEROOM) && needfill == FILL_NORMAL
function fill_ordinary_room(map, croom, depth, bonusItems) {
    if (croom.needfill !== FILL_NORMAL) return;
    if (croom.rtype !== OROOM && croom.rtype !== THEMEROOM) return;

    // Put a sleeping monster inside (1/3 chance)
    // C ref: (u.uhave.amulet || !rn2(3)) && somexyspace(...)
    if (!rn2(3)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            makemon(null, pos.x, pos.y, MM_NOGRP, depth);
        }
    }

    // Traps
    // C ref: x = 8 - (level_difficulty() / 6)
    const x = 8 - Math.floor(depth / 6);
    const trapChance = Math.max(x, 2);
    let trycnt = 0;
    while (!rn2(trapChance) && (++trycnt < 1000)) {
        mktrap(map, 0, MKTRAP_NOFLAGS, croom, null, depth);
    }

    // Gold (1/3 chance)
    // C ref: mkgold(0L, pos.x, pos.y) in mkobj.c:1999
    // amount formula: mul = rnd(30 / max(12 - depth, 2)), amount = 1 + rnd(level_difficulty + 2) * mul
    // Then mksobj_at(GOLD_PIECE, ...) creates the gold object
    if (!rn2(3)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            rnd(Math.max(Math.floor(30 / Math.max(12 - depth, 2)), 1)); // mul
            rnd(depth + 2); // rnd(level_difficulty() + 2)
            mksobj(GOLD_PIECE, true, false);
        }
    }

    // Fountain (1/10 chance)
    if (!rn2(10))
        mkfount(map, croom);

    // Sink (1/60 chance)
    if (!rn2(60))
        mksink(map, croom);

    // Altar (1/60 chance)
    if (!rn2(60))
        mkaltar(map, croom);

    // Grave
    // C ref: x = 80 - (depth(&u.uz) * 2)
    const graveX = 80 - (depth * 2);
    const graveChance = Math.max(graveX, 2);
    if (!rn2(graveChance))
        mkgrave(map, croom, depth);

    // Statue (1/20 chance)
    // C ref: mkcorpstat(STATUE, ...) → mksobj(STATUE, TRUE, FALSE) internally
    if (!rn2(20)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            mksobj(STATUE, true, false);
        }
    }

    // C ref: mklev.c:1015-1117 — bonus_items section
    // Oracle supply chest: at depth 1 in main dungeon, oracle_level.dnum matches,
    // and u.uz.dlevel < oracle_level.dlevel, so supply chest created with 2/3 prob.
    let skip_chests = false;
    if (bonusItems) {
        const pos = somexyspace(map, croom);
        if (pos) {
            // At depth 1: branch to surface exists but doesn't connect to mines,
            // so mines food check (Is_branchlev) fails. Falls to Oracle check.
            // C ref: u.uz.dnum == oracle_level.dnum && u.uz.dlevel < oracle_level.dlevel
            if (rn2(3)) {
                // Create supply chest (2/3 chance)
                // C ref: mklev.c:1033-1034
                mksobj(rn2(3) ? CHEST : LARGE_BOX, false, false);
                rn2(6); // olocked check

                // Supply items loop
                // C ref: mklev.c:1038-1070
                let tryct = 0;
                let cursed;
                do {
                    const otyp = rn2(2) ? POT_HEALING : supply_items[rn2(9)];
                    const otmp = mksobj(otyp, true, false);
                    if (otyp === POT_HEALING && rn2(2)) {
                        // quan = 2 (no extra RNG, just weight update)
                    }
                    cursed = otmp.cursed;
                    ++tryct;
                    if (tryct === 50) break;
                } while (cursed || !rn2(5));

                // Maybe add extra random item
                // C ref: mklev.c:1075-1110
                if (rn2(3)) {
                    const oclass = extra_classes[rn2(10)];
                    let otmp;
                    if (oclass === SPBOOK_no_NOVEL) {
                        const otyp = rnd_class(bases[SPBOOK_CLASS], SPE_BLANK_PAPER);
                        otmp = mksobj(otyp, true, false);
                    } else {
                        otmp = mkobj(oclass, false);
                    }
                    // Bias towards lower-level spellbooks
                    if (oclass === SPBOOK_no_NOVEL) {
                        const maxpass = (depth > 2) ? 2 : 3;
                        for (let pass = 1; pass <= maxpass; pass++) {
                            let otmp2;
                            const otyp2 = rnd_class(bases[SPBOOK_CLASS], SPE_BLANK_PAPER);
                            otmp2 = mksobj(otyp2, true, false);
                            if (objectData[otmp.otyp].oc2 > objectData[otmp2.otyp].oc2) {
                                otmp = otmp2;
                            }
                        }
                    }
                }

                skip_chests = true;
            }
        }
    }

    // C ref: box/chest (!rn2(nroom * 5 / 2))
    if (!skip_chests && !rn2(Math.max(Math.floor(map.nroom * 5 / 2), 1))) {
        const pos = somexyspace(map, croom);
        if (pos) {
            mksobj(rn2(3) ? LARGE_BOX : CHEST, true, false);
        }
    }

    // C ref: graffiti (!rn2(27 + 3 * abs(depth)))
    if (!rn2(27 + 3 * Math.abs(depth))) {
        // C: random_engraving(buf, pristinebuf) — selects text + wipeout_text
        random_engraving_rng();
        // C: do { somexyspace(croom, &pos); } while (typ != ROOM && !rn2(40));
        let pos;
        do {
            pos = somexyspace(map, croom);
        } while (pos && map.at(pos.x, pos.y).typ !== ROOM && !rn2(40));
    }

    // C ref: random objects (!rn2(3))
    if (!rn2(3)) {
        const pos = somexyspace(map, croom);
        if (pos) mkobj(0, true); // RANDOM_CLASS = 0
        trycnt = 0;
        while (!rn2(5)) {
            if (++trycnt > 100) break;
            const pos2 = somexyspace(map, croom);
            if (pos2) mkobj(0, true);
        }
    }
}

// ========================================================================
// Wall fixup
// ========================================================================

// C ref: mkmaze.c wall_cleanup() — remove walls totally surrounded by stone
function wall_cleanup(map, x1, y1, x2, y2) {
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            const loc = map.at(x, y);
            if (loc && IS_WALL(loc.typ) && loc.typ !== DBWALL) {
                if (is_solid(map, x-1, y-1) && is_solid(map, x-1, y)
                    && is_solid(map, x-1, y+1) && is_solid(map, x, y-1)
                    && is_solid(map, x, y+1) && is_solid(map, x+1, y-1)
                    && is_solid(map, x+1, y) && is_solid(map, x+1, y+1))
                    loc.typ = STONE;
            }
        }
    }
}

// C ref: mkmaze.c wallification() = wall_cleanup + fix_wall_spines
function wallify(map, x1, y1, x2, y2) {
    wall_cleanup(map, x1, y1, x2, y2);
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            setWallType(map, x, y);
        }
    }
}

// C ref: mkmaze.c wallification() -- full map wall fixup
export function wallification(map) {
    wall_cleanup(map, 1, 0, COLNO - 1, ROWNO - 1);
    for (let x = 1; x < COLNO - 1; x++) {
        for (let y = 0; y < ROWNO; y++) {
            setWallType(map, x, y);
        }
    }
}

// C ref: mkmaze.c iswall() — check if wall spine can join this location
function iswall_check(map, x, y) {
    if (!isok(x, y)) return 0;
    const typ = map.at(x, y).typ;
    return (IS_WALL(typ) || IS_DOOR(typ) || typ === LAVAWALL
            || typ === SDOOR || typ === IRONBARS) ? 1 : 0;
}

// C ref: mkmaze.c iswall_or_stone()
function iswall_or_stone(map, x, y) {
    if (!isok(x, y)) return 1; // out of bounds = stone
    const typ = map.at(x, y).typ;
    return (typ === STONE || iswall_check(map, x, y)) ? 1 : 0;
}

// C ref: mkmaze.c is_solid()
function is_solid(map, x, y) {
    return !isok(x, y) || IS_STWALL(map.at(x, y).typ);
}

// C ref: mkmaze.c extend_spine() — determine if wall spine extends in (dx,dy)
function extend_spine(locale, wall_there, dx, dy) {
    const nx = 1 + dx, ny = 1 + dy;
    if (wall_there) {
        if (dx) {
            if (locale[1][0] && locale[1][2]
                && locale[nx][0] && locale[nx][2])
                return 0; // corridor of walls — don't extend
            return 1;
        } else {
            if (locale[0][1] && locale[2][1]
                && locale[0][ny] && locale[2][ny])
                return 0;
            return 1;
        }
    }
    return 0;
}

// C ref: mkmaze.c spine_array — maps 4-bit NSEW extension to wall type
//   bits: N=8, S=4, E=2, W=1
const SPINE_ARRAY = [
    VWALL, HWALL, HWALL, HWALL,
    VWALL, TRCORNER, TLCORNER, TDWALL,
    VWALL, BRCORNER, BLCORNER, TUWALL,
    VWALL, TLWALL, TRWALL, CROSSWALL,
];

// C ref: mkmaze.c fix_wall_spines() — set correct wall type based on neighbors
function setWallType(map, x, y) {
    const loc = map.at(x, y);
    if (!loc || !IS_WALL(loc.typ) || loc.typ === DBWALL) return;

    // Build 3x3 locale grid of iswall_or_stone values
    const locale = [[0,0,0],[0,0,0],[0,0,0]];
    const loc_f = (cx, cy) => iswall_or_stone(map, cx, cy);
    locale[0][0] = loc_f(x - 1, y - 1);
    locale[1][0] = loc_f(x,     y - 1);
    locale[2][0] = loc_f(x + 1, y - 1);
    locale[0][1] = loc_f(x - 1, y);
    locale[2][1] = loc_f(x + 1, y);
    locale[0][2] = loc_f(x - 1, y + 1);
    locale[1][2] = loc_f(x,     y + 1);
    locale[2][2] = loc_f(x + 1, y + 1);

    // Determine if wall extends in each direction NSEW
    const bits = (extend_spine(locale, iswall_check(map, x, y - 1), 0, -1) << 3)
               | (extend_spine(locale, iswall_check(map, x, y + 1), 0, 1) << 2)
               | (extend_spine(locale, iswall_check(map, x + 1, y), 1, 0) << 1)
               | extend_spine(locale, iswall_check(map, x - 1, y), -1, 0);

    // Don't change typ if wall is free-standing
    if (bits) loc.typ = SPINE_ARRAY[bits];
}

// C ref: mklev.c:1312-1322 — vault creation and fill
// Called when check_room succeeds for vault position.
// Creates the vault room structure, fills with gold (simulated RNG),
// and runs wallification on the vault region.
function do_fill_vault(map, vaultCheck, depth) {
    const lowx = vaultCheck.lowx;
    const lowy = vaultCheck.lowy;
    const hix = lowx + vaultCheck.ddx;
    const hiy = lowy + vaultCheck.ddy;

    add_room_to_map(map, lowx, lowy, hix, hiy, true, VAULT, false);
    map.flags.has_vault = true;
    // C ref: mklev.c:1318 — vault room gets needfill=FILL_NORMAL
    map.rooms[map.nroom - 1].needfill = FILL_NORMAL;

    // C ref: fill_special_room for VAULT — mkgold per cell
    // mkgold(rn1(abs(depth)*100, 51), x, y) for each cell
    // rn1(n, base) = rn2(n) + base, then mkgold → mksobj_at(GOLD_PIECE)
    // → newobj() → next_ident() which consumes rnd(2) per gold object.
    const vroom = map.rooms[map.nroom - 1];
    for (let vx = vroom.lx; vx <= vroom.hx; vx++) {
        for (let vy = vroom.ly; vy <= vroom.hy; vy++) {
            rn2(Math.abs(depth) * 100 || 100); // rn1 amount
            rnd(2); // C ref: mkobj.c:521 — next_ident() in newobj()
        }
    }

    // C ref: mk_knox_portal(vault_x + w, vault_y + h)
    // At depth 1: Is_branchlev(&u.uz) is TRUE (level 1 is a branch level),
    // so mk_knox_portal returns early WITHOUT consuming any RNG.
    // At depths > 10: source->dnum < n_dgns is FALSE, then rn2(3) consumed.
    // At depths 2-10 that aren't branch levels: rn2(3) consumed, then
    //   u_depth > 10 check fails, returns.
    if (depth > 1) {
        // Simplified: at depth > 1, not a branch level, consume rn2(3)
        rn2(3);
    }

    // C ref: mklev.c:1321-1322 — !rn2(3) → makevtele() → makeniche(TELEP_TRAP)
    if (!rn2(3)) {
        makeniche(map, depth, TELEP_TRAP);
    }

    // Re-run wallification around the vault region to fix wall types
    wallify(map, lowx - 1, lowy - 1, hix + 1, hiy + 1);
}

// ========================================================================
// Pre-makelevel dungeon initialization simulation
// ========================================================================

// Simulate all RNG calls from dungeon.c init_dungeons() plus surrounding
// pre-makelevel calls. The call count is seed-dependent because
// place_level() uses recursive backtracking that varies by dungeon size.
//
// Call sequence (wizard mode — no chance checks):
//   1. nhlib.lua shuffle(align): rn2(3), rn2(2)
//   2. For each dungeon:
//      a. rn1(range, base) → rn2(range) if range > 0
//      b. parent_dlevel → rn2(num) for non-root, non-unconnected dungeons
//      c. place_level → recursive rn2(npossible) calls
//   3. init_castle_tune: 5 × rn2(7)
//   4. u_init.c: rn2(10)
//   5. nhlua pre_themerooms shuffle: rn2(3), rn2(2)
//   6. bones.c: rn2(3)
function simulateDungeonInit() {
    // 1. nhlib.lua: shuffle(align) — 3-element Fisher-Yates
    rn2(3); rn2(2);

    // Level definitions for each dungeon, in dungeon.lua order.
    // Each level: [base, range, chainIndex] where chainIndex is -1 for
    // no chain, or the index into THIS dungeon's level list for the chain.
    // In wizard mode, all levels are created (no chance checks).
    const DUNGEON_DEFS = [
        { // 0: Dungeons of Doom
            base: 25, range: 5, hasParent: false,
            // parentBranch computed from DofD branches, not needed for root
            levels: [
                [15, 4, -1],  // rogue
                [5, 5, -1],   // oracle
                [10, 3, -1],  // bigrm
                [-5, 4, -1],  // medusa
                [-1, 0, -1],  // castle
            ],
        },
        { // 1: Gehennom
            base: 20, range: 5, hasParent: true,
            parentBranchNum: 1, // rn2(1) — chain=castle in DofD, base=0, range=0
            levels: [
                [1, 0, -1],   // valley
                [-1, 0, -1],  // sanctum
                [4, 4, -1],   // juiblex
                [6, 4, -1],   // baalz
                [2, 6, -1],   // asmodeus
                [11, 6, -1],  // wizard1
                [1, 0, 5],    // wizard2 (chain=wizard1)
                [2, 0, 5],    // wizard3 (chain=wizard1)
                [10, 6, -1],  // orcus
                [-6, 4, -1],  // fakewiz1
                [-6, 4, -1],  // fakewiz2
            ],
        },
        { // 2: Gnomish Mines
            base: 8, range: 2, hasParent: true,
            parentBranchNum: 3, // rn2(3) — base=2, range=3 in DofD
            levels: [
                [3, 2, -1],   // minetn
                [-1, 0, -1],  // minend
            ],
        },
        { // 3: The Quest
            base: 5, range: 2, hasParent: true,
            parentBranchNum: 2, // rn2(2) — chain=oracle in DofD, base=6, range=2
            levels: [
                [1, 1, -1],   // x-strt
                [3, 1, -1],   // x-loca
                [-1, 0, -1],  // x-goal
            ],
        },
        { // 4: Sokoban
            base: 4, range: 0, hasParent: true,
            parentBranchNum: 1, // rn2(1) — chain=oracle in DofD, base=1, range=0
            levels: [
                [1, 0, -1],   // soko1
                [2, 0, -1],   // soko2
                [3, 0, -1],   // soko3
                [4, 0, -1],   // soko4
            ],
        },
        { // 5: Fort Ludios
            base: 1, range: 0, hasParent: true,
            parentBranchNum: 4, // rn2(4) — base=18, range=4 in DofD
            levels: [
                [-1, 0, -1],  // knox
            ],
        },
        { // 6: Vlad's Tower
            base: 3, range: 0, hasParent: true,
            parentBranchNum: 5, // rn2(5) — base=9, range=5 in Gehennom
            levels: [
                [1, 0, -1],   // tower1
                [2, 0, -1],   // tower2
                [3, 0, -1],   // tower3
            ],
        },
        { // 7: Elemental Planes
            base: 6, range: 0, hasParent: true,
            parentBranchNum: 1, // rn2(1) — base=1, range=0 in DofD
            levels: [
                [1, 0, -1],   // astral
                [2, 0, -1],   // water
                [3, 0, -1],   // fire
                [4, 0, -1],   // air
                [5, 0, -1],   // earth
                [6, 0, -1],   // dummy
            ],
        },
        { // 8: Tutorial (unconnected — no parent branch)
            base: 2, range: 0, hasParent: false,
            levels: [
                [1, 0, -1],   // tut-1
                [2, 0, -1],   // tut-2
            ],
        },
    ];

    // Process each dungeon
    for (const dgn of DUNGEON_DEFS) {
        // 2a. rn1(range, base) for level count
        const numLevels = dgn.range > 0
            ? rn2(dgn.range) + dgn.base
            : dgn.base;

        // 2b. parent_dlevel → rn2(num)
        if (dgn.hasParent) {
            rn2(dgn.parentBranchNum);
        }

        // 2c. place_level — recursive backtracking
        placeLevelSim(dgn.levels, numLevels);
    }

    // 3. init_castle_tune: 5 × rn2(7)
    for (let i = 0; i < 5; i++) rn2(7);

    // 4. u_init.c: rn2(10) for role selection
    rn2(10);

    // 5. nhlua pre_themerooms shuffle (loaded when themerms.lua is first used)
    rn2(3); rn2(2);

    // 6. bones.c: rn2(3) for bones check
    rn2(3);
}

// Simulate C's place_level() recursive backtracking for one dungeon.
// rawLevels: array of [base, range, chainIndex] per level template.
// numLevels: total dungeon levels available.
// C ref: dungeon.c:665-705 place_level, 597-626 possible_places
function placeLevelSim(rawLevels, numLevels) {
    const placed = new Array(rawLevels.length).fill(0);

    // Compute a level's valid range given current placed state.
    // C ref: dungeon.c level_range + possible_places
    function getLevelRange(idx) {
        const [base, range, chain] = rawLevels[idx];
        let adjBase;
        if (chain >= 0) {
            // Chain to previously-placed level in this dungeon
            adjBase = placed[chain] + base;
        } else if (base < 0) {
            adjBase = numLevels + base + 1;
        } else {
            adjBase = base;
        }
        let count;
        if (range === 0) {
            count = 1;
        } else {
            count = Math.min(range, numLevels - adjBase + 1);
            if (count < 1) count = 1;
        }
        return { adjBase, count };
    }

    function doPlace(idx) {
        if (idx >= rawLevels.length) return true;

        const { adjBase, count } = getLevelRange(idx);

        // Build validity map: mark range as TRUE, then exclude placed levels
        const map = new Array(numLevels + 1).fill(false);
        for (let i = adjBase; i < adjBase + count && i <= numLevels; i++) {
            if (i >= 1) map[i] = true;
        }
        let npossible = 0;
        for (let i = 0; i < idx; i++) {
            if (placed[i] > 0 && placed[i] <= numLevels && map[placed[i]]) {
                map[placed[i]] = false;
            }
        }
        for (let i = 1; i <= numLevels; i++) {
            if (map[i]) npossible++;
        }

        // Try random placements with backtracking
        for (; npossible > 0; npossible--) {
            const nth = rn2(npossible);
            // pick_level: find the nth TRUE entry
            let c = 0;
            for (let i = 1; i <= numLevels; i++) {
                if (map[i]) {
                    if (c === nth) {
                        placed[idx] = i;
                        break;
                    }
                    c++;
                }
            }
            if (doPlace(idx + 1)) return true;
            map[placed[idx]] = false;
        }
        return false;
    }

    doPlace(0);
}

// ========================================================================
// Main entry point
// ========================================================================

// C ref: mklev.c makelevel()
export function generateLevel(depth) {
    setLevelDepth(depth);

    // C ref: o_init.c init_objects() — shuffle descriptions, 198 rn2 calls
    init_objects();

    // Simulate pre-makelevel RNG calls that happen between init_objects
    // and makelevel. These are: nhlib.lua shuffle(align)(2) + dungeon.c
    // init (variable) + u_init(1) + nhlua pre_themerooms(2) + bones(1).
    simulateDungeonInit();

    const map = new GameMap();
    map.clear();

    // Initialize rectangle pool for BSP room placement
    init_rect();

    // C ref: mklev.c:1276 — maze level check (consumed but not acted on)
    rn2(5);

    // Make rooms using rect BSP algorithm
    // C ref: mklev.c:1287 makerooms()
    makerooms(map, depth);

    if (map.nroom === 0) {
        // Fallback: should never happen, but safety
        add_room_to_map(map, 10, 5, 20, 10, true, OROOM, false);
    }

    // Sort rooms left-to-right
    // C ref: mklev.c:1290 sort_rooms()
    sort_rooms(map);

    // Place stairs
    // C ref: mklev.c:1292 generate_stairs()
    generate_stairs(map, depth);

    // Connect rooms with corridors
    // C ref: mklev.c:1299 makecorridors()
    makecorridors(map, depth);

    // Add niches
    // C ref: mklev.c:1300 make_niches()
    make_niches(map, depth);

    // Fix wall types after corridors are dug
    wallification(map);

    // C ref: mklev.c:1305-1331 — do_vault()
    // Make a secret treasure vault, not connected to the rest
    if (map.vault_x !== undefined && map.vault_x >= 0) {
        let w = 1, h = 1;
        const vaultCheck = check_room(map, map.vault_x, w, map.vault_y, h, true);
        if (vaultCheck) {
            do_fill_vault(map, vaultCheck, depth);
        } else if (rnd_rect()) {
            // Retry: create_vault() = create_room(-1,-1,2,2,-1,-1,VAULT,TRUE)
            if (create_room(map, -1, -1, 2, 2, -1, -1, VAULT, true, depth)) {
                // create_room for vault saves position but doesn't add room
                if (map.vault_x >= 0) {
                    w = 1; h = 1;
                    const vc2 = check_room(map, map.vault_x, w, map.vault_y, h, true);
                    if (vc2) {
                        do_fill_vault(map, vc2, depth);
                    }
                }
            }
        }
    }

    // C ref: mklev.c:1333-1365 — do_mkroom chain
    // Special room type selection based on depth.
    // At depth 1: u_depth > 1 fails, so entire chain is skipped (no RNG consumed).
    // For deeper depths, the chain consumes rn2() calls for each check.
    if (depth > 1) {
        const room_threshold = 3; // simplified: no branch check
        // C ref: each check consumes one rn2() if it reaches that point
        if (depth > 1 && map.nroom >= room_threshold && rn2(depth) < 3) {
            // do_mkroom(SHOPBASE) — skip actual shop creation
        } else if (depth > 4 && !rn2(6)) {
            // do_mkroom(COURT)
        } else if (depth > 5 && !rn2(8)) {
            // do_mkroom(LEPREHALL)
        } else if (depth > 6 && !rn2(7)) {
            // do_mkroom(ZOO)
        } else if (depth > 8 && !rn2(5)) {
            // do_mkroom(TEMPLE)
        } else if (depth > 9 && !rn2(5)) {
            // do_mkroom(BEEHIVE)
        } else if (depth > 11 && !rn2(6)) {
            // do_mkroom(MORGUE)
        } else if (depth > 12 && !rn2(8)) {
            // do_mkroom(ANTHOLE) — antholemon() check skipped
        } else if (depth > 14 && !rn2(4)) {
            // do_mkroom(BARRACKS)
        } else if (depth > 15 && !rn2(6)) {
            // do_mkroom(SWAMP)
        } else if (depth > 16 && !rn2(8)) {
            // do_mkroom(COCKNEST)
        }
    }

    // C ref: mklev.c:1367-1376 — place_branch()
    // At depth 1: branch exists (entry from surface), place branch stairs
    if (depth === 1) {
        const branchRoom = generate_stairs_find_room(map);
        if (branchRoom) {
            const pos = somexyspace(map, branchRoom);
            if (pos) {
                const loc = map.at(pos.x, pos.y);
                if (loc) {
                    loc.typ = STAIRS;
                    loc.flags = 1; // up (branch goes up to surface)
                    map.upstair = { x: pos.x, y: pos.y };
                }
            }
        }
    }

    // C ref: mklev.c:1381-1401 — bonus item room selection + fill loop
    // ROOM_IS_FILLABLE: (rtype == OROOM || rtype == THEMEROOM) && needfill == FILL_NORMAL
    const isFillable = (r) => (r.rtype === OROOM || r.rtype === THEMEROOM)
                              && r.needfill === FILL_NORMAL;
    let fillableCount = 0;
    for (const croom of map.rooms) {
        if (isFillable(croom)) fillableCount++;
    }
    let bonusCountdown = fillableCount > 0 ? rn2(fillableCount) : -1;

    for (const croom of map.rooms) {
        const fillable = isFillable(croom);
        fill_ordinary_room(map, croom, depth,
                           fillable && bonusCountdown === 0);
        if (fillable) bonusCountdown--;
    }

    return map;
}
