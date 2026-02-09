/**
 * Ice Level (frozen caverns)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: 'I' });

    des.level_flags('mazelevel');

    // Frozen caverns with ice walls
    des.map({
        map: `
IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
IIIIIIIIII.........IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII.........IIIIIIIIIIIIIIII
IIIIIIIII...........IIIIIIIIIIIIIIIIIIIIIIIIIIIIIII...........IIIIIIIIIIIIIII
IIIIIIII.............IIIIIIIIIIIIIIIIIIIIIIIIIIIII.............IIIIIIIIIIIII
IIIIIII...............IIIIIIIIIIIIIIIIIIIIIIIIIII...............IIIIIIIIIIIII
IIIIII.................IIIIIIIIIIIIIIIIIIIIIIIII.................IIIIIIIIIIII
IIIII...................IIIIIIIIIIIIIIIIIIIIIII...................IIIIIIIIIII
IIII.....................IIIIIIIIIIIIIIIIIIIII.....................IIIIIIIIII
III.......................IIIIIIIIIIIIIIIIIII.......................IIIIIIIII
II.........................IIIIIIIIIIIIIIIII.........................IIIIIIII
II.........................IIIIIIIIIIIIIIIII.........................IIIIIIII
III.......................IIIIIIIIIIIIIIIIIII.......................IIIIIIIII
IIII.....................IIIIIIIIIIIIIIIIIIIII.....................IIIIIIIIII
IIIII...................IIIIIIIIIIIIIIIIIIIIIII...................IIIIIIIIIII
IIIIII.................IIIIIIIIIIIIIIIIIIIIIIIII.................IIIIIIIIIIII
IIIIIII...............IIIIIIIIIIIIIIIIIIIIIIIIIII...............IIIIIIIIIIIII
IIIIIIII.............IIIIIIIIIIIIIIIIIIIIIIIIIIIII.............IIIIIIIIIIIII
IIIIIIIII...........IIIIIIIIIIIIIIIIIIIIIIIIIIIIIII...........IIIIIIIIIIIIIII
IIIIIIIIII.........IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII.........IIIIIIIIIIIIIIII
IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII
`
    });

    // Some lit areas
    des.region(selection.area(10, 2, 20, 8), 'lit');
    des.region(selection.area(53, 2, 63, 8), 'lit');
    des.region(selection.area(25, 9, 50, 12), 'lit');

    // Stairs
    des.stair('up', 15, 5);
    des.stair('down', 58, 5);

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

    // Cold monsters
    des.monster({ id: 'white dragon' });
    des.monster({ id: 'D' }); // Random dragon
    des.monster({ id: 'ice vortex' });
    des.monster({ id: 'ice vortex' });
    des.monster({ id: 'winter wolf' });
    des.monster({ id: 'winter wolf' });
    des.monster({ id: 'winter wolf cub' });
    des.monster({ id: 'white unicorn' });
    des.monster({ id: 'yeti' });
    des.monster({ id: 'yeti' });
    des.monster({ id: 'frost giant' });
    des.monster({ id: 'Y' }); // Yeti

    // Random monsters
    for (let i = 0; i < 16; i++) {
        des.monster();
    }

    return finalize_level();
}
