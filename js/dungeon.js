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
    POOL, TREE, IRONBARS, LAVAPOOL, ICE,
    D_NODOOR, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED,
    DIR_N, DIR_S, DIR_E, DIR_W, DIR_180,
    xdir, ydir,
    OROOM, VAULT, MAXNROFROOMS, ROOMOFFSET,
    IS_WALL, IS_DOOR, IS_ROCK, IS_ROOM, IS_OBSTRUCTED, IS_FURNITURE,
    IS_POOL, ACCESSIBLE, isok
} from './config.js';
import { GameMap, makeRoom } from './map.js';
import { rn2, rnd, rn1, d } from './rng.js';

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
function check_room(map, lowx, ddx, lowy, ddy, vault) {
    let hix = lowx + ddx, hiy = lowy + ddy;
    const xlim = XLIM + (vault ? 1 : 0);
    const ylim = YLIM + (vault ? 1 : 0);

    if (lowx < 3) lowx = 3;
    if (lowy < 2) lowy = 2;
    if (hix > COLNO - 3) hix = COLNO - 3;
    if (hiy > ROWNO - 3) hiy = ROWNO - 3;

    for (;;) { // C uses goto chk; for retry
        if (hix <= lowx || hiy <= lowy)
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
function create_room(map, x, y, w, h, xal, yal, rtype, rlit, depth) {
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
            const result = check_room(map, xabs, dx, yabs, dy, vault);
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

        // Actually create the room
        add_room_to_map(map, xabs, yabs, xabs + wtmp - 1, yabs + htmp - 1,
                        lit, rtype, false);
        return true;

    } while (++trycnt <= 500);

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
    map.rooms.push(croom);
    map.nroom = map.rooms.length;
    do_room_or_subroom(map, croom, lowx, lowy, hix, hiy, lit, rtype,
                       special, true);
}

// C ref: mklev.c sort_rooms()
function sort_rooms(map) {
    const n = map.nroom;

    // Build old-to-new index mapping
    const oldIndices = map.rooms.map((r, i) => i);
    map.rooms.sort((a, b) => a.lx - b.lx);

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

// C ref: mklev.c makerooms()
function makerooms(map, depth) {
    let tried_vault = false;

    // Make rooms until satisfied (no more rects available)
    // C ref: mklev.c:393-417
    while (map.nroom < (MAXNROFROOMS - 1) && rnd_rect()) {
        if (map.nroom >= Math.floor(MAXNROFROOMS / 6) && rn2(2)
            && !tried_vault) {
            tried_vault = true;
            // Vault creation: create_room(-1, -1, 2, 2, -1, -1, VAULT, TRUE)
            // Create the vault, then mark it as not needing corridors.
            // In C, the vault is a disconnected room accessed via teleportation.
            if (create_room(map, -1, -1, 2, 2, -1, -1, VAULT, true, depth)) {
                const vaultRoom = map.rooms[map.nroom - 1];
                vaultRoom.needjoining = false;
            }
        } else {
            if (!create_room(map, -1, -1, -1, -1, -1, -1, OROOM, -1, depth))
                break;
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

    // For irregular rooms, walk inward -- skip for now (regular rooms only)
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
                    // Would place boulder -- skip for now
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
    return ((!has_dnstairs && !has_upstairs) || phase < 1)
        && (croom.rtype === OROOM || phase < 2);
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
            // Skip trap creation for now
            dosdoor(map, xx, yy, aroom, SDOOR, depth);
        } else {
            rm.typ = CORR;
            if (rn2(7)) {
                dosdoor(map, xx, yy, aroom, rn2(5) ? SDOOR : DOOR, depth);
            } else {
                if (!rn2(5) && IS_WALL(map.at(xx, yy).typ)) {
                    map.at(xx, yy).typ = IRONBARS;
                    if (rn2(3)) {
                        // Would make corpse -- skip for now
                    }
                }
                // Would place scroll of teleportation -- skip
                if (!rn2(3)) {
                    // Would place random object -- skip
                }
            }
        }
        return;
    }
}

// C ref: mklev.c make_niches()
function make_niches(map, depth) {
    let ct = rnd(Math.floor(map.nroom / 2) + 1);
    const ltptr = (depth > 15);
    const vamp = (depth > 5 && depth < 25);

    while (ct--) {
        if (ltptr && !rn2(6)) {
            makeniche(map, depth, 0); // TELEP_TRAP simplified
        } else if (vamp && !rn2(6)) {
            makeniche(map, depth, 0); // TRAPDOOR simplified
        } else {
            makeniche(map, depth, 0);
        }
    }
}

// C ref: mklev.c fill_ordinary_room() (simplified)
function fill_ordinary_room(map, croom, depth) {
    if (croom.rtype !== OROOM) return;

    // Put a sleeping monster inside (1/3 chance)
    if (!rn2(3)) {
        const pos = somexyspace(map, croom);
        // Would call makemon() -- skip for now
    }

    // Traps (simplified: skip)
    const x = 8 - Math.floor(depth / 6);
    const trapChance = Math.max(x, 2);
    // C: while (!rn2(x) && trycnt < 1000) mktrap(...)
    // Consume same PRNG values
    let trycnt = 0;
    while (!rn2(trapChance) && (++trycnt < 1000)) {
        // Would place trap -- skip for now
    }

    // Gold (1/3 chance)
    if (!rn2(3)) {
        const pos = somexyspace(map, croom);
        // Would place gold -- skip
    }

    // Fountain (1/10 chance)
    if (!rn2(10)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            const loc = map.at(pos.x, pos.y);
            if (loc && !bydoor(map, pos.x, pos.y)) {
                loc.typ = FOUNTAIN;
                map.flags.nfountains++;
            }
        }
    }

    // Sink (1/60 chance)
    if (!rn2(60)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            const loc = map.at(pos.x, pos.y);
            if (loc && !bydoor(map, pos.x, pos.y)) {
                loc.typ = SINK;
                map.flags.nsinks++;
            }
        }
    }

    // Altar (1/60 chance)
    if (!rn2(60)) {
        const pos = somexyspace(map, croom);
        if (pos) {
            const loc = map.at(pos.x, pos.y);
            if (loc && !bydoor(map, pos.x, pos.y))
                loc.typ = ALTAR;
        }
    }

    // Grave
    const graveChance = 80 - (depth * 2);
    if (!rn2(Math.max(graveChance, 2))) {
        const pos = somexyspace(map, croom);
        if (pos) {
            const loc = map.at(pos.x, pos.y);
            if (loc && !bydoor(map, pos.x, pos.y))
                loc.typ = GRAVE;
        }
    }

    // Statue (1/20 chance)
    if (!rn2(20)) {
        const pos = somexyspace(map, croom);
        // Would place statue -- skip
    }
}

// ========================================================================
// Wall fixup
// ========================================================================

// C ref: mklev.c wallification() -- fix wall types in a region
function wallify(map, x1, y1, x2, y2) {
    for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
            const loc = map.at(x, y);
            if (loc && IS_WALL(loc.typ)) {
                setWallType(map, x, y);
            }
        }
    }
}

// C ref: mklev.c wallification() -- full map wall fixup
export function wallification(map) {
    for (let x = 1; x < COLNO - 1; x++) {
        for (let y = 1; y < ROWNO - 1; y++) {
            const loc = map.at(x, y);
            if (loc && IS_WALL(loc.typ)) {
                setWallType(map, x, y);
            }
        }
    }
}

// Determine the correct wall type for a position based on neighbors
function setWallType(map, x, y) {
    const loc = map.at(x, y);
    if (!loc || !IS_WALL(loc.typ)) return;

    const above = isok(x, y - 1) ? map.at(x, y - 1) : null;
    const below = isok(x, y + 1) ? map.at(x, y + 1) : null;
    const left  = isok(x - 1, y) ? map.at(x - 1, y) : null;
    const right = isok(x + 1, y) ? map.at(x + 1, y) : null;

    const hasAbove = above && IS_WALL(above.typ);
    const hasBelow = below && IS_WALL(below.typ);
    const hasLeft  = left  && IS_WALL(left.typ);
    const hasRight = right && IS_WALL(right.typ);

    const connections = [hasAbove, hasBelow, hasLeft, hasRight]
        .filter(Boolean).length;

    if (connections >= 3) {
        if (!hasAbove) { loc.typ = TUWALL; }
        else if (!hasBelow) { loc.typ = TDWALL; }
        else if (!hasLeft)  { loc.typ = TLWALL; }
        else if (!hasRight) { loc.typ = TRWALL; }
        else { loc.typ = CROSSWALL; }
    } else if (hasAbove && hasRight && !hasBelow && !hasLeft) {
        loc.typ = BLCORNER;
    } else if (hasAbove && hasLeft && !hasBelow && !hasRight) {
        loc.typ = BRCORNER;
    } else if (hasBelow && hasRight && !hasAbove && !hasLeft) {
        loc.typ = TLCORNER;
    } else if (hasBelow && hasLeft && !hasAbove && !hasRight) {
        loc.typ = TRCORNER;
    }
    // Otherwise leave as HWALL or VWALL
}

// ========================================================================
// Main entry point
// ========================================================================

// C ref: mklev.c makelevel()
export function generateLevel(depth) {
    const map = new GameMap();
    map.clear();

    // Initialize rectangle pool for BSP room placement
    init_rect();

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

    // Fill rooms with contents
    // C ref: mklev.c:1394-1401
    for (const croom of map.rooms) {
        fill_ordinary_room(map, croom, depth);
    }

    // Light rooms based on depth
    // C ref: done inside do_room_or_subroom via litstate_rnd
    // (Already handled during room creation)

    return map;
}
