/**
 * Big Room variant 8 (eye shape with lava pupil)
 * Simplified port from nethack-c/dat/bigrm-9.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noflip');

    // Eye-shaped room with water surround and lava "pupil" in center
    des.map({
        map: `
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}................}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}................................}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}............................................}}}}}}}}}}}}}}}
}}}}}}}}}}......................................................}}}}}}}}}}
}}}}}}}............................................................}}}}}}}
}}}}}.......................LLLLLLLLLLLLLLLLLL.......................}}}}}
}}}....................LLLLLLLLLLLLLLLLLLLLLLLLLLL.....................}}}
}....................LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL....................}
}....................LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL....................}
}....................LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL....................}
}}}....................LLLLLLLLLLLLLLLLLLLLLLLLLLL.....................}}}
}}}}}.......................LLLLLLLLLLLLLLLLLL.......................}}}}}
}}}}}}}............................................................}}}}}}}
}}}}}}}}}}......................................................}}}}}}}}}}
}}}}}}}}}}}}}}}............................................}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}................................}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}................}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
`
    });

    // Unlit outer area, with lit "pupil" region in center
    des.region(selection.area(0, 0, 73, 18), 'unlit');
    des.region(selection.area(26, 4, 47, 14), 'lit');
    des.region(selection.area(21, 5, 51, 13), 'lit');
    des.region(selection.area(19, 6, 54, 12), 'lit');

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
