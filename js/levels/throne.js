/**
 * Throne Room Level (royal chambers)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel');

    // Grand throne room with royal chambers
    des.map({
        map: `
---------------------------------------------------------------------------
|.........................................................................|
|.........................-------------------------------................|
|........................|................................|...............|
|........................|................................|...............|
|........................|................................|...............|
|........................|................................|...............|
|........................|..............\.................|...............|
|........................|................................|...............|
|........................|................................|...............|
|........................|................................|...............|
|........................|................................|...............|
|........................|................................|...............|
|........................|................................|...............|
|.........................------+----------+--------------................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
---------------------------------------------------------------------------
`
    });

    // Light the throne room
    des.region(selection.area(1, 1, 73, 17), 'lit');

    // Stairs
    des.stair('up', 10, 10);
    des.stair('down', 65, 15);

    // Doors
    des.door('closed', 31, 14);
    des.door('closed', 42, 14);

    // Non-diggable walls
    des.non_diggable();

    // Throne
    des.feature({ type: 'throne', x: 40, y: 7 });

    // Royal treasures
    for (let i = 0; i < 10; i++) {
        des.object({ class: '*' }); // Gems
    }
    for (let i = 0; i < 5; i++) {
        des.object({ class: '$' }); // Gold
    }

    // Other objects
    for (let i = 0; i < 10; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 6; i++) {
        des.trap();
    }

    // Royal court
    des.monster({ id: 'king' });
    des.monster({ id: 'queen' });
    des.monster({ id: 'prince' });
    des.monster({ id: 'princess' });
    des.monster({ id: 'lord' });
    des.monster({ id: 'lord' });
    des.monster({ id: 'lady' });
    des.monster({ id: 'lady' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'sergeant' });
    des.monster({ id: 'lieutenant' });
    des.monster({ id: 'captain' });

    // Random monsters
    for (let i = 0; i < 13; i++) {
        des.monster();
    }

    return finalize_level();
}
