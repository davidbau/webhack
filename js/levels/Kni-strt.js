/**
 * Kni-strt - NetHack special level
 * Converted from: Kni-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';
import { rn2 } from '../rng.js';

export function generate() {
    // NetHack Knight Kni-strt.lua	$NHDT-Date: 1652196006 2022/5/10 15:20:6 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991,92 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, King Arthur
    // && receive your quest assignment.
    // 
    des.level_init({ style: "solidfill", fg: "." });

    des.level_flags("mazelevel", "noteleport", "hardfloor");
    // This is a kludge to init the level as a lit field.
    des.level_init({ style: "mines", fg: ".", bg: ".", smoothed: false, joined: false, lit: 1, walled: false });

    des.map(`

    ..................................................
    .-----......................................-----.
    .|...|......................................|...|.
    .--|+-------------------++-------------------+|--.
    ...|...................+..+...................|...
    ...|.|-----------------|++|-----------------|.|...
    ...|.|.................|..|.........|.......|.|...
    ...|.|...\.............+..+.........|.......|.|...
    ...|.|.................+..+.........+.......|.|...
    ...|.|.................|..|.........|.......|.|...
    ...|.|--------------------------------------|.|...
    ...|..........................................|...
    .--|+----------------------------------------+|--.
    .|...|......................................|...|.
    .-----......................................-----.
    ..................................................

    `);
    // Dungeon Description
    des.region(selection.area(0,0,49,15), "lit");
    des.region(selection.area(4,4,45,11), "unlit");
    des.region({ region: [6,6,22,9], lit: 1, type: "throne", filled: 2 });
    des.region(selection.area(27,6,43,9), "lit");
    // Portal arrival point
    des.levregion({ region: [20,14,20,14], type: "branch" });
    // Stairs
    des.stair("down", 40,7);
    // Doors
    // Outside Doors
    des.door("locked",24,3);
    des.door("locked",25,3);
    // Inside Doors
    des.door("closed",23,4);
    des.door("closed",26,4);
    des.door("locked",24,5);
    des.door("locked",25,5);
    des.door("closed",23,7);
    des.door("closed",26,7);
    des.door("closed",23,8);
    des.door("closed",26,8);
    des.door("closed",36,8);
    // Watchroom Doors
    des.door("closed",4,3);
    des.door("closed",45,3);
    des.door("closed",4,12);
    des.door("closed",45,12);
    // King Arthur
    des.monster({ id: "King Arthur", coord: [9, 7], inventory: function() {
       des.object({ id: "long sword", spe: 4, buc: "blessed", name: "Excalibur" });
       des.object({ id: "plate mail", spe: 4 });
    } })
    // The treasure of King Arthur
    des.object("chest", 9, 7);
    // knight guards for the watchrooms
    des.monster({ id: "knight", x: 4, y: 2, peaceful: 1 });
    des.monster({ id: "knight", x: 4, y: 13, peaceful: 1 });
    des.monster({ id: "knight", x: 45, y: 2, peaceful: 1 });
    des.monster({ id: "knight", x: 45, y: 13, peaceful: 1 });
    // page guards for the audience chamber
    des.monster("page", 16, 6);
    des.monster("page", 18, 6);
    des.monster("page", 20, 6);
    des.monster("page", 16, 9);
    des.monster("page", 18, 9);
    des.monster("page", 20, 9);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,49,15));
    // Random traps
    des.trap("sleep gas",24,4);
    des.trap("sleep gas",25,4);
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Monsters on siege duty.
    des.monster({ id: "quasit", x: 14, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 16, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 18, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 20, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 22, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 24, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 26, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 28, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 30, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 32, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 34, y: 0, peaceful: 0 });
    des.monster({ id: "quasit", x: 36, y: 0, peaceful: 0 });

    // Some warhorses
    for (let i = 1; i <= 2 + nh.rn2(3); i++) {
        des.monster({ id: "warhorse", peaceful: 1, inventory: function() { if (percent(50)) { des.object("saddle"); } } });
    
    }
    return des.finalize_level();
}

