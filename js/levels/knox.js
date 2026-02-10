/**
 * knox - NetHack special level
 * Converted from: knox.lua
 */

import * as des from '../sp_lev.js';
import { selection, percent } from '../sp_lev.js';

export function generate() {
    // NetHack knox knox.lua	$NHDT-Date: 1652196027 2022/5/10 15:20:27 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.5 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // Copyright (c) 1992 by Izchak Miller
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    des.level_init({ style: "solidfill", fg: " " });

    des.level_flags("mazelevel", "noteleport");
    // Fort's entry is via a secret door rather than a drawbridge;
    // the moat must be manually circumvented.
    des.map(`

    ----------------------------------------------------------------------------
    | |........|...............................................................|
    | |........|.................................................------------..|
    | --S----S--.................................................|..........|..|
    |   #   |........}}}}}}}....................}}}}}}}..........|..........|..|
    |   #   |........}-----}....................}-----}..........--+--+--...|..|
    |   # ---........}|...|}}}}}}}}}}}}}}}}}}}}}}|...|}.................|...|..|
    |   # |..........}---S------------------------S---}.................|...|..|
    |   # |..........}}}|...............|..........|}}}.................+...|..|
    | --S----..........}|...............S..........|}...................|...|..|
    | |.....|..........}|...............|......\...S}...................|...|..|
    | |.....+........}}}|...............|..........|}}}.................+...|..|
    | |.....|........}---S------------------------S---}.................|...|..|
    | |.....|........}|...|}}}}}}}}}}}}}}}}}}}}}}|...|}.................|...|..|
    | |..-S----......}-----}....................}-----}..........--+--+--...|..|
    | |..|....|......}}}}}}}....................}}}}}}}..........|..........|..|
    | |..|....|..................................................|..........|..|
    | -----------................................................------------..|
    |           |..............................................................|
    ----------------------------------------------------------------------------

    `);
    // Non diggable walls
    des.non_diggable(selection.area(0,0,75,19));
    // Portal arrival point
    des.levregion({ region: [8,16,8,16], type: "branch" });
    // accessible via ^V in wizard mode; arrive near the portal
    des.teleport_region({ region: [6,15,9,16], dir: "up" });
    des.teleport_region({ region: [6,15,9,16], dir: "down" });
    // Throne room, with Croesus on the throne
    des.region({ x1: 37,y1: 8,x2: 46,y2: 11, lit: 1, type: "throne", filled: 1 });
    // 50% chance each to move throne &&/|| fort's entry secret door up one row
    if (percent(50)) {
       des.monster({ id: "Croesus", x: 43, y: 10, peaceful: 0 });
    } else {
       des.monster({ id: "Croesus", x: 43, y: 9, peaceful: 0 });
       des.terrain(43,9, "\\");
       des.terrain(43,10, ".");
    }
    if (percent(50)) {
       des.terrain(47,9, "S");
       des.terrain(47,10, "|");
    }

    // The Vault
    function treasure_spot(x,y) {
       des.gold({ x: x, y: y, amount: 600 + Math.random(0, 300) });
       if ((Math.random(0,2) == 0)) {
          if ((Math.random(0,2) == 0)) {
             des.trap("spiked pit", x,y);
          } else {
             des.trap("land mine", x,y);
          }
       }
    }

    des.region({ region: [21,8,35,11], lit: 1, type: "ordinary" });
    let treasury = selection.area(21,8,35,11);
    treasury.iterate(treasure_spot);

    // Vault entrance also varies
    if (percent(50)) {
       des.terrain(36,9, "|");
       des.terrain(36,10, "S");
    }
    // Corner towers
    des.region(selection.area(19,6,21,6),"lit");
    des.region(selection.area(46,6,48,6),"lit");
    des.region(selection.area(19,13,21,13),"lit");
    des.region(selection.area(46,13,48,13),"lit");
    // A welcoming committee
    des.region({ region: [3,10,7,13],lit: 1,type: "zoo",filled: 1,irregular: 1 });
    // arrival chamber; needs to be a real room to control migrating monsters,
    // && `unfilled' is a kludge to force an ordinary room to remain a room
    des.region({ region: [6,15,9,16],lit: 0,type: "ordinary",arrival_room: true });

    // 3.6.2:  Entering level carrying a lit candle would show the whole entry
    // chamber except for its top right corner even though some of the revealed
    // spots are farther away than that is.  This is because the lit treasure zoo
    // is forcing the walls around it to be lit too (see light_region(sp_lev.c)),
    // && lit walls show up when light reaches the spot next to them.  The unlit
    // corner is beyond candle range && isn't flagged as lit so it doesn't show
    // up until light reaches it rather than when light gets next to it.
    // 
    // Force left && top walls of the arrival chamber to be unlit in order to
    // hide this lighting quirk.
    des.region(selection.area(5,14,5,17),"unlit");
    des.region(selection.area(5,14,9,14),"unlit");
    // (Entering the treasure zoo while blind && then regaining sight might
    // expose the new oddity of these walls ! appearing when on the lit side
    // but that's even less likely to occur than the rare instance of entering
    // the level with a candle.  They'll almost always be mapped from the arrival
    // side before entering the treasure zoo.
    // 
    // A prior workaround lit the top right corner wall && then jumped through
    // hoops to suppress the extra light in the 3x3 lit area that produced.
    // This is simpler && makes the short range candle light behave more like
    // it is expected to work.)

    // Barracks
    des.region({ region: [62,3,71,4],lit: 1,type: "barracks",filled: 1,irregular: 1 });
    // Doors
    des.door("closed",6,14);
    des.door("closed",9,3);
    des.door("open",63,5);
    des.door("open",66,5);
    des.door("open",68,8);
    des.door("locked",8,11);
    des.door("open",68,11);
    des.door("closed",63,14);
    des.door("closed",66,14);
    des.door("closed",4,3);
    des.door("closed",4,9);
    // Soldiers guarding the fort
    des.monster("soldier",12,14);
    des.monster("soldier",12,13);
    des.monster("soldier",11,10);
    des.monster("soldier",13,2);
    des.monster("soldier",14,3);
    des.monster("soldier",20,2);
    des.monster("soldier",30,2);
    des.monster("soldier",40,2);
    des.monster("soldier",30,16);
    des.monster("soldier",32,16);
    des.monster("soldier",40,16);
    des.monster("soldier",54,16);
    des.monster("soldier",54,14);
    des.monster("soldier",54,13);
    des.monster("soldier",57,10);
    des.monster("soldier",57,9);
    des.monster("lieutenant",15,8);
    // Possible source of a boulder
    des.monster("stone giant",3,1);
    // Four dragons guarding each side
    des.monster("D",18,9);
    des.monster("D",49,10);
    des.monster("D",33,5);
    des.monster("D",33,14);
    // Eels in the moat
    des.monster("giant eel",17,8);
    des.monster("giant eel",17,11);
    des.monster("giant eel",48,8);
    des.monster("giant eel",48,11);
    // The corner rooms treasures
    des.object("diamond",19,6);
    des.object("diamond",20,6);
    des.object("diamond",21,6);
    des.object("emerald",19,13);
    des.object("emerald",20,13);
    des.object("emerald",21,13);
    des.object("ruby",46,6);
    des.object("ruby",47,6);
    des.object("ruby",48,6);
    des.object("amethyst",46,13);
    des.object("amethyst",47,13);
    des.object("amethyst",48,13);


    return des.finalize_level();
}

