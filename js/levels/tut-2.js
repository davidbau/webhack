/**
 * tut-2 - NetHack special level
 * Converted from: tut-2.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {

    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel", "noflip",
                    "nomongen", "nodeathdrops", "noautosearch");

    des.map(`

    --------------
    |............|
    |............|
    |............|
    |............|
    |............|
    |............|
    --------------

    `);


    des.region(selection.area(1,1, 73, 16), "lit");

    des.stair({ dir: "up", coord: [ 2,2 ] });

    des.engraving({ coord: [ 1,1 ], type: "burn", text: "Use '" + nh.eckey("up") + "' to go up the stairs", degrade: false });


    des.trap({ type: "magic portal", coord: [ 11,5 ], seen: true });

    des.non_diggable();


    return des.finalize_level();
}

