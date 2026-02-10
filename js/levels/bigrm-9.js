/**
 * bigrm-9 - NetHack special level
 * Converted from: bigrm-9.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack bigroom bigrm-9.lua	$NHDT-Date: 1652196023 2022/5/10 15:20:23 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("mazelevel", "noflip");

    des.map(`

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

    `);

    // Unlit, except 3 mapgrids around the "pupil"
    des.region(selection.area(0,0,73,18),"unlit");
    des.region(selection.area(26,4,47,14),"lit");
    des.region(selection.area(21,5,51,13),"lit");
    des.region(selection.area(19,6,54,12),"lit");

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

