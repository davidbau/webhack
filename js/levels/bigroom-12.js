/**
 * Bigroom variant 12: Two hexagons with pool/lava/walls
 * C ref: nethack-c/dat/bigrm-12.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    des.level_flags('mazelevel', 'noflipy');
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.map(`

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

`);

    // Maybe replace lavawalls/waterwalls with stone walls
    if (percent(20)) {
        if (percent(50)) {
            des.replace_terrain({ fromterrain: 'W', toterrain: '-' });
        }
        if (percent(50)) {
            des.replace_terrain({ fromterrain: 'Z', toterrain: '-' });
        }
    }

    // Maybe replace pools with floor and then possibly walls with pools
    if (percent(25)) {
        des.replace_terrain({ fromterrain: 'P', toterrain: '.' });
        if (percent(75)) {
            des.replace_terrain({ fromterrain: 'W', toterrain: 'P' });
        }
    }
    if (percent(25)) {
        des.replace_terrain({ fromterrain: 'L', toterrain: '.' });
        if (percent(75)) {
            des.replace_terrain({ fromterrain: 'Z', toterrain: 'L' });
        }
    }

    // Maybe make both sides have the same terrain
    if (percent(20)) {
        if (percent(50)) {
            // Both are lava
            des.replace_terrain({ fromterrain: 'P', toterrain: 'L' });
            des.replace_terrain({ fromterrain: 'W', toterrain: 'Z' });
        } else {
            // Both are water
            des.replace_terrain({ fromterrain: 'L', toterrain: 'P' });
            des.replace_terrain({ fromterrain: 'Z', toterrain: 'W' });
        }
    }

    des.region(selection.area(0, 0, 75, 19), 'lit');
    des.non_diggable();

    des.wallify();

    des.stair('up');
    des.stair('down');

    for (let i = 0; i < 15; i++) {
        des.object();
    }
    for (let i = 0; i < 6; i++) {
        des.trap();
    }
    for (let i = 0; i < 28; i++) {
        des.monster();
    }

    return des.finalize_level();
}
