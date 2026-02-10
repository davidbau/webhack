/**
 * Ran-strt - NetHack special level
 * Converted from: Ran-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Ranger Ran-strt.lua	$NHDT-Date: 1652196011 2022/5/10 15:20:11 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, Orion,
    // && receive your quest assignment.
    // 
    des.level_init({ style: "solidfill", fg: "." });

    des.level_flags("mazelevel", "noteleport", "hardfloor", "arboreal");

    des.level_init({ style: "mines", fg: ".", bg: ".", smoothed: true, joined: true, lit: 1, walled: false });
    des.replace_terrain({ region: [0,0, 76,19], fromterrain: ".", toterrain: "T", chance: 5 });
    // 1234567890123456789012345678901234567890123456789012345678901234567890
    des.map({ halign: "left", valign: "center", map: `

                                           xx
       ...................................  x
      ..                                 ..  
     ..  ...............F...............  .. 
     .  ..             .F.             ..  . 
     . ..  .............F.............  .. . 
     . .  ..                         ..  . . 
     . . ..  .......................  .. ... 
     . . .  ..                     ..  .     
     ... . ..  .|..................... ......
     FFF . .  ..S..................          
     ... . ..  .|.................  .... ... 
     . . .  ..                     ..  . . . 
     . . ..  .......................  .. . . 
     . .  ..                         ..  . . 
     . ..  .............F.............  .. . 
     .  ..             .F.             ..  . 
     ..  ...............F...............  .. 
      ..                                 ..  
       ...................................  x
                                           xx

    ` });
    // Dungeon Description
    des.region(selection.area(0,0,40,20), "lit");
    // Stairs
    des.stair("down", 10,10);
    // Portal arrival point; just about anywhere on the right hand side of the map
    des.levregion({ region: [51,2,77,18], region_islev: 1, type: "branch" });
    // Orion
    des.monster({ id: "Orion", coord: [20, 10], inventory: function() {
       des.object({ id: "leather armor", spe: 4 });
       des.object({ id: "yumi", spe: 4 });
       des.object({ id: "ya", spe: 4, quantity: 50 });
    } })
    // The treasure of Orion
    des.object("chest", 20, 10);
    // Guards for the audience chamber
    des.monster("hunter", 19, 9);
    des.monster("hunter", 20, 9);
    des.monster("hunter", 21, 9);
    des.monster("hunter", 19, 10);
    des.monster("hunter", 21, 10);
    des.monster("hunter", 19, 11);
    des.monster("hunter", 20, 11);
    des.monster("hunter", 21, 11);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,40,20));
    // Traps
    des.trap("arrow",30,9);
    des.trap("arrow",30,10);
    des.trap("pit",40,9);
    des.trap("spiked pit");
    des.trap("bear");
    des.trap("bear");
    // Monsters on siege duty.
    des.monster({ id: "minotaur", x: 33, y: 9, peaceful: 0, asleep: 1 });
    des.monster({ id: "forest centaur", x: 19, y: 3, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 19, y: 4, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 19, y: 5, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 21, y: 3, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 21, y: 4, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 21, y: 5, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 1, y: 9, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 2, y: 9, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 3, y: 9, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 1, y: 11, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 2, y: 11, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 3, y: 11, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 19, y: 15, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 19, y: 16, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 19, y: 17, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 21, y: 15, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 21, y: 16, peaceful: 0 });
    des.monster({ id: "forest centaur", x: 21, y: 17, peaceful: 0 });
    des.monster({ id: "plains centaur", peaceful: 0 });
    des.monster({ id: "plains centaur", peaceful: 0 });
    des.monster({ id: "plains centaur", peaceful: 0 });
    des.monster({ id: "plains centaur", peaceful: 0 });
    des.monster({ id: "plains centaur", peaceful: 0 });
    des.monster({ id: "plains centaur", peaceful: 0 });
    des.monster({ id: "scorpion", peaceful: 0 });
    des.monster({ id: "scorpion", peaceful: 0 });


    return des.finalize_level();
}

