/**
 * tower1 - NetHack special level
 * Converted from: tower1.lua
 */

import * as des from '../sp_lev.js';
import { selection, shuffle } from '../sp_lev.js';

export function generate() {
    // NetHack tower tower1.lua	$NHDT-Date: 1717178759 2024/5/31 18:5:59 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // Upper stage of Vlad's tower
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport", "hardfloor", "solidify");
    des.map({ halign: "half-left", valign: "center", map: `

      --- --- ---  
      |.| |.| |.|  
    ---S---S---S---
    |.......+.+...|
    ---+-----.-----
      |...\.|.+.|  
    ---+-----.-----
    |.......+.+...|
    ---S---S---S---
      |.| |.| |.|  
      --- --- ---  

    ` });

    let niches = [ [3,1], [3,9], [7,1], [7,9], [11,1], [11,9] ];
    shuffle(niches);

    des.ladder("down", 11,5);
    // The lord && his court
    des.monster("Vlad the Impaler", 6, 5);
    des.monster("V",niches[1]);
    des.monster("V",niches[2]);
    des.monster("V",niches[3]);
    // The brides; they weren't named in Bram Stoker's original _Dracula_
    // && when appearing in umpteen subsequent books && movies there is
    // no consensus for their names.  According to the Wikipedia entry for
    // "Brides of Dracula", the "Czechoslovakian TV film Hrabe Drakula (1971)"
    // gave them titles rather than (|| perhaps in addition to) specific names
    // && we use those titles here.  Marking them as 'waiting' forces them to
    // start in vampire form instead of vampshifted into bat/fog/wolf form.
    let Vgenod = nh.is_genocided("vampire");
    let Vnames = [ null, null, null ];
    if ((! Vgenod)) {
       Vnames: [ "Madame", "Marquise", "Countess" ];
    }
    des.monster({ id: "vampire lady", coord: niches[4], name: Vnames[1], waiting: 1 });
    des.monster({ id: "vampire lady", coord: niches[5], name: Vnames[2], waiting: 1 });
    des.monster({ id: "vampire lady", coord: niches[6], name: Vnames[3], waiting: 1 });
    // The doors
    des.door("closed",8,3);
    des.door("closed",10,3);
    des.door("closed",3,4);
    des.door("locked",10,5);
    des.door("locked",8,7);
    des.door("locked",10,7);
    des.door("closed",3,6);
    // treasures
    des.object("chest", 7,5);

    des.object("chest",niches[6]);
    des.object("chest",niches[1]);
    des.object("chest",niches[2]);
    des.object("chest",niches[3]);
    des.object({ id: "chest", coord: niches[4],
                 contents: function() {
                    des.object({ id: "wax candle", quantity: Math.random(4,8) });
                 }
    });
    des.object({ id: "chest", coord: niches[5],
                 contents: function() {
                    des.object({ id: "tallow candle", quantity: Math.random(4,8) });
                 }
    });
    // We have to protect the tower against outside attacks
    des.non_diggable(selection.area(0,0,14,10));


    return des.finalize_level();
}

