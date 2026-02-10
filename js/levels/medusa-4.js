/**
 * medusa-4 - NetHack special level
 * Converted from: medusa-4.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack medusa medusa-4.lua	$NHDT-Date: 1716152274 2024/5/19 20:57:54 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.8 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990, 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("noteleport", "mazelevel");
    // 
    // Here the Medusa rules some slithery monsters from her 'palace', with
    // a yellow dragon nesting in the backyard.
    // 
    des.map(`

    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
    }}}}}}}}}}}}}}........}}}}}}}}}}}}}}}}}}}}}}}..}}}.....}}}}}}}}}}}----|}}}}}
    }}}}}}..----------F-.....}}}}}}}}}}}}}}}}..---...}}}}....T.}}}}}}}....|}}}}}
    }}}.....|...F......S}}}}....}}}}}}}...}}.....|}}.}}}}}}}......}}}}|......}}}
    }}}.....+...|..{...|}}}}}}}}}}}}.....}}}}|...|}}}}}}}}}}}.}}}}}}}}----.}}}}}
    }}......|...|......|}}}}}}}}}......}}}}}}|.......}}}}}}}}}}}}}..}}}}}...}}}}
    }}|-+--F|-+--....|F|-|}}}}}....}}}....}}}-----}}.....}}}}}}}......}}}}.}}}}}
    }}|...}}|...|....|}}}|}}}}}}}..}}}}}}}}}}}}}}}}}}}}....}}}}}}}}....T.}}}}}}}
    }}|...}}F...+....F}}}}}}}..}}}}}}}}}}}}}}...}}}}}}}}}}}}}}}}}}}}}}....}}..}}
    }}|...}}|...|....|}}}|}....}}}}}}....}}}...}}}}}...}}}}}}}}}}}}}}}}}.....}}}
    }}--+--F|-+--....-F|-|....}}}}}}}}}}.T...}}}}....---}}}}}}}}}}}}}}}}}}}}}}}}
    }}......|...|......|}}}}}.}}}}}}}}}....}}}}}}}.....|}}}}}}}}}.}}}}}}}}}}}}}}
    }}}}....+...|..{...|.}}}}}}}}}}}}}}}}}}}}}}}}}}.|..|}}}}}}}......}}}}...}}}}
    }}}}}}..|...F......|...}}}}}}}}}}..---}}}}}}}}}}--.-}}}}}....}}}}}}....}}}}}
    }}}}}}}}-----S----F|....}}}}}}}}}|...|}}}}}}}}}}}}...}}}}}}...}}}}}}..}}}}}}
    }}}}}}}}}..............T...}}}}}.|.......}}}}}}}}}}}}}}..}...}.}}}}....}}}}}
    }}}}}}}}}}....}}}}...}...}}}}}.......|.}}}}}}}}}}}}}}.......}}}}}}}}}...}}}}
    }}}}}}}}}}..}}}}}}}}}}.}}}}}}}}}}-..--.}}}}}}}}..}}}}}}..T...}}}..}}}}}}}}}}
    }}}}}}}}}...}}}}}}}}}}}}}}}}}}}}}}}...}}}}}}}....}}}}}}}.}}}..}}}...}}}}}}}}
    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}.}}}}}}....}}}}}}}}}}}}}}}}}}}...}}}}}}
    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}

    `);

    // 
    // place handling is similar to medusa-3.lua except that there are 4
    // downstairs-eligible rooms rather than 3, && only 2 of them are used
    let place = selection.new();
    // each of these spots are inside a distinct room
    place.set(4,8);
    place.set(10,4);
    place.set(10,8);
    place.set(10,12);

    // location of Medusa && downstairs && Perseus's statue
    let medloc = place.rndcoord(1,1);
    // specific location for some other statue in a different downstairs-eligible
    // room, to prevent object detection from becoming a trivial way to pinpoint
    // Medusa's location
    // [usefulness depends on future STATUE->dknown changes in nethack's core]
    let altloc = place.rndcoord(1,1);

    // 
    des.region(selection.area(0,0,74,19),"lit");
    // fixup_special hack: The first "room" region in Medusa levels gets filled
    // with some leaderboard statues, so this needs to be a room; setting
    // irregular=1 will force this
    des.region({ region: [13,3, 18,13], lit: 1, type: "ordinary", irregular: 1 });
    // 
    des.teleport_region({ region: [64,1,74,17], dir: "down" });
    des.teleport_region({ region: [2,2,18,13], dir: "up" });
    // 
    des.levregion({ region: [67,1,74,20], type: "stair-up" });

    // place the downstairs at the same spot where Medusa will be placed
    des.stair("down", medloc);
    // 
    des.door("locked",4,6);
    des.door("locked",4,10);
    des.door("locked",8,4);
    des.door("locked",8,12);
    des.door("locked",10,6);
    des.door("locked",10,10);
    des.door("locked",12,8);
    // 
    des.levregion({ region: [27,0,79,20], type: "branch" });
    // 
    des.non_diggable(selection.area(1,1,22,14));
    // 
    des.object("crystal ball", 7,8);
    // 
    // same spot as Medusa plus downstairs
    des.object({ id: "statue", coord: medloc, buc: "uncursed",
                          montype: "knight", historic: 1, male: 1,name: "Perseus",
                          contents: function() {
                             if (percent(75)) {
                                des.object({ id: "shield of reflection", buc: "cursed", spe: 0 });
                             }
                             if (percent(25)) {
                                des.object({ id: "levitation boots", spe: 0 });
                             }
                             if (percent(50)) {
                                des.object({ id: "scimitar", buc: "blessed", spe: 2 });
                             }
                             if (percent(50)) {
                                des.object("sack");
                             }
                          }
    });
    // 
    // first random statue is in one of the designated stair rooms but ! the
    // one with Medusa plus downstairs
    des.object({ id: "statue", coord: altloc, contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    for (let i = 1; i <= 8; i++) {
       des.object();
    }
    // 
    for (let i = 1; i <= 7; i++) {
       des.trap();
    }
    // 
    // place Medusa before placing other monsters so that they won't be able to
    // unintentionally steal her spot on the downstairs
    des.monster({ id: "Medusa", coord: medloc, asleep: 1 });
    des.monster("kraken", 7,7);
    // 
    // the nesting dragon
    des.monster({ id: "yellow dragon", x: 5, y: 4, asleep: 1 });
    if (percent(50)) {
       des.monster({ id: "baby yellow dragon", x: 4,y: 4, asleep: 1 });
    }
    if (percent(25)) {
       des.monster({ id: "baby yellow dragon", x: 4, y: 5, asleep: 1 });
    }
    des.object({ id: "egg", x: 5, y: 4, montype: "yellow dragon" });
    if (percent(50)) {
       des.object({ id: "egg", x: 5, y: 4, montype: "yellow dragon" });
    }
    if (percent(25)) {
       des.object({ id: "egg", x: 5, y: 4, montype: "yellow dragon" });
    }
    // 
    des.monster("giant eel");
    des.monster("giant eel");
    des.monster("jellyfish");
    des.monster("jellyfish");
    for (let i = 1; i <= 14; i++) {
       des.monster("S");
    }
    for (let i = 1; i <= 4; i++) {
       des.monster("black naga hatchling");
       des.monster("black naga");
    }

    // medusa.length-4.lua


    return des.finalize_level();
}

