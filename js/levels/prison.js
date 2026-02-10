/**
 * Prison Level (cells and corridors)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel');

    // Prison with cells
    des.map({
        map: `
---------------------------------------------------------------------------
|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|
||...||...||...||...||...||...||...||...||...||...||...||...||...||...|
||...||...||...||...||...||...||...||...||...||...||...||...||...||...|
|----+----+----+----+----+----+----+----+----+----+----+----+----+----|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|----+----+----+----+----+----+----+----+----+----+----+----+----+----|
||...||...||...||...||...||...||...||...||...||...||...||...||...||...|
||...||...||...||...||...||...||...||...||...||...||...||...||...||...|
|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|--+--|
|.........................................................................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
---------------------------------------------------------------------------
`
    });

    // Mostly unlit prison
    des.region(selection.area(1, 1, 73, 17), 'unlit');
    des.region(selection.area(1, 4, 73, 9), 'lit');
    des.region(selection.area(1, 13, 73, 17), 'lit');

    // Stairs in corridors
    des.stair('up', 10, 6);
    des.stair('down', 63, 15);

    // Non-diggable walls
    des.non_diggable();

    // Objects
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Many traps
    for (let i = 0; i < 10; i++) {
        des.trap();
    }

    // Guards
    des.monster({ id: 'guard' });
    des.monster({ id: 'guard' });
    des.monster({ id: 'guard' });
    des.monster({ id: 'guard' });
    des.monster({ id: 'watchman' });
    des.monster({ id: 'watchman' });
    des.monster({ id: 'watchman' });
    des.monster({ id: 'watch captain' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'lieutenant' });

    // Prisoners
    des.monster({ id: 'convict' });
    des.monster({ id: 'prisoner' });
    des.monster({ id: 'prisoner' });

    // Random monsters
    for (let i = 0; i < 14; i++) {
        des.monster();
    }

    return finalize_level();
}
