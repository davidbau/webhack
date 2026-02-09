/**
 * Big Room variant 3 (oval/elliptical shape)
 * Simplified port from nethack-c/dat/bigrm-4.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noflip');

    // Oval-shaped big room with lava pools
    des.map({
        map: `
-----------                                                     -----------
|.........|                                                     |.........|
|.........-------------                             -------------.........|
---...................------------       ------------...................---
  --.............................---------.............................--
   --.................................................................--
    --...............................................................--
     --......LLLLL.......................................LLLLL......--
      --.....LLLLL.......................................LLLLL.....--
      --.....LLLLL.......................................LLLLL.....--
     --......LLLLL.......................................LLLLL......--
    --...............................................................--
   --.................................................................--
  --.............................---------.............................--
---...................------------       ------------...................---
|.........-------------                             -------------.........|
|.........|                                                     |.........|
-----------                                                     -----------
`
    });

    // Fountains at corners
    des.feature({ type: 'fountain', x: 5, y: 2 });
    des.feature({ type: 'fountain', x: 5, y: 15 });
    des.feature({ type: 'fountain', x: 69, y: 2 });
    des.feature({ type: 'fountain', x: 69, y: 15 });

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
