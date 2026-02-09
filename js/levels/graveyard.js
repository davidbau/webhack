/**
 * Graveyard Level (maze of tombstones)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'graveyard');

    // Open graveyard with scattered graves
    des.map({
        map: `
---------------------------------------------------------------------------
|.........................................................................|
|..|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|.......|
|.........................................................................|
|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|...|
|.........................................................................|
|..|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|.......|
|.........................................................................|
|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|...|
|.........................................................................|
|..|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|.......|
|.........................................................................|
|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|...|
|.........................................................................|
|..|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|.......|
|.........................................................................|
|.......|.|.|......|.|.|.......|.|.|......|.|.|.......|.|.|......|.|.|...|
|.........................................................................|
---------------------------------------------------------------------------
`
    });

    // Unlit graveyard
    des.region(selection.area(1, 1, 73, 17), 'unlit');

    // Stairs
    des.stair('up');
    des.stair('down');

    // Non-diggable walls
    des.non_diggable();

    // Many graves scattered throughout
    for (let i = 0; i < 30; i++) {
        des.object({ id: 'grave' });
    }

    // Some other objects
    for (let i = 0; i < 10; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 8; i++) {
        des.trap();
    }

    // Undead monsters
    des.monster({ id: 'vampire' });
    des.monster({ id: 'vampire' });
    des.monster({ id: 'vampire lord' });
    des.monster({ id: 'lich' });
    des.monster({ id: 'lich' });
    des.monster({ id: 'ghost' });
    des.monster({ id: 'ghost' });
    des.monster({ id: 'ghost' });
    des.monster({ id: 'wraith' });
    des.monster({ id: 'wraith' });
    des.monster({ id: 'Z' }); // Zombie
    des.monster({ id: 'Z' });
    des.monster({ id: 'Z' });
    des.monster({ id: 'M' }); // Mummy
    des.monster({ id: 'M' });
    des.monster({ id: 'M' });

    // Random monsters
    for (let i = 0; i < 12; i++) {
        des.monster();
    }

    return finalize_level();
}
