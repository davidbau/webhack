/**
 * tower3 - NetHack special level
 * Converted from: tower3.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack tower tower3.lua	$NHDT-Date: 1652196038 2022/5/10 15:20:38 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor", "solidify");
    des.map({ halign: "half-left", valign: "center", map: `

        --- --- ---    
        |.| |.| |.|    
      ---S---S---S---  
      |.S.........S.|  
    -----.........-----
    |...|.........+...|
    |.---.........---.|
    |.|.S.........S.|.|
    |.---S---S---S---.|
    |...|.|.|.|.|.|...|
    ---.---.---.---.---
      |.............|  
      ---------------  

    ` });
    // Random places are the 10 niches
    let place = [ [5,1],[9,1],[13,1],[3,3],[15,3],
    	   [3,7],[15,7],[5,9],[9,9],[13,9] ]

    des.levregion({ type: "branch", region: [2,5,2,5] });
    des.ladder("up", 5,7);
    // Entry door is, of course, locked
    des.door("locked",14,5);
    // Let's put a dragon behind the door, just for the fun...args
    des.monster("D", 13, 5);
    des.monster({ x: 12, y: 4 });
    des.monster({ x: 12, y: 6 });
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.object("long sword",place[4]);
    des.trap({ coord: place[4] });
    des.object("lock pick",place[1]);
    des.trap({ coord: place[1] });
    des.object("elven cloak",place[2]);
    des.trap({ coord: place[2] });
    des.object("blindfold",place[3]);
    des.trap({ coord: place[3] });
    // Walls in the tower are non diggable
    des.non_diggable(selection.area(0,0,18,12));


    return des.finalize_level();
}

