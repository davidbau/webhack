/**
 * fakewiz1 - NetHack special level
 * Converted from: fakewiz1.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack yendor fakewiz1.lua	$NHDT-Date: 1652196025 2022/5/10 15:20:25 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson && Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel");

    let tmpbounds = selection.match("-");
    let bnds = tmpbounds.bounds();
    let bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    let fakewiz1 = des.map({ halign: "center", valign: "center", map: `

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
       des.levregion({ region: [4,4,4,4], type: "portal", name: "wizard3" });
       des.mazewalk(8,5,"east");
       des.region({ region: [4,3,6,6],lit: 0,type: "ordinary",irregular: 1,arrival_room: true });
       des.monster("L",4,4);
       des.monster("vampire lord",3,4);
       des.monster("kraken",6,6);
       // And to make things a little harder.
       des.trap("board",4,3);
       des.trap("board",4,5);
       des.trap("board",3,4);
       des.trap("board",5,4);
    }
    });

    let protected_region = bounds2.negate() | fakewiz1;
    hell_tweaks(protected_region);


    return des.finalize_level();
}

