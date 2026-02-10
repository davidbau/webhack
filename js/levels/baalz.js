/**
 * baalz - NetHack special level
 * Converted from: baalz.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack gehennom baalz.lua	$NHDT-Date: 1652196020 2022/5/10 15:20:20 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson && Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " ", lit: 0 });

    // TODO FIXME: see baalz_fixup - the legs get removed currently.

    des.level_flags("mazelevel", "corrmaze");
    // the two pools are fakes used to mark spots which need special wall fixups
    // the two iron bars are eyes && spots to their left will be made diggable
    des.map({ halign: "right", valign: "center", map: `

    -------------------------------------------------
    |                   ----               ----      
    |          ----     |     -----------  |         
    | ------      |  ---------|.........|--P         
    | F....|  -------|...........--------------      
    ---....|--|..................S............|----  
    +...--....S..----------------|............S...|  
    ---....|--|..................|............|----  
    | F....|  -------|...........-----S--------      
    | ------      |  ---------|.........|--P         
    |          ----     |     -----------  |         
    |                   ----               ----      
    -------------------------------------------------

    ` });
    des.levregion({ region: [1,0,15,20], region_islev: 1, exclude: [15,1,70,16], exclude_islev: 1, type: "stair-up" });
    des.levregion({ region: [1,0,15,20], region_islev: 1, exclude: [15,1,70,16], exclude_islev: 1, type: "branch" });
    des.teleport_region({region: [1,0,15,20], region_islev: 1, exclude: [15,1,70,16], exclude_islev: 1 });
    // this actually leaves the farthest right column diggable
    des.non_diggable(selection.area(0,0,47,12));
    des.mazewalk(0,6,"west");
    des.stair("down", 44,6);
    des.door("locked",0,6);
    // The fellow in residence
    des.monster("Baalzebub",35,6);
    // Some random weapons && armor.
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
    des.trap("spiked pit");
    des.trap("fire");
    des.trap("sleep gas");
    des.trap("anti magic");
    des.trap("fire");
    des.trap("magic");
    des.trap("magic");
    // Random monsters.
    des.monster("ghost",37,7);
    des.monster("horned devil",32,5);
    des.monster("barbed devil",38,7);
    des.monster("L");
    // Some Vampires for good measure
    des.monster("V");
    des.monster("V");
    des.monster("V");



    return des.finalize_level();
}

