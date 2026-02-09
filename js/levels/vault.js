/**
 * Treasure Vault Level (heavily guarded riches)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel');

    // Central vault with treasure, surrounded by guards
    des.map({
        map: `
---------------------------------------------------------------------------
|.........................................................................|
|.....................................................................---.|
|.......................-------------------------.....................|..|
|.......................|.....................|.....................|...|
|.....................--|*******************|--...................|.....|
|.....................|*********************|...................|.......|
|.....................|*******************|-|.................|.........|
|.....................|*****************|...|...............|...........|
|.....................|-|*************|.....|.............|.............|
|........................|***********|.......|...........|...............|
|........................|*********|.........|.........|.................|
|........................|*******|...........|.......|...................|
|........................-------.............|.....|.....................|
|..................................-------...|...|........................|
|.........................................................................|
|.........................................................................|
|.........................................................................|
---------------------------------------------------------------------------
`
    });

    // Light outer areas, vault is dark
    des.region(selection.area(1, 1, 73, 17), 'lit');
    des.region(selection.area(23, 5, 44, 12), 'unlit');

    // Stairs outside vault
    des.stair('up', 5, 5);
    des.stair('down', 68, 15);

    // Non-diggable walls
    des.non_diggable();

    // Treasure in vault
    for (let i = 0; i < 20; i++) {
        des.object({ class: '*' }); // Gems
    }
    for (let i = 0; i < 10; i++) {
        des.object({ class: '$' }); // Gold
    }
    for (let i = 0; i < 5; i++) {
        des.object({ class: '(' }); // Tools
    }

    // Random objects
    for (let i = 0; i < 10; i++) {
        des.object();
    }

    // Many traps protecting the vault
    for (let i = 0; i < 12; i++) {
        des.trap();
    }

    // Guards
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'soldier' });
    des.monster({ id: 'sergeant' });
    des.monster({ id: 'sergeant' });
    des.monster({ id: 'lieutenant' });
    des.monster({ id: 'captain' });
    des.monster({ id: 'watchman' });
    des.monster({ id: 'watchman' });
    des.monster({ id: 'watch captain' });

    // Dragons guarding treasure
    des.monster({ id: 'D' });
    des.monster({ id: 'D' });
    des.monster({ id: 'gold golem' });
    des.monster({ id: 'gold golem' });

    // Random monsters
    for (let i = 0; i < 13; i++) {
        des.monster();
    }

    return finalize_level();
}
