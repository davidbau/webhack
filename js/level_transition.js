// level_transition.js -- Level entry placement rules
// C ref: movement between levels places hero on corresponding stairs.

import { ACCESSIBLE, COLNO, ROWNO } from './config.js';
import { rn1 } from './rng.js';
import { deltrap } from './dungeon.js';
import {
    CORR, ROOM, AIR,
    IS_FURNITURE, IS_LAVA, IS_POOL, MAGIC_PORTAL, VIBRATING_SQUARE,
} from './config.js';

function isTeleportArrivalBlocked(map, x, y) {
    if (map?.trapAt?.(x, y)) return true;
    const loc = map?.at?.(x, y);
    if (!loc) return true;
    if (IS_FURNITURE(loc.typ)) return true;
    if (IS_LAVA(loc.typ) || IS_POOL(loc.typ)) return true;
    if (map._isInvocationLevel && map._invPos
        && x === map._invPos.x && y === map._invPos.y) {
        return true;
    }
    return false;
}

function isValidTeleportArrivalCell(map, x, y) {
    if (isTeleportArrivalBlocked(map, x, y)) return false;
    const loc = map?.at?.(x, y);
    if (!loc) return false;
    return ((loc.typ === CORR && !!map?.flags?.is_maze_lev)
        || loc.typ === ROOM
        || loc.typ === AIR);
}

function withinBoundedArea(x, y, lx, ly, hx, hy) {
    return x >= lx && x <= hx && y >= ly && y <= hy;
}

function normalizeRegion(region) {
    return {
        lx: Number.isFinite(region?.lx) ? region.lx : 0,
        ly: Number.isFinite(region?.ly) ? region.ly : 0,
        hx: Number.isFinite(region?.hx) ? region.hx : 0,
        hy: Number.isFinite(region?.hy) ? region.hy : 0,
        nlx: Number.isFinite(region?.nlx) ? region.nlx : 0,
        nly: Number.isFinite(region?.nly) ? region.nly : 0,
        nhx: Number.isFinite(region?.nhx) ? region.nhx : 0,
        nhy: Number.isFinite(region?.nhy) ? region.nhy : 0,
    };
}

// C ref: dungeon.c u_on_rndspot() + mkmaze.c place_lregion().
function getTeleportRegion(map, opts = {}) {
    const up = !!opts.up;
    const wasInWTower = !!opts.wasInWTower;
    if (wasInWTower && map?.dndest) {
        // C: Wizard tower special case uses dndest exclusion box as region.
        return normalizeRegion({
            lx: map.dndest.nlx,
            ly: map.dndest.nly,
            hx: map.dndest.nhx,
            hy: map.dndest.nhy,
            nlx: 0, nly: 0, nhx: 0, nhy: 0,
        });
    }
    return normalizeRegion(up ? map?.updest : map?.dndest);
}

// C ref: dungeon.c u_on_rndspot() -> mkmaze.c place_lregion().
// For default teleport regions this samples x in [1..COLNO-1], y in [0..ROWNO-1]
// with up to 200 randomized attempts, then deterministic scan fallback.
function getTeleportArrivalPosition(map, opts = {}) {
    let { lx, ly, hx, hy, nlx, nly, nhx, nhy } = getTeleportRegion(map, opts);

    if (!lx) {
        lx = 1;
        hx = COLNO - 1;
        ly = 0;
        hy = ROWNO - 1;
    }

    if (lx < 1) lx = 1;
    if (hx > COLNO - 1) hx = COLNO - 1;
    if (ly < 0) ly = 0;
    if (hy > ROWNO - 1) hy = ROWNO - 1;

    const oneshot = (lx === hx && ly === hy);

    const isBadLocation = (x, y) => {
        if (withinBoundedArea(x, y, nlx, nly, nhx, nhy)) return true;
        if (!isValidTeleportArrivalCell(map, x, y)) return true;
        return false;
    };

    const canPlaceAt = (x, y, force) => {
        let invalid = isBadLocation(x, y);
        if (invalid && !force) return false;
        if (invalid && force) {
            const trap = map?.trapAt?.(x, y);
            if (trap && trap.ttyp !== MAGIC_PORTAL && trap.ttyp !== VIBRATING_SQUARE) {
                deltrap(map, trap);
            }
            invalid = isBadLocation(x, y);
            if (invalid) return false;
        }
        // C ref: put_lregion_here() LR_*TELE rejects occupied monster unless oneshot.
        const mon = map?.monsterAt?.(x, y);
        if (mon) return false;
        return true;
    };

    for (let i = 0; i < 200; i++) {
        const x = rn1((hx - lx) + 1, lx);
        const y = rn1((hy - ly) + 1, ly);
        if (canPlaceAt(x, y, oneshot)) {
            return { x, y };
        }
    }

    for (let x = lx; x <= hx; x++) {
        for (let y = ly; y <= hy; y++) {
            if (canPlaceAt(x, y, true)) {
                return { x, y };
            }
        }
    }

    return { x: 1, y: 1 };
}

// Determine the hero arrival position on a level.
// transitionDir:
//   'down' -> arriving from above, place on upstair
//   'up'   -> arriving from below, place on downstairs
//   null   -> default startup/legacy behavior
export function getArrivalPosition(map, dungeonLevel, transitionDir = null) {
    if (transitionDir === 'teleport') {
        return getTeleportArrivalPosition(map, { up: false, wasInWTower: false });
    }

    const hasUpstair = !!(map?.upstair && map.upstair.x > 0 && map.upstair.y > 0);
    const hasDownstair = !!(map?.dnstair && map.dnstair.x > 0 && map.dnstair.y > 0);
    const hasUpdest = !!(map?.updest && Number.isFinite(map.updest.lx) && Number.isFinite(map.updest.ly));
    const hasDndest = !!(map?.dndest && Number.isFinite(map.dndest.lx) && Number.isFinite(map.dndest.ly));

    if (transitionDir === 'down' && hasUpdest) {
        return { x: map.updest.lx, y: map.updest.ly };
    }
    if (transitionDir === 'up' && hasDndest) {
        return { x: map.dndest.lx, y: map.dndest.ly };
    }

    if (transitionDir === 'down' && hasUpstair) {
        return { x: map.upstair.x, y: map.upstair.y };
    }
    if (transitionDir === 'up' && hasDownstair) {
        return { x: map.dnstair.x, y: map.dnstair.y };
    }

    // Backward-compatible default.
    if (hasUpstair) {
        return { x: map.upstair.x, y: map.upstair.y };
    }

    if (map.rooms.length > 0) {
        const room = map.rooms[0];
        return {
            x: Math.floor((room.lx + room.hx) / 2),
            y: Math.floor((room.ly + room.hy) / 2),
        };
    }

    for (let x = 1; x < COLNO - 1; x++) {
        for (let y = 1; y < ROWNO - 1; y++) {
            const loc = map.at(x, y);
            if (loc && ACCESSIBLE(loc.typ)) {
                return { x, y };
            }
        }
    }

    return { x: 1, y: 1 };
}
