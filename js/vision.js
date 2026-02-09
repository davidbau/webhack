// vision.js -- Field of view / vision system
// C-faithful port of NetHack's Algorithm C from vision.c
// Replaces the simplified rule-based approach with the actual
// recursive line-of-sight scanner used by C NetHack.

import { COLNO, ROWNO, DOOR, SDOOR, POOL,
         IS_WALL, IS_DOOR, isok,
         D_CLOSED, D_LOCKED } from './config.js';
import { BOULDER } from './objects.js';

// Vision bit flags (C ref: vision.h)
const COULD_SEE = 0x1;
const IN_SIGHT  = 0x2;

// Module-level state for Algorithm C (C ref: vision.c lines 1125-1133)
let start_row, start_col, step;
let cs_rows, cs_left, cs_right;
let viz_clear;  // reference to FOV instance's viz_clear

function sign(z) { return z < 0 ? -1 : (z ? 1 : 0); }

// ========================================================================
// does_block() -- what blocks vision
// C ref: vision.c:152-202
// ========================================================================
function doesBlock(map, x, y) {
    const loc = map.at(x, y);
    if (!loc) return true;
    // C: IS_OBSTRUCTED(typ) = typ < POOL (types 0-15: stone, walls, tree, sdoor, scorr)
    if (loc.typ < POOL) return true;
    // Closed/locked doors block
    if (IS_DOOR(loc.typ) && (loc.flags & (D_CLOSED | D_LOCKED))) return true;
    // Boulders block light
    const objs = map.objectsAt(x, y);
    for (const obj of objs) {
        if (obj.otyp === BOULDER) return true;
    }
    return false;
}

// ========================================================================
// Bresenham path functions -- check line-of-sight between two points
// C ref: vision.c:1407-1590
// Each checks intermediate points only (not endpoints).
// Returns 1 if clear, 0 if blocked.
// ========================================================================

// Quadrant I: target is right and up (scol < x2, srow > y2)
// C ref: vision.c:1407-1449
function q1_path(srow, scol, y2, x2) {
    let x = scol, y = srow;
    const dx = x2 - x;
    const dy = y - y2;
    const dxs = dx << 1;
    const dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x++; err -= dys; }
            y--;
            err += dxs;
            if (!viz_clear[y][x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y--; err -= dxs; }
            x++;
            err += dys;
            if (!viz_clear[y][x]) return 0;
        }
    }
    return 1;
}

// Quadrant IV: target is right and down (scol < x2, srow < y2)
// C ref: vision.c:1454-1496
function q4_path(srow, scol, y2, x2) {
    let x = scol, y = srow;
    const dx = x2 - x;
    const dy = y2 - y;
    const dxs = dx << 1;
    const dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x++; err -= dys; }
            y++;
            err += dxs;
            if (!viz_clear[y][x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y++; err -= dxs; }
            x++;
            err += dys;
            if (!viz_clear[y][x]) return 0;
        }
    }
    return 1;
}

// Quadrant II: target is left and up (scol > x2, srow > y2)
// C ref: vision.c:1501-1543
function q2_path(srow, scol, y2, x2) {
    let x = scol, y = srow;
    const dx = x - x2;
    const dy = y - y2;
    const dxs = dx << 1;
    const dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x--; err -= dys; }
            y--;
            err += dxs;
            if (!viz_clear[y][x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y--; err -= dxs; }
            x--;
            err += dys;
            if (!viz_clear[y][x]) return 0;
        }
    }
    return 1;
}

// Quadrant III: target is left and down (scol > x2, srow < y2)
// C ref: vision.c:1548-1590
function q3_path(srow, scol, y2, x2) {
    let x = scol, y = srow;
    const dx = x - x2;
    const dy = y2 - y;
    const dxs = dx << 1;
    const dys = dy << 1;
    if (dy > dx) {
        let err = dxs - dy;
        for (let k = dy - 1; k; k--) {
            if (err >= 0) { x--; err -= dys; }
            y++;
            err += dxs;
            if (!viz_clear[y][x]) return 0;
        }
    } else {
        let err = dys - dx;
        for (let k = dx - 1; k; k--) {
            if (err >= 0) { y++; err -= dxs; }
            x--;
            err += dys;
            if (!viz_clear[y][x]) return 0;
        }
    }
    return 1;
}

// clear_path() -- check LOS between two arbitrary points
// C ref: vision.c:1601-1625
export function clear_path(col1, row1, col2, row2) {
    if (col1 < col2) {
        if (row1 > row2) return q1_path(row1, col1, row2, col2);
        else return q4_path(row1, col1, row2, col2);
    } else {
        if (row1 > row2) return q2_path(row1, col1, row2, col2);
        else if (row1 === row2 && col1 === col2) return 1;
        else return q3_path(row1, col1, row2, col2);
    }
}

// ========================================================================
// right_side() -- recursive scanner for right half of vision
// C ref: vision.c:1654-1840
// ========================================================================
function right_side(row, left, right_mark) {
    const nrow = row + step;
    const deeper = nrow >= 0 && nrow < ROWNO;
    const rowp = cs_rows[row];
    const row_min_idx = row;

    while (left <= right_mark) {
        let right_edge = right_ptrs_arr[row][left];
        if (right_edge > COLNO - 1) right_edge = COLNO - 1;

        if (!viz_clear[row][left]) {
            // Blocked segment -- mark walls as COULD_SEE
            // Corner kludge: extend beyond right_mark if previous row was clear
            if (right_edge > right_mark) {
                right_edge = viz_clear[row - step]
                    ? (viz_clear[row - step][right_mark] ? right_mark + 1 : right_mark)
                    : right_mark;
            }
            for (let i = left; i <= right_edge; i++)
                rowp[i] = COULD_SEE;
            if (cs_left[row] > left) cs_left[row] = left;
            if (cs_right[row] < right_edge) cs_right[row] = right_edge;
            left = right_edge + 1;
            continue;
        }

        // Clear segment -- find visible range
        if (left !== start_col) {
            // Find left edge of visible area
            for (; left <= right_edge; left++) {
                let result;
                if (step < 0) result = q1_path(start_row, start_col, row, left);
                else result = q4_path(start_row, start_col, row, left);
                if (result) break;
            }

            if (left > COLNO - 1) return;
            if (left === COLNO - 1) {
                rowp[COLNO - 1] = COULD_SEE;
                if (cs_right[row] < COLNO - 1) cs_right[row] = COLNO - 1;
                return;
            }
            if (left >= right_edge) {
                left = right_edge;
                continue;
            }
        }

        // Find right edge of visible area
        let right;
        if (right_mark < right_edge) {
            for (right = right_mark; right <= right_edge; right++) {
                let result;
                if (step < 0) result = q1_path(start_row, start_col, row, right);
                else result = q4_path(start_row, start_col, row, right);
                if (!result) break;
            }
            --right;
        } else {
            right = right_edge;
        }

        if (left <= right) {
            // Adjacent vertical wall special case
            if (left === right && left === start_col && start_col < (COLNO - 1)
                && !viz_clear[row][start_col + 1])
                right = start_col + 1;

            if (right > COLNO - 1) right = COLNO - 1;
            // Mark visible range
            for (let i = left; i <= right; i++)
                rowp[i] = COULD_SEE;
            if (cs_left[row] > left) cs_left[row] = left;
            if (cs_right[row] < right) cs_right[row] = right;

            // Recurse
            if (deeper) right_side(nrow, left, right);
            left = right + 1;
        }
    }
}

// Need a module-level reference for right_ptrs and left_ptrs
let right_ptrs_arr, left_ptrs_arr;

// ========================================================================
// left_side() -- recursive scanner for left half of vision
// C ref: vision.c:1846-1974
// ========================================================================
function left_side(row, left_mark, right) {
    const nrow = row + step;
    const deeper = nrow >= 0 && nrow < ROWNO;
    const rowp = cs_rows[row];
    let lim_min = 0;

    while (right >= left_mark) {
        let left_edge = left_ptrs_arr[row][right];
        if (left_edge < lim_min) left_edge = lim_min;

        if (!viz_clear[row][right]) {
            // Blocked segment
            if (left_edge < left_mark) {
                left_edge = viz_clear[row - step]
                    ? (viz_clear[row - step][left_mark] ? left_mark - 1 : left_mark)
                    : left_mark;
            }
            for (let i = left_edge; i <= right; i++)
                rowp[i] = COULD_SEE;
            if (cs_left[row] > left_edge) cs_left[row] = left_edge;
            if (cs_right[row] < right) cs_right[row] = right;
            right = left_edge - 1;
            continue;
        }

        // Clear segment
        if (right !== start_col) {
            for (; right >= left_edge; right--) {
                let result;
                if (step < 0) result = q2_path(start_row, start_col, row, right);
                else result = q3_path(start_row, start_col, row, right);
                if (result) break;
            }

            if (right < lim_min) return;
            if (right === lim_min) {
                rowp[lim_min] = COULD_SEE;
                if (cs_left[row] > lim_min) cs_left[row] = lim_min;
                return;
            }
            if (right <= left_edge) {
                right = left_edge;
                continue;
            }
        }

        // Find left edge
        let left;
        if (left_mark > left_edge) {
            for (left = left_mark; left >= left_edge; --left) {
                let result;
                if (step < 0) result = q2_path(start_row, start_col, row, left);
                else result = q3_path(start_row, start_col, row, left);
                if (!result) break;
            }
            left++;
        } else {
            left = left_edge;
        }

        if (left <= right) {
            // Adjacent vertical wall special case
            if (left === right && right === start_col && start_col > 0
                && !viz_clear[row][start_col - 1])
                left = start_col - 1;

            if (left < lim_min) left = lim_min;
            for (let i = left; i <= right; i++)
                rowp[i] = COULD_SEE;
            if (cs_left[row] > left) cs_left[row] = left;
            if (cs_right[row] < right) cs_right[row] = right;

            if (deeper) left_side(nrow, left, right);
            right = left - 1;
        }
    }
}

// ========================================================================
// view_from() -- Algorithm C entry point
// C ref: vision.c:1991-2080
// ========================================================================
function view_from(srow, scol, loc_cs_rows, left_most, right_most) {
    start_col = scol;
    start_row = srow;
    cs_rows = loc_cs_rows;
    cs_left = left_most;
    cs_right = right_most;

    // Determine starting row extent
    let left, right;
    if (viz_clear[srow][scol]) {
        left = left_ptrs_arr[srow][scol];
        right = right_ptrs_arr[srow][scol];
    } else {
        // In stone: see adjacent squares
        left = (!scol) ? 0
            : (viz_clear[srow][scol - 1] ? left_ptrs_arr[srow][scol - 1] : scol - 1);
        right = (scol === COLNO - 1) ? COLNO - 1
            : (viz_clear[srow][scol + 1] ? right_ptrs_arr[srow][scol + 1] : scol + 1);
    }

    // Mark starting row as COULD_SEE
    const rowp = cs_rows[srow];
    for (let i = left; i <= right; i++)
        rowp[i] = COULD_SEE;
    cs_left[srow] = left;
    cs_right[srow] = right;

    // Scan downward
    let nrow;
    if ((nrow = srow + 1) < ROWNO) {
        step = 1;
        if (scol < COLNO - 1) right_side(nrow, scol, right);
        if (scol) left_side(nrow, left, scol);
    }

    // Scan upward
    if ((nrow = srow - 1) >= 0) {
        step = -1;
        if (scol < COLNO - 1) right_side(nrow, scol, right);
        if (scol) left_side(nrow, left, scol);
    }
}

// ========================================================================
// FOV class
// ========================================================================
export class FOV {
    constructor() {
        // visible[x][y] = true if currently visible (public API)
        this.visible = [];
        for (let x = 0; x < COLNO; x++) {
            this.visible[x] = new Array(ROWNO).fill(false);
        }
        this._map = null;
    }

    // Build viz_clear, left_ptrs, right_ptrs from map terrain
    // C ref: vision.c:210-265 vision_reset()
    visionReset(map) {
        this._map = map;
        const vc = [];
        const lp = [];
        const rp = [];
        for (let y = 0; y < ROWNO; y++) {
            vc[y] = new Uint8Array(COLNO);
            lp[y] = new Int16Array(COLNO);
            rp[y] = new Int16Array(COLNO);
        }

        for (let y = 0; y < ROWNO; y++) {
            let dig_left = 0;
            let block = true; // position (0,y) is always stone
            for (let x = 1; x < COLNO; x++) {
                const isBlocked = doesBlock(map, x, y);
                if (block !== isBlocked) {
                    if (block) {
                        // Was blocked, now clear: set ptrs for blocked segment
                        for (let i = dig_left; i < x; i++) {
                            lp[y][i] = dig_left;
                            rp[y][i] = x - 1;
                        }
                    } else {
                        // Was clear, now blocked: set ptrs for clear segment
                        let i = dig_left;
                        if (dig_left) dig_left--;
                        for (; i < x; i++) {
                            lp[y][i] = dig_left;
                            rp[y][i] = x;
                            vc[y][i] = 1;
                        }
                    }
                    dig_left = x;
                    block = !block;
                }
            }
            // Handle right boundary
            let i = dig_left;
            if (!block && dig_left) dig_left--;
            for (; i < COLNO; i++) {
                lp[y][i] = dig_left;
                rp[y][i] = COLNO - 1;
                vc[y][i] = block ? 0 : 1;
            }
        }

        this.viz_clear = vc;
        this.left_ptrs = lp;
        this.right_ptrs = rp;
    }

    // Recompute field of view from player position
    // C ref: vision.c:511-846 vision_recalc()
    compute(gameMap, px, py) {
        // Build lookup tables (once per level, or rebuild each time for simplicity)
        this.visionReset(gameMap);

        // Set module-level references for the recursive functions
        viz_clear = this.viz_clear;
        right_ptrs_arr = this.right_ptrs;
        left_ptrs_arr = this.left_ptrs;

        // Allocate cs_array[ROWNO][COLNO] for COULD_SEE/IN_SIGHT bits
        const cs = [];
        const csLeft = new Int16Array(ROWNO).fill(COLNO);
        const csRight = new Int16Array(ROWNO).fill(0);
        for (let y = 0; y < ROWNO; y++) {
            cs[y] = new Uint8Array(COLNO);
        }

        // Run Algorithm C to compute COULD_SEE
        view_from(py, px, cs, csLeft, csRight);

        // Apply night vision (range 1): adjacent squares with COULD_SEE get IN_SIGHT
        // C ref: vision.c:670-699 (u.nv_range = 1 for standard hero)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = px + dx, ny = py + dy;
                if (nx >= 0 && nx < COLNO && ny >= 0 && ny < ROWNO) {
                    if (cs[ny][nx]) cs[ny][nx] |= IN_SIGHT;
                }
            }
        }

        // Lighting loop: COULD_SEE + lit → IN_SIGHT
        // C ref: vision.c:727-829
        for (let row = 0; row < ROWNO; row++) {
            for (let col = 0; col < COLNO; col++) {
                if (cs[row][col] & IN_SIGHT) {
                    // Already visible via night vision — nothing more to do
                } else if (cs[row][col] & COULD_SEE) {
                    const loc = gameMap.at(col, row);
                    if (loc && loc.lit) {
                        // Door/wall special case: only visible if adjacent square
                        // toward hero is also lit (prevents seeing doors at end
                        // of dark hallways)
                        // C ref: vision.c:760-784
                        if ((IS_DOOR(loc.typ) || loc.typ === SDOOR || IS_WALL(loc.typ))
                            && !this.viz_clear[row][col]) {
                            const dx = sign(px - col);
                            const dy = sign(py - row);
                            const adjCol = col + dx, adjRow = row + dy;
                            if (adjCol >= 0 && adjCol < COLNO && adjRow >= 0 && adjRow < ROWNO) {
                                const adj = gameMap.at(adjCol, adjRow);
                                if (adj && adj.lit) {
                                    cs[row][col] |= IN_SIGHT;
                                }
                            }
                        } else {
                            cs[row][col] |= IN_SIGHT;
                        }
                    }
                }
            }
        }

        // Store cs_array for couldsee() checks
        this._cs = cs;

        // Copy to visible[x][y] for canSee() API
        for (let x = 0; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                this.visible[x][y] = !!(cs[y][x] & IN_SIGHT);
            }
        }
    }

    // Can the player see position (x, y)?
    canSee(x, y) {
        if (x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return false;
        return this.visible[x][y];
    }

    // Could the player see this position (LOS only, ignoring lighting)?
    // C ref: vision.h #define couldsee(x, y) ((gv.viz_array[y][x] & COULD_SEE) != 0)
    couldSee(x, y) {
        if (!this._cs || x < 0 || x >= COLNO || y < 0 || y >= ROWNO) return false;
        return !!(this._cs[y][x] & COULD_SEE);
    }
}

// Map-based LOS check for when viz_clear tables aren't available
// (e.g., monmove tests that don't run the full FOV pipeline)
function is_clear_map(map, x, y) {
    const loc = map.at(x, y);
    if (!loc) return false;
    if (loc.typ < POOL) return false;
    if (IS_DOOR(loc.typ) && (loc.flags & (D_CLOSED | D_LOCKED))) return false;
    return true;
}

function clear_path_map(map, col1, row1, col2, row2) {
    // Bresenham LOS using map lookups instead of viz_clear table
    const dx = col2 - col1;
    const dy = row2 - row1;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    let x = col1, y = row1;
    if (ady > adx) {
        let err = (adx << 1) - ady;
        for (let k = ady - 1; k > 0; k--) {
            if (err >= 0) { x += sx; err -= ady << 1; }
            y += sy;
            err += adx << 1;
            if (!is_clear_map(map, x, y)) return false;
        }
    } else if (adx > 0) {
        let err = (ady << 1) - adx;
        for (let k = adx - 1; k > 0; k--) {
            if (err >= 0) { y += sy; err -= adx << 1; }
            x += sx;
            err += ady << 1;
            if (!is_clear_map(map, x, y)) return false;
        }
    }
    return true;
}

// Monster can see target position
// C ref: vision.h #define m_cansee(mtmp, x2, y2) clear_path(mtmp->mx, mtmp->my, x2, y2)
export function m_cansee(mon, map, x2, y2) {
    if (viz_clear) return !!clear_path(mon.mx, mon.my, x2, y2);
    return clear_path_map(map, mon.mx, mon.my, x2, y2);
}

// Could the player see this position (LOS only, ignoring lighting)
// C ref: vision.h #define couldsee(x, y) ((gv.viz_array[y][x] & COULD_SEE) != 0)
export function couldsee(map, player, x, y) {
    if (viz_clear) return !!clear_path(player.x, player.y, x, y);
    return clear_path_map(map, player.x, player.y, x, y);
}

// C ref: vision.c:2095-2137 — do_clear_area
// Compute LOS from (scol, srow) and call func(x, y, arg) for each visible
// position within range. Used by dog_goal's wantdoor search.
export function do_clear_area(fov, map, scol, srow, range, func, arg) {
    // Ensure viz_clear tables are available (lazy init from map if needed)
    if (!fov.viz_clear && map) fov.visionReset(map);
    if (!fov.viz_clear) return;

    // Set module-level table references for view_from
    viz_clear = fov.viz_clear;
    right_ptrs_arr = fov.right_ptrs;
    left_ptrs_arr = fov.left_ptrs;

    // Allocate temp arrays for view_from (separate from hero's _cs)
    const tmpCs = [];
    const tmpLeft = new Int16Array(ROWNO).fill(COLNO);
    const tmpRight = new Int16Array(ROWNO).fill(0);
    for (let y = 0; y < ROWNO; y++) tmpCs[y] = new Uint8Array(COLNO);

    // Run Algorithm C from center position
    view_from(srow, scol, tmpCs, tmpLeft, tmpRight);

    // C ref: vision.c circle_data[45..54] — horizontal limits for range 9
    const circle_9 = [9, 9, 9, 9, 8, 8, 7, 6, 5, 3];

    const ymin = Math.max(0, srow - range);
    const ymax = Math.min(ROWNO - 1, srow + range);
    for (let y = ymin; y <= ymax; y++) {
        if (tmpLeft[y] <= tmpRight[y]) {
            const offset = Math.abs(srow - y);
            const xlim = circle_9[offset] || 0;
            const xmin = Math.max(1, Math.max(scol - xlim, tmpLeft[y]));
            const xmax = Math.min(COLNO - 1, Math.min(scol + xlim, tmpRight[y]));
            for (let x = xmin; x <= xmax; x++) {
                if (tmpCs[y][x] & COULD_SEE) {
                    func(x, y, arg);
                }
            }
        }
    }
}
