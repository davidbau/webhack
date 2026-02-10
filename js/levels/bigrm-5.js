/**
 * bigrm-5 - NetHack special level
 * Converted from: bigrm-5.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-5.lua	$NHDT-Date: 1652196022 2022/5/10 15:20:22 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel", "noflip");

    des.map(`

                                ------------------                            
                        ---------................---------                    
                  -------................................-------              
             ------............................................------         
          ----......................................................----      
        ---............................................................---    
      ---................................................................---  
    ---....................................................................---
    |........................................................................|
    |........................................................................|
    |........................................................................|
    ---....................................................................---
      ---................................................................---  
        ---............................................................---    
          ----......................................................----      
             ------............................................------         
                  -------................................-------              
                        ---------................---------                    
                                ------------------                            

    `);


    if (percent(25)) {
       let sel = selection.match(".").percentage(2).grow();
       des.replace_terrain({ selection: sel, fromterrain: ".", toterrain: percent(50) && "I" || "C" });
    }

    des.region(selection.area(0,0,72,18), "lit");

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

