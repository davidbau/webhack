/**
 * Tou-strt - NetHack special level
 * Converted from: Tou-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Tourist Tou-strt.lua	$NHDT-Date: 1652196016 2022/5/10 15:20:16 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991,92 by M. Stephenson, P. Winner
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, Twoflower
    // && receive your quest assignment.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor");
    des.map(`

    .......}}....---------..-------------------------------------------------...
    ........}}...|.......|..|.-------------------------------------------...|...
    .........}}..|.......|..|.|......|......|.............|......|......|...|...
    ..........}}.|.......|..|.|......+......+.............+......+..\...|...|...
    ...........}}}..........|.|......|......|.............|......|......|...|...
    .............}}.........|.|----S-|--S---|S----------S-|---S--|------|...|...
    ..............}}}.......|...............................................|...
    ................}}}.....----S------++--S----------S----------S-----------...
    ..................}}...........    ..    ...................................
    ......-------......}}}}........}}}}..}}}}..}}}}..}}}}.......................
    ......|.....|.......}}}}}}..}}}}   ..   }}}}..}}}}..}}}.....................
    ......|.....+...........}}}}}}........................}}}..}}}}..}}}..}}}...
    ......|.....|...........................................}}}}..}}}..}}}}.}}}}
    ......-------...............................................................
    ............................................................................
    ...-------......-------.....................................................
    ...|.....|......|.....|.....................................................
    ...|.....+......+.....|.....................................................
    ...|.....|......|.....|.....................................................
    ...-------......-------.....................................................

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    des.region({ region: [14,1, 20,3], lit: 0, type: "morgue", filled: 1 });
    des.region(selection.area(7,10,11,12), "unlit");
    des.region(selection.area(4,16,8,18), "unlit");
    des.region(selection.area(17,16,21,18), "unlit");
    des.region(selection.area(27,2,32,4), "unlit");
    des.region(selection.area(34,2,39,4), "unlit");
    des.region(selection.area(41,2,53,4), "unlit");
    des.region(selection.area(55,2,60,4), "unlit");
    des.region(selection.area(62,2,67,4), "lit");
    // Stairs
    des.stair("down", 66,3);
    // Portal arrival point
    des.levregion({ region: [68,14,68,14], type: "branch" });
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // Doors
    des.door("locked",31,5);
    des.door("locked",36,5);
    des.door("locked",41,5);
    des.door("locked",52,5);
    des.door("locked",58,5);
    des.door("locked",28,7);
    des.door("locked",39,7);
    des.door("locked",50,7);
    des.door("locked",61,7);
    des.door("closed",33,3);
    des.door("closed",40,3);
    des.door("closed",54,3);
    des.door("closed",61,3);
    des.door("open",12,11);
    des.door("open",9,17);
    des.door("open",16,17);
    des.door("locked",35,7);
    des.door("locked",36,7);
    // Monsters on siege duty.
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("s");
    des.monster("s");
    des.monster("forest centaur");
    des.monster("forest centaur");
    des.monster("forest centaur");
    des.monster("forest centaur");
    des.monster("forest centaur");
    des.monster("forest centaur");
    des.monster("forest centaur");
    des.monster("forest centaur");
    des.monster("C");
    // Twoflower
    des.monster({ id: "Twoflower", coord: [64, 3], inventory: function() {
       des.object({ id: "walking shoes", spe: 3 });
       des.object({ id: "hawaiian shirt", spe: 3 });
    } })
    // The treasure of Twoflower
    des.object("chest", 64, 3);
    // guides for the audience chamber
    des.monster("guide", 29, 3);
    des.monster("guide", 32, 4);
    des.monster("guide", 35, 2);
    des.monster("guide", 38, 3);
    des.monster("guide", 45, 3);
    des.monster("guide", 48, 2);
    des.monster("guide", 49, 4);
    des.monster("guide", 51, 3);
    des.monster("guide", 57, 3);
    des.monster("guide", 62, 4);
    des.monster("guide", 66, 4);
    // path guards
    des.monster("watchman", 35, 8);
    des.monster("watchman", 36, 8);
    // river monsters
    des.monster("giant eel", 62, 12);
    des.monster("piranha", 47, 10);
    des.monster("piranha", 29, 11);
    des.monster("kraken", 34, 9);
    des.monster("kraken", 37, 9);
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();


    return des.finalize_level();
}

