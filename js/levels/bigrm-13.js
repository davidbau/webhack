/**
 * bigrm-13 - NetHack special level
 * Converted from: bigrm-13.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-13.lua	$NHDT-Date: 1652196024 2022/5/10 15:20:24 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.0 $
    // Copyright (c) 2026 by Pasi Kallinen
    // NetHack may be freely redistributed.  See license for details.
    // 
    // Pillars

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
    |.........................................................................|
    ---------------------------------------------------------------------------

    `);

    let pillar = `

    ---
    | |
    ---
    `;

    let filters = [
       // 1: all pillars
       function(x, y) { return true; },
       // 2: 3 vertical lines
       function(x, y) { return (x%2 == 1); },
       // 3: checkerboard
       function(x, y) { return (((x+y)%2) == 0); },
       // 4: center row
       function(x, y) { return (y%2 == 1); },
       // 5: top && bottom rows
       function(x, y) { return (y%2 == 0); },
       // 6: random 50%
       function(x, y) { return (Math.random(0,1) == 0); },
       // 7: corners && center
       function(x, y) { return ((x/3)%2 == y%2); },
       // 8: slanted
       function(x, y) { return (Math.floor((x+1)/3) == y); },
    ];

    let idx = Math.random(1, filters.length);

    for (let y = 0; y <= 2; y++) {
       for (let x = 0; x <= 6; x++) {
          if ((filters[idx](x, y))) {
             des.map({ coord: [12 + x*9, 4 + y*5], map: pillar, contents: function() { } });
          }
       }
    }

    des.region(selection.area(0,0,75,18), "lit");
    des.wallify();
    des.non_diggable();

    des.stair("up");
    des.stair("down");

    for (let i = 1; i <= 15; i++) {
       des.object();
    }
    for (let i = 1; i <= 6; i++) {
       des.trap();
    }
    for (let i = 1; i <= 28; i++) {
      des.monster();

    }
    return des.finalize_level();
}

