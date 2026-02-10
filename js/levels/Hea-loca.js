/**
 * Hea-loca - NetHack special level
 * Converted from: Hea-loca.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Healer Hea-loca.lua	$NHDT-Date: 1652196004 2022/5/10 15:20:4 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991, 1993 by M. Stephenson, P. Winner
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "hardfloor");
    // 
    des.level_init({ style: "mines", fg: ".", bg: "P", smoothed: true ,joined: true, lit: 1, walled: false });

    des.map(`

    PPPPPPPPPPPPP.......PPPPPPPPPPP
    PPPPPPPP...............PPPPPPPP
    PPPP.....-------------...PPPPPP
    PPPPP....|.S.........|....PPPPP
    PPP......+.|.........|...PPPPPP
    PPP......+.|.........|..PPPPPPP
    PPPP.....|.S.........|..PPPPPPP
    PPPPP....-------------....PPPPP
    PPPPPPPP...............PPPPPPPP
    PPPPPPPPPPP........PPPPPPPPPPPP

    `);
    // Dungeon Description
    des.region(selection.area(0,0,30,9), "lit");
    des.region({ region: [12,3, 20,6], lit: 1, type: "temple", filled: 1 });
    // Doors
    des.door("closed",9,4);
    des.door("closed",9,5);
    des.door("locked",11,3);
    des.door("locked",11,6);
    // Stairs
    des.stair("up", 4,4);
    des.stair("down", 20,6);
    // Non diggable walls
    des.non_diggable(selection.area(11,2,21,7));
    // Altar in the temple.
    des.altar({ x: 13,y: 5, align: "chaos", type: "shrine" });
    // Objects
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    // Random monsters.
    des.monster("rabid rat");
    des.monster("rabid rat");
    des.monster("rabid rat");
    des.monster("rabid rat");
    des.monster("rabid rat");
    des.monster("rabid rat");
    des.monster("rabid rat");
    des.monster("rabid rat");
    des.monster({ class: "r", peaceful: 0 });
    des.monster("giant eel");
    des.monster("giant eel");
    des.monster("giant eel");
    des.monster("giant eel");
    des.monster("giant eel");
    des.monster("electric eel");
    des.monster("electric eel");
    des.monster("kraken");
    des.monster("shark");
    des.monster("shark");
    des.monster({ class: ";", peaceful: 0 });
    des.monster({ class: ";", peaceful: 0 });
    des.monster({ class: "D", peaceful: 0 });
    des.monster({ class: "D", peaceful: 0 });
    des.monster({ class: "D", peaceful: 0 });
    des.monster({ class: "D", peaceful: 0 });
    des.monster({ class: "D", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });
    des.monster({ class: "S", peaceful: 0 });


    return des.finalize_level();
}

