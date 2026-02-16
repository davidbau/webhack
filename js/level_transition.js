// level_transition.js -- Level entry placement rules
// C ref: movement between levels places hero on corresponding stairs.

import { COLNO, ROWNO, ACCESSIBLE } from './config.js';
import { rn1 } from './rng.js';
import {
    CORR, ROOM, AIR,
    IS_FURNITURE, IS_LAVA, IS_POOL,
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

// C ref: dungeon.c u_on_rndspot() -> mkmaze.c place_lregion().
// For default teleport regions this samples x in [1..COLNO-1], y in [0..ROWNO-1]
// with up to 200 randomized attempts, then deterministic scan fallback.
function getTeleportArrivalPosition(map) {
    const lx = 1;
    const hx = COLNO - 1;
    const ly = 0;
    const hy = ROWNO - 1;

    for (let i = 0; i < 200; i++) {
        const x = rn1((hx - lx) + 1, lx);
        const y = rn1((hy - ly) + 1, ly);
        if (isValidTeleportArrivalCell(map, x, y)) {
            return { x, y };
        }
    }

    for (let x = lx; x <= hx; x++) {
        for (let y = ly; y <= hy; y++) {
            if (isValidTeleportArrivalCell(map, x, y)) {
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
        return getTeleportArrivalPosition(map);
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
    if (hasUpstair && dungeonLevel > 1) {
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
