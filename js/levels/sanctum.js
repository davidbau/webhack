/**
 * sanctum - NetHack special level
 * Converted from: sanctum.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack gehennom sanctum.lua	$NHDT-Date: 1652196034 2022/5/10 15:20:34 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.5 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson && Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor", "nommap");
    // This is outside the main map, below, so we must do it before adding
    // that map && anchoring coordinates to it. This extends the invisible
    // barrier up to the top row, which falls outside the drawn map.
    des.non_passwall(selection.area(39,0,41,0));
    des.map(`

    ----------------------------------------------------------------------------
    |             --------------                                               |
    |             |............|             -------                           |
    |       -------............-----         |.....|                           |
    |       |......................|        --.....|            ---------      |
    |    ----......................---------|......----         |.......|      |
    |    |........---------..........|......+.........|     ------+---..|      |
    |  ---........|.......|..........--S----|.........|     |........|..|      |
    |  |..........|.......|.............|   |.........-------..----------      |
    |  |..........|.......|..........----   |..........|....|..|......|        |
    |  |..........|.......|..........|      --.......----+---S---S--..|        |
    |  |..........---------..........|       |.......|.............|..|        |
    |  ---...........................|       -----+-------S---------S---       |
    |    |...........................|          |...| |......|    |....|--     |
    |    ----.....................----          |...---....---  ---......|     |
    |       |.....................|             |..........|    |.....----     |
    |       -------...........-----             --...-------    |.....|        |
    |             |...........|                  |...|          |.....|        |
    |             -------------                  -----          -------        |
    ----------------------------------------------------------------------------

    `);
    des.region({ region: [15,7, 21,10], lit: 1, type: "temple", filled: 2, contents: function() {
                    des.door({ wall: "random", state: "secret" });
    } })
    des.altar({ x: 18, y: 8, align: "noalign", type: "sanctum" });
    des.region({ region: [41,6, 48,11], lit: 0, type: "morgue", filled: 1, irregular: 1 });
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // Invisible barrier separating the left & right halves of the level
    des.non_passwall(selection.area(37,0,39,19));
    // Doors
    des.door("closed",40,6);
    des.door("locked",62,6);
    des.door("closed",46,12);
    des.door("closed",53,10);
    // Surround the temple with fire
    des.trap("fire",13,5);
    des.trap("fire",14,5);
    des.trap("fire",15,5);
    des.trap("fire",16,5);
    des.trap("fire",17,5);
    des.trap("fire",18,5);
    des.trap("fire",19,5);
    des.trap("fire",20,5);
    des.trap("fire",21,5);
    des.trap("fire",22,5);
    des.trap("fire",23,5);
    des.trap("fire",13,12);
    des.trap("fire",14,12);
    des.trap("fire",15,12);
    des.trap("fire",16,12);
    des.trap("fire",17,12);
    des.trap("fire",18,12);
    des.trap("fire",19,12);
    des.trap("fire",20,12);
    des.trap("fire",21,12);
    des.trap("fire",22,12);
    des.trap("fire",23,12);
    des.trap("fire",13,6);
    des.trap("fire",13,7);
    des.trap("fire",13,8);
    des.trap("fire",13,9);
    des.trap("fire",13,10);
    des.trap("fire",13,11);
    des.trap("fire",23,6);
    des.trap("fire",23,7);
    des.trap("fire",23,8);
    des.trap("fire",23,9);
    des.trap("fire",23,10);
    des.trap("fire",23,11);
    // Some traps.
    des.trap("spiked pit");
    des.trap("fire");
    des.trap("sleep gas");
    des.trap("anti magic");
    des.trap("fire");
    des.trap("magic");
    // Some random objects
    des.object("[");
    des.object("[");
    des.object("[");
    des.object("[");
    des.object(")");
    des.object(")");
    des.object("*");
    des.object("!");
    des.object("!");
    des.object("!");
    des.object("!");
    des.object("?");
    des.object("?");
    des.object("?");
    des.object("?");
    des.object("?");
    // Some monsters.
    des.monster({ id: "horned devil", x: 14,y: 12,peaceful: 0 });
    des.monster({ id: "barbed devil", x: 18,y: 8,peaceful: 0 });
    des.monster({ id: "erinys", x: 10,y: 4,peaceful: 0 });
    des.monster({ id: "marilith", x: 7,y: 9,peaceful: 0 });
    des.monster({ id: "nalfeshnee", x: 27,y: 8,peaceful: 0 });
    // Moloch's horde
    des.monster({ id: "aligned cleric", x: 20,y: 3,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 15,y: 4,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 11,y: 5,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 11,y: 7,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 11,y: 9,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 11,y: 12,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 15,y: 13,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 17,y: 13,align: "noalign",peaceful: 0 });
    des.monster({ id: "aligned cleric", x: 21,y: 13,align: "noalign",peaceful: 0 });
    // A few nasties
    des.monster("L");
    des.monster("L");
    des.monster("V");
    des.monster("V");
    des.monster("V");
    des.stair("up", 63,15);
    // Teleporting to this level is allowed after the invocation creates its
    // entrance.  Force arrival in that case to be on rightmost third of level.
    des.teleport_region({ region: [54,1,79,18], region_islev: 1, dir: "down" });


    return des.finalize_level();
}

