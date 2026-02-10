/**
 * asmodeus - NetHack special level
 * Converted from: asmodeus.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack gehennom asmodeus.lua	$NHDT-Date: 1652196020 2022/05/10 15:20:20 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson and Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel");

    const tmpbounds = selection.match("-");
    const bnds = tmpbounds.bounds();
    const bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    // First part
<<<<<<< HEAD
    const asmo1 = des.map({ halign: "half-left", valign: "center", map: `  --------------------- | +  +  +  +  +  + .| +  + .| | +  +  +  +  +  + .S +  + .| |---+------------ + .| | +  + .| +  +  +  + .|-+-- | + ---| +  +  +  + .| +  + | + | + S +  +  +  + .| +  + | + | + | +  +  +  + .| +  + | + | + | +  +  +  + .|-+-- | + | + ----------- + .| | + S +  +  +  +  + | +  + .| ---------------------  `, contents: function(rm) { // Doors;
            des.door("closed",4,3);
            des.door("locked",18,4);
            des.door("closed",18,8);
=======
    const asmo1 = des.map({ halign: "half-left", valign: "center", map: `

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

    `, contents: function(rm) { // Doors;
            des.door("closed",04,03);
            des.door("locked",18,04);
            des.door("closed",18,08);
>>>>>>> 3634da106f5a877669164801a01cbcdbb479e85d
            //
            des.stair("down", 13,7);
            // Non diggable walls
            des.non_diggable(selection.area(0,0,20,11));
            // Entire main area
            des.region(selection.area(1,1,20,10),"unlit");
            // The fellow in residence
            des.monster("Asmodeus",12,7);
            // Some random weapons and armor.
            des.object("[");
            des.object("[");
            des.object(")");
            des.object(")");
            des.object("*");
            des.object("!");
            des.object("!");
            des.object("?");
            des.object("?");
            des.object("?");
            // Some traps.
            des.trap("spiked pit", 5,2);
            des.trap("fire", 8,6);
            des.trap("sleep gas");
            des.trap("anti magic");
            des.trap("fire");
            des.trap("magic");
            des.trap("magic");
            // Random monsters.
            des.monster("ghost",11,7);
            des.monster("horned devil",10,5);
            des.monster("L");
            // Some Vampires for good measure
            des.monster("V");
            des.monster("V");
            des.monster("V"); } });

    des.levregion({ region: [1,0,6,20], region_islev: 1, exclude: [6,1,70,16], exclude_islev: 1, type: "stair-up" });

    des.levregion({ region: [1,0,6,20], region_islev: 1, exclude: [6,1,70,16], exclude_islev: 1, type: "branch" });
    des.teleport_region({ region: [1,0,6,20], region_islev: 1, exclude: [6,1,70,16], exclude_islev: 1 });

    // Second part
<<<<<<< HEAD
    const asmo2 = des.map({ halign: "half-right", valign: "center", map: `  --------------------------------- +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  + | +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  + + +  +  +  +  +  +  +  +  +  +  +  +  +  +  +  + | ---------------------------------  `, contents: function(rm) { des.mazewalk(32,2,"east");
=======
    const asmo2 = des.map({ halign: "half-right", valign: "center", map: `

    ---------------------------------
    ................................|
    ................................+
    ................................|
    ---------------------------------

    `, contents: function(rm) { des.mazewalk(32,02,"east");
>>>>>>> 3634da106f5a877669164801a01cbcdbb479e85d
            // Non diggable walls
            des.non_diggable(selection.area(0,0,32,4));
            des.door("closed",32,2);
            des.monster("&");
            des.monster("&");
            des.monster("&");
            des.trap("anti magic");
            des.trap("fire");
            des.trap("magic"); } });

    const protectedAreas = bounds2.negate() | asmo1 | asmo2;
    hell_tweaks(protectedAreas)


    return des.finalize_level();
}
