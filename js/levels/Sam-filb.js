/**
 * Sam-filb - NetHack special level
 * Converted from: Sam-filb.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Samurai Sam-filb.lua	$NHDT-Date: 1652196013 2022/5/10 15:20:13 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-92 by M. Stephenson, P. Winner
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel");

    des.map(`

    -------------                                  -------------
    |...........|                                  |...........|
    |...-----...|----------------------------------|...-----...|
    |...|   |...|..................................|...|   |...|
    |...-----..........................................-----...|
    |...........|--S----------------------------S--|...........|
    ----...--------.|..........................|.--------...----
       |...|........+..........................+........|...|   
       |...|........+..........................+........|...|   
    ----...--------.|..........................|.--------...----
    |...........|--S----------------------------S--|...........|
    |...-----..........................................-----...|
    |...|   |...|..................................|...|   |...|
    |...-----...|----------------------------------|...-----...|
    |...........|                                  |...........|
    -------------                                  -------------

    `);
    des.region(selection.area(0,0,59,15), "unlit");
    // Doors
    des.door("closed",16,7);
    des.door("closed",16,8);
    des.door("closed",43,7);
    des.door("closed",43,8);
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
    des.object();
    des.object();
    // 
    des.monster("d");
    des.monster("wolf");
    des.monster("wolf");
    des.monster("wolf");
    des.monster("wolf");
    des.monster("stalker");
    des.monster("stalker");
    des.monster("stalker");
    // 
    des.trap();
    des.trap();
    des.trap();
    des.trap();


    return des.finalize_level();
}

