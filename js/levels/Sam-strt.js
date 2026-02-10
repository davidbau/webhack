/**
 * Sam-strt - NetHack special level
 * Converted from: Sam-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Samurai Sam-strt.lua	$NHDT-Date: 1695932714 2023/9/28 20:25:14 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-92 by M. Stephenson, P. Winner
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, Lord Sato
    // && receive your quest assignment.
    // 
    // The throne room designation produces random atmospheric
    // messages (until the room is entered) but this one doesn't
    // actually contain any throne.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor");

    des.map(`

    ..............................................................PP............
    ...............................................................PP...........
    ..........---------------------------------------------------...PPP.........
    ..........|......|.........|...|..............|...|.........|....PPPPP......
    ......... |......|.........S...|..............|...S.........|.....PPPP......
    ..........|......|.........|---|..............|---|.........|.....PPP.......
    ..........+......|.........+...-------++-------...+.........|......PP.......
    ..........+......|.........|......................|.........|......PP.......
    ......... |......---------------------++--------------------|........PP.....
    ..........|.................................................|.........PP....
    ..........|.................................................|...........PP..
    ..........----------------------------------------...-------|............PP.
    ..........................................|.................|.............PP
    .............. ................. .........|.................|..............P
    ............. } ............... } ........|.................|...............
    .............. ........PP....... .........|.................|...............
    .....................PPP..................|.................|...............
    ......................PP..................-------------------...............
    ............................................................................
    ............................................................................

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    des.region({ region: [18,3, 26,7], lit: 1, type: "throne", filled: 2 });
    // Portal arrival zone
    des.levregion({ region: [62,12,70,17], type: "branch" });
    // Stairs
    des.stair("down", 29,4);
    // Doors
    des.door("locked",10,6);
    des.door("locked",10,7);
    des.door("closed",27,4);
    des.door("closed",27,6);
    des.door("closed",38,6);
    des.door("locked",38,8);
    des.door("closed",39,6);
    des.door("locked",39,8);
    des.door("closed",50,4);
    des.door("closed",50,6);
    // Lord Sato
    des.monster({ id: "Lord Sato", coord: [20, 4], inventory: function() {
       des.object({ id: "splint mail", spe: 5, eroded: -1, buc: "!-cursed" });
       des.object({ id: "katana", spe: 4, eroded: -1, buc: "!-cursed" });
    } })
    // The treasure of Lord Sato
    des.object("chest", 20, 4);
    // roshi guards for the audience chamber
    des.monster("roshi", 18, 4);
    des.monster("roshi", 18, 5);
    des.monster("roshi", 18, 6);
    des.monster("roshi", 18, 7);
    des.monster("roshi", 26, 4);
    des.monster("roshi", 26, 5);
    des.monster("roshi", 26, 6);
    des.monster("roshi", 26, 7);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Monsters on siege duty.
    des.monster({ id: "ninja", x: 64, y: 0, peaceful: 0 });
    des.monster("wolf", 65, 1);
    des.monster({ id: "ninja", x: 67, y: 2, peaceful: 0 });
    des.monster({ id: "ninja", x: 69, y: 5, peaceful: 0 });
    des.monster({ id: "ninja", x: 69, y: 6, peaceful: 0 });
    des.monster("wolf", 69, 7);
    des.monster({ id: "ninja", x: 70, y: 6, peaceful: 0 });
    des.monster({ id: "ninja", x: 70, y: 7, peaceful: 0 });
    des.monster({ id: "ninja", x: 72, y: 1, peaceful: 0 });
    des.monster("wolf", 75, 9);
    des.monster({ id: "ninja", x: 73, y: 5, peaceful: 0 });
    des.monster({ id: "ninja", x: 68, y: 2, peaceful: 0 });
    des.monster("stalker");


    return des.finalize_level();
}

