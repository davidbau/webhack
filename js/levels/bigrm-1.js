/**
 * bigrm-1 - NetHack special level
 * Converted from: bigrm-1.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-1.lua	$NHDT-Date: 1652196021 2022/5/10 15:20:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
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


    if (percent(80)) {
       let terrains = [ "-", "F", "L", "T", "C" ];
       let tidx = Math.random(1, terrains.length);
       let choice = Math.random(0, 5);
       if (choice == 0) {
          // one horizontal line
          des.terrain(selection.line(10,8, 65,8), terrains[tidx]);
       } else if (choice == 1) {
          // two vertical lines
          let sel = selection.line(15,4, 15, 13) | selection.line(59,4, 59, 13);
          des.terrain(sel, terrains[tidx]);
       } else if (choice == 2) {
          // plus sign
          sel: selection.line(10,8, 64, 8) | selection.line(37,3, 37, 14);
          des.terrain(sel, terrains[tidx]);
       } else if (choice == 3) {
          // brackets:  [  ]
          des.terrain(selection.rect(4,4, 70,13), terrains[tidx]);
          sel: selection.line(25,4, 50,4) | selection.line(25,13, 50,13);
          des.terrain(sel, '.');
       } else if (choice == 4) {
          // snake
          des.terrain(selection.fillrect(5,5, 69, 12), terrains[tidx]);
          for (let i = 0; i <= 7; i++) {
             let x = 6 + i*8;
             let y = 5 + (i%2);
             des.terrain(selection.fillrect(x, y, x+6, y+6), '.');
          }
       } else {
          // nothing
       }
    }

    des.region(selection.area(1,1, 73, 16), "lit");

    des.stair("up");
    des.stair("down");

    des.non_diggable();

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

