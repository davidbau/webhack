/**
 * Pri-goal - NetHack special level
 * Converted from: Pri-goal.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Priest Pri-goal.lua	$NHDT-Date: 1687033651 2023/6/17 20:27:31 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.2 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel");

    des.level_init({ style: "mines", fg: "L", bg: ".", smoothed: false, joined: false, lit: 0, walled: false });

    des.map(`

    xxxxxx..xxxxxx...xxxxxxxxx
    xxxx......xx......xxxxxxxx
    xx.xx.............xxxxxxxx
    x....................xxxxx
    ......................xxxx
    ......................xxxx
    xx........................
    xxx......................x
    xxx................xxxxxxx
    xxxx.....x.xx.......xxxxxx
    xxxxx...xxxxxx....xxxxxxxx

    `);
    // Dungeon Description
    let place = [ [14,4], [13,7] ]
    let placeidx = Math.random(1, place.length);

    des.region(selection.area(0,0,25,10), "unlit");
    // Stairs
    des.stair("up", 20,5);
    // Objects [note: eroded=-1 => obj->oerodeproof=1]
    des.object({ id: "helm of brilliance", coord: place[placeidx],
                 buc: "blessed", spe: 0, eroded: -1, name: "The Mitre of Holiness" })
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
    des.trap("fire");
    des.trap("fire");
    des.trap("fire");
    des.trap("fire");
    des.trap();
    des.trap();
    // Random monsters.
    des.monster("Nalzok",place[placeidx]);
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("human zombie");
    des.monster("Z");
    des.monster("Z");
    des.monster("wraith");
    des.monster("wraith");
    des.monster("wraith");
    des.monster("wraith");
    des.monster("wraith");
    des.monster("wraith");
    des.monster("wraith");
    des.monster("wraith");
    des.monster("W");


    return des.finalize_level();
}

