/**
 * medusa-1 - NetHack special level
 * Converted from: medusa-1.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack medusa medusa-1.lua	$NHDT-Date: 1652196027 2022/5/10 15:20:27 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.4 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1990, 1991 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // These are the Medusa's levels :
    // 

    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport");

    des.map(`

    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
    }}.}}}}}..}}}}}......}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}....}}}...}}}}}
    }...}}.....}}}}}....}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}...............}
    }....}}}}}}}}}}....}}}..}}}}}}}}}}}.......}}}}}}}}}}}}}}}}..}}.....}}}...}}
    }....}}}}}}}}.....}}}}..}}}}}}.................}}}}}}}}}}}.}}}}.....}}...}}
    }....}}}}}}}}}}}}.}}}}.}}}}}}.-----------------.}}}}}}}}}}}}}}}}}.........}
    }....}}}}}}}}}}}}}}}}}}.}}}...|...............S...}}}}}}}}}}}}}}}}}}}....}}
    }.....}.}}....}}}}}}}}}.}}....--------+--------....}}}}}}..}}}}}}}}}}}...}}
    }......}}}}..}}}}}}}}}}}}}........|.......|........}}}}}....}}}}}}}}}}}}}}}
    }.....}}}}}}}}}}}}}}}}}}}}........|.......|........}}}}}...}}}}}}}}}.}}}}}}
    }.....}}}}}}}}}}}}}}}}}}}}....--------+--------....}}}}}}.}.}}}}}}}}}}}}}}}
    }......}}}}}}}}}}}}}}}}}}}}...S...............|...}}}}}}}}}}}}}}}}}.}}}}}}}
    }.......}}}}}}}..}}}}}}}}}}}}.-----------------.}}}}}}}}}}}}}}}}}....}}}}}}
    }........}}.}}....}}}}}}}}}}}}.................}}}}}..}}}}}}}}}.......}}}}}
    }.......}}}}}}}......}}}}}}}}}}}}}}.......}}}}}}}}}.....}}}}}}...}}..}}}}}}
    }.....}}}}}}}}}}}.....}}}}}}}}}}}}}}}}}}}}}}.}}}}}}}..}}}}}}}}}}....}}}}}}}
    }}..}}}}}}}}}}}}}....}}}}}}}}}}}}}}}}}}}}}}...}}..}}}}}}}.}}.}}}}..}}}}}}}}
    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
    }}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}

    `);
    // Dungeon Description
    des.region(selection.area(0,0,74,19),"lit");
    des.region(selection.area(31,7,45,7),"unlit");
    // make the downstairs room a real room to control arriving monsters, 
    // && also as a fixup_special hack; the first room defined on Medusa's level
    // receives some statues
    des.region({ region: [35,9, 41,10], lit: 0, type: "ordinary", arrival_room: true });
    des.region(selection.area(31,12,45,12),"unlit");
    // Teleport: down to up stairs island, up to Medusa's island
    des.teleport_region({ region: [1,1,5,17], dir: "down" });
    des.teleport_region({ region: [26,4,50,15], dir: "up" });
    // Stairs
    des.stair("up", 5,14);
    des.stair("down", 36,10);
    // Doors
    des.door("closed",46,7);
    des.door("locked",38,8);
    des.door("locked",38,11);
    des.door("closed",30,12);
    // Branch, ! allowed inside Medusa's building.
    des.levregion({ region: [1,0,79,20], exclude: [30,6,46,13], type: "branch" });
    // Non diggable walls
    des.non_diggable(selection.area(30,6,46,13));
    // Objects
    des.object({ id: "statue", x: 36,y: 10, buc: "uncursed",
                 montype: "knight", historic: 1, male: 1, name: "Perseus",
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

    // Specifying explicit contents forces them to be empty.
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object({ id: "statue", contents: 0 });
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    // Random traps
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap();
    des.trap("board",38,7);
    des.trap("board",38,12);
    // Random monsters
    des.monster({ id: "Medusa", x: 36,y: 10, asleep: 1 });
    des.monster("giant eel",11,6);
    des.monster("giant eel",23,13);
    des.monster("giant eel",29,2);
    des.monster("jellyfish",2,2);
    des.monster("jellyfish",0,8);
    des.monster("jellyfish",4,18);
    des.monster("water troll",51,3);
    des.monster("water troll",64,11);
    des.monster({ class: 'S', x: 38, y: 7 });
    des.monster({ class: 'S', x: 38, y: 12 });
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();


    return des.finalize_level();
}

