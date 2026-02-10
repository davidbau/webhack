/**
 * bigrm-2 - NetHack special level
 * Converted from: bigrm-2.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-2.lua	$NHDT-Date: 1652196021 2022/5/10 15:20:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel", "noflip");

    des.map(`

    ---------------------------------------------------------------------------
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    |.........................................................................|
    ---------------------------------------------------------------------------

    `);
    // Dungeon Description
    des.region(selection.area(1,1,73,16),"lit");

    let darkness;

    let choice = Math.random(0, 3)
    if (choice == 0) {
       darkness: selection.area(1,7,22,9)
          | selection.area(24,1,50,5)
          | selection.area(24,11,50,16)
          | selection.area(52,7,73,9);
    } else if (choice == 1) {
       darkness: selection.area(24,1,50,16);
    } else if (choice == 2) {
       darkness: selection.area(1,1,22,16)
          | selection.area(52,1,73,16);
    }

    if (darkness !== null) {
       des.region(darkness,"unlit");
       if (percent(25)) {
          des.replace_terrain({ selection: darkness.grow(),
                                fromterrain: ".", toterrain: "I" });
       }
    }

    // Stairs
    des.stair("up");
    des.stair("down");
    // Non diggable walls
    des.non_diggable();
    // Objects
    for (let i = 1; i <= 15; i++) {
       des.object();
    }
    // Random traps
    for (let i = 1; i <= 6; i++) {
       des.trap();
    }
    // Random monsters.
    for (let i = 1; i <= 28; i++) {
       des.monster();
    
    }
    return des.finalize_level();
}

