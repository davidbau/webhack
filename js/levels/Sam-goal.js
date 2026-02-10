/**
 * Sam-goal - NetHack special level
 * Converted from: Sam-goal.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Samurai Sam-goal.lua	$NHDT-Date: 1652196013 2022/5/10 15:20:13 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-92 by M. Stephenson, P. Winner
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport");

    des.map(`


               .......................           
           ......-------------------......       
        ......----.................----......    
       ....----.....-------------.....----....   
      ....--.....----...........----.....--....  
      ...||....---....---------....---....||...  
      ...|....--....---.......---....--....|...  
     ....|...||...---...--+--...---...||...|.... 
     ....|...|....|....|-...-|....|....|...|.... 
     ....|...|....|....+.....+....|....|...|.... 
     ....|...|....|....|-...-|....|....|...|.... 
     ....|...||...---...--+--...---...||...|.... 
      ...|....--....---.......---....--....|...  
      ...||....---....---------....---....||...  
      ....--.....----...........----.....--....  
       ....----.....-------------.....----....   
        ......----.................----......    
           ......-------------------......       
               .......................           

    `);
    // Dungeon Description
    let place = [ [2,11],[42,9] ]
    let placeidx = Math.random(1, place.length);

    des.region(selection.area(0,0,44,19), "unlit");
    // Doors
    des.door("closed",19,10);
    des.door("closed",22,8);
    des.door("closed",22,12);
    des.door("closed",25,10);
    // Stairs
    des.stair({ dir: "up", coord: place[placeidx] });

    // Holes in the concentric ring walls
    place: [ [22,14],[30,10],[22, 6],[14,10] ]
    placeidx: Math.random(1, place.length);
    des.terrain(place[placeidx], ".");
    place: [ [22, 4],[35,10],[22,16],[ 9,10] ]
    placeidx: Math.random(1, place.length);
    des.terrain(place[placeidx], ".");
    place: [ [22, 2],[22,18] ]
    placeidx: Math.random(1, place.length);
    des.terrain(place[placeidx], ".");

    // Non diggable walls
    des.non_diggable(selection.area(0,0,44,19));
    // Objects
    des.object({ id: "tsurugi", x: 22, y: 10, buc: "blessed", spe: 0, name: "The Tsurugi of Muramasa" });
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
    // 
    des.trap("board",22,9);
    des.trap("board",24,10);
    des.trap("board",22,11);
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Random monsters.
    des.monster("Ashikaga Takauji", 22, 10);
    des.monster({ id: "samurai", peaceful: 0 });
    des.monster({ id: "samurai", peaceful: 0 });
    des.monster({ id: "samurai", peaceful: 0 });
    des.monster({ id: "samurai", peaceful: 0 });
    des.monster({ id: "samurai", peaceful: 0 });
    des.monster({ id: "ninja", peaceful: 0 });
    des.monster({ id: "ninja", peaceful: 0 });
    des.monster({ id: "ninja", peaceful: 0 });
    des.monster({ id: "ninja", peaceful: 0 });
    des.monster({ id: "ninja", peaceful: 0 });
    des.monster("wolf");
    des.monster("wolf");
    des.monster("wolf");
    des.monster("wolf");
    des.monster("d");
    des.monster("d");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");


    return des.finalize_level();
}

