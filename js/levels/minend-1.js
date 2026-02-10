/**
 * minend-1 - NetHack special level
 * Converted from: minend-1.lua
 */

import * as des from '../sp_lev.js';
import { selection, shuffle } from '../sp_lev.js';

export function generate() {
    // NetHack mines minend-1.lua	$NHDT-Date: 1652196029 2022/5/10 15:20:29 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
    // Copyright (c) 1989-95 by Jean-Christophe Collet
    // Copyright (c) 1991-95 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // Mine } level variant 1
    // "Mimic of the Mines"

    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel");

    des.map(`

    ------------------------------------------------------------------   ------
    |                        |.......|     |.......-...|       |.....|.       |
    |    ---------        ----.......-------...........|       ---...-S-      |
    |    |.......|        |..........................-S-      --.......|      |
    |    |......-------   ---........................|.       |.......--      |
    |    |..--........-----..........................|.       -.-..----       |
    |    --..--.-----........-.....................---        --..--          |
    |     --..--..| -----------..................---.----------..--           |
    |      |...--.|    |..S...S..............---................--            |
    |     ----..-----  ------------........--- ------------...---             |
    |     |.........--            ----------              ---...-- -----      |
    |    --.....---..--                           --------  --...---...--     |
    | ----..-..-- --..---------------------      --......--  ---........|     |
    |--....-----   --..-..................---    |........|    |.......--     |
    |.......|       --......................S..  --......--    ---..----      |
    |--.--.--        ----.................---     ------..------...--         |
    | |....S..          |...............-..|         ..S...........|          |
    --------            --------------------           ------------------------

    `);

    // Dungeon Description
    let place = [ [8,16],[13,7],[21,8],[41,14],[50,4],[50,16],[66,1] ]
    shuffle(place)

    // make the entry chamber a real room; it affects monster arrival
    des.region({ region: [26,1,32,1], lit: 0, type: "ordinary", irregular: 1, arrival_room: true });
    des.region(selection.area(20,8,21,8),"unlit");
    des.region(selection.area(23,8,25,8),"unlit");
    // Secret doors
    des.door("locked",7,16);
    des.door("locked",22,8);
    des.door("locked",26,8);
    des.door("locked",40,14);
    des.door("locked",50,3);
    des.door("locked",51,16);
    des.door("locked",66,2);
    // Stairs
    des.stair("up", 36,4);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,74,17));
    // Niches
    // Note: place[6] empty
    des.object("diamond",place[7]);
    des.object("emerald",place[7]);
    des.object("worthless piece of violet glass",place[7]);
    des.monster({ class: "m", coord: place[7], appear_as: "obj:luckstone" });
    des.object("worthless piece of white glass",place[1]);
    des.object("emerald",place[1]);
    des.object("amethyst",place[1]);
    des.monster({ class: "m", coord: place[1], appear_as: "obj:loadstone" });
    des.object("diamond",place[2]);
    des.object("worthless piece of green glass",place[2]);
    des.object("amethyst",place[2]);
    des.monster({ class: "m", coord: place[2], appear_as: "obj:flint" });
    des.object("worthless piece of white glass",place[3]);
    des.object("emerald",place[3]);
    des.object("worthless piece of violet glass",place[3]);
    des.monster({ class: "m", coord: place[3], appear_as: "obj:touchstone" });
    des.object("worthless piece of red glass",place[4]);
    des.object("ruby",place[4]);
    des.object("loadstone",place[4]);
    des.object("ruby",place[5]);
    des.object("worthless piece of red glass",place[5]);
    des.object({ id: "luckstone", coord: place[5], buc: "!-cursed", achievement: 1 });
    // Random objects
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
    // Random monsters
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

