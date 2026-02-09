/**
 * Big Room variant 9 (two hexagons with pools)
 * Simplified port from nethack-c/dat/bigrm-12.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noflipy');

    // Two hexagons side by side - left has water, right has lava
    des.map({
        map: `

         .......................           .......................
        .........................         .........................
       ...........................       ...........................
      .............................     .............................
     ........PPPPPPPPPPPPPPP........   ........LLLLLLLLLLLLLLL........
    ........PPPPPPPPPPPPPPPPP........ ........LLLLLLLLLLLLLLLLL........
   ........PPPWWWWWWWWWWWWWPPP...............LLLZZZZZZZZZZZZZLLL........
  ........PPPWWWWWWWWWWWWWWWPPP.............LLLZZZZZZZZZZZZZZZLLL........
 ........PPPWWWWWWWWWWWWWWWWWPPP...........LLLZZZZZZZZZZZZZZZZZLLL........
  ........PPPWWWWWWWWWWWWWWWPPP.............LLLZZZZZZZZZZZZZZZLLL........
   ........PPPWWWWWWWWWWWWWPPP...............LLLZZZZZZZZZZZZZLLL........
    ........PPPPPPPPPPPPPPPPP........ ........LLLLLLLLLLLLLLLLL........
     ........PPPPPPPPPPPPPPP........   ........LLLLLLLLLLLLLLL........
      .............................     .............................
       ...........................       ...........................
        .........................         .........................
         .......................           .......................

`
    });

    // Light the room
    des.region(selection.area(0, 0, 75, 19), 'lit');

    // Non-diggable walls
    des.non_diggable();

    // Stairs
    des.stair('up');
    des.stair('down');

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
