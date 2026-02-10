/**
 * tower2 - NetHack special level
 * Converted from: tower2.lua
 */

import * as des from '../sp_lev.js';
import { selection, shuffle } from '../sp_lev.js';

export function generate() {
    // NetHack tower tower2.lua	$NHDT-Date: 1652196037 2022/5/10 15:20:37 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
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
    ---.------+----
      |......|..|  
    --------.------
    |.S......+..S.|
    ---S---S---S---
      |.| |.| |.|  
      --- --- ---  

    ` });
    // Random places are the 10 niches
    let place = [ [3,1],[7,1],[11,1],[1,3],[13,3],
    	   [1,7],[13,7],[3,9],[7,9],[11,9] ]
    shuffle(place)

    des.ladder("up", 11,5);
    des.ladder("down", 3,7);
    des.door("locked",10,4);
    des.door("locked",9,7);
    des.monster("&",place[10]);
    des.monster("&",place[1]);
    des.monster("hell hound pup",place[2]);
    des.monster("hell hound pup",place[3]);
    des.monster("winter wolf",place[4]);
    des.object({ id: "chest", coord: place[5],
                 contents: function() {
                    des.object("amulet of life saving");
                 }
    });
    des.object({ id: "chest", coord: place[6],
                 contents: function() {
                    des.object("amulet of strangulation");
                 }
    });
    des.object("water walking boots",place[7]);
    des.object("crystal plate mail",place[8]);

    let spbooks = [
       "spellbook of invisibility",
       "spellbook of cone of cold",
       "spellbook of create familiar",
       "spellbook of clairvoyance",
       "spellbook of charm monster",
       "spellbook of stone to flesh",
       "spellbook of polymorph"
    ]
    shuffle(spbooks);
    des.object(spbooks[1],place[9]);

    // Walls in the tower are non diggable
    des.non_diggable(selection.area(0,0,14,10));



    return des.finalize_level();
}

