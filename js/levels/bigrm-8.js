/**
 * bigrm-8 - NetHack special level
 * Converted from: bigrm-8.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-8.lua	$NHDT-Date: 1652196023 2022/5/10 15:20:23 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel");

    des.map(`

    ----------------------------------------------                             
    |............................................---                           
    --.............................................---                         
     ---......................................FF.....---                       
       ---...................................FF........---                     
         ---................................FF...........---                   
           ---.............................FF..............---                 
             ---..........................FF.................---               
               ---.......................FF....................---             
                 ---....................FF.......................---           
                   ---.................FF..........................---         
                     ---..............FF.............................---       
                       ---...........FF................................----    
                         ---........FF...................................---   
                           ---.....FF......................................--- 
                             ---.............................................--
                               ---............................................|
                                 ----------------------------------------------

    `);

    if (percent(40)) {
       let terrain = [ "L", "}", "T", ".", "-", "C" ];
       let tidx = Math.random(1, terrain.length);
       des.replace_terrain({ region: [0,0, 74,17], fromterrain: "F", toterrain: terrain[tidx] });
    };

    des.region(selection.area(1,1,73,16), "lit");

    des.stair("up");
    des.stair("down");

    des.non_diggable();

    for (let i = 1; i <= 15; i++) {
       des.object();
    }

    for (let i = 1; i <= 6; i++) {
       des.trap();
    }

    for (let i = 1; i <= 28; i++) {
      des.monster();
    }

    return des.finalize_level();
}

