/**
 * Tou-goal - NetHack special level
 * Converted from: Tou-goal.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Tourist Tou-goal.lua	$NHDT-Date: 1652196015 2022/5/10 15:20:15 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991,92 by M. Stephenson, P. Winner
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel");

    des.map(`

    ----------------------------------------------------------------------------
    |.........|.........|..........|..| |.................|........|........|..|
    |.........|.........|..........|..| |....--------.....|........|........|..|
    |------S--|--+-----------+------..| |....|......|.....|........|........|..|
    |.........|.......................| |....|......+.....--+-------------+--..|
    |.........|.......................| |....|......|..........................|
    |-S-----S-|......----------.......| |....|......|..........................|
    |..|..|...|......|........|.......| |....-----------.........----..........|
    |..+..+...|......|........|.......| |....|.........|.........|}}|..........|
    |..|..|...|......+........|.......| |....|.........+.........|}}|..........|
    |..|..|...|......|........|.......S.S....|.........|.........----..........|
    |---..----|......|........|.......| |....|.........|.......................|
    |.........+......|+F-+F-+F|.......| |....-----------.......................|
    |---..----|......|..|..|..|.......| |......................--------------..|
    |..|..|...|......--F-F--F--.......| |......................+............|..|
    |..+..+...|.......................| |--.---...-----+-----..|............|..|
    |--|..----|--+-----------+------..| |.....|...|.........|..|------------|..|
    |..+..+...|.........|..........|..| |.....|...|.........|..+............|..|
    |..|..|...|.........|..........|..| |.....|...|.........|..|............|..|
    ----------------------------------------------------------------------------

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    // The Inn
    des.region(selection.area(1,1,9,2), "lit");
    des.region({ region: [1,4,9,5], lit: 1, type: "barracks", filled: 1 });
    des.region(selection.area(1,7,2,10), "unlit");
    des.region(selection.area(7,7,9,10), "unlit");
    des.region(selection.area(1,14,2,15), "unlit");
    des.region(selection.area(7,14,9,15), "unlit");
    des.region(selection.area(1,17,2,18), "unlit");
    des.region(selection.area(7,17,9,18), "unlit");
    // 
    des.region({ region: [11,1,19,2], lit: 0, type: "barracks", filled: 1 });
    des.region(selection.area(21,1,30,2), "unlit");
    des.region({ region: [11,17,19,18], lit: 0, type: "barracks", filled: 1 });
    des.region(selection.area(21,17,30,18), "unlit");
    // Police Station
    des.region(selection.area(18,7,25,11), "lit");
    des.region(selection.area(18,13,19,13), "unlit");
    des.region(selection.area(21,13,22,13), "unlit");
    des.region(selection.area(24,13,25,13), "unlit");
    // The town itself
    des.region(selection.area(42,3,47,6), "unlit");
    des.region(selection.area(42,8,50,11), "unlit");
    des.region({ region: [37,16,41,18], lit: 0, type: "morgue", filled: 1 });
    des.region(selection.area(47,16,55,18), "unlit");
    des.region(selection.area(55,1,62,3), "unlit");
    des.region(selection.area(64,1,71,3), "unlit");
    des.region({ region: [60,14,71,15], lit: 1, type: "shop", filled: 1 });
    des.region({ region: [60,17,71,18], lit: 1, type: "shop", filled: 1 });
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // Stairs
    des.stair("up", 70,8);
    // Doors
    des.door("locked",7,3);
    des.door("locked",2,6);
    des.door("locked",8,6);
    des.door("closed",3,8);
    des.door("closed",6,8);
    des.door("open",10,12);
    des.door("closed",3,15);
    des.door("closed",6,15);
    des.door("closed",3,17);
    des.door("closed",6,17);
    des.door("closed",13,3);
    des.door("random",25,3);
    des.door("closed",13,16);
    des.door("random",25,16);
    des.door("locked",17,9);
    des.door("locked",18,12);
    des.door("locked",21,12);
    des.door("locked",24,12);
    des.door("locked",34,10);
    des.door("locked",36,10);
    des.door("random",48,4);
    des.door("random",56,4);
    des.door("random",70,4);
    des.door("random",51,9);
    des.door("random",51,15);
    des.door("open",59,14);
    des.door("open",59,17);
    // Objects
    des.object({ id: "credit card", x: 4, y: 1, buc: "blessed", spe: 0, name: "The Platinum Yendorian Express Card" });
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
    // Random traps - must avoid the 2 shops
    let validtraps = selection.area(0,0,75,19).filter_mapchar('.')
    validtraps = validtraps - selection.area(60,14,71,18)
    for (let i = 1; i <= 6; i++) {
       des.trap(validtraps.rndcoord(1));
    }
    // Random monsters.
    des.monster({ id: "Master of Thieves", x: 4, y: 1, peaceful: 0 });
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
    // ladies of the evening
    des.monster("succubus", 2, 8);
    des.monster("succubus", 8, 8);
    des.monster("incubus", 2, 14);
    des.monster("incubus", 8, 14);
    des.monster("incubus", 2, 17);
    des.monster("incubus", 8, 17);
    // Police station (with drunken prisoners)
    des.monster({ id: "Kop Kaptain", x: 24, y: 9, peaceful: 0 });
    des.monster({ id: "Kop Lieutenant", x: 20, y: 9, peaceful: 0 });
    des.monster({ id: "Kop Lieutenant", x: 22, y: 11, peaceful: 0 });
    des.monster({ id: "Kop Lieutenant", x: 22, y: 7, peaceful: 0 });
    des.monster({ id: "Keystone Kop", x: 19, y: 7, peaceful: 0 });
    des.monster({ id: "Keystone Kop", x: 19, y: 8, peaceful: 0 });
    des.monster({ id: "Keystone Kop", x: 22, y: 9, peaceful: 0 });
    des.monster({ id: "Keystone Kop", x: 24, y: 11, peaceful: 0 });
    des.monster({ id: "Keystone Kop", x: 19, y: 11, peaceful: 0 });
    des.monster("prisoner", 19, 13);
    des.monster("prisoner", 21, 13);
    des.monster("prisoner", 24, 13);
    // 
    des.monster({ id: "watchman", x: 33, y: 10, peaceful: 0 });

    des.wallify();


    return des.finalize_level();
}

