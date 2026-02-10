/**
 * Rog-filb - NetHack special level
 * Converted from: Rog-filb.lua
 */

import * as des from '../sp_lev.js';

export function generate() {
    // NetHack Rogue Rog-filb.lua	$NHDT-Date: 1652196011 2022/5/10 15:20:11 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1992 by Dean Luick
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("up");
                  des.object();
                  des.monster({ id: "leprechaun", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.monster({ id: "leprechaun", peaceful: 0 });
                  des.monster({ id: "guardian naga", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.trap();
                  des.object();
                  des.monster({ id: "water nymph", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("down");
                  des.object();
                  des.trap();
                  des.trap();
                  des.monster({ class: "l", peaceful: 0 });
                  des.monster({ id: "guardian naga", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.trap();
                  des.trap();
                  des.monster({ id: "leprechaun", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.trap();
                  des.monster({ id: "leprechaun", peaceful: 0 });
                  des.monster({ id: "water nymph", peaceful: 0 });
               }
    })

    des.random_corridors();


    return des.finalize_level();
}

