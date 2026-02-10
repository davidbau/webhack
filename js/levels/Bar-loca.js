/**
 * Bar-loca - NetHack special level
 * Converted from: Bar-loca.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Barbarian Bar-loca.lua	$NHDT-Date: 1652196000 2022/5/10 15:20:0 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "hardfloor");

    des.map(`

    ..........PPP.........................................                      
    ...........PP..........................................        .......      
    ..........PP...........-----..........------------------     ..........     
    ...........PP..........+...|..........|....S...........|..  ............    
    ..........PPP..........|...|..........|-----...........|...  .............  
    ...........PPP.........-----..........+....+...........|...  .............  
    ..........PPPPPPPPP...................+....+...........S.................   
    ........PPPPPPPPPPPPP.........-----...|-----...........|................    
    ......PPPPPPPPPPPPPP..P.......+...|...|....S...........|          ...       
    .....PPPPPPP......P..PPPP.....|...|...------------------..         ...      
    ....PPPPPPP.........PPPPPP....-----........................      ........   
    ...PPPPPPP..........PPPPPPP..................................   ..........  
    ....PPPPPPP........PPPPPPP....................................  ..........  
    .....PPPPP........PPPPPPP.........-----........................   ........  
    ......PPP..PPPPPPPPPPPP...........+...|.........................    .....   
    ..........PPPPPPPPPPP.............|...|.........................     ....   
    ..........PPPPPPPPP...............-----.........................       .    
    ..............PPP.................................................          
    ...............PP....................................................       
    ................PPP...................................................      

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    des.region(selection.area(24,3,26,4), "unlit");
    des.region(selection.area(31,8,33,9), "unlit");
    des.region(selection.area(35,14,37,15), "unlit");
    des.region(selection.area(39,3,54,8), "lit");
    des.region(selection.area(56,0,75,8), "unlit");
    des.region(selection.area(64,9,75,16), "unlit");
    // Doors
    des.door("open",23,3);
    des.door("open",30,8);
    des.door("open",34,14);
    des.door("locked",38,5);
    des.door("locked",38,6);
    des.door("closed",43,3);
    des.door("closed",43,5);
    des.door("closed",43,6);
    des.door("closed",43,8);
    des.door("locked",55,6);
    // Stairs
    des.stair("up", 5,2);
    des.stair("down", 70,13);
    // Objects
    des.object({ x: 42, y: 3 });
    des.object({ x: 42, y: 3 });
    des.object({ x: 42, y: 3 });
    des.object({ x: 41, y: 3 });
    des.object({ x: 41, y: 3 });
    des.object({ x: 41, y: 3 });
    des.object({ x: 41, y: 3 });
    des.object({ x: 41, y: 8 });
    des.object({ x: 41, y: 8 });
    des.object({ x: 42, y: 8 });
    des.object({ x: 42, y: 8 });
    des.object({ x: 42, y: 8 });
    des.object({ x: 71, y: 13 });
    des.object({ x: 71, y: 13 });
    des.object({ x: 71, y: 13 });
    // Random traps
    des.trap("spiked pit",10,13);
    des.trap("spiked pit",21,7);
    des.trap("spiked pit",67,8);
    des.trap("spiked pit",68,9);
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Random monsters.
    des.monster({ id: "ogre", x: 12, y: 9, peaceful: 0 });
    des.monster({ id: "ogre", x: 18, y: 11, peaceful: 0 });
    des.monster({ id: "ogre", x: 45, y: 5, peaceful: 0 });
    des.monster({ id: "ogre", x: 45, y: 6, peaceful: 0 });
    des.monster({ id: "ogre", x: 47, y: 5, peaceful: 0 });
    des.monster({ id: "ogre", x: 46, y: 5, peaceful: 0 });
    des.monster({ id: "ogre", x: 56, y: 3, peaceful: 0 });
    des.monster({ id: "ogre", x: 56, y: 4, peaceful: 0 });
    des.monster({ id: "ogre", x: 56, y: 5, peaceful: 0 });
    des.monster({ id: "ogre", x: 56, y: 6, peaceful: 0 });
    des.monster({ id: "ogre", x: 57, y: 3, peaceful: 0 });
    des.monster({ id: "ogre", x: 57, y: 4, peaceful: 0 });
    des.monster({ id: "ogre", x: 57, y: 5, peaceful: 0 });
    des.monster({ id: "ogre", x: 57, y: 6, peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ id: "ogre", peaceful: 0 });
    des.monster({ class: "O", peaceful: 0 });
    des.monster({ class: "T", peaceful: 0 });
    des.monster({ id: "rock troll", x: 46, y: 6, peaceful: 0 });
    des.monster({ id: "rock troll", x: 47, y: 6, peaceful: 0 });
    des.monster({ id: "rock troll", x: 56, y: 7, peaceful: 0 });
    des.monster({ id: "rock troll", x: 57, y: 7, peaceful: 0 });
    des.monster({ id: "rock troll", x: 70, y: 13, peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ id: "rock troll", peaceful: 0 });
    des.monster({ class: "T", peaceful: 0 });



    return des.finalize_level();
}

