/**
 * Temple Level (sacred halls with altars)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel');

    // Sacred temple with multiple altar chambers
    des.map({
        map: `
---------------------------------------------------------------------------
|.........................................................................|
|.....-------------------.......-------------------.......................|
|.....|..................|......|.................|.......................|
|.....|......._..........|......|.........._......|.......................|
|.....|..................|......|.................|.......................|
|.....---+---------------.......----------------+--.......................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.....-------------------.......-------------------.......................|
|.....|..................|......|.................|.......................|
|.....|......._..........|......|.........._......|.......................|
|.....|..................|......|.................|.......................|
|.....---+---------------.......----------------+--.......................|
|.........................................................................|
---------------------------------------------------------------------------
`
    });

    // Light the temple
    des.region(selection.area(1, 1, 73, 17), 'lit');

    // Stairs
    des.stair('up', 60, 9);
    des.stair('down', 68, 9);

    // Non-diggable walls
    des.non_diggable();

    // Altars in chambers
    des.altar({ x: 14, y: 4, align: 'lawful' });
    des.altar({ x: 45, y: 4, align: 'neutral' });
    des.altar({ x: 14, y: 14, align: 'chaotic' });
    des.altar({ x: 45, y: 14, align: 'neutral' });

    // Objects
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 6; i++) {
        des.trap();
    }

    // Temple guardians
    des.monster({ id: 'aligned priest' });
    des.monster({ id: 'aligned priest' });
    des.monster({ id: 'aligned priest' });
    des.monster({ id: 'aligned priest' });
    des.monster({ id: 'Angel' });
    des.monster({ id: 'Angel' });
    des.monster({ id: 'Archon' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'sergeant' });

    // Random monsters
    for (let i = 0; i < 16; i++) {
        des.monster();
    }

    return finalize_level();
}
