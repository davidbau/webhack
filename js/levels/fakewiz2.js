/**
 * fakewiz2 - NetHack special level
 * Converted from: fakewiz2.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack yendor fakewiz2.lua	$NHDT-Date: 1652196026 2022/5/10 15:20:26 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson && Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel");

    let tmpbounds = selection.match("-");
    let bnds = tmpbounds.bounds();
    let bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    let fakewiz2 = des.map({ halign: "center", valign: "center", map: `

    .........
    .}}}}}}}.
    .}}---}}.
    .}--.--}.
    .}|...|}.
    .}--.--}.
    .}}---}}.
    .}}}}}}}.
    .........

    `, contents: function(rm) {
       des.levregion({ region: [1,0,79,20], region_islev: 1, exclude: [0,0,8,8], type: "stair-up" });
       des.levregion({ region: [1,0,79,20], region_islev: 1, exclude: [0,0,8,8], type: "stair-down" });
       des.levregion({ region: [1,0,79,20], region_islev: 1, exclude: [0,0,8,8], type: "branch" });
       des.teleport_region({ region: [1,0,79,20], region_islev: 1,exclude: [2,2,6,6] });
       des.mazewalk(8,5,"east");
       des.monster("L",4,4);
       des.monster("vampire lord",3,4);
       des.monster("kraken",6,6);
       // And to make things a little harder.
       des.trap("board",4,3);
       des.trap("board",4,5);
       des.trap("board",3,4);
       des.trap("board",5,4);
       // treasures
       des.object("\"",4,4);
    }
    });

    let protected_region = bounds2.negate() | fakewiz2;
    hell_tweaks(protected_region);


    return des.finalize_level();
}

