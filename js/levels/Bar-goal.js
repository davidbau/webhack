/**
 * Bar-goal - NetHack special level
 * Converted from: Bar-goal.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Barbarian Bar-goal.lua	$NHDT-Date: 1652196000 2022/5/10 15:20:0 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel");

    des.map(`


                                   .............                                
                                 ..................                             
            ....              .........................          ....           
          .......          ..........................           .......         
          ......             ........................          .......          
          ..  ......................................             ..             
           ..                 .....................             ..              
            ..                 ..................              ..               
             ..         ..S...S..............   ................                
              ..                   ........                ...                  
           .........                                         ..                 
           ......  ..                                         ...  ....         
          .. ...    ..                             ......       ........        
       ....          .. ..................        ........       ......         
      ......          ......................       ......         ..            
       ....             ..................              ...........             
                          ..............                                        
                            ...........                                         


    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "unlit");
    // Secret doors
    des.door("locked",22,9);
    des.door("locked",26,9);
    // Stairs
    des.stair("up", 36,5);
    // The altar.  Unattended.
    des.altar({ x: 63,y: 4,align: "noncoaligned", type: "altar" });
    des.non_diggable(selection.area(0,0,75,19));
    // Objects
    des.object({ id: "luckstone", x: 63, y: 4,buc: "blessed",spe: 0,name: "The Heart of Ahriman" });
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Random monsters.
    des.monster({ id: "Thoth Amon", x: 63, y: 4, peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ class: "O", peaceful: 0 });
    des.monster({ class: "O", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ class: "T", peaceful: 0 });
    des.wallify();



    return des.finalize_level();
}

