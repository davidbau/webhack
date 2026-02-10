/**
 * Bigroom variant 10: Cloud maze that can optionally transform into other terrain
 * C ref: nethack-c/dat/bigrm-10.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';
import { rn2 } from '../rng.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });
    des.level_flags('mazelevel', 'noflip');

    des.map(`
.......................................................................
.......................................................................
.......................................................................
.......................................................................
...C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C...
...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...
...C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C...
...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...
...C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C...
...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...
...C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C...
...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...
...C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C...
...CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...
...C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C C...
.......................................................................
.......................................................................
.......................................................................
.......................................................................
`);

    if (percent(40)) {
        // Occasionally it's not a fog maze
        const terrain = ['L', '}', 'T', '-', 'F'];
        const tidx = rn2(terrain.length);
        // Break it up a bit
        des.replace_terrain({ region: { x1: 0, y1: 0, x2: 70, y2: 18 }, fromterrain: 'C', toterrain: '.', chance: 5 });
        des.replace_terrain({ region: { x1: 0, y1: 0, x2: 70, y2: 18 }, fromterrain: 'C', toterrain: terrain[tidx] });
    }

    des.region(selection.area(0, 0, 70, 18), 'lit');

    // When falling down on this level, never end up in the fog maze
    des.teleport_region({ region: { x1: 0, y1: 0, x2: 70, y2: 18 }, exclude: { x1: 2, y1: 3, x2: 68, y2: 15 }, dir: 'down' });

    for (let i = 0; i < 15; i++) {
        des.object();
    }

    for (let i = 0; i < 6; i++) {
        des.trap();
    }

    for (let i = 0; i < 28; i++) {
        des.monster();
    }

    des.mazewalk({ x: 4, y: 2, dir: 'south', stocked: 0 });

    // Stairs up, not in the fog maze
    des.levregion({ region: { x1: 0, y1: 0, x2: 70, y2: 18 }, exclude: { x1: 2, y1: 3, x2: 68, y2: 15 }, type: 'stair-up' });
    des.stair('down');

    return des.finalize_level();
}
