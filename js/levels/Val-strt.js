/**
 * Val-strt - NetHack special level
 * Converted from: Val-strt.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Valkyrie Val-strt.lua	$NHDT-Date: 1652196017 2022/5/10 15:20:17 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The "start" level for the quest.
    // 
    // Here you meet your (besieged) class leader, the Norn,
    // && receive your quest assignment.
    // 

    des.level_flags("mazelevel", "noteleport", "hardfloor", "icedpools");
    des.level_init({ style: "solidfill", fg: "I" });

    let pools = selection.new()
    // random locations
    for (let i = 1; i <= 13; i++) {
       pools.set();
    }
    // some bigger ones
    pools = pools | selection.grow(selection.set(selection.new()), "west");
    pools = pools | selection.grow(selection.set(selection.new()), "north");
    pools = pools | selection.grow(selection.set(selection.new()), "random");

    // Lava pools surrounded by water
    des.terrain(pools.clone().grow("all"), "P");
    des.terrain(pools, "L");

    des.map(`

    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    xxxxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...xxxxxxxxxxxxxxxxxxxxx
    xxxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..{..xxxxxxxxxxxxxxxxxxxx
    xxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.....xxxxxxxxxxxxxxxxxxx
    xxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxx
    xxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxx
    xxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..xxxxxxxxxxxxxxxxxxx
    xxxxxxxx.....xxxxxxxxxxxxx|----------------|xxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxx
    xxxxxxx..xxx...xxxxxxxxxxx|................|xxxxxxxxxx..xxxxxxxxxxxxxxxxxxxx
    xxxxxx..xxxxxx......xxxxx.|................|.xxxxxxxxx.xxxxxxxxxxxxxxxxxxxxx
    xxxxx..xxxxxxxxxxxx.......+................+...xxxxxxx.xxxxxxxxxxxxxxxxxxxxx
    xxxx..xxxxxxxxx.....xxxxx.|................|.x...xxxxx.xxxxxxxxxxxxxxxxxxxxx
    xxx..xxxxxxxxx..xxxxxxxxxx|................|xxxx.......xxxxxxxxxxxxxxxxxxxxx
    xxxx..xxxxxxx..xxxxxxxxxxx|----------------|xxxxxxxxxx...xxxxxxxxxxxxxxxxxxx
    xxxxxx..xxxx..xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...xxxxxxxxxxxxxxxxx
    xxxxxxx......xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...xxxxxxxxxxxxxxx
    xxxxxxxxx...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...x......xxxxxx
    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.........xxxxx
    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.......xxxxxx
    xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

    `);
    // Dungeon Description
    des.region(selection.area(0,0,75,19), "lit");
    // Portal arrival point
    des.levregion({ region: [66,17,66,17], type: "branch" });
    // Stairs
    des.stair("down", 18,1);
    des.feature("fountain", 53,2);
    // Doors
    des.door("locked",26,10);
    des.door("locked",43,10);
    // Norn
    des.monster({ id: "Norn", coord: [35, 10], inventory: function() {
       des.object({ id: "banded mail", spe: 5 });
       des.object({ id: "long sword", spe: 4 });
    } })
    // The treasure of the Norn
    des.object("chest", 36, 10);
    // valkyrie guards for the audience chamber
    des.monster("warrior", 27, 8);
    des.monster("warrior", 27, 9);
    des.monster("warrior", 27, 11);
    des.monster("warrior", 27, 12);
    des.monster("warrior", 42, 8);
    des.monster("warrior", 42, 9);
    des.monster("warrior", 42, 11);
    des.monster("warrior", 42, 12);
    // Non diggable walls
    des.non_diggable(selection.area(26,7,43,13));
    // Random traps
    des.trap("fire");
    des.trap("fire");
    des.trap("fire");
    des.trap("fire");
    des.trap("fire");
    des.trap("fire");
    // Monsters on siege duty.
    des.monster("fire ant", 4, 12);
    des.monster("fire ant", 8, 8);
    des.monster("fire ant", 14, 4);
    des.monster("fire ant", 17, 11);
    des.monster("fire ant", 24, 10);
    des.monster("fire ant", 45, 10);
    des.monster("fire ant", 54, 2);
    des.monster("fire ant", 55, 7);
    des.monster("fire ant", 58, 14);
    des.monster("fire ant", 63, 17);
    des.monster({ id: "fire giant", x: 18, y: 1, peaceful: 0 });
    des.monster({ id: "fire giant", x: 10, y: 16, peaceful: 0 });

    return des.finalize_level();
}

