/**
 * soko3-1 - NetHack special level
 * Converted from: soko3-1.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack sokoban soko3-1.lua	$NHDT-Date: 1652196035 2022/5/10 15:20:35 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1998-1999 by Kevin Hugo
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "premapped", "sokoban", "solidify");

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
    des.stair("down", 11,2);
    des.stair("up", 23,4);
    des.door("locked", 27,9);
    des.region(selection.area(0,0,28,11), "lit");
    des.non_diggable(selection.area(0,0,28,11));
    des.non_passwall(selection.area(0,0,28,11));

    // Boulders
    des.object("boulder",3,2);
    des.object("boulder",4,2);
    // 
    des.object("boulder",6,2);
    des.object("boulder",6,3);
    des.object("boulder",7,2);
    // 
    des.object("boulder",3,6);
    des.object("boulder",2,7);
    des.object("boulder",3,7);
    des.object("boulder",3,8);
    des.object("boulder",2,9);
    des.object("boulder",3,9);
    des.object("boulder",4,9);
    // 
    des.object("boulder",6,7);
    des.object("boulder",6,9);
    des.object("boulder",8,7);
    des.object("boulder",8,10);
    des.object("boulder",9,8);
    des.object("boulder",9,9);
    des.object("boulder",10,7);
    des.object("boulder",10,10);

    // prevent monster generation over the (filled) holes
    des.exclusion({ type: "monster-generation", region: [ 11,10, 27,10 ] });
    // Traps
    des.trap("hole",12,10);
    des.trap("hole",13,10);
    des.trap("hole",14,10);
    des.trap("hole",15,10);
    des.trap("hole",16,10);
    des.trap("hole",17,10);
    des.trap("hole",18,10);
    des.trap("hole",19,10);
    des.trap("hole",20,10);
    des.trap("hole",21,10);
    des.trap("hole",22,10);
    des.trap("hole",23,10);
    des.trap("hole",24,10);
    des.trap("hole",25,10);
    des.trap("hole",26,10);

    // Random objects
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "=" });
    des.object({ class: "/" });



    return des.finalize_level();
}

