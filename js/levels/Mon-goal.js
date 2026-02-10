/**
 * Mon-goal - NetHack special level
 * Converted from: Mon-goal.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack Monk Mon-goal.lua	$NHDT-Date: 1652196007 2022/5/10 15:20:7 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // des.level_init({ style: "solidfill", fg: " " });

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
    let place = [ [14,4],[13,7] ]
    let placeidx = Math.random(1, place.length);

    des.region(selection.area(0,0,25,10), "unlit");
    // Stairs
    des.stair("up", 20,5);
    // Objects
    des.object({ id: "lenses", coord: place[placeidx], buc: "blessed", spe: 0, name: "The Eyes of the Overworld" });
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
    des.monster("Master Kaen",place[placeidx]);
    des.altar({ coord: place[placeidx], align: "noalign", type: "altar" });
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("earth elemental");
    des.monster("xorn");
    des.monster("xorn");
    des.monster("xorn");
    des.monster("xorn");
    des.monster("xorn");
    des.monster("xorn");
    des.monster("xorn");
    des.monster("xorn");
    des.monster("xorn");


    return des.finalize_level();
}

