/**
 * Pri-fila - NetHack special level
 * Converted from: Pri-fila.lua
 */

import * as des from '../sp_lev.js';

export function generate() {
    // NetHack Priest Pri-fila.lua	$NHDT-Date: 1652196008 2022/5/10 15:20:8 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("up");
                  des.object();
                  des.monster("human zombie");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.object();
                  des.monster("human zombie");
               }
    })

    des.room({ type: "morgue",
               contents: function() {
                  des.stair("down");
                  des.object();
                  des.trap();
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.trap();
                  des.monster("wraith");
               }
    })

    des.room({ type: "morgue",
               contents: function() {
                  des.object();
                  des.trap();
               }
    })

    des.random_corridors();


    return des.finalize_level();
}

