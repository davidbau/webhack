/**
 * soko2-1 - NetHack special level
 * Converted from: soko2-1.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack sokoban soko2-1.lua	$NHDT-Date: 1652196035 2022/5/10 15:20:35 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1998-1999 by Kevin Hugo
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "premapped", "sokoban", "solidify");

    des.map(`

    --------------------
    |........|...|.....|
    |.....-..|.-.|.....|
    |..|.....|...|.....|
    |-.|..-..|.-.|.....|
    |...--.......|.....|
    |...|...-...-|.....|
    |...|..|...--|.....|
    |-..|..|----------+|
    |..................|
    |...|..|------------
    --------            

    `);
    des.stair("down", 6,10);
    des.stair("up", 16,4);
    des.door("locked", 18,8);
    des.region(selection.area(0,0, 19,11), "lit");
    des.non_diggable(selection.area(0,0,19,11));
    des.non_passwall(selection.area(0,0,19,11));

    // Boulders
    des.object("boulder",2,2);
    des.object("boulder",3,2);
    // 
    des.object("boulder",5,3);
    des.object("boulder",7,3);
    des.object("boulder",7,2);
    des.object("boulder",8,2);
    // 
    des.object("boulder",10,3);
    des.object("boulder",11,3);
    // 
    des.object("boulder",2,7);
    des.object("boulder",2,8);
    des.object("boulder",3,9);
    // 
    des.object("boulder",5,7);
    des.object("boulder",6,6);

    // prevent monster generation over the (filled) holes
    des.exclusion({ type: "monster-generation", region: [ 7,9, 18,9 ] });
    // Traps
    des.trap("hole",8,9);
    des.trap("hole",9,9);
    des.trap("hole",10,9);
    des.trap("hole",11,9);
    des.trap("hole",12,9);
    des.trap("hole",13,9);
    des.trap("hole",14,9);
    des.trap("hole",15,9);
    des.trap("hole",16,9);
    des.trap("hole",17,9);

    // Random objects
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "=" });
    des.object({ class: "/" });


    return des.finalize_level();
}

