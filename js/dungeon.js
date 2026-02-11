// dungeon.js -- Level generation
// Faithful port of mklev.c, rect.c, sp_lev.c from NetHack 3.7.
// See DECISIONS.md #9, DESIGN.md for architecture notes.
//
// The C code uses global state (levl[][], svr.rooms[], gs.smeq[]).
// In JS we pass the map object explicitly to all functions.

import {
    COLNO, ROWNO, STONE, VWALL, HWALL, TLCORNER, TRCORNER,
    BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL,
    DOOR, CORR, ROOM, STAIRS, LADDER, FOUNTAIN, ALTAR, GRAVE, SINK,
    SDOOR, SCORR, AIR,
    POOL, IRONBARS, ICE, LAVAWALL,
    D_NODOOR, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED,
    DIR_N, DIR_S, DIR_E, DIR_W, DIR_180,
    xdir, ydir, N_DIRS,
    OROOM, THEMEROOM, VAULT, SHOPBASE, MAXNROFROOMS, ROOMOFFSET,
    DBWALL,
    IS_WALL, IS_STWALL, IS_DOOR, IS_ROOM, IS_OBSTRUCTED, IS_FURNITURE,
    IS_POOL, IS_LAVA, isok,
    NO_TRAP, ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
    LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
    PIT, SPIKED_PIT, HOLE, TRAPDOOR, TELEP_TRAP, LEVEL_TELEP,
    MAGIC_PORTAL, WEB, STATUE_TRAP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP,
    VIBRATING_SQUARE, TRAPPED_DOOR, TRAPPED_CHEST, TRAPNUM,
    is_pit, is_hole,
    MKTRAP_NOFLAGS, MKTRAP_MAZEFLAG, MKTRAP_NOSPIDERONWEB, MKTRAP_NOVICTIM,
    PM_ARCHEOLOGIST as ROLE_ARCHEOLOGIST, PM_WIZARD as ROLE_WIZARD
} from './config.js';
import { GameMap, makeRoom, FILL_NONE, FILL_NORMAL } from './map.js';
import { rn2, rnd, rn1, d } from './rng.js';
import { getbones } from './bones.js';
import { mkobj, mksobj, mkcorpstat, weight, setLevelDepth, TAINT_AGE } from './mkobj.js';
import { makemon, mkclass, NO_MM_FLAGS, MM_NOGRP } from './makemon.js';
import { S_HUMAN, PM_ELF, PM_HUMAN, PM_GNOME, PM_DWARF, PM_ORC, PM_ARCHEOLOGIST, PM_WIZARD } from './monsters.js';
import { init_objects } from './o_init.js';
import { roles } from './player.js';
import {
    ARROW, DART, ROCK, BOULDER, LARGE_BOX, CHEST, GOLD_PIECE, CORPSE,
    STATUE, TALLOW_CANDLE, WAX_CANDLE, BELL,
    WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, GEM_CLASS, WAND_CLASS,
    ARMOR_CLASS, SCROLL_CLASS, POTION_CLASS, RING_CLASS, SPBOOK_CLASS,
    POT_HEALING, POT_EXTRA_HEALING, POT_SPEED, POT_GAIN_ENERGY,
    SCR_ENCHANT_WEAPON, SCR_ENCHANT_ARMOR, SCR_CONFUSE_MONSTER, SCR_SCARE_MONSTER,
    SCR_TELEPORTATION,
    WAN_DIGGING, SPE_HEALING, SPE_BLANK_PAPER, SPE_NOVEL,
    objectData, bases,
} from './objects.js';
import { RUMORS_FILE_TEXT } from './rumor_data.js';
import { getSpecialLevel } from './special_levels.js';
import { setLevelContext, clearLevelContext } from './sp_lev.js';
import { themerooms_generate as themermsGenerate, reset_state as resetThemermsState } from './levels/themerms.js';

/**
 * Bridge function: Call themed room generation with des.* API bridge
 *
 * Sets up levelState to point at our procedural map, calls themerms,
 * then cleans up. This allows themed rooms (which use des.room()) to
 * work with procedural dungeon generation.
 */
function themerooms_generate(map, depth) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';

    try {
        // Bridge: Point sp_lev's levelState.map at our procedural map
        setLevelContext(map, depth);

        // Call ported themerms (uses des.* API internally)
        const result = themermsGenerate(map, depth);

        if (DEBUG) {
            console.log(`themerooms_generate: result=${result}, nroom=${map.nroom}`);
        }

        return result;
    } finally {
        // Always cleanup levelState, even on error
        clearLevelContext();
    }
}

import { parseEncryptedDataFile, parseRumorsFile } from './hacklib.js';
import { EPITAPH_FILE_TEXT } from './epitaph_data.js';
import { ENGRAVE_FILE_TEXT } from './engrave_data.js';
import { shtypes, stock_room } from './shknam.js';

// Module-level game seed for nameshk() — set by setGameSeed() before level gen
let _gameSeed = 0;
export function setGameSeed(seed) { _gameSeed = seed; }

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

// C ref: rect.c init_rect() - exported for sp_lev.js special level initialization
export function init_rect() {
    rects = new Array(n_rects);
    rect_cnt = 1;
    rects[0] = { lx: 0, ly: 0, hx: COLNO - 1, hy: ROWNO - 1 };
}

// Debug exports for rectangle pool inspection
export function get_rect_count() {
    return rect_cnt;
}

export function get_rects() {
    return rects.slice(0, rect_cnt);
}

// C ref: rect.c rnd_rect() - exported for sp_lev.js themed room generation
export function rnd_rect() {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';
    if (DEBUG) {
        const stack = new Error().stack.split('\n')[2].trim(); // Get caller
        console.log(`  rnd_rect: ENTRY rect_cnt=${rect_cnt} from ${stack}`);
    }
    const result = rect_cnt > 0 ? rects[rn2(rect_cnt)] : null;
    if (DEBUG) {
        if (result) {
            console.log(`  rnd_rect: selected rect (${result.lx},${result.ly})-(${result.hx},${result.hy}), pool=${rect_cnt}`);
        } else {
            console.log(`  rnd_rect: NO RECTS AVAILABLE, pool=${rect_cnt}`);
        }
    }
    return result;
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
export function get_rect(r) {
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
export function split_rects(r1, r2) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_RECTS === '1';
    const old_cnt = rect_cnt;
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

    if (DEBUG) {
        const top_space = r2.ly - old_r.ly - 1;
        const top_thresh = (old_r.hy < ROWNO - 1 ? 2 * YLIM : YLIM + 1) + 4;
        const left_space = r2.lx - old_r.lx - 1;
        const left_thresh = (old_r.hx < COLNO - 1 ? 2 * XLIM : XLIM + 1) + 4;
        const bottom_space = old_r.hy - r2.hy - 1;
        const bottom_thresh = (old_r.ly > 0 ? 2 * YLIM : YLIM + 1) + 4;
        const right_space = old_r.hx - r2.hx - 1;
        const right_thresh = (old_r.lx > 0 ? 2 * XLIM : XLIM + 1) + 4;

        console.log(`  split_rects: (${old_r.lx},${old_r.ly})-(${old_r.hx},${old_r.hy}) by room (${r2.lx},${r2.ly})-(${r2.hx},${r2.hy}), pool ${old_cnt}->${rect_cnt}`);
        console.log(`    T:${top_space}>${top_thresh}=${top_space>top_thresh}, L:${left_space}>${left_thresh}=${left_space>left_thresh}, B:${bottom_space}>${bottom_thresh}=${bottom_space>bottom_thresh}, R:${right_space}>${right_thresh}=${right_space>right_thresh}`);
    }
}

// C ref: rect.c split_rects() -- exported for sp_lev.js fixed-position rooms
// After creating a fixed-position room, split all intersecting rectangles in the pool
// to avoid future random rooms overlapping with it.
export function update_rect_pool_for_room(room) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_RECTS === '1';
    const old_cnt = rect_cnt;

    // C ref: sp_lev.c:1635-1638 — r2 bounds include border (x-1, y-1) to (x+w, y+h)
    // Room object has inclusive bounds (lx, ly) to (hx, hy), but split_rects needs
    // borders: (lx-1, ly-1) to (hx+1, hy+1)
    const r2 = {
        lx: room.lx - 1,
        ly: room.ly - 1,
        hx: room.hx + 1,
        hy: room.hy + 1
    };

    // Walk through all rectangles and split those that intersect with r2
    // Need to walk backwards since split_rects modifies the pool
    for (let i = rect_cnt - 1; i >= 0; i--) {
        const r = intersect(rects[i], r2);
        if (r) {
            split_rects(rects[i], r2);
        }
    }

    if (DEBUG && rect_cnt !== old_cnt) {
        console.log(`  update_rect_pool_for_room: split around (${r2.lx},${r2.ly})-(${r2.hx},${r2.hy}), pool ${old_cnt}->${rect_cnt}`);
    }
}

// ========================================================================
// sp_lev.c -- Room creation (check_room, create_room)
// ========================================================================

// C ref: sp_lev.c check_room()
// Verifies room area is all STONE with required margins.
// May shrink the room. Returns { lowx, ddx, lowy, ddy } or null.
export function check_room(map, lowx, ddx, lowy, ddy, vault, inThemerooms) {
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
export function litstate_rnd(litstate, depth) {
    if (litstate < 0)
        return (rnd(1 + Math.abs(depth)) < 11 && rn2(77)) ? true : false;
    return !!litstate;
}


// C ref: sp_lev.c create_room() -- create a random room using rect BSP
// Returns true if room was created, false if failed.
export function create_room(map, x, y, w, h, xal, yal, rtype, rlit, depth, inThemerooms) {
    const DEBUG_THEME = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';
    const nroom_before = map.nroom;
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
            if (!r1) {
                if (DEBUG_THEME) console.log(`  create_room: no rect, rtype=${rtype}, VAULT=${rtype===VAULT}`);
                return false;
            }

            const hx = r1.hx, hy = r1.hy, lx = r1.lx, ly = r1.ly;
            let dx, dy;
            if (vault) {
                dx = dy = 1;
            } else {
                const dx_rng = rn2((hx - lx > 28) ? 12 : 8);
                dx = 2 + dx_rng;
                const dy_rng = rn2(4);
                dy = 2 + dy_rng;
                if (DEBUG_THEME) console.log(`  Room size: dx=2+${dx_rng}=${dx}, dy=2+${dy_rng}=${dy}`);
                if (dx * dy > 50)
                    dy = Math.floor(50 / dx);
            }
            const xborder = (lx > 0 && hx < COLNO - 1) ? 2 * xlim : xlim + 1;
            const yborder = (ly > 0 && hy < ROWNO - 1) ? 2 * ylim : ylim + 1;
            if (hx - lx < dx + 3 + xborder || hy - ly < dy + 3 + yborder) {
                r1 = null;
                continue;
            }
            const x_rng = rn2(hx - (lx > 0 ? lx : 3) - dx - xborder + 1);
            xabs = lx + (lx > 0 ? xlim : 3) + x_rng;
            const y_rng = rn2(hy - (ly > 0 ? ly : 2) - dy - yborder + 1);
            yabs = ly + (ly > 0 ? ylim : 2) + y_rng;
            if (DEBUG_THEME) console.log(`  Room pos: xabs=${lx}+3+${x_rng}=${xabs}, yabs=${ly}+2+${y_rng}=${yabs}`);
            // C ref: sp_lev.c:1564-1571 — special case for full-height rectangles in bottom half
            // CRITICAL: Call rn2(map.nroom) BEFORE other checks to match C RNG sequence
            // C calls rn2(map.nroom) at line 1564, then checks condition at 1566-1571
            let nroom_check = false;
            if (ly === 0 && hy >= ROWNO - 1) {
                // Always call rn2(map.nroom) for RNG alignment, even if other conditions fail
                nroom_check = !map.nroom || !rn2(map.nroom);
                if ((yabs + dy > Math.floor(ROWNO / 2)) && nroom_check) {
                    yabs = rn1(3, 2);
                    if (map.nroom < 4 && dy > 1)
                        dy--;
                }
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
            // C ref: sp_lev.c:1580-1644 — partially specified room
            let rndpos = 0;
            let xaltmp = xal;
            let yaltmp = yal;

            if (xtmp < 0 && ytmp < 0) {
                xtmp = rnd(5);
                ytmp = rnd(5);
                rndpos = 1;
            }
            if (wtmp < 0 || htmp < 0) {
                wtmp = rn1(15, 3);
                htmp = rn1(8, 2);
            }
            if (xaltmp === -1) xaltmp = rnd(3);
            if (yaltmp === -1) yaltmp = rnd(3);

            // Convert grid position to absolute coordinates
            // C uses integer division: ((xtmp-1)*COLNO)/5
            xabs = Math.trunc(((xtmp - 1) * COLNO) / 5) + 1;
            yabs = Math.trunc(((ytmp - 1) * ROWNO) / 5) + 1;

            // Alignment adjustments
            // SPLEV_LEFT=1, SPLEV_CENTER=3, SPLEV_RIGHT=5, TOP=1, BOTTOM=5
            switch (xaltmp) {
            case 1: break;
            case 5: xabs += Math.trunc(COLNO / 5) - wtmp; break;
            case 3: xabs += Math.trunc((Math.trunc(COLNO / 5) - wtmp) / 2); break;
            }
            switch (yaltmp) {
            case 1: break;
            case 5: yabs += Math.trunc(ROWNO / 5) - htmp; break;
            case 3: yabs += Math.trunc((Math.trunc(ROWNO / 5) - htmp) / 2); break;
            }

            // Bounds clamping
            if (xabs + wtmp - 1 > COLNO - 2) xabs = COLNO - wtmp - 3;
            if (xabs < 2) xabs = 2;
            if (yabs + htmp - 1 > ROWNO - 2) yabs = ROWNO - htmp - 3;
            if (yabs < 2) yabs = 2;

            // Find a containing rect
            const r2 = {
                lx: xabs - 1,
                ly: yabs - 1,
                hx: xabs + wtmp + rndpos,
                hy: yabs + htmp + rndpos
            };
            r1 = get_rect(r2);

            if (r1) {
                const result = check_room(map, xabs, wtmp, yabs, htmp, vault, inThemerooms);
                if (!result) r1 = null;
            }

            if (!r1) continue;
            split_rects(r1, r2);
        }

        // C ref: sp_lev.c:1652-1659 — vaults don't add a room or
        // increment nroom; they just save the position for later.
        if (vault) {
            map.vault_x = xabs;
            map.vault_y = yabs;
            if (DEBUG_THEME) console.log(`  create_room: vault special case SUCCESS, nroom=${nroom_before}->${map.nroom}`);
            return true;
        }

        // Actually create the room
        add_room_to_map(map, xabs, yabs, xabs + wtmp - 1, yabs + htmp - 1,
                        lit, rtype, false);
        if (DEBUG_THEME) console.log(`  create_room: SUCCESS, rtype=${rtype}, VAULT=${rtype===VAULT}, nroom=${nroom_before}->${map.nroom}`);
        return true;

    } while (++trycnt <= 100); // C ref: sp_lev.c trycnt limit is 100

    if (DEBUG_THEME) console.log(`  create_room: FAILED after 100 tries, rtype=${rtype}, VAULT=${rtype===VAULT}`);
    return false;
}

// ========================================================================
// mklev.c -- Core level generation
// ========================================================================

// C ref: mklev.c do_room_or_subroom()
// roomIdx: optional override for roomno computation (used for subrooms)
function do_room_or_subroom(map, croom, lowx, lowy, hix, hiy,
                            lit, rtype, special, is_room, roomIdx) {
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

    const roomno = (roomIdx !== undefined) ? roomIdx : map.rooms.indexOf(croom);
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
        const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_ROOM_FILL === '1';
        if (DEBUG) {
            const area = (hix - lowx + 1) * (hiy - lowy + 1);
            console.log(`Filling room (${lowx},${lowy})-(${hix},${hiy}) area=${area}`);
        }
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
    // Track nroom separately (don't use rooms.length once subrooms are added)
    map.nroom = (map.nroom || 0) + 1;
    do_room_or_subroom(map, croom, lowx, lowy, hix, hiy, lit, rtype,
                       special, true);
}

// C ref: mklev.c add_subroom()
function add_subroom_to_map(map, proom, lowx, lowy, hix, hiy, lit, rtype, special) {
    const croom = makeRoom();
    croom.needjoining = false;
    // Subrooms use a pseudo room index beyond nroom (matches C pointer arithmetic)
    const nsubroom = map.nsubroom || 0;
    const roomIdx = map.nroom + nsubroom;
    map.nsubroom = nsubroom + 1;
    // Add subroom to map.rooms array at index roomIdx (beyond main rooms)
    // In C, subrooms occupy indices [nroom..nroom+nsubroom) in the rooms array
    map.rooms[roomIdx] = croom;
    do_room_or_subroom(map, croom, lowx, lowy, hix, hiy, lit, rtype,
                       special, false, roomIdx);
    proom.sbrooms[proom.nsubrooms] = croom;
    proom.nsubrooms++;
    return croom;
}

// C ref: sp_lev.c create_subroom()
// x, y are relative to parent room. w, h are sub-room dimensions.
// Returns the created subroom, or null if parent too small.
export function create_subroom(map, proom, x, y, w, h, rtype, rlit, depth) {
    const width = proom.hx - proom.lx + 1;
    const height = proom.hy - proom.ly + 1;

    if (width < 4 || height < 4) return null;

    if (w === -1) w = rnd(width - 3);
    if (h === -1) h = rnd(height - 3);
    if (x === -1) x = rnd(width - w);
    if (y === -1) y = rnd(height - h);
    if (x === 1) x = 0;
    if (y === 1) y = 0;
    if ((x + w + 1) === width) x++;
    if ((y + h + 1) === height) y++;
    if (rtype === -1) rtype = OROOM;
    const lit = litstate_rnd(rlit, depth);

    return add_subroom_to_map(map, proom,
        proom.lx + x, proom.ly + y,
        proom.lx + x + w - 1, proom.ly + y + h - 1,
        lit, rtype, false);
}

// Wall direction constants for sp_create_door (sp_lev.h)
const W_NORTH = 1, W_SOUTH = 2, W_EAST = 4, W_WEST = 8;
const W_ANY = W_NORTH | W_SOUTH | W_EAST | W_WEST;

// C ref: sp_lev.c create_door() — place a door on a room wall
// dd = { secret, mask, pos, wall }
export function sp_create_door(map, dd, broom) {
    let x = 0, y = 0;

    if (dd.secret === -1) dd.secret = rn2(2);
    if (dd.wall === -1) dd.wall = W_ANY; // W_RANDOM → W_ANY

    if (dd.mask === -1) {
        if (!dd.secret) {
            if (!rn2(3)) {
                if (!rn2(5)) dd.mask = D_ISOPEN;
                else if (!rn2(6)) dd.mask = D_LOCKED;
                else dd.mask = D_CLOSED;
                if (dd.mask !== D_ISOPEN && !rn2(25))
                    dd.mask |= D_TRAPPED;
            } else {
                dd.mask = D_NODOOR;
            }
        } else {
            if (!rn2(5)) dd.mask = D_LOCKED;
            else dd.mask = D_CLOSED;
            if (!rn2(20)) dd.mask |= D_TRAPPED;
        }
    }

    let trycnt;
    for (trycnt = 0; trycnt < 100; trycnt++) {
        const dwall = dd.wall;

        switch (rn2(4)) {
        case 0:
            if (!(dwall & W_NORTH)) continue;
            y = broom.ly - 1;
            x = broom.lx + ((dd.pos === -1) ? rn2(1 + broom.hx - broom.lx) : dd.pos);
            if (!isok(x, y - 1) || IS_OBSTRUCTED(map.at(x, y - 1).typ)) continue;
            break;
        case 1:
            if (!(dwall & W_SOUTH)) continue;
            y = broom.hy + 1;
            x = broom.lx + ((dd.pos === -1) ? rn2(1 + broom.hx - broom.lx) : dd.pos);
            if (!isok(x, y + 1) || IS_OBSTRUCTED(map.at(x, y + 1).typ)) continue;
            break;
        case 2:
            if (!(dwall & W_WEST)) continue;
            x = broom.lx - 1;
            y = broom.ly + ((dd.pos === -1) ? rn2(1 + broom.hy - broom.ly) : dd.pos);
            if (!isok(x - 1, y) || IS_OBSTRUCTED(map.at(x - 1, y).typ)) continue;
            break;
        case 3:
            if (!(dwall & W_EAST)) continue;
            x = broom.hx + 1;
            y = broom.ly + ((dd.pos === -1) ? rn2(1 + broom.hy - broom.ly) : dd.pos);
            if (!isok(x + 1, y) || IS_OBSTRUCTED(map.at(x + 1, y).typ)) continue;
            break;
        }

        if (okdoor(map, x, y)) break;
    }

    if (trycnt >= 100) return;

    const loc = map.at(x, y);
    loc.typ = dd.secret ? SDOOR : DOOR;
    loc.flags = dd.mask;
    add_door(map, x, y, broom);
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


// Flood fill from (sx, sy) through connected cells of the same typ,
// assign roomno, compute bounding box, and register as a room.
// C ref: sp_lev.c flood_fill_rm() + add_room()
export function floodFillAndRegister(map, sx, sy, rtype, lit) {
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
    // Track nroom separately (don't use rooms.length once subrooms are added)
    map.nroom = (map.nroom || 0) + 1;

    const roomno = map.nroom - 1;
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

// C ref: mklev.c:363 — gl.luathemes[] tracks whether Lua theme state is loaded
// On first level generation, nhl_loadlua() consumes rn2(3) and rn2(2).
// Subsequent levels reuse the cached state with no RNG.
let _themesLoaded = false;

// Track Lua MT RNG initialization (shared with sp_lev.js via export)
// Lazy initialization happens on first Lua RNG use (des.object/des.monster)
// Use getter function to avoid stale import copies (primitives are copied, not referenced)
let _mtInitialized = false;
export function isMtInitialized() {
    return _mtInitialized;
}
export function setMtInitialized(val) {
    _mtInitialized = val;
}

// C ref: mkmaze.c makemaz()
// Generate a maze level (used in Gehennom and deep dungeon past Medusa)
function makemaz(map, protofile) {
    // C ref: mkmaze.c:1127-1204
    // If protofile specified, try to load special level
    // For now, we only handle the procedural case (protofile === "")

    if (protofile && protofile !== "") {
        // TODO: Load special maze level file
        console.warn(`makemaz: special level "${protofile}" not implemented, using procedural maze`);
    }

    // C ref: mkmaze.c:1189-1191
    // Set maze flags
    map.flags = map.flags || {};
    map.flags.is_maze_lev = true;
    map.flags.corrmaze = !rn2(3); // 2/3 chance of corridor maze

    // C ref: mkmaze.c:1193-1197
    // Determine maze creation parameters
    // create_maze has different params based on Invocation level check
    const useInvocationParams = rn2(2); // !Invocation_lev && rn2(2)
    if (useInvocationParams) {
        // create_maze(-1, -1, !rn2(5))
        create_maze(map, -1, -1, !rn2(5));
    } else {
        // create_maze(1, 1, FALSE)
        create_maze(map, 1, 1, false);
    }

    // C ref: mkmaze.c:1199-1200
    // Wallification for non-corridor mazes
    if (!map.flags.corrmaze) {
        // wallification(2, 2, x_maze_max, y_maze_max)
        // For now, skip wallification - it's complex and optional
    }

    // C ref: mkmaze.c:1202-1208
    // Place stairs
    const upstair = mazexy(map);
    mkstairs(map, upstair.x, upstair.y, true); // up stairs

    const downstair = mazexy(map);
    mkstairs(map, downstair.x, downstair.y, false); // down stairs

    // C ref: mkmaze.c:1211 — place_branch() for branch stairs
    // Skip for now - needs branch detection logic

    // C ref: mkmaze.c:1213 — populate_maze()
    // Skip for now - this would add monsters/traps/items
}

// Helper function to create the actual maze
function create_maze(map, x0, y0, smoothed) {
    // C ref: mkmaze.c:984-1056 create_maze()
    // This is a simplified version that creates a basic maze structure

    // Fill map with walls
    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            if (loc) loc.typ = STONE;
        }
    }

    // Determine maze bounds
    const x_maze_max = (x0 < 0) ? x0 = Math.min(COLNO - 1, rn2(29) + 11) : (COLNO - 1);
    const y_maze_max = (y0 < 0) ? y0 = Math.min(ROWNO - 1, rn2(11) + 7) : (ROWNO - 1);

    // Create a simple maze using recursive backtracking
    // Start from (x0, y0) and carve passages
    // For simplicity, create a grid of corridors
    for (let x = 1; x < x_maze_max; x += 2) {
        for (let y = 1; y < y_maze_max; y += 2) {
            const loc = map.at(x, y);
            if (loc) loc.typ = CORR; // Carve out corridor cells
        }
    }

    // Connect adjacent cells with corridors
    for (let x = 1; x < x_maze_max; x += 2) {
        for (let y = 1; y < y_maze_max; y += 2) {
            // Randomly connect to right or down
            if (x + 2 < x_maze_max && rn2(2)) {
                const loc = map.at(x + 1, y);
                if (loc) loc.typ = CORR;
            }
            if (y + 2 < y_maze_max && rn2(2)) {
                const loc = map.at(x, y + 1);
                if (loc) loc.typ = CORR;
            }
        }
    }
}

// Helper function to find a random location in the maze
function mazexy(map) {
    // C ref: mkmaze.c:1059-1076 mazexy()
    // Find a random CORR/ROOM location in the maze
    let x, y;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
        x = rn2(COLNO);
        y = rn2(ROWNO);
        attempts++;
        if (attempts > maxAttempts) {
            // Fallback to center
            return { x: Math.floor(COLNO / 2), y: Math.floor(ROWNO / 2) };
        }
        const loc = map.at(x, y);
        if (loc && (loc.typ === CORR || loc.typ === ROOM)) {
            return { x, y };
        }
    } while (true);
}

// Helper function to place stairs
function mkstairs(map, x, y, isUp) {
    // C ref: mkroom.c:891-920 mkstairs()
    const loc = map.at(x, y);
    if (!loc) return;

    loc.typ = isUp ? STAIRS : STAIRS;
    loc.stairdir = isUp ? 1 : 0; // 1 = up, 0 = down
}

// C ref: mklev.c makerooms()
function makerooms(map, depth) {
    let tried_vault = false;
    let themeroom_tries = 0;

    // C ref: mklev.c:365-380 — load Lua themes on first call only
    if (!_themesLoaded) {
        _themesLoaded = true;
        rn2(3); rn2(2);
    }

    // Make rooms until satisfied (no more rects available)
    // C ref: mklev.c:393-417
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';
    const DEBUG_POOL = typeof process !== 'undefined' && process.env.DEBUG_RECT_POOL === '1';

    let loop_count = 0;
    while (map.nroom < (MAXNROFROOMS - 1) && rnd_rect()) {
        loop_count++;

        if (DEBUG_POOL && loop_count % 10 === 0) {
            console.log(`[POOL CHECK] Loop ${loop_count}: nroom=${map.nroom}, rect_cnt=${rect_cnt}, tries=${themeroom_tries}`);
        }

        if (loop_count > 100) {
            console.error(`⚠️  INFINITE LOOP DETECTED: ${loop_count} iterations, nroom=${map.nroom}, rect_cnt=${rect_cnt}`);
            console.error(`  Last rect pool state: ${rect_cnt} rects`);
            if (rect_cnt > 0) {
                console.error(`  Rect 0: (${rects[0].lx},${rects[0].ly})-(${rects[0].hx},${rects[0].hy})`);
            }
            break;
        }

        if (DEBUG) {
            console.log(`Loop iteration: nroom=${map.nroom}, tries=${themeroom_tries}`);
        }
        if (map.nroom >= Math.floor(MAXNROFROOMS / 6) && rn2(2)
            && !tried_vault) {
            tried_vault = true;
            // C ref: mklev.c:396-399 — create_vault()
            if (DEBUG) console.log(`Creating vault...`);
            create_room(map, -1, -1, 2, 2, -1, -1, VAULT, true, depth, true);
        } else {
            // C ref: mklev.c:402-407
            const nroom_before = map.nroom;
            const result = themerooms_generate(map, depth);
            const nroom_after = map.nroom;

            if (DEBUG_POOL && nroom_before === nroom_after && result) {
                console.log(`⚠️  SUSPICIOUS: themeroom returned success but nroom unchanged (${nroom_before})`);
            }

            if (!result) {
                // themeroom_failed
                if (DEBUG) {
                    console.log(`themeroom failed, tries=${themeroom_tries + 1}, nroom=${map.nroom}, breaking=${(themeroom_tries + 1) > 10 || map.nroom >= Math.floor(MAXNROFROOMS / 6)}`);
                }
                if (++themeroom_tries > 10
                    || map.nroom >= Math.floor(MAXNROFROOMS / 6))
                    break;
            } else {
                if (DEBUG) {
                    console.log(`themeroom succeeded, resetting tries, nroom=${map.nroom}`);
                }
                themeroom_tries = 0;
            }
        }
    }
    if (DEBUG) {
        console.log(`Exited loop: nroom=${map.nroom}, tries=${themeroom_tries}`);
        console.log(`makerooms() finished: ${map.nroom} rooms created, themeroom_tries=${themeroom_tries}`);

        // Log room sizes and positions
        let totalArea = 0;
        for (let i = 0; i < map.nroom; i++) {
            const r = map.rooms[i];
            if (!r) continue; // Skip undefined rooms
            const w = r.hx - r.lx + 1;
            const h = r.hy - r.ly + 1;
            const area = w * h;
            totalArea += area;
            if (i < 5) { // Log first 5 rooms
                console.log(`  Room ${i}: (${r.lx},${r.ly})-(${r.hx},${r.hy}) size=${w}x${h} area=${area}`);
            }
        }
        console.log(`  Total room area: ${totalArea} squares (screen is ~1920 squares)`);
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

// C ref: sp_lev.c add_doors_to_room()
// Link any doors within/bordering the room to the room
export function add_doors_to_room(map, croom) {
    const DOOR = 8, SDOOR = 9; // Door types from map.js

    for (let x = croom.lx - 1; x <= croom.hx + 1; x++) {
        for (let y = croom.ly - 1; y <= croom.hy + 1; y++) {
            if (x < 0 || y < 0 || x >= COLNO || y >= ROWNO) continue;
            const loc = map.at(x, y);
            if (loc && (loc.typ === DOOR || loc.typ === SDOOR)) {
                maybe_add_door(map, x, y, croom);
            }
        }
    }

    // Recursively add doors for subrooms
    if (croom.sbrooms) {
        for (let i = 0; i < croom.sbrooms.length; i++) {
            add_doors_to_room(map, croom.sbrooms[i]);
        }
    }
}

// C ref: sp_lev.c maybe_add_door()
function maybe_add_door(map, x, y, droom) {
    // Check if this door location is associated with this room
    if (droom.hx >= 0) {
        const inside = (x >= droom.lx && x <= droom.hx && y >= droom.ly && y <= droom.hy);
        const loc = map.at(x, y);
        const roomMatch = loc && loc.roomno === droom.roomno;

        if ((!droom.irregular && inside) || roomMatch) {
            add_door(map, x, y, droom);
        }
    }
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

    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_CORRIDORS === '1';
    if (DEBUG) {
        console.log(`dig_corridor: (${org.x},${org.y}) -> (${dest.x},${dest.y}) nxcor=${nxcor}`);
    }

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
        if (cct++ > 500 || (nxcor && !rn2(35))) {
            if (DEBUG) console.log(`  -> failed: cct=${cct} or rn2(35) abort, npoints=${npoints}`);
            return { success: false, npoints };
        }

        xx += dx;
        yy += dy;

        if (xx >= COLNO - 1 || xx <= 0 || yy <= 0 || yy >= ROWNO - 1) {
            if (DEBUG) console.log(`  -> failed: boundary check (${xx},${yy}), npoints=${npoints}`);
            return { success: false, npoints };
        }

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
                    // C ref: mksobj_at(BOULDER, xx, yy) — place boulder in corridor
                    const otmp = mksobj(BOULDER, true, false);
                    if (otmp) {
                        otmp.ox = xx;
                        otmp.oy = yy;
                        map.objects.push(otmp);
                    }
                }
            }
        } else if (crm.typ !== ftyp && crm.typ !== SCORR) {
            if (DEBUG) console.log(`  -> failed: collision at (${xx},${yy}) typ=${crm.typ}, npoints=${npoints}`);
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
    if (DEBUG) {
        console.log(`  -> success: true, npoints: ${npoints}`);
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
export function makecorridors(map, depth) {
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

// C ref: mkroom.c inside_room() -- check if (x,y) is inside room bounds (including walls)
function inside_room(croom, x, y) {
    return x >= croom.lx - 1 && x <= croom.hx + 1
        && y >= croom.ly - 1 && y <= croom.hy + 1;
}

// C ref: mkroom.c somexy() -- pick random position in room, avoiding subrooms
function somexy(croom, map) {
    let try_cnt = 0;

    // C ref: mkroom.c somexy() irregular path — !edge && roomno == i
    if (croom.irregular) {
        const i = croom.roomnoidx + ROOMOFFSET;
        while (try_cnt++ < 100) {
            const x = somex(croom);
            const y = somey(croom);
            const loc = map.at(x, y);
            if (loc && !loc.edge && loc.roomno === i)
                return { x, y };
        }
        // Exhaustive search fallback
        for (let x = croom.lx; x <= croom.hx; x++) {
            for (let y = croom.ly; y <= croom.hy; y++) {
                const loc = map.at(x, y);
                if (loc && !loc.edge && loc.roomno === i)
                    return { x, y };
            }
        }
        return null;
    }

    if (!croom.nsubrooms) {
        return { x: somex(croom), y: somey(croom) };
    }

    // Check that coords don't fall into a subroom or into a wall
    while (try_cnt++ < 100) {
        const x = somex(croom);
        const y = somey(croom);
        const loc = map.at(x, y);
        if (loc && IS_WALL(loc.typ))
            continue;
        let inSubroom = false;
        for (let i = 0; i < croom.nsubrooms; i++) {
            if (inside_room(croom.sbrooms[i], x, y)) {
                inSubroom = true;
                break;
            }
        }
        if (!inSubroom)
            return { x, y };
    }
    return null;
}

// C ref: mkroom.c somexyspace() -- find accessible space in room
function somexyspace(map, croom) {
    let trycnt = 0;
    let okay;
    do {
        const pos = somexy(croom, map);
        okay = pos && isok(pos.x, pos.y) && !occupied(map, pos.x, pos.y);
        if (okay) {
            const loc = map.at(pos.x, pos.y);
            okay = loc && (loc.typ === ROOM || loc.typ === CORR || loc.typ === ICE);
        }
        if (okay) return pos;
    } while (trycnt++ < 100);
    return null;
}

// C ref: teleport.c collect_coords() — gather coordinates in expanding
// distance rings from (cx,cy), shuffling each ring independently.
// Used by enexto() to find nearby unoccupied positions.
// Returns array of {x,y} coords, RNG-consuming front-to-back Fisher-Yates per ring.
function collect_coords(cx, cy, maxradius) {
    const rowrange = (cy < Math.floor(ROWNO / 2)) ? (ROWNO - 1 - cy) : cy;
    const colrange = (cx < Math.floor(COLNO / 2)) ? (COLNO - 1 - cx) : cx;
    const k = Math.max(rowrange, colrange);
    if (!maxradius) maxradius = k;
    else maxradius = Math.min(maxradius, k);

    const result = [];
    for (let radius = 1; radius <= maxradius; radius++) {
        const ringStart = result.length;
        const lox = cx - radius, hix = cx + radius;
        const loy = cy - radius, hiy = cy + radius;
        for (let y = Math.max(loy, 0); y <= hiy; y++) {
            if (y > ROWNO - 1) break;
            for (let x = Math.max(lox, 1); x <= hix; x++) {
                if (x > COLNO - 1) break;
                // Only edge cells of the ring square
                if (x !== lox && x !== hix && y !== loy && y !== hiy) continue;
                result.push({ x, y });
            }
        }
        // Front-to-back Fisher-Yates shuffle for this ring
        let n = result.length - ringStart;
        let passIdx = ringStart;
        while (n > 1) {
            const swap = rn2(n);
            if (swap) {
                const tmp = result[passIdx];
                result[passIdx] = result[passIdx + swap];
                result[passIdx + swap] = tmp;
            }
            passIdx++;
            n--;
        }
    }
    return result;
}

// C ref: teleport.c goodpos() — simplified for level generation.
// Checks SPACE_POS terrain and no monster at position.
function sp_goodpos(x, y, map) {
    if (!isok(x, y)) return false;
    const loc = map.at(x, y);
    if (!loc || loc.typ <= DOOR) return false; // !SPACE_POS
    // Check no monster at position
    for (const m of map.monsters) {
        if (m.mx === x && m.my === y) return false;
    }
    return true;
}

// C ref: teleport.c enexto() — find nearest valid position to (cx,cy).
// First tries radius 3 (collect_coords with shuffled rings), then full map.
// Always consumes RNG for collect_coords regardless of whether position is found.
export function enexto(cx, cy, map) {
    // First pass: radius 3 (with GP_CHECKSCARY — no effect during mklev)
    const nearCoords = collect_coords(cx, cy, 3);
    for (const cc of nearCoords) {
        if (sp_goodpos(cc.x, cc.y, map)) return cc;
    }
    // Second pass: full map
    const allCoords = collect_coords(cx, cy, 0);
    // Skip the first nearCoords.length entries (already checked, different shuffle order)
    for (let i = nearCoords.length; i < allCoords.length; i++) {
        if (sp_goodpos(allCoords[i].x, allCoords[i].y, map)) return allCoords[i];
    }
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
// Engrave data — parsed at module load from encrypted string constant.
const { texts: ENGRAVE_TEXTS, lineBytes: ENGRAVE_LINE_BYTES, chunksize: ENGRAVE_FILE_CHUNKSIZE } =
    parseEncryptedDataFile(ENGRAVE_FILE_TEXT);

// Rumor data — parsed at module load from encrypted string constant.
// C ref: rumors file has two sections (true + false) with sizes in header.
const { trueTexts: RUMOR_TRUE_TEXTS, trueLineBytes: RUMOR_TRUE_LINE_BYTES, trueSize: RUMOR_TRUE_SIZE,
        falseTexts: RUMOR_FALSE_TEXTS, falseLineBytes: RUMOR_FALSE_LINE_BYTES, falseSize: RUMOR_FALSE_SIZE } =
    parseRumorsFile(RUMORS_FILE_TEXT);

// Padded line size for rumor/engrave files (MD_PAD_RUMORS)
const RUMOR_PAD_LENGTH = 60;

// Epitaph data — parsed at module load from encrypted string constant.
// C ref: engrave.c make_grave() → get_rnd_text(EPITAPHFILE, ...)
const { texts: epitaphTexts, lineBytes: epitaphLineBytes, chunksize: epitaphChunksize } =
    parseEncryptedDataFile(EPITAPH_FILE_TEXT);

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
                        // C ref: mkcorpstat(CORPSE, 0, mkclass(S_HUMAN, 0), xx, yy+dy, TRUE)
                        const mndx = mkclass(S_HUMAN, 0, depth);
                        const corpse = mksobj(CORPSE, true, false);
                        if (corpse && mndx >= 0) {
                            corpse.corpsenm = mndx;
                        }
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
            // C ref: mkroll_launch — mksobj_at(BOULDER, cc.x, cc.y)
            const boulderObj = mksobj(BOULDER, true, false);
            if (boulderObj) {
                boulderObj.ox = launchCoord.x;
                boulderObj.oy = launchCoord.y;
                map.objects.push(boulderObj);
            }
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
export function mktrap(map, num, mktrapflags, croom, tm, depth) {
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
    const x = trap.tx, y = trap.ty;

    // Helper: place object on map at trap position
    function placeObj(obj) {
        obj.ox = x;
        obj.oy = y;
        map.objects.push(obj);
    }

    // Trap-specific item
    // C ref: mklev.c:1818-1836
    let otmp = null;
    switch (trap.ttyp) {
    case ARROW_TRAP:
        otmp = mksobj(ARROW, true, false);
        if (otmp) otmp.opoisoned = 0; // C ref: mklev.c:1820
        break;
    case DART_TRAP:
        otmp = mksobj(DART, true, false);
        break;
    case ROCKTRAP:
        otmp = mksobj(ROCK, true, false);
        break;
    default:
        break;
    }
    if (otmp) placeObj(otmp);

    // Random possession loop
    // C ref: mklev.c:1843-1877
    const classMap = [WEAPON_CLASS, TOOL_CLASS, FOOD_CLASS, GEM_CLASS];
    do {
        const poss_class = classMap[rn2(4)];
        otmp = mkobj(poss_class, false);
        otmp.cursed = true; // C ref: curse(otmp) at mklev.c:1865
        placeObj(otmp);
    } while (!rn2(5));

    // Corpse race selection
    // C ref: mklev.c:1880-1915
    let victim_mnum;
    const race = rn2(15);
    if (race === 0) {
        victim_mnum = PM_ELF;
        if (trap.ttyp === SLP_GAS_TRAP && !(depth <= 2 && rn2(2))) {
            victim_mnum = PM_HUMAN;
        }
    } else if (race >= 1 && race <= 2) {
        victim_mnum = PM_DWARF;
    } else if (race >= 3 && race <= 5) {
        victim_mnum = PM_ORC;
    } else if (race >= 6 && race <= 9) {
        victim_mnum = PM_GNOME;
        if (!rn2(10)) {
            otmp = mksobj(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, true, false);
            otmp.cursed = true; // C ref: curse(otmp) at mklev.c:1905
            placeObj(otmp);
        }
    } else {
        victim_mnum = PM_HUMAN;
    }

    // Human → adventurer conversion
    // C ref: mklev.c:1919-1920
    if (victim_mnum === PM_HUMAN && rn2(25)) {
        victim_mnum = rn1(PM_WIZARD - PM_ARCHEOLOGIST, PM_ARCHEOLOGIST);
    }

    // C ref: mklev.c:1921 — mkcorpstat(CORPSE, NULL, &mons[victim_mnum], ...)
    // Uses mkcorpstat which handles special_corpse restart logic for start_corpse_timeout
    otmp = mkcorpstat(CORPSE, victim_mnum, true);
    // C ref: mklev.c:1922 — age corpse so it's too old to safely eat
    // TAINT_AGE=50; subtracting 51 makes (age + 50 <= moves) true at game start
    otmp.age -= (TAINT_AGE + 1);
    placeObj(otmp);
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
    // C ref: make_grave() → get_rnd_text(EPITAPHFILE, ...) when str=NULL
    // get_rnd_line calls rn2(filechunksize) to pick a random epitaph offset.
    // This only happens when dobell is false (str=NULL); when dobell is true,
    // a fixed "Saved by the bell!" string is used (no RNG).
    if (!dobell) {
        const idx = get_rnd_line_index(
            epitaphLineBytes, epitaphChunksize, RUMOR_PAD_LENGTH);
        // TODO: use epitaph text for grave rendering
        void (epitaphTexts[idx] || epitaphTexts[0]);
    }
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
export function fill_ordinary_room(map, croom, depth, bonusItems) {
    if (croom.rtype !== OROOM && croom.rtype !== THEMEROOM) return;

    // C ref: mklev.c:944-952 — recursively fill subrooms first, before
    // checking needfill. An unfilled outer room shouldn't block filling
    // of a filled inner subroom.
    for (let i = 0; i < croom.nsubrooms; i++) {
        const subroom = croom.sbrooms[i];
        if (subroom) {
            fill_ordinary_room(map, subroom, depth, false);
        }
    }

    if (croom.needfill !== FILL_NORMAL) return;

    // Put a sleeping monster inside (1/3 chance)
    // C ref: (u.uhave.amulet || !rn2(3)) && somexyspace(croom, &pos)
    if (!rn2(3)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            makemon(null, pos.x, pos.y, MM_NOGRP, depth, map);
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
            const mul = rnd(Math.max(Math.floor(30 / Math.max(12 - depth, 2)), 1));
            const amount = 1 + rnd(depth + 2) * mul;
            const gold = mksobj(GOLD_PIECE, true, false);
            if (gold) {
                gold.ox = pos.x; gold.oy = pos.y;
                gold.quan = amount;
                gold.owt = weight(gold);
                map.objects.push(gold);
            }
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
    // C ref: mkcorpstat(STATUE, NULL, NULL, ...) → mksobj calls rndmonnum() internally
    if (!rn2(20)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            const statue = mksobj(STATUE, true, false);
            if (statue) {
                statue.ox = pos.x; statue.oy = pos.y;
                map.objects.push(statue);
            }
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
                const chest = mksobj(rn2(3) ? CHEST : LARGE_BOX, false, false);
                if (chest) { chest.ox = pos.x; chest.oy = pos.y; map.objects.push(chest); }
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
            const box = mksobj(rn2(3) ? LARGE_BOX : CHEST, true, false);
            if (box) {
                box.ox = pos.x; box.oy = pos.y;
                map.objects.push(box);
            }
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
        if (pos) {
            const obj = mkobj(0, true);
            if (obj) { obj.ox = pos.x; obj.oy = pos.y; map.objects.push(obj); }
        }
        trycnt = 0;
        while (!rn2(5)) {
            if (++trycnt > 100) break;
            const pos2 = somexyspace(map, croom);
            if (pos2) {
                const obj2 = mkobj(0, true);
                if (obj2) { obj2.ox = pos2.x; obj2.oy = pos2.y; map.objects.push(obj2); }
            }
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
//   0. role_init: rn2(100) for quest nemesis gender (Archeologist/Wizard only)
//   1. nhlib.lua shuffle(align): rn2(3), rn2(2)
//   2. For each dungeon:
//      a. rn1(range, base) → rn2(range) if range > 0
//      b. parent_dlevel → rn2(num) for non-root, non-unconnected dungeons
//      c. place_level → recursive rn2(npossible) calls
//   3. init_castle_tune: 5 × rn2(7)
//   4. u_init.c: rn2(10)
//   5. nhlua pre_themerooms shuffle: rn2(3), rn2(2)
//   6. bones.c: rn2(3)
export function simulateDungeonInit(roleIndex) {
    // 0. role_init: quest nemesis gender — rn2(100) for roles whose
    // nemesis lacks M2_MALE/M2_FEMALE/M2_NEUTER flags.
    // C ref: role.c:2060 — only Archeologist (Minion of Huhetotl) and
    // Wizard (Dark One) need this call; all other nemeses have explicit gender.
    if (roleIndex === ROLE_ARCHEOLOGIST || roleIndex === ROLE_WIZARD) {
        rn2(100);
    }

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

    // 4. u_init.c u_init() → newpw() + u_init_misc()
    // C ref: exper.c newpw() — rnd(enadv) if role has non-zero energy advance
    const role = roleIndex !== undefined ? roles[roleIndex] : null;
    const enadv = role ? (role.enadv || 0) : 0;
    if (enadv > 0) rnd(enadv);
    // C ref: u_init.c u_init_misc() — rn2(10)
    rn2(10);

    // 5. nhlua pre_themerooms shuffle (loaded when themerms.lua is first used)
    rn2(3); rn2(2);
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
// get_level_extends() + bound_digging() — Mark boundary stone as non-diggable
// C ref: mkmaze.c:1353-1455
// ========================================================================

function get_level_extends(map) {
    // C ref: mkmaze.c:1353-1427
    // Scan from each edge to find the first column/row with non-STONE content.
    // The is_maze_lev flag affects the boundary offset; normal levels use -2/+2.
    const is_maze_lev = false; // normal dungeon levels are not maze levels

    let xmin, xmax, ymin, ymax;
    let found, nonwall;

    // Scan columns left to right for xmin
    found = false; nonwall = false;
    for (xmin = 0; !found && xmin <= COLNO; xmin++) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmin, y)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    xmin -= (nonwall || !is_maze_lev) ? 2 : 1;
    if (xmin < 0) xmin = 0;

    // Scan columns right to left for xmax
    found = false; nonwall = false;
    for (xmax = COLNO - 1; !found && xmax >= 0; xmax--) {
        for (let y = 0; y <= ROWNO - 1; y++) {
            const typ = map.at(xmax, y)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    xmax += (nonwall || !is_maze_lev) ? 2 : 1;
    if (xmax >= COLNO) xmax = COLNO - 1;

    // Scan rows top to bottom for ymin (within xmin..xmax)
    found = false; nonwall = false;
    for (ymin = 0; !found && ymin <= ROWNO; ymin++) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.at(x, ymin)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    ymin -= (nonwall || !is_maze_lev) ? 2 : 1;

    // Scan rows bottom to top for ymax (within xmin..xmax)
    found = false; nonwall = false;
    for (ymax = ROWNO - 1; !found && ymax >= 0; ymax--) {
        for (let x = xmin; x <= xmax; x++) {
            const typ = map.at(x, ymax)?.typ ?? STONE;
            if (typ !== STONE) {
                found = true;
                if (!IS_WALL(typ)) nonwall = true;
            }
        }
    }
    ymax += (nonwall || !is_maze_lev) ? 2 : 1;
    if (ymax >= ROWNO) ymax = ROWNO - 1;

    return { xmin, xmax, ymin, ymax };
}

export function bound_digging(map) {
    // C ref: mkmaze.c:1439-1455
    // Mark boundary stone/wall cells as non-diggable so mineralize skips them.
    const { xmin, xmax, ymin, ymax } = get_level_extends(map);

    for (let x = 0; x < COLNO; x++) {
        for (let y = 0; y < ROWNO; y++) {
            const loc = map.at(x, y);
            if (loc && IS_STWALL(loc.typ)
                && (y <= ymin || y >= ymax || x <= xmin || x >= xmax)) {
                loc.nondiggable = true;
            }
        }
    }
}

// ========================================================================
// mineralize() — Deposit gold and gems in stone walls
// C ref: mklev.c:1437-1530
// ========================================================================

export function mineralize(map, depth) {
    // C ref: mklev.c:1468-1472 — default probabilities
    const goldprob = 20 + Math.floor(depth / 3);
    const gemprob = Math.floor(goldprob / 4);

    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_MINERALIZE === '1';
    let eligible_count = 0;
    let rng_calls = 0;

    // C ref: mklev.c:1490-1529 — scan for eligible stone tiles
    for (let x = 2; x < COLNO - 2; x++) {
        for (let y = 1; y < ROWNO - 1; y++) {
            const loc_yp1 = map.at(x, y + 1);
            if (!loc_yp1 || loc_yp1.typ !== STONE) {
                // <x,y> and <x,y+1> not eligible, skip ahead
                y += 2;
                continue;
            }
            const loc = map.at(x, y);
            if (!loc || loc.typ !== STONE) {
                // <x,y> not eligible, <x,y+1> also not eligible
                y += 1;
                continue;
            }
            // C ref: mklev.c:1496-1503 — check W_NONDIGGABLE and all 8 neighbors
            if (loc.nondiggable) continue;
            if (map.at(x, y - 1)?.typ !== STONE
                || map.at(x + 1, y - 1)?.typ !== STONE
                || map.at(x - 1, y - 1)?.typ !== STONE
                || map.at(x + 1, y)?.typ !== STONE
                || map.at(x - 1, y)?.typ !== STONE
                || map.at(x + 1, y + 1)?.typ !== STONE
                || map.at(x - 1, y + 1)?.typ !== STONE) {
                continue;
            }

            // Eligible stone tile — try to place gold
            eligible_count++;
            rng_calls++;
            if (rn2(1000) < goldprob) {
                const otmp = mksobj(GOLD_PIECE, false, false);
                if (otmp) {
                    otmp.ox = x;
                    otmp.oy = y;
                    otmp.quan = 1 + rnd(goldprob * 3);
                    otmp.owt = weight(otmp);
                    // C ref: !rn2(3) → add_to_buried, else place_object
                    if (rn2(3) !== 0) {
                        map.objects.push(otmp);
                    }
                    // else: buried — don't add to map.objects
                }
            }
            // Try to place gems
            rng_calls++;
            if (rn2(1000) < gemprob) {
                const cnt = rnd(2 + Math.floor(depth / 3));
                for (let i = 0; i < cnt; i++) {
                    const otmp = mkobj(GEM_CLASS, false);
                    if (otmp) {
                        if (otmp.otyp === ROCK) {
                            // C: dealloc_obj(otmp) — discard rocks, no rn2(3)
                        } else {
                            otmp.ox = x;
                            otmp.oy = y;
                            // C ref: !rn2(3) → add_to_buried, else place_object
                            if (rn2(3) !== 0) {
                                map.objects.push(otmp);
                            }
                            // else: buried — don't add to map.objects
                        }
                    }
                }
            }
        }
    }

    if (DEBUG) {
        console.log(`mineralize: depth=${depth}, eligible=${eligible_count}, rng_calls=${rng_calls} (expected 1110 in C)`);
    }
}

// ========================================================================
// mkshop() — pick a room to be a shop and set its type
// C ref: mkroom.c:94-216
// ========================================================================

// C ref: mkroom.c:41-48
function isbig(sroom) {
    return (sroom.hx - sroom.lx + 1) * (sroom.hy - sroom.ly + 1) > 20;
}

// C ref: mkroom.c:640-663
function has_dnstairs_room(croom, map) {
    return map.dnstair.x >= croom.lx && map.dnstair.x <= croom.hx
        && map.dnstair.y >= croom.ly && map.dnstair.y <= croom.hy;
}
function has_upstairs_room(croom, map) {
    return map.upstair.x >= croom.lx && map.upstair.x <= croom.hx
        && map.upstair.y >= croom.ly && map.upstair.y <= croom.hy;
}

// C ref: mkroom.c:1049-1096 — check if room shape traps shopkeeper
function invalid_shop_shape(sroom, map) {
    const doorx = map.doors[sroom.fdoor].x;
    const doory = map.doors[sroom.fdoor].y;
    let insidex = 0, insidey = 0, insidect = 0;

    // Find ROOM squares inside room and adjacent to door
    for (let x = Math.max(doorx - 1, sroom.lx); x <= Math.min(doorx + 1, sroom.hx); x++) {
        for (let y = Math.max(doory - 1, sroom.ly); y <= Math.min(doory + 1, sroom.hy); y++) {
            const loc = map.at(x, y);
            if (loc && loc.typ === ROOM) {
                insidex = x;
                insidey = y;
                insidect++;
            }
        }
    }
    if (insidect < 1) return true;
    if (insidect === 1) {
        // Only 1 square next to door — check if shopkeeper can move elsewhere
        insidect = 0;
        for (let x = Math.max(insidex - 1, sroom.lx); x <= Math.min(insidex + 1, sroom.hx); x++) {
            for (let y = Math.max(insidey - 1, sroom.ly); y <= Math.min(insidey + 1, sroom.hy); y++) {
                if (x === insidex && y === insidey) continue;
                const loc = map.at(x, y);
                if (loc && loc.typ === ROOM) insidect++;
            }
        }
        if (insidect === 1) return true; // shopkeeper trapped
    }
    return false;
}

function mkshop(map) {
    // C ref: mkroom.c:158-179 — find eligible room
    for (const sroom of map.rooms) {
        if (sroom.hx < 0) return;
        if (sroom.rtype !== OROOM) continue;
        if (has_dnstairs_room(sroom, map) || has_upstairs_room(sroom, map)) continue;
        if (sroom.doorct !== 1) continue;
        if (invalid_shop_shape(sroom, map)) continue;

        // Found eligible room — light it
        // C ref: mkroom.c:180-187
        if (!sroom.rlit) {
            for (let x = sroom.lx - 1; x <= sroom.hx + 1; x++) {
                for (let y = sroom.ly - 1; y <= sroom.hy + 1; y++) {
                    const loc = map.at(x, y);
                    if (loc) loc.lit = true;
                }
            }
            sroom.rlit = true;
        }

        // C ref: mkroom.c:189-201 — pick shop type by probability
        let j = rnd(100);
        let i = 0;
        while ((j -= shtypes[i].prob) > 0) i++;

        // Big rooms can't be wand or book shops → general store
        if (isbig(sroom) && (shtypes[i].symb === WAND_CLASS || shtypes[i].symb === SPBOOK_CLASS))
            i = 0;

        sroom.rtype = SHOPBASE + i;
        sroom.needfill = FILL_NORMAL;
        return;
    }
}

// ========================================================================
// Main entry point
// ========================================================================

// Called once at game start to consume the one-time RNG calls that happen
// before any level generation in C: init_objects() + dungeon structure +
// castle tune + u_init + themerooms shuffle.
// C ref: early_init() → o_init.c init_objects(), dungeon.c init_dungeons(),
//        u_init.c u_init(), nhlua pre_themerooms
export function initLevelGeneration(roleIndex) {
    init_objects();
    simulateDungeonInit(roleIndex);
    _themesLoaded = false; // Reset Lua theme state for new game
    setMtInitialized(false); // Reset MT RNG state for new game
}

// C ref: mklev.c makelevel()
/**
 * Generate a level at the specified depth or dungeon coordinates.
 * @param {number} depth - Absolute depth from surface (backward compat)
 * @param {number} [dnum] - Dungeon branch number (optional)
 * @param {number} [dlevel] - Level within branch (optional, 1-based)
 * @returns {GameMap} The generated level
 */
export function makelevel(depth, dnum, dlevel) {
    setLevelDepth(depth);
    resetThemermsState(); // Reset themed room state for new level
    setMtInitialized(false); // Reset MT RNG state - init happens per level, not per session

    // C ref: bones.c getbones() — rn2(3) + bones load pipeline
    // Must happen BEFORE special level check to match C RNG order
    const bonesMap = getbones(null, depth);
    if (bonesMap) return bonesMap;

    // Check for special level if branch coordinates provided
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_MAKELEVEL === '1';
    if (dnum !== undefined && dlevel !== undefined) {
        const special = getSpecialLevel(dnum, dlevel);
        if (special) {
            if (DEBUG) console.log(`Generating special level: ${special.name} at (${dnum}, ${dlevel})`);

            // C ref: mklev.c:365-380 — Lua theme shuffle when loading special level
            // In C, loading oracle.lua triggers themerms.lua load, which does rn2(3), rn2(2)
            if (!_themesLoaded) {
                _themesLoaded = true;
                rn2(3); rn2(2);
            }

            const specialMap = special.generator();
            if (specialMap) {
                return specialMap;
            }
            // If special level generation fails, fall through to procedural
            if (DEBUG) console.warn(`Special level ${special.name} generation failed, using procedural`);
        }
    }

    const map = new GameMap();
    map.clear();

    // C ref: mklev.c:1274-1287 — maze vs rooms decision (else-if chain)
    // The rn2(5) is part of the final condition in the chain
    // For procedural levels: check if In_hell or (rn2(5) && past Medusa)
    const isGehennom = (dnum === 1);
    const mazeRoll = rn2(5); // 0-4, maze if non-zero (80% chance) - C ref: mklev.c:1276
    const isPastMedusa = (dnum === 0 || dnum === undefined) && depth > 25;
    const shouldMakeMaze = isGehennom || (mazeRoll !== 0 && isPastMedusa);

    if (shouldMakeMaze) {
        // C ref: mklev.c:1278 makemaz("")
        makemaz(map, "");
    } else {
        // C ref: mklev.c:1287 makerooms()
        // Initialize rectangle pool for BSP room placement
        init_rect();

        // Make rooms using rect BSP algorithm
        // Note: makerooms() handles the Lua theme load shuffle (rn2(3), rn2(2))
        makerooms(map, depth);
    }

    if (map.nroom === 0) {
        // Fallback: should never happen, but safety
        if (DEBUG) console.warn(`⚠️ makerooms() created 0 rooms! Using fallback single room. This is a bug!`);
        add_room_to_map(map, 10, 5, 20, 10, true, OROOM, false);
    } else if (DEBUG) {
        console.log(`✓ makerooms() created ${map.nroom} rooms`);
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

    // Fix wall types after corridors are dug (needed for structural consistency)
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
            mkshop(map);
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
        // C ref: find_branch_room → somexyspace
        // NOTE: Despite C having rn2(5) after find_branch_room, analysis shows
        // C actually has 5 rooms total, same as JS should have after 5 build_room successes.
        // The rn2(5) is for the bonus item room selection, not room count.
        // So DON'T create an extra branch room - just call somexyspace for RNG alignment.
        const candidateRoom = generate_stairs_find_room(map);
        if (candidateRoom) {
            // Call somexyspace to match C's RNG consumption
            const pos = somexyspace(map, candidateRoom);
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

    // Initialize needfill for ordinary and theme rooms
    // C ref: In C NetHack, OROOM and THEMEROOM get needfill=FILL_NORMAL by default
    // This was missing from the JS port, preventing monster/object generation
    for (let i = 0; i < map.nroom; i++) {
        const croom = map.rooms[i];
        if (croom.rtype === OROOM || croom.rtype === THEMEROOM) {
            croom.needfill = FILL_NORMAL;
        }
    }

    // C ref: mklev.c:1381-1401 — bonus item room selection + fill loop
    // ROOM_IS_FILLABLE: (rtype == OROOM || rtype == THEMEROOM) && needfill == FILL_NORMAL
    const isFillable = (r) => (r.rtype === OROOM || r.rtype === THEMEROOM)
                              && r.needfill === FILL_NORMAL;
    let fillableCount = 0;
    // Only iterate over main rooms (nroom), not subrooms
    for (let i = 0; i < map.nroom; i++) {
        const croom = map.rooms[i];
        if (isFillable(croom)) fillableCount++;
    }
    let bonusCountdown = fillableCount > 0 ? rn2(fillableCount) : -1;

    for (let i = 0; i < map.nroom; i++) {
        const croom = map.rooms[i];
        const fillable = isFillable(croom);
        fill_ordinary_room(map, croom, depth,
                           fillable && bonusCountdown === 0);
        if (fillable) bonusCountdown--;
    }

    // C ref: mklev.c:1405-1407 — second fill_special_room pass for all rooms.
    // This runs AFTER fill_ordinary_room and BEFORE mineralize.
    // Shop stocking comes first, then vault gold.
    // Only iterate over main rooms (nroom), not subrooms
    for (let i = 0; i < map.nroom; i++) {
        const croom = map.rooms[i];
        if (croom.rtype >= SHOPBASE && croom.needfill === FILL_NORMAL) {
            stock_room(croom.rtype - SHOPBASE, croom, map, depth, _gameSeed);
        }
    }
    // For VAULT rooms, gold was already placed during vault creation (first fill),
    // so mkgold just adds to existing gold: only rn2 for amount, no rnd(2) since
    // g_at(x,y) finds the existing gold object and skips mksobj_at/newobj.
    for (let i = 0; i < map.nroom; i++) {
        const croom = map.rooms[i];
        if (croom.rtype === VAULT && croom.needfill === FILL_NORMAL) {
            for (let vx = croom.lx; vx <= croom.hx; vx++) {
                for (let vy = croom.ly; vy <= croom.hy; vy++) {
                    rn2(Math.abs(depth) * 100 || 100);
                }
            }
        }
    }

    // C ref: mklev.c:1533-1539 — level_finalize_topology()
    // bound_digging marks boundary stone as non-diggable before mineralize
    bound_digging(map);
    mineralize(map, depth);

    // C ref: mkmaze.c:644-645 — place branch stairs for branch levels
    // Called from fixup_special() after level generation when Is_branchlev is true
    // For depths 2-4: Gnomish Mines entrance range
    // Parameters: all zeros = search anywhere on map, place anywhere
    // rtype = LR_BRANCH (4) = branch staircase
    if (depth >= 2 && depth <= 4) {
        place_lregion(map, 0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH);
    }

    return map;
}

// =============================================================================
// Region placement (place_lregion) — C ref: mkmaze.c:317-469
// =============================================================================

// Region type constants (C ref: mkmaze.h)
const LR_TELE = 0;
const LR_DOWNTELE = 1;
const LR_UPTELE = 2;
const LR_PORTAL = 3;
const LR_BRANCH = 4;
const LR_UPSTAIR = 5;
const LR_DOWNSTAIR = 6;

// C ref: mkmaze.c:346 — within_bounded_area
// Check if (x,y) is within the inclusive rectangle (lx,ly,hx,hy)
function within_bounded_area(x, y, lx, ly, hx, hy) {
    return x >= lx && x <= hx && y >= ly && y <= hy;
}

// C ref: mkmaze.c:317-332 — is_exclusion_zone
// Check if position is in an exclusion zone for this region type
// Stub implementation: no exclusion zones for now
function is_exclusion_zone(rtype, x, y) {
    // TODO: implement exclusion zones when needed
    // For now, no exclusion zones
    return false;
}

// C ref: mkmaze.c:341-351 — bad_location
// Returns true if location is unsuitable for region placement:
// - occupied by monster/object/trap/stairs/altar/etc.
// - inside restricted region (nlx,nly,nhx,nhy)
// - NOT (corridor on maze level OR room OR air)
function bad_location(map, x, y, nlx, nly, nhx, nhy) {
    // Check if occupied
    if (occupied(map, x, y)) {
        return true;
    }

    // Check if inside restricted region
    if (within_bounded_area(x, y, nlx, nly, nhx, nhy)) {
        return true;
    }

    // Check terrain type - must be CORR (on maze), ROOM, or AIR
    const loc = map.at(x, y);
    if (!loc) return true;

    const typ = loc.typ;
    const isMaze = false; // TODO: check map.flags.is_maze_lev when needed

    // Valid if: (CORR and maze level) OR ROOM OR AIR
    const isValid = (typ === CORR && isMaze) || typ === ROOM || typ === AIR;
    return !isValid;
}

// C ref: mkmaze.c:413-469 — put_lregion_here
// Try to place region at (x,y). Returns true on success.
function put_lregion_here(map, x, y, nlx, nly, nhx, nhy, rtype, oneshot) {
    // Check if location is bad
    if (bad_location(map, x, y, nlx, nly, nhx, nhy) ||
        is_exclusion_zone(rtype, x, y)) {
        if (!oneshot) {
            return false; // Try again
        }
        // In oneshot mode, try to force placement by removing trap
        // (simplified - C has more complex logic here)
        if (bad_location(map, x, y, nlx, nly, nhx, nhy) ||
            is_exclusion_zone(rtype, x, y)) {
            return false;
        }
    }

    // Place the feature based on region type
    const loc = map.at(x, y);
    if (!loc) return false;

    switch (rtype) {
        case LR_TELE:
        case LR_UPTELE:
        case LR_DOWNTELE:
            // Teleport region - not needed for basic implementation
            break;

        case LR_PORTAL:
            // Portal - not needed for basic implementation
            break;

        case LR_DOWNSTAIR:
            loc.typ = STAIRS;
            loc.flags = 0; // down
            map.dnstair = { x, y };
            break;

        case LR_UPSTAIR:
            loc.typ = STAIRS;
            loc.flags = 1; // up
            map.upstair = { x, y };
            break;

        case LR_BRANCH:
            // Branch stairs (entrance to sub-dungeon like Mines)
            // For Gnomish Mines at depth 2-4, this is a down stair
            loc.typ = STAIRS;
            loc.flags = 0; // down (into branch)
            map.dnstair = { x, y };
            break;
    }

    return true;
}

// C ref: mkmaze.c:356-410 — place_lregion
// Place a region (stairs/portal/teleport) at a suitable location
// Parameters:
//   lx,ly,hx,hy: search area (0 = use full level)
//   nlx,nly,nhx,nhy: exclusion area (avoid this rectangle)
//   rtype: region type (LR_BRANCH, LR_TELE, etc.)
export function place_lregion(map, lx, ly, hx, hy, nlx, nly, nhx, nhy, rtype) {
    // Default to full level if lx is 0
    if (!lx) {
        // Note: C code has special handling for LR_BRANCH with rooms,
        // calling place_branch() instead. For minimal implementation,
        // we just use full level bounds.
        lx = 1;
        hx = COLNO - 1;
        ly = 0;
        hy = ROWNO - 1;
    }

    // Clamp to level bounds
    if (lx < 1) lx = 1;
    if (hx > COLNO - 1) hx = COLNO - 1;
    if (ly < 0) ly = 0;
    if (hy > ROWNO - 1) hy = ROWNO - 1;

    // Probabilistic approach: try 200 random locations
    const oneshot = (lx === hx && ly === hy);
    let attempts = 0;
    for (let trycnt = 0; trycnt < 200; trycnt++) {
        const x = rn1((hx - lx) + 1, lx);
        const y = rn1((hy - ly) + 1, ly);
        attempts++;
        if (put_lregion_here(map, x, y, nlx, nly, nhx, nhy, rtype, oneshot)) {
            // Debug: uncomment to see attempt count
            // console.log(`place_lregion succeeded after ${attempts} attempts at (${x},${y})`);
            return;
        }
    }

    // Deterministic fallback: try all positions
    for (let x = lx; x <= hx; x++) {
        for (let y = ly; y <= hy; y++) {
            if (put_lregion_here(map, x, y, nlx, nly, nhx, nhy, rtype, true)) {
                return;
            }
        }
    }

    // If we get here, couldn't place region
    // C code calls impossible() here, we'll just log a warning
    console.warn(`Couldn't place lregion type ${rtype}!`);
}
