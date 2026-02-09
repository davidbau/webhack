/**
 * Cloud Level (floating platforms in the sky)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: 'C' });

    des.level_flags('mazelevel');

    // Floating platforms in clouds
    des.map({
        map: `
CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC
CCCCCC...........CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...........CCCCCCCCCCCC
CCCCC.............CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.............CCCCCCCCCCC
CCCC...............CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...............CCCCCCCCCC
CCC.................CCCCCCCCCCCCCCCCCCCCCCCCCCCCC.................CCCCCCCCC
CC...................CCCCCCCCCCCCCCCCCCCCCCCCCCC...................CCCCCCCC
C.....................CCCCCCCCCCCCCCCCCCCCCCCCC.....................CCCCCCC
C.......................CCCCCCCCCCCCCCCCCCCCC.......................CCCCCC
.........................CCCCCCCCCCCCCCCCCCC.........................CCCCC
..........................CCCCCCCCCCCCCCCCC..........................CCCC
..........................CCCCCCCCCCCCCCCCC..........................CCCC
.........................CCCCCCCCCCCCCCCCCCC.........................CCCCC
C.......................CCCCCCCCCCCCCCCCCCCCC.......................CCCCCC
C.....................CCCCCCCCCCCCCCCCCCCCCCCCC.....................CCCCCCC
CC...................CCCCCCCCCCCCCCCCCCCCCCCCCCC...................CCCCCCCC
CCC.................CCCCCCCCCCCCCCCCCCCCCCCCCCCCC.................CCCCCCCCC
CCCC...............CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...............CCCCCCCCCC
CCCCC.............CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.............CCCCCCCCCCC
CCCCCC...........CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...........CCCCCCCCCCCC
CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC
`
    });

    // Light the platforms
    des.region(selection.area(6, 2, 17, 8), 'lit');
    des.region(selection.area(56, 2, 67, 8), 'lit');
    des.region(selection.area(24, 9, 49, 12), 'lit');

    // Stairs
    des.stair('up', 11, 5);
    des.stair('down', 61, 5);

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

    // Flying/air creatures
    des.monster({ id: 'air elemental' });
    des.monster({ id: 'air elemental' });
    des.monster({ id: 'fog cloud' });
    des.monster({ id: 'fog cloud' });
    des.monster({ id: 'fog cloud' });
    des.monster({ id: 'steam vortex' });
    des.monster({ id: 'energy vortex' });
    des.monster({ id: 'dust vortex' });
    des.monster({ id: 'djinni' });
    des.monster({ id: 'couatl' });
    des.monster({ id: 'yellow light' });
    des.monster({ id: 'yellow light' });

    // Random monsters
    for (let i = 0; i < 16; i++) {
        des.monster();
    }

    return finalize_level();
}
