/**
 * Pri-loca - NetHack special level
 * Converted from: Pri-loca.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Priest Pri-loca.lua	$NHDT-Date: 1652196009 2022/5/10 15:20:9 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "hardfloor", "noflip");
    // This is a kludge to init the level as a lit field.
    des.level_init({ style: "mines", fg: ".", bg: ".", smoothed: false, joined: false, lit: 1, walled: false });

    des.map(`

    ........................................
    ........................................
    ..........----------+----------.........
    ..........|........|.|........|.........
    ..........|........|.|........|.........
    ..........|----.----.----.----|.........
    ..........+...................+.........
    ..........+...................+.........
    ..........|----.----.----.----|.........
    ..........|........|.|........|.........
    ..........|........|.|........|.........
    ..........----------+----------.........
    ........................................
    ........................................

    `);
    // Dungeon Description
    des.region({ region: [0,0, 9,13], lit: 0, type: "morgue", filled: 1 });
    des.region({ region: [9,0, 30,1], lit: 0, type: "morgue", filled: 1 });
    des.region({ region: [9,12, 30,13], lit: 0, type: "morgue", filled: 1 });
    des.region({ region: [31,0, 39,13], lit: 0, type: "morgue", filled: 1 });
    des.region({ region: [11,3, 29,10], lit: 1, type: "temple", filled: 1, irregular: 1 });
    // The altar inside the temple
    des.altar({ x: 20,y: 7, align: "noalign", type: "shrine" });
    des.monster({ id: "aligned cleric", x: 20, y: 7, align: "noalign", peaceful: 0 });
    // Doors
    des.door("locked",10,6);
    des.door("locked",10,7);
    des.door("locked",20,2);
    des.door("locked",20,11);
    des.door("locked",30,6);
    des.door("locked",30,7);
    // Stairs
    // Note:  The up stairs are *intentionally* off of the map.
    des.stair("up", 43,5);
    des.stair("down", 20,6);
    // Non diggable walls
    des.non_diggable(selection.area(10,2,30,13));
    // Objects (inside the antechambers).
    des.object({ coord: [ 14, 3 ] });
    des.object({ coord: [ 15, 3 ] });
    des.object({ coord: [ 16, 3 ] });
    des.object({ coord: [ 14, 10 ] });
    des.object({ coord: [ 15, 10 ] });
    des.object({ coord: [ 16, 10 ] });
    des.object({ coord: [ 17, 10 ] });
    des.object({ coord: [ 24, 3 ] });
    des.object({ coord: [ 25, 3 ] });
    des.object({ coord: [ 26, 3 ] });
    des.object({ coord: [ 27, 3 ] });
    des.object({ coord: [ 24, 10 ] });
    des.object({ coord: [ 25, 10 ] });
    des.object({ coord: [ 26, 10 ] });
    des.object({ coord: [ 27, 10 ] });
    // Random traps
    des.trap({ coord: [ 15,4 ] });
    des.trap({ coord: [ 25,4 ] });
    des.trap({ coord: [ 15,9 ] });
    des.trap({ coord: [ 25,9 ] });
    des.trap();
    des.trap();
    // No random monsters - the morgue generation will put them in.


    return des.finalize_level();
}

