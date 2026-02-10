/**
 * wizard3 - NetHack special level
 * Converted from: wizard3.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack yendor wizard3.lua	$NHDT-Date: 1652196040 2022/5/10 15:20:40 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson && Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel", "noteleport", "hardfloor");

    let tmpbounds = selection.match("-");
    let bnds = tmpbounds.bounds();
    let bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    let wiz3 = des.map({ halign: "center", valign: "center", map: `

    ----------------------------x
    |..|............S..........|x
    |..|..------------------S--|x
    |..|..|.........|..........|x
    |..S..|.}}}}}}}.|..........|x
    |..|..|.}}---}}.|-S--------|x
    |..|..|.}--.--}.|..|.......|x
    |..|..|.}|...|}.|..|.......|x
    |..---|.}--.--}.|..|.......|x
    |.....|.}}---}}.|..|.......|x
    |.....S.}}}}}}}.|..|.......|x
    |.....|.........|..|.......|x
    ----------------------------x

    `, contents: function(rm) {
       des.levregion({ type: "stair-up", region: [1,0,79,20], region_islev: 1, exclude: [0,0,28,12] });
       des.levregion({ type: "stair-down", region: [1,0,79,20], region_islev: 1, exclude: [0,0,28,12] });
       des.levregion({ type: "branch", region: [1,0,79,20], region_islev: 1, exclude: [0,0,28,12] });
       des.teleport_region({ region: [1,0,79,20], region_islev: 1, exclude: [0,0,27,12] });
       des.levregion({ region: [25,11,25,11], type: "portal", name: "fakewiz1" });
       des.mazewalk(28,9,"east");
       des.region({ region: [7,3, 15,11], lit: 0 ,type: "morgue", filled: 2 });
       des.region({ region: [17,6, 18,11], lit: 0, type: "beehive", filled: 1 });
       // make the entry chamber a real room; it affects monster arrival
       des.region({ region: [20,6,26,11],lit: 0,type: "ordinary",arrival_room: true,
                    contents: function() {
                       let w = "north";
                       if (percent(50)) { w = "west" }
                       des.door({ state: "secret", wall: w });
                    }
       });
       des.door("closed",18,5);
       des.ladder("up", 11,7);
       // Non diggable walls
       // Walls inside the moat stay diggable
       des.non_diggable(selection.area(0,0,6,12));
       des.non_diggable(selection.area(6,0,27,2));
       des.non_diggable(selection.area(16,2,27,12));
       des.non_diggable(selection.area(6,12,16,12));
       // 
       des.non_passwall(selection.area(0,0,6,12));
       des.non_passwall(selection.area(6,0,27,2));
       des.non_passwall(selection.area(16,2,27,12));
       des.non_passwall(selection.area(6,12,16,12));
       // 
       des.monster("L", 10, 7);
       des.monster("vampire lord", 12, 7);
       // Some surrounding horrors
       des.monster("kraken", 8, 5);
       des.monster("giant eel", 8, 8);
       des.monster("kraken", 14, 5);
       des.monster("giant eel", 14, 8);
       // Other monsters
       des.monster("L");
       des.monster("D");
       des.monster("D", 26, 9);
       des.monster("&");
       des.monster("&");
       des.monster("&");
       // And to make things a little harder.
       des.trap("board",10,7);
       des.trap("board",12,7);
       des.trap("board",11,6);
       des.trap("board",11,8);
       // Some loot
       des.object(")");
       des.object("!");
       des.object("?");
       des.object("?");
       des.object("(");
       // treasures
       des.object("\"", 11, 7);
    }
    });

    let protected_region = bounds2.negate() | wiz3;
    hell_tweaks(protected_region);


    return des.finalize_level();
}

