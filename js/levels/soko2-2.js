/**
 * Sokoban Level 2-2
 * Ported from nethack-c/dat/soko2-2.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport', 'premapped', 'sokoban', 'solidify');

    des.map(`
  --------
--|.|....|
|........|----------
|.-...-..|.|.......|
|...-......|.......|
|.-....|...|.......|
|....-.--.-|.......|
|..........|.......|
|.--...|...|.......|
|....-.|---|.......|
--|....|----------+|
  |................|
  ------------------
`);

    des.stair('down', 6, 11);
    des.stair('up', 15, 6);
    des.door('locked', 18, 10);
    des.region(selection.area(0, 0, 19, 12), 'lit');
    des.non_diggable(selection.area(0, 0, 19, 12));
    des.non_passwall(selection.area(0, 0, 19, 12));

    // Boulders
    des.object('boulder', 4, 2);
    des.object('boulder', 4, 3);
    des.object('boulder', 5, 3);
    des.object('boulder', 7, 3);
    des.object('boulder', 8, 3);
    des.object('boulder', 2, 4);
    des.object('boulder', 3, 4);
    des.object('boulder', 5, 5);
    des.object('boulder', 6, 6);
    des.object('boulder', 9, 6);
    des.object('boulder', 3, 7);
    des.object('boulder', 4, 7);
    des.object('boulder', 7, 7);
    des.object('boulder', 6, 9);
    des.object('boulder', 5, 10);
    des.object('boulder', 5, 11);

    // Prevent monster generation over the (filled) holes
    des.exclusion({ type: 'monster-generation', region: { x1: 6, y1: 11, x2: 18, y2: 11 } });

    // Traps
    des.trap('hole', 7, 11);
    des.trap('hole', 8, 11);
    des.trap('hole', 9, 11);
    des.trap('hole', 10, 11);
    des.trap('hole', 11, 11);
    des.trap('hole', 12, 11);
    des.trap('hole', 13, 11);
    des.trap('hole', 14, 11);
    des.trap('hole', 15, 11);
    des.trap('hole', 16, 11);
    des.trap('hole', 17, 11);

    // Random objects
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '=' });
    des.object({ class: '/' });

    return finalize_level();
}
