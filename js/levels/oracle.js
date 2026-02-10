/**
 * oracle - NetHack special level
 * Converted from: oracle.lua
 */

import * as des from '../sp_lev.js';

export function generate() {
    // NetHack oracle oracle.lua	$NHDT-Date: 1652196033 2022/5/10 15:20:33 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.1 $
    // Copyright (c) 2015 by Pasi Kallinen
    // NetHack may be freely redistributed.  See license for details.
    // 
    // Oracle level
    des.level_flags("noflip");

    des.room({ type: "ordinary", lit: 1, x: 3,y: 3, xalign: "center",yalign: "center", w: 11,h: 9, contents: function() {
                  des.object({ id: "statue", x: 0, y: 0, montype: "C", historic: true });
                  des.object({ id: "statue", x: 0, y: 8, montype: "C", historic: true });
                  des.object({ id: "statue", x: 10, y: 0, montype: "C", historic: true });
                  des.object({ id: "statue", x: 10, y: 8, montype: "C", historic: true });
                  des.object({ id: "statue", x: 5, y: 1, montype: "C", historic: true });
                  des.object({ id: "statue", x: 5, y: 7, montype: "C", historic: true });
                  des.object({ id: "statue", x: 2, y: 4, montype: "C", historic: true });
                  des.object({ id: "statue", x: 8, y: 4, montype: "C", historic: true });

                  des.room({ type: "delphi", lit: 1, x: 4,y: 3, w: 3,h: 3, contents: function() {
                                des.feature("fountain", 0, 1);
                                des.feature("fountain", 1, 0);
                                des.feature("fountain", 1, 2);
                                des.feature("fountain", 2, 1);
                                des.monster("Oracle", 1, 1);
                                des.door({ state: "nodoor", wall: "all" });
                             }
                  });

                  des.monster();
                  des.monster();
               }
    });

    des.room({ contents: function() {
                     des.stair("up");
                     des.object();
                  }
    });

    des.room({ contents: function() {
                     des.stair("down");
                     des.object();
                     des.trap();
                     des.monster();
                     des.monster();
                  }
    });

    des.room({ contents: function() {
                     des.object();
                     des.object();
                     des.monster();
                  }
    });

    des.room({ contents: function() {
                     des.object();
                     des.trap();
                     des.monster();
                  }
    });

    des.room({ contents: function() {
                     des.object();
                     des.trap();
                     des.monster();
                  }
    });

    des.random_corridors();


    return des.finalize_level();
}

