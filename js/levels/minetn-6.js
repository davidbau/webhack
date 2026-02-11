/**
 * minetn-6 - NetHack special level
 * Converted from: minetn-6.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent, shuffle } from '../sp_lev.js';
import { A_CHAOTIC, A_NEUTRAL, A_LAWFUL } from '../config.js';

// Helper function: returns shop type based on role
// C ref: NetHack minetn levels - "health food shop" for Monk, "food shop" otherwise
// During level generation, role is unknown, so use 50/50 random selection
function monkfoodshop() {
    return percent(50) ? "health food shop" : "food shop";
}

export function generate() {
    // Shuffle alignment array for altar shrines (standard NetHack pattern)
    const align = [A_CHAOTIC, A_NEUTRAL, A_LAWFUL];
    shuffle(align);
    // NetHack mines minetn-6.lua	$NHDT-Date: 1652196031 2022/5/10 15:20:31 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
    // Copyright (c) 1989-95 by Jean-Christophe Collet
    // Copyright (c) 1991-95 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // "Bustling Town" by Kelly Bailey

    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "inaccessibles");

    des.level_init({ style: "mines", fg: ".", bg: "-", smoothed: true, joined: true,lit: 1,walled: true });

    // Map extends the full height of the playable area in order to prevent any of
    // the cavern fill from getting cut off by walls of the town buildings &&
    // creating inaccessible spaces. The inaccessibles flag does compensate for
    // this, but it does so by doing things like creating backdoors into adjacent
    // shops which we don't want.
    des.map({ halign: "center", valign: "top", map: `

    x--------xxxxxxxxxxx-------------------x
    x------xxxxxxxxxxxxxx-----------------xx
    .-----................----------------.x
    .|...|................|...|..|...|...|..
    .|...+..--+--.........|...|..|...|...|..
    .|...|..|...|..-----..|...|..|-+---+--..
    .-----..|...|--|...|..--+---+-.........x
    ........|...|..|...+.............-----.x
    ........-----..|...|......--+-...|...|..
    x----...|...|+------..{...|..|...+...|..
    x|..+...|...|.............|..|...|...|..
    .|..|...|...|-+-.....---+-------------.x
    .----...--+--..|..-+-|..................
    ...|........|..|..|..|----....--------.x
    ...|..T.....----..|..|...+....|......|..
    ...|-....{........|..|...|....+......|x.
    ...--..-....T.....--------....|......|x.
    .......--.....................----------
    .xxxx-----xxxxxxxxxxxxxxxxxx------------
    xxxx-------xxxxxxxxxxxxxxx--------------

    ` });

    des.region(selection.area(0,0,39,19),"lit");

    // stairs can generate 1 column left || right inside the map,
    // in case the randomly generated mines layout doesn't extend outside the map
    des.levregion({ type: "stair-up", region: [1,3,21,19], region_islev: 1, exclude: [1,0,39,18] });
    des.levregion({ type: "stair-down", region: [60,3,75,19], region_islev: 1, exclude: [0,0,38,18] });

    des.region(selection.area(13,7,14,8),"unlit");
    des.region({ region: [9,9, 11,11], lit: 1, type: "candle shop", filled: 1 });
    des.region({ region: [16,6, 18,8], lit: 1, type: "tool shop", filled: 1 });
    des.region({ region: [23,3, 25,5], lit: 1, type: "shop", filled: 1 });
    des.region({ region: [22,14, 24,15], lit: 1, type: monkfoodshop(), filled: 1 });
    des.region({ region: [31,14, 36,16], lit: 1, type: "temple", filled: 1 });
    des.altar({ x: 35,y: 15,align: align[1],type: "shrine"});

    des.door("closed",5,4);
    des.door("locked",4,10);
    des.door("closed",10,4);
    des.door("closed",10,12);
    des.door("locked",13,9);
    des.door("locked",14,11);
    des.door("closed",19,7);
    des.door("closed",19,12);
    des.door("closed",24,6);
    des.door("closed",24,11);
    des.door("closed",25,14);
    des.door("closed",28,6);
    des.door("locked",28,8);
    des.door("closed",30,15);
    des.door("closed",31,5);
    des.door("closed",35,5);
    des.door("closed",33,9);

    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome", 14, 8);
    des.monster("gnome lord", 14, 7);
    des.monster("gnome", 27, 10);
    des.monster("gnome lord");
    des.monster("gnome lord");
    des.monster("dwarf");
    des.monster("dwarf");
    des.monster("dwarf");
    des.monster({ id: "watchman", peaceful: 1 });
    des.monster({ id: "watchman", peaceful: 1 });
    des.monster({ id: "watchman", peaceful: 1 });
    des.monster({ id: "watch captain", peaceful: 1 });
    des.monster({ id: "watch captain", peaceful: 1 });



    return des.finalize_level();
}
