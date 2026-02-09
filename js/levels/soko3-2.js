/**
 * Sokoban Level 3-2
 * Ported from nethack-c/dat/soko3-2.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport', 'premapped', 'sokoban', 'solidify');

    des.map(`
 ----          -----------
-|..|-------   |.........|
|..........|   |.........|
|..-----.-.|   |.........|
|..|...|...|   |.........|
|.........-|   |.........|
|.......|..|   |.........|
|.----..--.|   |.........|
|........|.--  |.........|
|.---.-.....------------+|
|...|...-................|
|.........----------------
----|..|..|
    -------
`);

    des.stair('down', 3, 1);
    des.stair('up', 20, 4);
    des.door('locked', 24, 9);
    des.region(selection.area(0, 0, 25, 13), 'lit');
    des.non_diggable(selection.area(0, 0, 25, 13));
    des.non_passwall(selection.area(0, 0, 25, 13));

    // Boulders
    des.object('boulder', 2, 3);
    des.object('boulder', 8, 3);
    des.object('boulder', 9, 4);
    des.object('boulder', 2, 5);
    des.object('boulder', 4, 5);
    des.object('boulder', 9, 5);
    des.object('boulder', 2, 6);
    des.object('boulder', 5, 6);
    des.object('boulder', 6, 7);
    des.object('boulder', 3, 8);
    des.object('boulder', 7, 8);
    des.object('boulder', 5, 9);
    des.object('boulder', 10, 9);
    des.object('boulder', 7, 10);
    des.object('boulder', 10, 10);
    des.object('boulder', 3, 11);

    // Prevent monster generation over the (filled) holes
    des.exclusion({ type: 'monster-generation', region: { x1: 12, y1: 10, x2: 24, y2: 10 } });

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

    // Random objects
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '=' });
    des.object({ class: '/' });

    return finalize_level();
}
