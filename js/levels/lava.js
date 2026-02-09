/**
 * Lava Level (volcanic terrain)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: 'L' });

    des.level_flags('mazelevel');

    // Islands of safety in a sea of lava
    des.map({
        map: `
LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
LLLLLLLL.........LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL.........LLLLLLLLLLLLLL
LLLLLLL...........LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL...........LLLLLLLLLLLLL
LLLLLL.............LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL.............LLLLLLLLLLLL
LLLLL...............LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL...............LLLLLLLLLLL
LLLL.................LLLLLLLLLLLLLLLLLLLLLLLLLLLLL.................LLLLLLLLLL
LLL...................LLLLLLLLLLLLLLLLLLLLLLLLLLL...................LLLLLLLLL
LL.....................LLLLLLLLLLLLLLLLLLLLLLLLL.....................LLLLLLLL
L.......................LLLLLLLLLLLLLLLLLLLLLLL.......................LLLLLLL
L.........................LLLLLLLLLLLLLLLLLLL.........................LLLLLL
L.........................LLLLLLLLLLLLLLLLLLL.........................LLLLLL
L.......................LLLLLLLLLLLLLLLLLLLLLLL.......................LLLLLLL
LL.....................LLLLLLLLLLLLLLLLLLLLLLLLL.....................LLLLLLLL
LLL...................LLLLLLLLLLLLLLLLLLLLLLLLLLL...................LLLLLLLLL
LLLL.................LLLLLLLLLLLLLLLLLLLLLLLLLLLLL.................LLLLLLLLLL
LLLLL...............LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL...............LLLLLLLLLLL
LLLLLL.............LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL.............LLLLLLLLLLLL
LLLLLLL...........LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL...........LLLLLLLLLLLLL
LLLLLLLL.........LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL.........LLLLLLLLLLLLLL
LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL
`
    });

    // Light some safe areas
    des.region(selection.area(8, 2, 18, 7), 'lit');
    des.region(selection.area(55, 2, 65, 7), 'lit');
    des.region(selection.area(23, 9, 51, 12), 'lit');

    // Stairs on different platforms
    des.stair('up', 12, 4);
    des.stair('down', 60, 4);

    // Non-diggable
    des.non_diggable();

    // Objects
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 6; i++) {
        des.trap();
    }

    // Fire and lava monsters
    des.monster({ id: 'fire elemental' });
    des.monster({ id: 'fire elemental' });
    des.monster({ id: 'salamander' });
    des.monster({ id: 'salamander' });
    des.monster({ id: 'fire vortex' });
    des.monster({ id: 'fire vortex' });
    des.monster({ id: 'red dragon' });
    des.monster({ id: 'D' }); // Random dragon
    des.monster({ id: 'D' });
    des.monster({ id: 'hell hound' });
    des.monster({ id: 'hell hound' });

    // Random monsters on platforms
    for (let i = 0; i < 17; i++) {
        des.monster();
    }

    return finalize_level();
}
