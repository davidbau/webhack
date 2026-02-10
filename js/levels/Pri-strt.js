/**
 * Pri-strt - NetHack special level
 * Converted from: Pri-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Priest Pri-strt.lua	$NHDT-Date: 1652196009 2022/5/10 15:20:9 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.5 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, High Priest
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
    des.region({ region: [24,6, 33,13], lit: 1, type: "temple", filled: 2 });

    des.replace_terrain({ region: [0,0, 10,19], fromterrain: ".", toterrain: "T", chance: 10 });
    des.replace_terrain({ region: [65,0, 75,19], fromterrain: ".", toterrain: "T", chance: 10 });
    des.terrain([5,4], ".");

    let spacelocs = selection.floodfill(5,4);

    // Portal arrival point
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
    des.altar({ x: 28, y: 9, align: "noalign", type: "altar" });
    // High Priest
    des.monster({ id: "Arch Priest", coord: [28, 10], inventory: function() {
       des.object({ id: "robe", spe: 4 });
       des.object({ id: "mace", spe: 4 });
    } })
    // The treasure of High Priest
    des.object("chest", 27, 10);
    // knight guards for the audience chamber
    des.monster("acolyte", 32, 7);
    des.monster("acolyte", 32, 8);
    des.monster("acolyte", 32, 11);
    des.monster("acolyte", 32, 12);
    des.monster("acolyte", 33, 7);
    des.monster("acolyte", 33, 8);
    des.monster("acolyte", 33, 11);
    des.monster("acolyte", 33, 12);
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
    for (let i = 1; i <= 12; i++) {
       des.monster("human zombie", spacelocs.rndcoord(1));
    
    }
    return des.finalize_level();
}

