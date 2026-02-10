/**
 * medusa-3 - NetHack special level
 * Converted from: medusa-3.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack medusa medusa-3.lua	$NHDT-Date: 1716152250 2024/5/19 20:57:30 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.8 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990, 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    des.level_init({ style: "solidfill", fg: " " });
    des.level_flags("noteleport", "mazelevel", "shortsighted");
    // 
    // Here you disturb ravens nesting in the trees.
    // 
    des.map(`

    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
    }}}}}}}}}}.}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}.}}}}}}}}}}}}}}}}}}}}}}}}}}}}
    }}}}}}}}T..T.}}}}}}}}}}}}}}}}}}}}..}}}}}}}}.}}}...}}}}}}}.}}}}}......}}}}}}}
    }}}}}}.......T.}}}}}}}}}}}..}}}}..T.}}}}}}...T...T..}}...T..}}..-----..}}}}}
    }}}...-----....}}}}}}}}}}.T..}}}}}...}}}}}.....T..}}}}}......T..|...|.T..}}}
    }}}.T.|...|...T.}}}}}}}.T......}}}}..T..}}.}}}.}}...}}}}}.T.....+...|...}}}}
    }}}}..|...|.}}.}}}}}.....}}}T.}}}}.....}}}}}}.T}}}}}}}}}}}}}..T.|...|.}}}}}}
    }}}}}.|...|.}}}}}}..T..}}}}}}}}}}}}}T.}}}}}}}}..}}}}}}}}}}}.....-----.}}}}}}
    }}}}}.--+--..}}}}}}...}}}}}}}}}}}}}}}}}}}T.}}}}}}}}}}}}}}}}.T.}........}}}}}
    }}}}}.......}}}}}}..}}}}}}}}}.}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}.}}}.}}.T.}}}}}}
    }}.T...T...}}}}T}}}}}}}}}}}....}}}}}}}}}}T}}}}}.T}}...}}}}}}}}}}}}}}...}}}}}
    }}}...T}}}}}}}..}}}}}}}}}}}.T...}}}}}}}}.T.}.T.....T....}}}}}}}}}}}}}.}}}}}}
    }}}}}}}}}}}}}}}....}}}}}}}...}}.}}}}}}}}}}............T..}}}}}.T.}}}}}}}}}}}
    }}}}}}}}}}}}}}}}..T..}}}}}}}}}}}}}}..}}}}}..------+--...T.}}}....}}}}}}}}}}}
    }}}}.}..}}}}}}}.T.....}}}}}}}}}}}..T.}}}}.T.|...|...|....}}}}}.}}}}}...}}}}}
    }}}.T.}...}..}}}}T.T.}}}}}}.}}}}}}}....}}...|...+...|.}}}}}}}}}}}}}..T...}}}
    }}}}..}}}.....}}...}}}}}}}...}}}}}}}}}}}}}T.|...|...|}}}}}}}}}}}....T..}}}}}
    }}}}}..}}}.T..}}}.}}}}}}}}.T..}}}}}}}}}}}}}}---S-----}}}}}}}}}}}}}....}}}}}}
    }}}}}}}}}}}..}}}}}}}}}}}}}}}.}}}}}}}}}}}}}}}}}T..T}}}}}}}}}}}}}}}}}}}}}}}}}}
    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}

    `);

    let place = selection.new();
    // each of these spots are inside a distinct room
    place.set(8,6);
    place.set(66,5);
    place.set(46,15);

    // location of Medusa && downstairs && Perseus's statue
    let medloc = place.rndcoord(1,1);
    // specific location for some other statue in a different downstairs-eligible
    // room, to prevent object detection from becoming a trivial way to pinpoint
    // Medusa's location
    // [usefulness depends on future STATUE->dknown changes in nethack's core]
    let altloc = place.rndcoord(1,1);
    // location of a fountain, in the remaining of three downstairs-eligible rooms
    let othloc = place.rndcoord(1,1);
    // once here, all three points set in 'place' have been used up

    des.region(selection.area(0,0,74,19),"lit");
    // fixup_special hack: the first room defined on a Medusa level gets some
    // leaderboard statues, use arrival_room to force it to be a room even though
    // monsters won't arrive within it
    des.region({ region: [49,14, 51,16], lit: -1, type: "ordinary", arrival_room: true });
    des.region(selection.area(7,5,9,7),"unlit");
    des.region(selection.area(65,4,67,6),"unlit");
    des.region(selection.area(45,14,47,16),"unlit");
    // Non diggable walls
    // 4th room has diggable walls as Medusa is never placed there
    des.non_diggable(selection.area(6,4,10,8));
    des.non_diggable(selection.area(64,3,68,7));
    des.non_diggable(selection.area(44,13,48,17));
    // All places are accessible also with jumping, so don't bother
    // restricting the placement when teleporting from levels below this.
    des.teleport_region({ region: [33,2,38,7], dir: "down" });
    des.levregion({ region: [32,1,39,7], type: "stair-up" });

    // place the downstairs at the same spot where Medusa will be placed
    des.stair("down", medloc);
    // 
    des.door("locked",8,8);
    des.door("locked",64,5);
    des.door("random",50,13);
    des.door("locked",48,15);
    // 
    // in one of the three designated rooms, but ! the one with Medusa plus
    // downstairs && also ! 'altloc' where a random statue will be placed
    des.feature("fountain", othloc);
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
    // first random statue is in one of the three designated rooms but ! the
    // one with Medusa plus downstairs || the one with the fountain
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
    des.object("scroll of blank paper",48,18);
    des.object("scroll of blank paper",48,18);
    // 
    des.trap("rust");
    des.trap("rust");
    des.trap("board");
    des.trap("board");
    des.trap();
    // 
    // place Medusa before placing other monsters so that they won't be able to
    // unintentionally steal her spot on the downstairs
    des.monster({ id: "Medusa", coord: medloc, asleep: 1 });
    des.monster("giant eel");
    des.monster("giant eel");
    des.monster("jellyfish");
    des.monster("jellyfish");
    des.monster("wood nymph");
    des.monster("wood nymph");
    des.monster("water nymph");
    des.monster("water nymph");

    for (let i = 1; i <= 30; i++) {
       des.monster({ id: "raven", peaceful: 0 });
    }

    // medusa.length-3.lua


    return des.finalize_level();
}

