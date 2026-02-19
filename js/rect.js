// rect.js -- Rectangle allocation for room placement
// Faithful port of rect.c from NetHack 3.7.
//
// Manages a pool of free rectangles used during level generation.
// Rooms are placed by picking a random free rectangle and splitting the
// remaining space around the allocated room.

import { COLNO, ROWNO } from './config.js';
import { rn2 } from './rng.js';

// cf. rect.c:16-17
export const XLIM = 4;
export const YLIM = 3;

// cf. rect.c:19-21
const n_rects = Math.floor((COLNO * ROWNO) / 30);
let rects = [];
let rect_cnt = 0;

// cf. rect.c:29 — initialization for every new level
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

// cf. rect.c:60 — search index of one precise rect
function get_rect_ind(r) {
    for (let i = 0; i < rect_cnt; i++) {
        if (rects[i].lx === r.lx && rects[i].ly === r.ly &&
            rects[i].hx === r.hx && rects[i].hy === r.hy)
            return i;
    }
    return -1;
}

// cf. rect.c:82 — search a free rect that includes the given one
export function get_rect(r) {
    for (let i = 0; i < rect_cnt; i++) {
        if (r.lx >= rects[i].lx && r.ly >= rects[i].ly &&
            r.hx <= rects[i].hx && r.hy <= rects[i].hy)
            return rects[i];
    }
    return null;
}

// cf. rect.c:104 — get some random rect from the list
export function rnd_rect() {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_THEMEROOMS === '1';
    const DEBUG_POOL = typeof process !== 'undefined' && process.env.DEBUG_RECT_POOL === '1';
    if (DEBUG) {
        const stack = new Error().stack.split('\n')[2].trim();
        console.log(`  rnd_rect: ENTRY rect_cnt=${rect_cnt} from ${stack}`);
    }
    if (DEBUG_POOL) {
        console.log(`  rnd_rect: pool=${rect_cnt} [${rects.slice(0, rect_cnt).map(r => `(${r.lx},${r.ly})-(${r.hx},${r.hy})`).join(', ')}]`);
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

// cf. rect.c:116 — intersection of two rectangles, or null
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

// cf. rect.c:133 — bounding rect containing both r1 and r2
export function rect_bounds(r1, r2) {
    return {
        lx: Math.min(r1.lx, r2.lx),
        ly: Math.min(r1.ly, r2.ly),
        hx: Math.max(r1.hx, r2.hx),
        hy: Math.max(r1.hy, r2.hy)
    };
}

// cf. rect.c:147 — remove a rectangle from the list
function remove_rect(r) {
    const ind = get_rect_ind(r);
    if (ind >= 0) {
        rects[ind] = rects[--rect_cnt];
    }
}

// cf. rect.c:161 — add a rect to the list
function add_rect(r) {
    if (rect_cnt >= n_rects) return;
    if (get_rect(r)) return; // already contained in another rect
    rects[rect_cnt] = { lx: r.lx, ly: r.ly, hx: r.hx, hy: r.hy };
    rect_cnt++;
}

// cf. rect.c:182 — split r1 around allocated r2
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

// Helper for sp_lev.js — split all rects around a fixed-position room.
// Not in C's rect.c but factored out from sp_lev.c/dungeon.js usage pattern.
export function update_rect_pool_for_room(room) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_RECTS === '1';
    const old_cnt = rect_cnt;

    // C ref: sp_lev.c:1635-1638 — r2 bounds include border (x-1, y-1) to (x+w, y+h)
    const r2 = {
        lx: room.lx - 1,
        ly: room.ly - 1,
        hx: room.hx + 1,
        hy: room.hy + 1
    };

    // Walk backwards since split_rects modifies the pool
    for (let i = rect_cnt - 1; i >= 0; i--) {
        const r = intersect(rects[i], r2);
        if (r) {
            split_rects(rects[i], r);
        }
    }

    if (DEBUG && rect_cnt !== old_cnt) {
        console.log(`  update_rect_pool_for_room: split around (${r2.lx},${r2.ly})-(${r2.hx},${r2.hy}), pool ${old_cnt}->${rect_cnt}`);
    }
}
