/**
 * bigrm-4 - NetHack special level
 * Converted from: bigrm-4.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-4.lua	$NHDT-Date: 1652196022 2022/5/10 15:20:22 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel", "noflip");

    des.map(`

    -----------                                                     -----------
    |.........|                                                     |.........|
    |.........-------------                             -------------.........|
    ---...................------------       ------------...................---
      --.............................---------.............................--  
       --.................................................................--   
        --...............................................................--    
         --......LLLLL.......................................LLLLL......--     
          --.....LLLLL.......................................LLLLL.....--      
          --.....LLLLL.......................................LLLLL.....--      
         --......LLLLL.......................................LLLLL......--     
        --...............................................................--    
       --.................................................................--   
      --.............................---------.............................--  
    ---...................------------       ------------...................---
    |.........-------------                             -------------.........|
    |.........|                                                     |.........|
    -----------                                                     -----------

    `);

    let terrains = [ ".", ".", ".", ".", "P", "L", "-", "T", "W", "Z" ];
    let tidx = Math.random(1, terrains.length);
    let toterr = terrains[tidx];
    if ((toterr !== "L")) {
       des.replace_terrain({ fromterrain: "L", toterrain: toterr });
    }

    des.feature("fountain", 5,2);
    des.feature("fountain", 5,15);
    des.feature("fountain", 69,2);
    des.feature("fountain", 69,15);

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

