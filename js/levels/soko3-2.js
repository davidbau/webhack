/**
 * soko3-2 - NetHack special level
 * Converted from: soko3-2.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack sokoban soko3-2.lua	$NHDT-Date: 1652196036 2022/5/10 15:20:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1998-1999 by Kevin Hugo
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "premapped", "sokoban", "solidify");

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
    des.stair("down", 3,1);
    des.stair("up", 20,4);
    des.door("locked",24,9);
    des.region(selection.area(0,0,25,13), "lit");
    des.non_diggable(selection.area(0,0,25,13));
    des.non_passwall(selection.area(0,0,25,13));

    // Boulders
    des.object("boulder",2,3);
    des.object("boulder",8,3);
    des.object("boulder",9,4);
    des.object("boulder",2,5);
    des.object("boulder",4,5);
    des.object("boulder",9,5);
    des.object("boulder",2,6);
    des.object("boulder",5,6);
    des.object("boulder",6,7);
    des.object("boulder",3,8);
    des.object("boulder",7,8);
    des.object("boulder",5,9);
    des.object("boulder",10,9);
    des.object("boulder",7,10);
    des.object("boulder",10,10);
    des.object("boulder",3,11);

    // prevent monster generation over the (filled) holes
    des.exclusion({ type: "monster-generation", region: [ 12,10, 24,10 ] });
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

    // Random objects
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "=" });
    des.object({ class: "/" });



    return des.finalize_level();
}

