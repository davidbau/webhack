/**
 * Cav-loca - NetHack special level
 * Converted from: Cav-loca.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Caveman Cav-loca.lua	$NHDT-Date: 1652196002 2022/5/10 15:20:2 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "hardfloor");

    des.map(`


        .............                     ...........                           
       ...............                   .............                          
        .............                  ...............        ..........        
         ...........                    .............      ...............      
            ...                                    ...   ..................     
             ...                ..........          ... ..................      
              ...              ............          BBB...................     
               ...              ..........          ......................      
                .....                 ..      .....B........................    
      ....       ...............      .    ........B..........................  
     ......     .. .............S..............         ..................      
      ....     ..                ...........             ...............        
         ..  ...                                    ....................        
          ....                                      BB...................       
             ..                 ..                 ..  ...............          
              ..   .......     ....  .....  ....  ..     .......   S            
               ............     ....... ..  .......       .....    ...  ....    
                   .......       .....   ......                      .......    


    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "unlit");
    des.region({ region: [52,6, 73,15], lit: 1, type: "ordinary", irregular: 1 });
    // Doors
    des.door("locked",28,11);
    // Stairs
    des.stair("up", 4,3);
    des.stair("down", 73,10);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // Objects
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
    des.object();
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Random monsters.
    des.monster({ id: "bugbear", x: 2, y: 10, peaceful: 0 });
    des.monster({ id: "bugbear", x: 3, y: 11, peaceful: 0 });
    des.monster({ id: "bugbear", x: 4, y: 12, peaceful: 0 });
    des.monster({ id: "bugbear", x: 2, y: 11, peaceful: 0 });
    des.monster({ id: "bugbear", x: 16, y: 16, peaceful: 0 });
    des.monster({ id: "bugbear", x: 17, y: 17, peaceful: 0 });
    des.monster({ id: "bugbear", x: 18, y: 18, peaceful: 0 });
    des.monster({ id: "bugbear", x: 19, y: 16, peaceful: 0 });
    des.monster({ id: "bugbear", x: 30, y: 6, peaceful: 0 });
    des.monster({ id: "bugbear", x: 31, y: 7, peaceful: 0 });
    des.monster({ id: "bugbear", x: 32, y: 8, peaceful: 0 });
    des.monster({ id: "bugbear", x: 33, y: 6, peaceful: 0 });
    des.monster({ id: "bugbear", x: 34, y: 7, peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ class: "h", peaceful: 0 });
    des.monster({ class: "H", peaceful: 0 });
    des.monster({ id: "hill giant", x: 3, y: 12, peaceful: 0 });
    des.monster({ id: "hill giant", x: 20, y: 17, peaceful: 0 });
    des.monster({ id: "hill giant", x: 35, y: 8, peaceful: 0 });
    des.monster({ id: "hill giant", peaceful: 0 });
    des.monster({ id: "hill giant", peaceful: 0 });
    des.monster({ id: "hill giant", peaceful: 0 });
    des.monster({ id: "hill giant", peaceful: 0 });
    des.monster({ class: "H", peaceful: 0 });
    des.wallify();

    // 
    // The "goal" level for the quest.
    // 
    // Here you meet Tiamat your nemesis monster.  You have to
    // defeat Tiamat in combat to gain the artifact you have
    // been assigned to retrieve.
    // 


    return des.finalize_level();
}

