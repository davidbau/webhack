/**
 * bigrm-10 - NetHack special level
 * Converted from: bigrm-10.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-10.lua	$NHDT-Date: 1652196024 2022/5/10 15:20:24 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel", "noflip");

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
       // occasionally it's ! a fog maze
       let terrain = [ "L", "}", "T", "-", "F" ];
       let tidx = Math.random(1, terrain.length);
       // break it up a bit
       des.replace_terrain({ region: [0, 0, 70, 18], fromterrain: "C", toterrain: ".", chance: 5 });
       des.replace_terrain({ region: [0, 0, 70, 18], fromterrain: "C", toterrain: terrain[tidx] });
    };

    des.region(selection.area(0,0,70,18), "lit");

    // when falling down on this level, never } up in the fog maze
    des.teleport_region({ region: [0,0,70,18], exclude: [2,3,68,15], dir: "down" });

    for (let i = 1; i <= 15; i++) {
       des.object();
    }

    for (let i = 1; i <= 6; i++) {
       des.trap();
    }

    for (let i = 1; i <= 28; i++) {
      des.monster();
    }

    des.mazewalk({ x: 4, y: 2, dir: "south", stocked: 0 });

    // Stairs up, ! in the fog maze
    des.levregion({ region: [0,0,70,18], exclude: [2,3,68,15], type: "stair-up"});
    des.stair("down");


    return des.finalize_level();
}

