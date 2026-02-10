/**
 * orcus - NetHack special level
 * Converted from: orcus.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack gehennom orcus.lua	$NHDT-Date: 1652196033 2022/5/10 15:20:33 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson && Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel", "shortsighted");

    let tmpbounds = selection.match("-");
    let bnds = tmpbounds.bounds();
    let bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    // A ghost town
    let orcus1 = des.map({ halign: "right", valign: "center", map: `

    .|....|....|....|..............|....|........
    .|....|....|....|..............|....|........
    .|....|....|....|--...-+-------|.............
    .|....|....|....|..............+.............
    .|.........|....|..............|....|........
    .--+-...-+----+--....-------...--------.-+---
    .....................|.....|.................
    .....................|.....|.................
    .--+----....-+---....|.....|...----------+---
    .|....|....|....|....---+---...|......|......
    .|.........|....|..............|......|......
    .----...---------.....-----....+......|......
    .|........................|....|......|......
    .----------+-...--+--|....|....----------+---
    .|....|..............|....+....|.............
    .|....+.......|......|....|....|.............
    .|....|.......|......|....|....|.............

    `, contents: function(rm) {
       des.mazewalk(0,6,"west");
       // Entire main area
       des.region(selection.area(1,0,44,16),"unlit");
       des.stair("down", 33,15);
       // Wall "ruins"
       des.object("boulder",19,2);
       des.object("boulder",20,2);
       des.object("boulder",21,2);
       des.object("boulder",36,2);
       des.object("boulder",36,3);
       des.object("boulder",6,4);
       des.object("boulder",5,5);
       des.object("boulder",6,5);
       des.object("boulder",7,5);
       des.object("boulder",39,5);
       des.object("boulder",8,8);
       des.object("boulder",9,8);
       des.object("boulder",10,8);
       des.object("boulder",11,8);
       des.object("boulder",6,10);
       des.object("boulder",5,11);
       des.object("boulder",6,11);
       des.object("boulder",7,11);
       des.object("boulder",21,11);
       des.object("boulder",21,12);
       des.object("boulder",13,13);
       des.object("boulder",14,13);
       des.object("boulder",15,13);
       des.object("boulder",14,14);
       // Doors
       des.door("closed",23,2);
       des.door("open",31,3);
       des.door("nodoor",3,5);
       des.door("closed",9,5);
       des.door("closed",14,5);
       des.door("closed",41,5);
       des.door("open",3,8);
       des.door("nodoor",13,8);
       des.door("open",41,8);
       des.door("closed",24,9);
       des.door("closed",31,11);
       des.door("open",11,13);
       des.door("closed",18,13);
       des.door("closed",41,13);
       des.door("open",26,14);
       des.door("closed",6,15);
       // Special rooms
       des.altar({ x: 24,y: 7,align: "noalign",type: "sanctum" });
       des.region({ region: [22,12,25,16],lit: 0,type: "morgue",filled: 1 });
       des.region({ region: [32,9,37,12],lit: 1,type: "shop",filled: 1 });
       des.region({ region: [12,0,15,4],lit: 1,type: "shop",filled: 1 });
       // Some traps.
       des.trap("spiked pit");
       des.trap("sleep gas");
       des.trap("anti magic");
       des.trap("fire");
       des.trap("fire");
       des.trap("fire");
       des.trap("magic");
       des.trap("magic");
       // Some random objects
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
       // An object that's worth most of a wish
       // (this is part of the compensation for the reduced wishes at the Castle)
       if (Math.random(0, 1) == 1) {
          des.object("magic marker");
       } else {
          des.object("magic lamp");
       }
       // The resident nasty
       des.monster("Orcus",33,15);
       // And its preferred companions
       des.monster("human zombie",32,15);
       des.monster("shade",32,14);
       des.monster("shade",32,16);
       des.monster("vampire",35,16);
       des.monster("vampire",35,14);
       des.monster("vampire lord",36,14);
       des.monster("vampire lord",36,15);
       // Randomly placed companions
       des.monster("skeleton");
       des.monster("skeleton");
       des.monster("skeleton");
       des.monster("skeleton");
       des.monster("skeleton");
       des.monster("shade");
       des.monster("shade");
       des.monster("shade");
       des.monster("shade");
       des.monster("giant zombie");
       des.monster("giant zombie");
       des.monster("giant zombie");
       des.monster("ettin zombie");
       des.monster("ettin zombie");
       des.monster("ettin zombie");
       des.monster("human zombie");
       des.monster("human zombie");
       des.monster("human zombie");
       des.monster("vampire");
       des.monster("vampire");
       des.monster("vampire");
       des.monster("vampire lord");
       des.monster("vampire lord");
       // A few more for the party
       des.monster();
       des.monster();
       des.monster();
       des.monster();
       des.monster();
    } });

    des.levregion({ region: [1,0,12,20], region_islev: 1, exclude: [20,1,70,20], exclude_islev: 1, type: "stair-up" });
    des.levregion({ region: [1,0,12,20], region_islev: 1, exclude: [20,1,70,20], exclude_islev: 1, type: "branch" });
    des.teleport_region({ region: [1,0,12,20], region_islev: 1, exclude: [20,1,70,20], exclude_islev: 1 });

    let protected_region = bounds2.negate() | orcus1;
    hell_tweaks(protected_region);
    return des.finalize_level();
}

