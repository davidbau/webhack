/**
 * Big Room variant 2 (with decorative wall pattern)
 * Simplified port from nethack-c/dat/bigrm-3.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noflip');

    // Big room with decorative wall pattern
    des.map({
        map: `
---------------------------------------------------------------------------
|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|..............---.......................................---..............|
|...............|.........................................|...............|
|.....|.|.|.|.|---|.|.|.|.|...................|.|.|.|.|.|---|.|.|.|.|.....|
|.....|--------   --------|...................|----------   --------|.....|
|.....|.|.|.|.|---|.|.|.|.|...................|.|.|.|.|.|---|.|.|.|.|.....|
|...............|.........................................|...............|
|..............---.......................................---..............|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|
---------------------------------------------------------------------------
`
    });

    // Light the room
    des.region(selection.area(1, 1, 73, 16), 'lit');

    // Stairs
    des.stair('up');
    des.stair('down');

    // Non-diggable walls
    des.non_diggable();

    // Objects
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 6; i++) {
        des.trap();
    }

    // Monsters at specific locations forming a pattern
    // Top row
    des.monster({ x: 1, y: 1 });
    des.monster({ x: 13, y: 1 });
    des.monster({ x: 25, y: 1 });
    des.monster({ x: 37, y: 1 });
    des.monster({ x: 49, y: 1 });
    des.monster({ x: 61, y: 1 });
    des.monster({ x: 73, y: 1 });

    // Middle rows
    des.monster({ x: 7, y: 7 });
    des.monster({ x: 13, y: 7 });
    des.monster({ x: 25, y: 7 });
    des.monster({ x: 37, y: 7 });
    des.monster({ x: 49, y: 7 });
    des.monster({ x: 61, y: 7 });
    des.monster({ x: 67, y: 7 });

    des.monster({ x: 7, y: 9 });
    des.monster({ x: 13, y: 9 });
    des.monster({ x: 25, y: 9 });
    des.monster({ x: 37, y: 9 });
    des.monster({ x: 49, y: 9 });
    des.monster({ x: 61, y: 9 });
    des.monster({ x: 67, y: 9 });

    // Bottom row
    des.monster({ x: 1, y: 16 });
    des.monster({ x: 13, y: 16 });
    des.monster({ x: 25, y: 16 });
    des.monster({ x: 37, y: 16 });
    des.monster({ x: 49, y: 16 });
    des.monster({ x: 61, y: 16 });
    des.monster({ x: 73, y: 16 });

    return finalize_level();
}
