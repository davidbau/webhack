/**
 * Sokoban Level 3-1
 * Ported from nethack-c/dat/soko3-1.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport', 'premapped', 'sokoban', 'solidify');

    des.map(`
-----------       -----------
|....|....|--     |.........|
|....|......|     |.........|
|.........|--     |.........|
|....|....|       |.........|
|-.---------      |.........|
|....|.....|      |.........|
|....|.....|      |.........|
|..........|      |.........|
|....|.....|---------------+|
|....|......................|
-----------------------------
`);

    des.stair('down', 11, 2);
    des.stair('up', 23, 4);
    des.door('locked', 27, 9);
    des.region(selection.area(0, 0, 28, 11), 'lit');
    des.non_diggable(selection.area(0, 0, 28, 11));
    des.non_passwall(selection.area(0, 0, 28, 11));

    // Boulders
    des.object('boulder', 3, 2);
    des.object('boulder', 4, 2);
    //
    des.object('boulder', 6, 2);
    des.object('boulder', 6, 3);
    des.object('boulder', 7, 2);
    //
    des.object('boulder', 3, 6);
    des.object('boulder', 2, 7);
    des.object('boulder', 3, 7);
    des.object('boulder', 3, 8);
    des.object('boulder', 2, 9);
    des.object('boulder', 3, 9);
    des.object('boulder', 4, 9);
    //
    des.object('boulder', 6, 7);
    des.object('boulder', 6, 9);
    des.object('boulder', 8, 7);
    des.object('boulder', 8, 10);
    des.object('boulder', 9, 8);
    des.object('boulder', 9, 9);
    des.object('boulder', 10, 7);
    des.object('boulder', 10, 10);

    // Prevent monster generation over the (filled) holes
    des.exclusion({ type: 'monster-generation', region: { x1: 11, y1: 10, x2: 27, y2: 10 } });

    // Traps
    des.trap('hole', 12, 10);
    des.trap('hole', 13, 10);
    des.trap('hole', 14, 10);
    des.trap('hole', 15, 10);
    des.trap('hole', 16, 10);
    des.trap('hole', 17, 10);
    des.trap('hole', 18, 10);
    des.trap('hole', 19, 10);
    des.trap('hole', 20, 10);
    des.trap('hole', 21, 10);
    des.trap('hole', 22, 10);
    des.trap('hole', 23, 10);
    des.trap('hole', 24, 10);
    des.trap('hole', 25, 10);
    des.trap('hole', 26, 10);

    // Random objects
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '=' });
    des.object({ class: '/' });

    return finalize_level();
}
