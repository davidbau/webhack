/**
 * Cav-fila - NetHack special level
 * Converted from: Cav-fila.lua
 */

import * as des from '../sp_lev.js';

export function generate() {
    // NetHack Caveman Cav-fila.lua	$NHDT-Date: 1652196001 2022/5/10 15:20:1 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noflip");

    des.level_init({ style: "mines", fg: ".", bg: " ", smoothed: true, joined: true, walled: true });

    // 
    des.stair("up");
    des.stair("down");
    // 
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    // 
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // 
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ id: "bugbear", peaceful: 0 });
    des.monster({ class: "h", peaceful: 0 });
    des.monster({ id: "hill giant", peaceful: 0 });


    return des.finalize_level();
}

