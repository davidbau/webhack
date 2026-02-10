/**
 * soko4-1 - NetHack special level
 * Converted from: soko4-1.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack sokoban soko4-1.lua	$NHDT-Date: 1652196036 2022/5/10 15:20:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1998-1999 by Kevin Hugo
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // In case you haven't played the game Sokoban, you'll learn
    // quickly.  This branch isn't particularly difficult, just time
    // consuming.  Some players may wish to skip this branch.
    // 
    // The following actions are currently permitted without penalty:
    // Carrying || throwing a boulder already in inventory
    // (player || nonplayer).
    // Teleporting boulders.
    // Digging in the floor.
    // The following actions are permitted, but with a luck penalty:
    // Breaking boulders.
    // Stone-to-fleshing boulders.
    // Creating new boulders (e.g., with a scroll of earth).
    // Jumping.
    // Being pulled by a thrown iron ball.
    // Hurtling through the air from Newton's 3rd law.
    // Squeezing past boulders when naked || as a giant.
    // These actions are ! permitted:
    // Moving diagonally between two boulders &&/|| walls.
    // Pushing a boulder diagonally.
    // Picking up boulders (player || nonplayer).
    // Digging || walking through walls.
    // Teleporting within levels || between levels of this branch.
    // Using cursed potions of gain level.
    // Escaping a pit/hole (e.g., by flying, levitation, ||
    // passing a dexterity check).
    // Bones files are ! permitted.


    // ## Bottom (first) level of Sokoban ###
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor", "premapped", "sokoban", "solidify");

    des.map(`

    ------  ----- 
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
     ----         

    `);
    des.levregion({ region: [6,4,6,4], type: "branch" });
    des.stair("up", 6,6);
    des.region(selection.area(0,0,13,12), "lit");
    des.non_diggable(selection.area(0,0,13,12));
    des.non_passwall(selection.area(0,0,13,12));

    // Boulders
    des.object("boulder",2,2);
    des.object("boulder",2,3);
    // 
    des.object("boulder",10,2);
    des.object("boulder",9,3);
    des.object("boulder",10,4);
    // 
    des.object("boulder",8,7);
    des.object("boulder",9,8);
    des.object("boulder",9,9);
    des.object("boulder",8,10);
    des.object("boulder",10,10);

    // prevent monster generation over the (filled) pits
    des.exclusion({ type: "monster-generation", region: [ 1,6, 7,11 ] });
    // Traps
    des.trap("pit",3,6);
    des.trap("pit",4,6);
    des.trap("pit",5,6);
    des.trap("pit",2,8);
    des.trap("pit",2,9);
    des.trap("pit",4,10);
    des.trap("pit",5,10);
    des.trap("pit",6,10);
    des.trap("pit",7,10);

    // A little help
    des.object("scroll of earth",2,11);
    des.object("scroll of earth",3,11);

    // Random objects
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "=" });
    des.object({ class: "/" });



    return des.finalize_level();
}

