/**
 * Mon-fila - NetHack special level
 * Converted from: Mon-fila.lua
 */

import * as des from '../sp_lev.js';

export function generate() {
    // NetHack Monk Mon-fila.lua	$NHDT-Date: 1652196006 2022/5/10 15:20:6 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1991-2 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 

    // 
    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("up");
                  des.object();
                  des.monster({ class: "E", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.monster({ class: "E", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.object();
                  des.monster("xorn");
                  des.monster("earth elemental");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.stair("down");
                  des.object();
                  des.trap();
                  des.monster({ class: "E", peaceful: 0 });
                  des.monster("earth elemental");
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.object();
                  des.trap();
                  des.monster({ class: "X", peaceful: 0 });
               }
    })

    des.room({ type: "ordinary",
               contents: function() {
                  des.object();
                  des.trap();
                  des.monster("earth elemental");
               }
    })

    des.random_corridors();


    return des.finalize_level();
}

