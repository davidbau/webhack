/**
 * wizard1 - NetHack special level
 * Converted from: wizard1.lua
 */

import * as des from '../sp_lev.js';
import { selection } from '../sp_lev.js';

export function generate() {
    // NetHack yendor wizard1.lua	$NHDT-Date: 1652196039 2022/5/10 15:20:39 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.3 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by M. Stephenson && Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // The top (real) wizard level.
    // Keeping the Moat for old-time's sake
    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel", "noteleport", "hardfloor");

    let tmpbounds = selection.match("-");
    let bnds = tmpbounds.bounds();
    let bounds2 = selection.fillrect(bnds.lx, bnds.ly + 1, bnds.hx - 2, bnds.hy - 1);

    let wiz1 = des.map({ halign: "center", valign: "center", map: `

    ----------------------------x
    |.......|..|.........|.....|x
    |.......S..|.}}}}}}}.|.....|x
    |..--S--|..|.}}---}}.|---S-|x
    |..|....|..|.}--.--}.|..|..|x
    |..|....|..|.}|...|}.|..|..|x
    |..--------|.}--.--}.|..|..|x
    |..|.......|.}}---}}.|..|..|x
    |..S.......|.}}}}}}}.|..|..|x
    |..|.......|.........|..|..|x
    |..|.......|-----------S-S-|x
    |..|.......S...............|x
    ----------------------------x

    `, contents: function(rm) {
       des.levregion({ type: "stair-up", region: [1,0,79,20], region_islev: 1, exclude: [0,0,28,12] });
       des.levregion({ type: "stair-down", region: [1,0,79,20], region_islev: 1, exclude: [0,0,28,12] });
       des.levregion({ type: "branch", region: [1,0,79,20], region_islev: 1, exclude: [0,0,28,12] });
       des.teleport_region({ region: [1,0,79,20], region_islev: 1, exclude: [0,0,27,12] });
       des.region({ region: [12,1, 20,9], lit: 0, type: "morgue", filled: 2, contents: function() {
                       let sdwall = [ "south", "west", "east" ];
                       des.door({ wall: sdwall[Math.random(1, sdwall.length)], state: "secret" });
       } })
       // another region to constrain monster arrival
       des.region({ region: [1,1, 10,11], lit: 0, type: "ordinary", arrival_room: true });
       des.mazewalk(28,5,"east");
       des.ladder("down", 6,5);
       // Non diggable walls
       // Walls inside the moat stay diggable
       des.non_diggable(selection.area(0,0,11,12));
       des.non_diggable(selection.area(11,0,21,0));
       des.non_diggable(selection.area(11,10,27,12));
       des.non_diggable(selection.area(21,0,27,10));
       // Non passable walls
       des.non_passwall(selection.area(0,0,11,12));
       des.non_passwall(selection.area(11,0,21,0));
       des.non_passwall(selection.area(11,10,27,12));
       des.non_passwall(selection.area(21,0,27,10));
       // The wizard && his guards
       des.monster({ id: "Wizard of Yendor", x: 16, y: 5, asleep: 1 });
       des.monster("hell hound", 15, 5);
       des.monster("vampire lord", 17, 5);
       // The let treasure
       des.object("Book of the Dead", 16, 5);
       // Surrounding terror
       des.monster("kraken", 14, 2);
       des.monster("giant eel", 17, 2);
       des.monster("kraken", 13, 4);
       des.monster("giant eel", 13, 6);
       des.monster("kraken", 19, 4);
       des.monster("giant eel", 19, 6);
       des.monster("kraken", 15, 8);
       des.monster("giant eel", 17, 8);
       des.monster("piranha", 15, 2);
       des.monster("piranha", 19, 8);
       // Random monsters
       des.monster("D");
       des.monster("H");
       des.monster("&");
       des.monster("&");
       des.monster("&");
       des.monster("&");
       // And to make things a little harder.
       des.trap("board",16,4);
       des.trap("board",16,6);
       des.trap("board",15,5);
       des.trap("board",17,5);
       // Random traps.
       des.trap("spiked pit");
       des.trap("sleep gas");
       des.trap("anti magic");
       des.trap("magic");
       // Some random loot.
       des.object("ruby");
       des.object("!");
       des.object("!");
       des.object("?");
       des.object("?");
       des.object("+");
       des.object("+");
       des.object("+");
    }
    });

    let protected_region = bounds2.negate() | wiz1;
    hell_tweaks(protected_region);


    return des.finalize_level();
}

