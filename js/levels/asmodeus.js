/**
 * asmodeus - NetHack special level
 * Converted from: asmodeus.lua
 */

import * as des from '../sp_lev.js';
import { percent } from '../sp_lev.js';
import { selection } from '../sp_lev.js';
import { hell_tweaks } from './hellfill.js';

export function generate() {

    des.level_init({ style: "mazegrid", bg: "-" });

des.level_flags("mazelevel")

let tmpbounds = selection.match("-");
let bnds = tmpbounds.bounds();
let bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

// First part
let asmo1 = des.map({ halign: "half-left", valign: "center", map: `
---------------------
|.............|.....|
|.............S.....|
|---+------------...|
|.....|.........|-+--
|..---|.........|....
|..|..S.........|....
|..|..|.........|....
|..|..|.........|-+--
|..|..-----------...|
|..S..........|.....|
---------------------
`, contents: (rm) => {
   // Doors
   des.door("closed",4,3);
   des.door("locked",18,4);
   des.door("closed",18,8);
   --
   des.stair("down", 13,7)
   // Non diggable walls
   des.non_diggable(selection.area(0,0,20,11))
   // Entire main area
   des.region(selection.area(1,1,20,10),"unlit")
   // The fellow in residence
   des.monster("Asmodeus",12,7);
   // Some random weapons and armor.
   des.object("[")
   des.object("[")
   des.object(")")
   des.object(")")
   des.object("*")
   des.object("!")
   des.object("!")
   des.object("?")
   des.object("?")
   des.object("?")
   // Some traps.
   des.trap("spiked pit", 5,2)
   des.trap("fire", 8,6)
   des.trap("sleep gas")
   des.trap("anti magic")
   des.trap("fire")
   des.trap("magic")
   des.trap("magic")
   // Random monsters.
   des.monster("ghost",11,7);
   des.monster("horned devil",10,5);
   des.monster("L");
   // Some Vampires for good measure
   des.monster("V");
   des.monster("V");
   des.monster("V")
} });

des.levregion({ region: [1,0,6,20], region_islev: 1, exclude: [6,1,70,16], exclude_islev: 1, type: "stair-up" });

des.levregion({ region: [1,0,6,20], region_islev: 1, exclude: [6,1,70,16], exclude_islev: 1, type: "branch" });
des.teleport_region({ region: [1,0,6,20], region_islev: 1, exclude: [6,1,70,16], exclude_islev: 1 })

// Second part
let asmo2 = des.map({ halign: "half-right", valign: "center", map: `
---------------------------------
................................|
................................+
................................|
---------------------------------
`, contents: (rm) => {
   des.mazewalk(32,2,"east")
   // Non diggable walls
   des.non_diggable(selection.area(0,0,32,4))
   des.door("closed",32,2);
   des.monster("&");
   des.monster("&");
   des.monster("&");
   des.trap("anti magic")
   des.trap("fire")
   des.trap("magic")
} });

let protectedArea = bounds2.negate().union(asmo1).union(asmo2);
hell_tweaks(protectedArea);


    return des.finalize_level();
}
