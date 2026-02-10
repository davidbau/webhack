/**
 * minefill - NetHack special level
 * Converted from: minefill.lua
 */

import * as des from '../sp_lev.js';
import { percent } from '../sp_lev.js';

export function generate() {
    // NetHack mines minefill.lua	$NHDT-Date: 1652196028 2022/5/10 15:20:28 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
    // Copyright (c) 1989-95 by Jean-Christophe Collet
    // Copyright (c) 1991-95 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 

    // The "fill" level for the mines.
    // 
    // This level is used to fill out any levels ! occupied by
    // specific levels.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noflip");

    des.level_init({ style: "mines", fg: ".", bg: " ", smoothed: true, joined: true, walled: true });

    // 
    des.stair("up");
    des.stair("down");
    // 
    for (let i = 1; i <= Math.random(2, 5); i++) {
       des.object("*");
    }
    des.object("(");
    for (let i = 1; i <= Math.random(2, 4); i++) {
       des.object();
    }
    if (percent(75)) {
       for (let i = 1; i <= Math.random(1, 2); i++) {
          des.object("boulder");
       }
    }
    // 
    for (let i = 1; i <= Math.random(6, 8); i++) {
       des.monster("gnome");
    }
    des.monster("gnome lord");
    des.monster("dwarf");
    des.monster("dwarf");
    des.monster("G");
    des.monster("G");
    des.monster(percent(50) && "h" || "G");
    // 
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();


    return des.finalize_level();
}

