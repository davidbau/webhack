/**
 * Mon-strt - NetHack special level
 * Converted from: Mon-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Monk Mon-strt.lua	$NHDT-Date: 1652196007 2022/5/10 15:20:7 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, the Grand Master
    // && receive your quest assignment.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor");

    des.map(`

    ............................................................................
    ............................................................................
    ............................................................................
    ....................------------------------------------....................
    ....................|................|.....|.....|.....|....................
    ....................|..------------..|--+-----+-----+--|....................
    ....................|..|..........|..|.................|....................
    ....................|..|..........|..|+---+---+-----+--|....................
    ..................---..|..........|......|...|...|.....|....................
    ..................+....|..........+......|...|...|.....|....................
    ..................+....|..........+......|...|...|.....|....................
    ..................---..|..........|......|...|...|.....|....................
    ....................|..|..........|..|+-----+---+---+--|....................
    ....................|..|..........|..|.................|....................
    ....................|..------------..|--+-----+-----+--|....................
    ....................|................|.....|.....|.....|....................
    ....................------------------------------------....................
    ............................................................................
    ............................................................................
    ............................................................................

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    des.region({ region: [24,6, 33,13], lit: 1, type: "temple" });

    des.replace_terrain({ region: [0,0, 10,19], fromterrain: ".", toterrain: "T", chance: 10 });
    des.replace_terrain({ region: [65,0, 75,19], fromterrain: ".", toterrain: "T", chance: 10 });

    let spacelocs = selection.floodfill(5,4);

    // Portal arrival point
    des.terrain([5,4], ".");
    des.levregion({ region: [5,4,5,4], type: "branch" });
    // Stairs
    des.stair("down", 52,9);
    // Doors
    des.door("locked",18,9);
    des.door("locked",18,10);
    des.door("closed",34,9);
    des.door("closed",34,10);
    des.door("closed",40,5);
    des.door("closed",46,5);
    des.door("closed",52,5);
    des.door("locked",38,7);
    des.door("closed",42,7);
    des.door("closed",46,7);
    des.door("closed",52,7);
    des.door("locked",38,12);
    des.door("closed",44,12);
    des.door("closed",48,12);
    des.door("closed",52,12);
    des.door("closed",40,14);
    des.door("closed",46,14);
    des.door("closed",52,14);
    // Unattended Altar - unaligned due to conflict - player must align it.
    des.altar({ x: 28,y: 9, align: "noalign", type: "altar" });
    // The Grand Master
    des.monster({ id: "Grand Master", coord: [28, 10], inventory: function() {
       des.object({ id: "robe", spe: 6 });
    } })
    // No treasure chest!
    // guards for the audience chamber
    des.monster("abbot", 32, 7);
    des.monster("abbot", 32, 8);
    des.monster("abbot", 32, 11);
    des.monster("abbot", 32, 12);
    des.monster("abbot", 33, 7);
    des.monster("abbot", 33, 8);
    des.monster("abbot", 33, 11);
    des.monster("abbot", 33, 12);
    // Non diggable walls
    des.non_diggable(selection.area(18,3,55,16));
    // Random traps
    for (let i = 1; i <= 2; i++) {
       des.trap("dart", spacelocs.rndcoord(1));
    }
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Monsters on siege duty.
    for (let i = 1; i <= 8; i++) {
       des.monster("earth elemental", spacelocs.rndcoord(1));
    }
    for (let i = 1; i <= 4; i++) {
       des.monster("xorn", spacelocs.rndcoord(1));
    }
    // next to leader, so possibly tricky to pick up if ! ready for quest yet;
    // there's no protection against a xorn eating these tins; BUC state is random
    des.object({ id: "tin", coord: [29, 9], quantity: 2, montype: "spinach" });
    // ensure enough vegetarian food generates for vegetarian games
    des.object({ id: "food ration", coord: [46, 4], quantity: 4});


    return des.finalize_level();
}

