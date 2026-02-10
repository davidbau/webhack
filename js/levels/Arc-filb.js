/**
 * Arc-filb - NetHack special level
 * Converted from: Arc-filb.lua
 */

import * as des from '../sp_lev.js';

export function generate() {
    // NetHack Archeologist Arc-filb.lua	$NHDT-Date: 1652195998 2022/5/10 15:19:58 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("up");
                  des.object();
                  des.monster("M");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.monster("M");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.object();
                  des.monster("M");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("down");
                  des.object();
                  des.trap();
                  des.monster("S");
                  des.monster("human mummy");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.trap();
                  des.monster("S");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.monster("S");
               }
    })

    des.random_corridors();


    return des.finalize_level();
}

