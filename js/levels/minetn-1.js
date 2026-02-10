/**
 * minetn-1 - NetHack special level
 * Converted from: minetn-1.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent, shuffle } from '../sp_lev.js';

export function generate() {
    // NetHack 3.7	mines minetn-1.lua	$NHDT-Date: 1652196030 2022/5/10 15:20:30 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.8 $
    // Copyright (c) 1989-95 by Jean-Christophe Collet
    // Copyright (c) 1991-95 by M. Stephenson
    // NetHack may be freely redistributed.  See license for details.
    // 
    // A tragic accident has occurred in Frontier Town...args.
    // 
    // Minetown variant 1
    // Orcish Town - a variant of Frontier Town that has been
    // overrun by orcs.  Note the barricades (iron bars).

    des.level_flags("mazelevel");

    des.level_init({ style: "mines", fg: ".", bg: " ", smoothed: true, joined: true, walled: true });

    des.map(`

    .....................................
    .----------------F------------------.
    .|.................................|.
    .|.-------------......------------.|.
    .|.|...|...|...|......|..|...|...|.|.
    .F.|...|...|...|......|..|...|...|.|.
    .|.|...|...|...|......|..|...|...|.F.
    .|.|...|...|----......------------.|.
    .|.---------.......................|.
    .|.................................|.
    .|.---------.....--...--...........|.
    .|.|...|...|----.|.....|.---------.|.
    .|.|...|...|...|.|.....|.|..|....|.|.
    .|.|...|...|...|.|.....|.|..|....|.|.
    .|.|...|...|...|.|.....|.|..|....|.|.
    .|.-------------.-------.---------.|.
    .|.................................F.
    .-----------F------------F----------.
    .....................................

    `);

    // Don't let the player fall into his likely death; used to explicitly exclude
    // the town, but that meant that you couldn't teleport out as well as ! in.
    des.teleport_region({ region: [1,1,75,19], exclude: [1,0,35,21], region_islev: 1 });
    des.region(selection.area(1,1,35,17), "lit");
    des.levregion({ type: "stair-up", region: [1,3,21,19], region_islev: 1,
    		exclude: [0,1,36,17] });
    des.levregion({ type: "stair-down", region: [57,3,75,19], region_islev: 1,
    		exclude: [0,1,36,17] })

    // shame we can't make polluted fountains
    des.feature("fountain",16,9);
    des.feature("fountain",25,9);

    // the altar's defiled; useful for BUC but never coaligned
    des.altar({ x: 20,y: 13,align: "noalign", type: "shrine" });

    // set up the shop doors; could be broken down
    des.door("random",5,8);
    des.door("random",9,8);
    des.door("random",13,7);
    des.door("random",22,5);
    des.door("random",27,7);
    des.door("random",31,7);
    des.door("random",5,10);
    des.door("random",9,10);
    des.door("random",15,13);
    des.door("random",25,13);
    des.door("random",31,11);

    // knock a few holes in the shop interior walls
    des.replace_terrain({ region: [7,4,11,6], fromterrain: "|", toterrain: ".", chance: 18 });
    des.replace_terrain({ region: [25,4,29,6], fromterrain: "|", toterrain: ".", chance: 18 });
    des.replace_terrain({ region: [7,12,11,14], fromterrain: "|", toterrain: ".", chance: 18 });
    des.replace_terrain({ region: [28,12,28,14], fromterrain: "|", toterrain: ".", chance: 33 });

    // One spot each in most shops...args
    let place = [ [5,4],[9,5],[13,4],[26,4],[31,5],[30,14],[5,14],[10,13],[26,14],[27,13] ]
    shuffle(place);

    // scatter some bodies
    des.object({ id: "corpse", x: 20,y: 12, montype: "aligned cleric" });
    des.object({ id: "corpse", coord: place[1], montype: "shopkeeper" });
    des.object({ id: "corpse", coord: place[2], montype: "shopkeeper" });
    des.object({ id: "corpse", coord: place[3], montype: "shopkeeper" });
    des.object({ id: "corpse", coord: place[4], montype: "shopkeeper" });
    des.object({ id: "corpse", coord: place[5], montype: "shopkeeper" });
    des.object({ id: "corpse", montype: "watchman" });
    des.object({ id: "corpse", montype: "watchman" });
    des.object({ id: "corpse", montype: "watchman" });
    des.object({ id: "corpse", montype: "watchman" });
    des.object({ id: "corpse", montype: "watch captain" });

    // Rubble!
    for (let i = 1; i <= 9 + Math.random(2 - 1,2*5); i++) {
      if (percent(90)) {
        des.object("boulder");
      }
      des.object("rock");
    }

    // Guarantee 7 candles since we won't have Izchak available
    des.object({ id: "wax candle", coord: place[4], quantity: Math.random(1,2) });

    des.object({ id: "wax candle", coord: place[1], quantity: Math.random(2,4) });
    des.object({ id: "wax candle", coord: place[2], quantity: Math.random(1,2) });
    des.object({ id: "tallow candle", coord: place[3], quantity: Math.random(1,3) });
    des.object({ id: "tallow candle", coord: place[2], quantity: Math.random(1,2) });
    des.object({ id: "tallow candle", coord: place[4], quantity: Math.random(1,2) });

    // go ahead && leave a lamp next to one corpse to be suggestive
    // && some empty wands...args
    des.object("oil lamp",place[2]);
    des.object({ id: "wand of striking", coord: place[1], buc: "uncursed", spe: 0 });
    des.object({ id: "wand of striking", coord: place[3], buc: "uncursed", spe: 0 });
    des.object({ id: "wand of striking", coord: place[4], buc: "uncursed", spe: 0 });
    des.object({ id: "wand of magic missile", coord: place[4], buc: "uncursed", spe: 0 });
    des.object({ id: "wand of magic missile", coord: place[5], buc: "uncursed", spe: 0 });

    // the Orcish Army

    let inside = selection.floodfill(18,8)
    let near_temple = selection.area(17,8, 23,14) & inside

    for (let i = 1; i <= 5 + Math.random(1 - 1,1*10); i++) {
       if (percent(50)) {
          des.monster({ id: "orc-captain", coord: inside.rndcoord(1), peaceful: 0 });
       } else {
          if (percent(80)) {
             des.monster({ id: "Uruk-hai", coord: inside.rndcoord(1), peaceful: 0 });
          } else {
             des.monster({ id: "Mordor orc", coord: inside.rndcoord(1), peaceful: 0 });
          }
       }
    }
    // shamans can be hanging out in/near the temple
    for (let i = 1; i <= Math.random(2 - 1,2*3); i++) {
       des.monster({ id: "orc shaman", coord: near_temple.rndcoord(0), peaceful: 0 });
    }
    // these are ! such a big deal
    // to run into outside the bars
    for (let i = 1; i <= 9 + Math.random(2 - 1,2*5); i++) {
       if (percent(90)) {
          des.monster({ id: "hill orc", peaceful: 0 });
       } else {
          des.monster({ id: "goblin", peaceful: 0 });
       }
    }

    // Hack to force full-level wallification

    des.wallify();


    return des.finalize_level();
}

