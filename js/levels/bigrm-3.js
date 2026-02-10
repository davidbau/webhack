/**
 * bigrm-3 - NetHack special level
 * Converted from: bigrm-3.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-3.lua	$NHDT-Date: 1652196021 2022/5/10 15:20:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel", "noflip");

    des.map(`

    ---------------------------------------------------------------------------
    |.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |..............---.......................................---..............|
    |...............|.........................................|...............|
    |.....|.|.|.|.|---|.|.|.|.|...................|.|.|.|.|.|---|.|.|.|.|.....|
    |.....|--------   --------|...................|----------   --------|.....|
    |.....|.|.|.|.|---|.|.|.|.|...................|.|.|.|.|.|---|.|.|.|.|.....|
    |...............|.........................................|...............|
    |..............---.......................................---..............|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|.|
    ---------------------------------------------------------------------------

    `);

    // Dungeon Description
    des.region(selection.area(1,1,73,16), "lit");

    // replace some walls
    if (percent(66)) {
       let sel = selection.match("[.w.]");
       let terrains = [ "F", "T", "W", "Z" ];
       let choice = terrains[Math.random(1, terrains.length)];
       des.terrain(sel, choice);
    }

    // Stairs
    des.stair("up");
    des.stair("down");

    // Non diggable walls
    des.non_diggable();

    for (let i = 1; i <= 15; i++) {
       des.object();
    }

    for (let i = 1; i <= 6; i++) {
       des.trap();
    }

    des.monster({ x: 1, y: 1 });
    des.monster({ x: 13, y: 1 });
    des.monster({ x: 25, y: 1 });
    des.monster({ x: 37, y: 1 });
    des.monster({ x: 49, y: 1 });
    des.monster({ x: 61, y: 1 });
    des.monster({ x: 73, y: 1 });
    des.monster({ x: 7, y: 7 });
    des.monster({ x: 13, y: 7 });
    des.monster({ x: 25, y: 7 });
    des.monster({ x: 37, y: 7 });
    des.monster({ x: 49, y: 7 });
    des.monster({ x: 61, y: 7 });
    des.monster({ x: 67, y: 7 });
    des.monster({ x: 7, y: 9 });
    des.monster({ x: 13, y: 9 });
    des.monster({ x: 25, y: 9 });
    des.monster({ x: 37, y: 9 });
    des.monster({ x: 49, y: 9 });
    des.monster({ x: 61, y: 9 });
    des.monster({ x: 67, y: 9 });
    des.monster({ x: 1, y: 16 });
    des.monster({ x: 13, y: 16 });
    des.monster({ x: 25, y: 16 });
    des.monster({ x: 37, y: 16 });
    des.monster({ x: 49, y: 16 });
    des.monster({ x: 61, y: 16 });
    des.monster({ x: 73, y: 16 });


    return des.finalize_level();
}

