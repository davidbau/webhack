/**
 * minend-2 - NetHack special level
 * Converted from: minend-2.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack mines minend-2.lua	$NHDT-Date: 1652196029 2022/5/10 15:20:29 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989-95 by Jean-Christophe Collet
    // Copyright (c) 1991-95 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // Mine } level variant 2
    // "Gnome King's Wine Cellar"

    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel");

    des.map(`

    ---------------------------------------------------------------------------
    |...................................................|                     |
    |.|---------S--.--|...|--------------------------|..|                     |
    |.||---|   |.||-| |...|..........................|..|                     |
    |.||...| |-|.|.|---...|.............................|                ..   |
    |.||...|-|.....|....|-|..........................|..|.               ..   |
    |.||.....|-S|..|....|............................|..|..                   |
    |.||--|..|..|..|-|..|----------------------------|..|-.                   |
    |.|   |..|..|....|..................................|...                  |
    |.|   |..|..|----|..-----------------------------|..|....                 |
    |.|---|..|--|.......|----------------------------|..|.....                |
    |...........|----.--|......................|     |..|.......              |
    |-----------|...|.| |------------------|.|.|-----|..|.....|..             |
    |-----------|.{.|.|--------------------|.|..........|.....|....           |
    |...............|.S......................|-------------..-----...         |
    |.--------------|.|--------------------|.|.........................       |
    |.................|                    |.....................|........    |
    ---------------------------------------------------------------------------

    `);

    if (percent(50)) {
       des.terrain([55,14],"-");
       des.terrain([56,14],"-");
       des.terrain([61,15],"|");
       des.terrain([52,5], "S");
       des.door("locked", 52,5);
    }
    if (percent(50)) {
       des.terrain([18,1], "|");
       des.terrain(selection.area(7,12, 8,13), ".");
    }
    if (percent(50)) {
       des.terrain([49,4], "|");
       des.terrain([21,5], ".");
    }
    if (percent(50)) {
       if (percent(50)) {
          des.terrain([22,1], "|");
       } else {
          des.terrain([50,7], "-");
          des.terrain([51,7], "-");
       }
    }

    // uncontrolled arrival (via trap door, level teleport) will be in the central
    // portion of level to prevent ending up stuck in the treasure area, whether
    // arriving from above || below (despite this being bottom of Mines branch,
    // hero might arrive from below by invoking Wiz role's Eye of the Aethiopica)
    des.teleport_region({ region: [23,3,48,16], region_islev: 1 });

    // Dungeon Description
    des.feature("fountain", [14,13]);
    des.region(selection.area(23,3,48,6),"lit");
    des.region(selection.area(21,6,22,6),"lit");
    des.region(selection.area(14,4,14,4),"unlit");
    des.region(selection.area(10,5,14,8),"unlit");
    des.region(selection.area(10,9,11,9),"unlit");
    des.region(selection.area(15,8,16,8),"unlit");
    // Secret doors
    des.door("locked",12,2);
    des.door("locked",11,6);
    // Stairs
    des.stair("up", 36,4);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,52,17));
    des.non_diggable(selection.area(53,0,74,0));
    des.non_diggable(selection.area(53,17,74,17));
    des.non_diggable(selection.area(74,1,74,16));
    des.non_diggable(selection.area(53,7,55,7));
    des.non_diggable(selection.area(53,14,61,14));
    // The Gnome King's wine cellar.
    // the Trespassers sign is a long-running joke
    des.engraving([12,3], "engrave",
    	      "You are now entering the Gnome King's wine cellar.")
    des.engraving([12,4], "engrave", "Trespassers will be persecuted!");
    des.object("potion of booze", 10, 7);
    des.object("potion of booze", 10, 7);
    des.object("!", 10, 7);
    des.object("potion of booze", 10, 8);
    des.object("potion of booze", 10, 8);
    des.object("!", 10, 8);
    des.object("potion of booze", 10, 9);
    des.object("potion of booze", 10, 9);
    des.object("potion of object detection", 10, 9);
    // Objects
    // The Treasure chamber...args
    des.object("diamond", 69, 4);
    des.object("*", 69, 4);
    des.object("diamond", 69, 4);
    des.object("*", 69, 4);
    des.object("emerald", 70, 4);
    des.object("*", 70, 4);
    des.object("emerald", 70, 4);
    des.object("*", 70, 4);
    des.object("emerald", 69, 5);
    des.object("*", 69, 5);
    des.object("ruby", 69, 5);
    des.object("*", 69, 5);
    des.object("ruby", 70, 5);
    des.object("amethyst", 70, 5);
    des.object("*", 70, 5);
    des.object("amethyst", 70, 5);
    des.object({ id: "luckstone", x: 70, y: 5,
    	     buc: "!-cursed", achievement: 1 });
    // Scattered gems...args
    des.object("*");
    des.object("*");
    des.object("*");
    des.object("*");
    des.object("*");
    des.object("*");
    des.object("*");
    des.object("(");
    des.object("(");
    des.object();
    des.object();
    des.object();
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Random monsters.
    des.monster("gnome king");
    des.monster("gnome lord");
    des.monster("gnome lord");
    des.monster("gnome lord");
    des.monster("gnomish wizard");
    des.monster("gnomish wizard");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("gnome");
    des.monster("hobbit");
    des.monster("hobbit");
    des.monster("dwarf");
    des.monster("dwarf");
    des.monster("dwarf");
    des.monster("h");


    return des.finalize_level();
}

