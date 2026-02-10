/**
 * Wiz-fila - NetHack special level
 * Converted from: Wiz-fila.lua
 */

import * as des from '../sp_lev.js';

export function generate() {
    // NetHack Wizard Wiz-fila.lua	$NHDT-Date: 1652196018 2022/5/10 15:20:18 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1992 by David Cohrs
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("up");
                  des.object();
                  des.monster({ class: "i", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.monster({ class: "i", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.object();
                  des.monster("vampire bat");
                  des.monster("vampire bat");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("down");
                  des.object();
                  des.trap();
                  des.monster({ class: "i", peaceful: 0 });
                  des.monster("vampire bat");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.trap();
                  des.monster({ class: "i", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.monster("vampire bat");
               }
    })

    des.random_corridors();


    return des.finalize_level();
}

