/**
 * Arc-strt - NetHack special level
 * Converted from: Arc-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Archeologist Arc-strt.lua	$NHDT-Date: 1652195999 2022/5/10 15:19:59 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, Lord Carnarvon
    // && receive your quest assignment.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor");

    des.map(`

    ............................................................................
    ............................................................................
    ............................................................................
    ............................................................................
    ....................}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}.................
    ....................}-------------------------------------}.................
    ....................}|..S......+.................+.......|}.................
    ....................}-S---------------+----------|.......|}.................
    ....................}|.|...............|.......+.|.......|}.................
    ....................}|.|...............---------.---------}.................
    ....................}|.S.\.............+.................+..................
    ....................}|.|...............---------.---------}.................
    ....................}|.|...............|.......+.|.......|}.................
    ....................}-S---------------+----------|.......|}.................
    ....................}|..S......+.................+.......|}.................
    ....................}-------------------------------------}.................
    ....................}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}.................
    ............................................................................
    ............................................................................
    ............................................................................

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    des.region(selection.area(22,6,23,6), "unlit");
    des.region(selection.area(25,6,30,6), "unlit");
    des.region(selection.area(32,6,48,6), "unlit");
    des.region(selection.area(50,6,56,8), "lit");
    des.region(selection.area(40,8,46,8), "unlit");
    des.region(selection.area(22,8,22,12), "unlit");
    des.region(selection.area(24,8,38,12), "unlit");
    des.region(selection.area(48,8,48,8), "lit");
    des.region(selection.area(40,10,56,10), "lit");
    des.region(selection.area(48,12,48,12), "lit");
    des.region(selection.area(40,12,46,12), "unlit");
    des.region(selection.area(50,12,56,14), "lit");
    des.region(selection.area(22,14,23,14), "unlit");
    des.region(selection.area(25,14,30,14), "unlit");
    des.region(selection.area(32,14,48,14), "unlit");
    // Stairs
    des.stair("down", 55,7);
    // Portal arrival point
    des.levregion({ region: [63,6,63,6], type: "branch" });
    // Doors
    des.door("closed",22,7);
    des.door("closed",38,7);
    des.door("locked",47,8);
    des.door("locked",23,10);
    des.door("locked",39,10);
    des.door("locked",57,10);
    des.door("locked",47,12);
    des.door("closed",22,13);
    des.door("closed",38,13);
    des.door("locked",24,14);
    des.door("closed",31,14);
    des.door("locked",49,14);
    // Lord Carnarvon
    des.monster({ id: "Lord Carnarvon", coord: [25, 10], inventory: function() {
       des.object({ id: "fedora", spe: 5 });
       des.object({ id: "bullwhip", spe: 4 });
    } })
    // The treasure of Lord Carnarvon
    des.object("chest", 25, 10);
    // student guards for the audience chamber
    des.monster("student", 26, 9);
    des.monster("student", 27, 9);
    des.monster("student", 28, 9);
    des.monster("student", 26, 10);
    des.monster("student", 28, 10);
    des.monster("student", 26, 11);
    des.monster("student", 27, 11);
    des.monster("student", 28, 11);
    // city watch guards in the antechambers
    des.monster("watchman", 50, 6);
    des.monster("watchman", 50, 14);
    // Eels in the moat
    des.monster("giant eel", 20, 10);
    des.monster("giant eel", 45, 4);
    des.monster("giant eel", 33, 16);
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
    des.monster("S", 60, 9);
    des.monster("M", 60, 10);
    des.monster("S", 60, 11);
    des.monster("S", 60, 12);
    des.monster("M", 60, 13);
    des.monster("S", 61, 10);
    des.monster("S", 61, 11);
    des.monster("S", 61, 12);
    des.monster("S", 30, 3);
    des.monster("M", 20, 17);
    des.monster("S", 67, 2);
    des.monster("S", 10, 19);


    return des.finalize_level();
}

