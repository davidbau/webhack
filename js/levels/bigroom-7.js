/**
 * bigrm-7 - NetHack special level
 * Converted from: bigrm-7.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-7.lua	$NHDT-Date: 1652196023 2022/05/10 15:20:23 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.0 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel");

    des.map(`

                                                            -----              
                                                    ---------...---            
                                            ---------.........L...---          
                                    ---------.......................---        
                            ---------.................................---      
                    ---------...........................................---    
            ---------.....................................................---  
    ---------...............................................................---
    |.........................................................................|
    |.L.....................................................................L.|
    |.........................................................................|
    ---...............................................................---------
      ---.....................................................---------        
        ---...........................................---------                
          ---.................................---------                        
            ---.......................---------                                
              ---...L.........---------                                        
                ---...---------                                                
                  -----                                                        

    `);

    const terrain = ["L", "T", "{", "."]; tidx = Math.random(1, terrain.length); des.replace_terrain({ region={00,0, 74,18}, fromterrain:"L", toterrain:terrain[tidx] });  des.region(selection.area(1,1,73,17), "lit");  des.stair("up"); des.stair("down");  des.non_diggable();  for i = 1,15 do des.object(); }  for i = 1,6 do des.trap(); }  for i = 1,28 do des.monster(); end

    return des.finalize_level();
}
