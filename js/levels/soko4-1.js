/**
 * Sokoban Level 4, Variant 1 (Entry Level)
 *
 * Ported from: nethack-c/dat/soko4-1.lua
 * Original: Copyright (c) 1998-1999 by Kevin Hugo
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    // Bottom (first) level of Sokoban
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport', 'hardfloor', 'premapped', 'sokoban', 'solidify');

    des.map(`------  -----
|....|  |...|
|....----...|
|...........|
|..|-|.|-|..|
---------|.---
|......|.....|
|..----|.....|
--.|   |.....|
 |.|---|.....|
 |...........|
 |..|---------
 ----         `);

    des.levregion({ region: [6, 4, 6, 4], type: 'branch' });
    des.stair('up', 6, 6);
    des.region(selection.area(0, 0, 13, 12), 'lit');
    des.non_diggable(selection.area(0, 0, 13, 12));
    des.non_passwall(selection.area(0, 0, 13, 12));

    // Boulders
    des.object('boulder', 2, 2);
    des.object('boulder', 2, 3);
    //
    des.object('boulder', 10, 2);
    des.object('boulder', 9, 3);
    des.object('boulder', 10, 4);
    //
    des.object('boulder', 8, 7);
    des.object('boulder', 9, 8);
    des.object('boulder', 9, 9);
    des.object('boulder', 8, 10);
    des.object('boulder', 10, 10);

    // Prevent monster generation over the (filled) pits
    des.exclusion({ type: 'monster-generation', region: [1, 6, 7, 11] });

    // Traps
    des.trap('pit', 3, 6);
    des.trap('pit', 4, 6);
    des.trap('pit', 5, 6);
    des.trap('pit', 2, 8);
    des.trap('pit', 2, 9);
    des.trap('pit', 4, 10);
    des.trap('pit', 5, 10);
    des.trap('pit', 6, 10);
    des.trap('pit', 7, 10);

    // A little help
    des.object('scroll of earth', 2, 11);
    des.object('scroll of earth', 3, 11);

    // Random objects
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '=' });
    des.object({ class: '/' });

    // Finalize level (applies random flipping)
    finalize_level();
}
