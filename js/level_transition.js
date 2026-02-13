// level_transition.js -- Level entry placement rules
// C ref: movement between levels places hero on corresponding stairs.

import { COLNO, ROWNO, ACCESSIBLE } from './config.js';

// Determine the hero arrival position on a level.
// transitionDir:
//   'down' -> arriving from above, place on upstair
//   'up'   -> arriving from below, place on downstairs
//   null   -> default startup/legacy behavior
export function getArrivalPosition(map, dungeonLevel, transitionDir = null) {
    const hasUpstair = !!(map?.upstair && map.upstair.x > 0 && map.upstair.y > 0);
    const hasDownstair = !!(map?.dnstair && map.dnstair.x > 0 && map.dnstair.y > 0);

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
