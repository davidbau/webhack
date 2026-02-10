/**
 * soko1-2 - NetHack special level
 * Converted from: soko1-2.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack sokoban soko1-2.lua	$NHDT-Date: 1652196034 2022/5/10 15:20:34 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.6 $
    // Copyright (c) 1998-1999 by Kevin Hugo
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "premapped", "sokoban", "solidify");

    des.map(`

      ------------------------
      |......................|
      |..-------------------.|
    ----.|    -----        |.|
    |..|.--  --...|        |.|
    |.....|--|....|        |.|
    |.....|..|....|        |.|
    --....|......--        |.|
     |.......|...|   ------|.|
     |....|..|...| --|.....|.|
     |....|--|...| |.+.....|.|
     |.......|..-- |-|.....|.|
     ----....|.--  |.+.....+.|
        ---.--.|   |-|.....|--
         |.....|   |.+.....|  
         |..|..|   --|.....|  
         -------     -------  

    `);

    let place = selection.new();
    place.set(16,10);
    place.set(16,12);
    place.set(16,14);

    des.stair("down", 6,15);
    des.region(selection.area(0,0,25,16),"lit");
    des.non_diggable(selection.area(0,0,25,16));
    des.non_passwall(selection.area(0,0,25,16));

    // Boulders
    des.object("boulder",4,4);
    des.object("boulder",2,6);
    des.object("boulder",3,6);
    des.object("boulder",4,7);
    des.object("boulder",5,7);
    des.object("boulder",2,8);
    des.object("boulder",5,8);
    des.object("boulder",3,9);
    des.object("boulder",4,9);
    des.object("boulder",3,10);
    des.object("boulder",5,10);
    des.object("boulder",6,12);
    // 
    des.object("boulder",7,14);
    // 
    des.object("boulder",11,5);
    des.object("boulder",12,6);
    des.object("boulder",10,7);
    des.object("boulder",11,7);
    des.object("boulder",10,8);
    des.object("boulder",12,9);
    des.object("boulder",11,10);

    // prevent monster generation over the (filled) holes
    des.exclusion({ type: "monster-generation", region: [ 5,1, 22,1 ] });
    // Traps
    des.trap("hole",5,1);
    des.trap("hole",6,1);
    des.trap("hole",7,1);
    des.trap("hole",8,1);
    des.trap("hole",9,1);
    des.trap("hole",10,1);
    des.trap("hole",11,1);
    des.trap("hole",12,1);
    des.trap("hole",13,1);
    des.trap("hole",14,1);
    des.trap("hole",15,1);
    des.trap("hole",16,1);
    des.trap("hole",17,1);
    des.trap("hole",18,1);
    des.trap("hole",19,1);
    des.trap("hole",20,1);
    des.trap("hole",21,1);
    des.trap("hole",22,1);

    des.monster({ id: "giant mimic", appear_as: "obj:boulder" });
    des.monster({ id: "giant mimic", appear_as: "obj:boulder" });

    // Random objects
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "%" });
    des.object({ class: "=" });
    des.object({ class: "/" });

    // Rewards
    des.door("locked",23,12);
    des.door("closed",17,10);
    des.door("closed",17,12);
    des.door("closed",17,14);
    des.region({ region: [18,9, 22,15], lit: 1, type: "zoo", filled: 1, irregular: 1 });

    let pt = selection.rndcoord(place);
    if (percent(25)) {
       des.object({ id: "bag of holding", coord: pt,
    		buc: "!-cursed", achievement: 1 });
    } else {
       des.object({ id: "amulet of reflection", coord: pt,
    		buc: "!-cursed", achievement: 1 });
    }
    des.engraving({ coord: pt, type: "burn", text: "Elbereth" });
    des.object({ id: "scroll of scare monster", coord: pt, buc: "cursed" });


    return des.finalize_level();
}

