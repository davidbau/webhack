/**
 * Bar-strt - NetHack special level
 * Converted from: Bar-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Barbarian Bar-strt.lua	$NHDT-Date: 1652196001 2022/5/10 15:20:1 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, Pelias,
    // && receive your quest assignment.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor");

    des.map(`

    ..................................PP........................................
    ...................................PP.......................................
    ...................................PP.......................................
    ....................................PP......................................
    ........--------------......-----....PPP....................................
    ........|...S........|......+...|...PPP.....................................
    ........|----........|......|...|....PP.....................................
    ........|.\..........+......-----...........................................
    ........|----........|...............PP.....................................
    ........|...S........|...-----.......PPP....................................
    ........--------------...+...|......PPPPP...................................
    .........................|...|.......PPP....................................
    ...-----......-----......-----........PP....................................
    ...|...+......|...+..--+--.............PP...................................
    ...|...|......|...|..|...|..............PP..................................
    ...-----......-----..|...|.............PPPP.................................
    .....................-----............PP..PP................................
    .....................................PP...PP................................
    ....................................PP...PP.................................
    ....................................PP....PP................................

    `);

    // the forest beyond the river
    des.replace_terrain({ region: [37,0, 59,19], fromterrain: ".", toterrain: "T", chance: 5 });
    des.replace_terrain({ region: [60,0, 64,19], fromterrain: ".", toterrain: "T", chance: 10 });
    des.replace_terrain({ region: [65,0, 75,19], fromterrain: ".", toterrain: "T", chance: 20 });
    // guarantee a path && free spot for the portal
    des.terrain(selection.randline(selection.new(), 37,7, 62,2, 7), ".");
    des.terrain([62,2], ".");

    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    des.region(selection.area(9,5,11,5), "unlit");
    des.region(selection.area(9,7,11,7), "lit");
    des.region(selection.area(9,9,11,9), "unlit");
    des.region(selection.area(13,5,20,9), "lit");
    des.region(selection.area(29,5,31,6), "lit");
    des.region(selection.area(26,10,28,11), "lit");
    des.region(selection.area(4,13,6,14), "lit");
    des.region(selection.area(15,13,17,14), "lit");
    des.region(selection.area(22,14,24,15), "lit");
    // Stairs
    des.stair("down", 9,9);
    // Portal arrival point
    des.levregion({ region: [62,2,62,2], type: "branch" });
    // Doors
    des.door("locked",12,5);
    des.door("locked",12,9);
    des.door("closed",21,7);
    des.door("open",7,13);
    des.door("open",18,13);
    des.door("open",23,13);
    des.door("open",25,10);
    des.door("open",28,5);
    // Elder
    des.monster({ id: "Pelias", coord: [10, 7], inventory: function() {
       des.object({ id: "runesword", spe: 5 });
       des.object({ id: "chain mail", spe: 5 });
    } })
    // The treasure of Pelias
    des.object("chest", 9, 5);
    // chieftain guards for the audience chamber
    des.monster("chieftain", 10, 5);
    des.monster("chieftain", 10, 9);
    des.monster("chieftain", 11, 5);
    des.monster("chieftain", 11, 9);
    des.monster("chieftain", 14, 5);
    des.monster("chieftain", 14, 9);
    des.monster("chieftain", 16, 5);
    des.monster("chieftain", 16, 9);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // One trap to keep the ogres at bay.
    des.trap("spiked pit",37,7);
    // Eels in the river
    des.monster("giant eel", 36, 1);
    des.monster("giant eel", 37, 9);
    des.monster("giant eel", 39, 15);
    // Monsters on siege duty.
    let ogrelocs = selection.floodfill(37,7) & selection.area(40,3, 45,20)
    for (let i = 0; i <= 11; i++) {
       des.monster({ id: "ogre", coord: ogrelocs.rndcoord(1), peaceful: 0 });
    
    }
    return des.finalize_level();
}

