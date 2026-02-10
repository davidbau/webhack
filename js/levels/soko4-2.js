/**
 * soko4-2 - NetHack special level
 * Converted from: soko4-2.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack sokoban soko4-2.lua	$NHDT-Date: 1652196036 2022/5/10 15:20:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1998-1999 by Kevin Hugo
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor", "premapped", "sokoban", "solidify");

    des.map(`

    -------- ------
    |.|....|-|....|
    |.|-..........|
    |.||....|.....|
    |.||....|.....|
    |.|-----|.-----
    |.|    |......|
    |.-----|......|
    |.............|
    |..|---|......|
    ----   --------

    `);
    des.levregion({ region: [3,1,3,1], type: "branch" });
    des.stair("up", 1,1);
    des.region(selection.area(0,0,14,10),"lit");
    des.non_diggable(selection.area(0,0,14,10));
    des.non_passwall(selection.area(0,0,14,10));

    // Boulders
    des.object("boulder",5,2);
    des.object("boulder",6,2);
    des.object("boulder",6,3);
    des.object("boulder",7,3);
    // 
    des.object("boulder",9,5);
    des.object("boulder",10,3);
    des.object("boulder",11,2);
    des.object("boulder",12,3);
    // 
    des.object("boulder",7,8);
    des.object("boulder",8,8);
    des.object("boulder",9,8);
    des.object("boulder",10,8);

    // prevent monster generation over the (filled) pits
    des.exclusion({ type: "monster-generation", region: [ 1,1, 1,9 ] });
    des.exclusion({ type: "monster-generation", region: [ 1,8, 7,9 ] });
    // Traps
    des.trap("pit",1,2);
    des.trap("pit",1,3);
    des.trap("pit",1,4);
    des.trap("pit",1,5);
    des.trap("pit",1,6);
    des.trap("pit",1,7);
    des.trap("pit",3,8);
    des.trap("pit",4,8);
    des.trap("pit",5,8);
    des.trap("pit",6,8);

    // A little help
    des.object("scroll of earth",1,9);
    des.object("scroll of earth",2,9);

    // Random objects
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "=" });
    des.object({ class: "/" });




    return des.finalize_level();
}

