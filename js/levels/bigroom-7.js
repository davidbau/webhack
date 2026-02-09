/**
 * Big Room variant 7 (triangular wedge shape)
 * Simplified port from nethack-c/dat/bigrm-8.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel');

    // Triangular wedge-shaped room with diagonal feature line
    des.map({
        map: `
----------------------------------------------
|............................................---
--.............................................---
 ---......................................FF.....---
   ---...................................FF........---
     ---................................FF...........---
       ---.............................FF..............---
         ---..........................FF.................---
           ---.......................FF....................---
             ---....................FF.......................---
               ---.................FF..........................---
                 ---..............FF.............................---
                   ---...........FF................................----
                     ---........FF...................................---
                       ---.....FF......................................---
                         ---.............................................--
                           ---............................................|
                             ----------------------------------------------
`
    });

    // Light the room
    des.region(selection.area(1, 1, 73, 16), 'lit');

    // Stairs
    des.stair('up');
    des.stair('down');

    // Non-diggable walls
    des.non_diggable();

    // Objects
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 6; i++) {
        des.trap();
    }

    // Monsters
    for (let i = 0; i < 28; i++) {
        des.monster();
    }

    return finalize_level();
}
