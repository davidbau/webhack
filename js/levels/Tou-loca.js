/**
 * Tou-loca - NetHack special level
 * Converted from: Tou-loca.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Tourist Tou-loca.lua	$NHDT-Date: 1652196015 2022/5/10 15:20:15 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991,92 by M. Stephenson, P. Winner
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "hardfloor");
    des.map(`

    ----------------------------------------------------------------------------
    |....|......|..........|......|......|...|....|.....|......|...............|
    |....|......|.|------|.|......|......|.|.|....|..}..|......|.|----------|..|
    |....|--+----.|......|.|-S---+|+-----|.|.S....|.....|---+--|.|..........+..|
    |....|........|......|.|...|.........|.|------|..............|..........|-+|
    |....+...}}...+......|.|...|.|-----|.|..............|--+----------------|..|
    |----|........|------|.|---|.|.....|......|-----+-|.|.......|...........|--|
    |............................|.....|.|--+-|.......|.|.......|...........|..|
    |----|.....|-------------|...|--+--|.|....|.......|.|-----------+-------|..|
    |....+.....+.........S...|...........|....|-------|........................|
    |....|.....|.........|...|.|---------|....|.........|-------|.|----------|.|
    |....|.....|---------|---|.|......|..+....|-------|.|.......|.+......S.\.|.|
    |....|.....+.........S...|.|......|..|....|.......|.|.......|.|......|...|.|
    |-------|..|.........|---|.|+-------------------+-|.|.......+.|----------|.|
    |.......+..|---------|.........|.........|..........|.......|.|..........|.|
    |.......|..............|--+--|.|.........|.|----+-----------|.|..........|.|
    |---------+-|--+-----|-|.....|.|.........|.|........|.|.....+.|..........+.|
    |...........|........|.S.....|.|----+----|.|--------|.|.....|.|----------|.|
    |...........|........|.|.....|........................|.....|..............|
    ----------------------------------------------------------------------------

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    des.non_diggable(selection.area(0,0,75,19));
    // 
    des.region({ region: [1,1, 4,5], lit: 0, type: "morgue", filled: 1 });
    des.region({ region: [15,3, 20,5], lit: 1, type: "shop", filled: 1 });
    des.region({ region: [62,3, 71,4], lit: 1, type: "shop", filled: 1 });
    des.region({ region: [1,17, 11,18], lit: 1, type: "barracks", filled: 1 });
    des.region({ region: [12,9, 20,10], lit: 1, type: "barracks", filled: 1 });
    des.region({ region: [53,11, 59,14], lit: 1, type: "zoo", filled: 1 });
    des.region({ region: [63,14, 72,16], lit: 1, type: "barracks", filled: 1 });
    des.region({ region: [32,14, 40,16], lit: 1, type: "temple", filled: 1 });
    // 
    des.region({ region: [6,1,11,2], type: "ordinary" });
    des.region({ region: [24,1,29,2], type: "ordinary" });
    des.region({ region: [31,1,36,2], type: "ordinary" });
    des.region({ region: [42,1,45,3], type: "ordinary" });
    des.region({ region: [53,1,58,2], type: "ordinary" });
    des.region({ region: [24,4,26,5], type: "ordinary" });
    des.region({ region: [30,6,34,7], type: "ordinary" });
    des.region(selection.area(73,5,74,5), "unlit");
    des.region({ region: [1,9,4,12], type: "ordinary" });
    des.region({ region: [1,14,7,15], type: "ordinary" });
    des.region({ region: [12,12,20,13], type: "ordinary" });
    des.region({ region: [13,17,20,18], type: "ordinary" });
    des.region({ region: [22,9,24,10], type: "ordinary" });
    des.region({ region: [22,12,24,12], type: "ordinary" });
    des.region({ region: [24,16,28,18], type: "ordinary" });
    des.region({ region: [28,11,33,12], type: "ordinary" });
    des.region(selection.area(35,11,36,12), "lit");
    des.region({ region: [38,8,41,12], type: "ordinary" });
    des.region({ region: [43,7,49,8], type: "ordinary" });
    des.region({ region: [43,12,49,12], type: "ordinary" });
    des.region({ region: [44,16,51,16], type: "ordinary" });
    des.region({ region: [53,6,59,7], type: "ordinary" });
    des.region({ region: [61,6,71,7], type: "ordinary" });
    des.region({ region: [55,16,59,18], type: "ordinary" });
    des.region({ region: [63,11,68,12], type: "ordinary" });
    des.region({ region: [70,11,72,12], type: "ordinary" });
    // Stairs
    des.stair("up", 10,4);
    des.stair("down", 73,5);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    des.door("closed",5,5);
    des.door("closed",5,9);
    des.door("closed",8,14);
    des.door("closed",8,3);
    des.door("closed",11,9);
    des.door("closed",11,12);
    des.door("closed",10,16);
    des.door("closed",14,5);
    des.door("closed",15,16);
    des.door("locked",21,9);
    des.door("locked",21,12);
    des.door("closed",23,17);
    des.door("closed",25,3);
    des.door("closed",26,15);
    des.door("closed",29,3);
    des.door("closed",28,13);
    des.door("closed",31,3);
    des.door("closed",32,8);
    des.door("closed",37,11);
    des.door("closed",36,17);
    des.door("locked",41,3);
    des.door("closed",40,7);
    des.door("closed",48,6);
    des.door("closed",48,13);
    des.door("closed",48,15);
    des.door("closed",56,3);
    des.door("closed",55,5);
    des.door("closed",72,3);
    des.door("locked",74,4);
    des.door("closed",64,8);
    des.door("closed",62,11);
    des.door("closed",69,11);
    des.door("closed",60,13);
    des.door("closed",60,16);
    des.door("closed",73,16);

    // Objects
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
    // Toilet paper
    des.object("blank paper", 71, 12);
    des.object("blank paper", 71, 12);
    // Random traps - must avoid the 2 shops
    let validtraps = selection.area(0,0,75,19).filter_mapchar('.')
    validtraps = validtraps - (selection.area(15,3,20,5) + selection.area(62,3,71,4))
    for (let i = 1; i <= 9; i++) {
       des.trap(validtraps.rndcoord(1));
    }
    // Random monsters.
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
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("giant spider");
    des.monster("s");
    des.monster("s");


    return des.finalize_level();
}

