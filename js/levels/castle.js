/**
 * castle - NetHack special level
 * Converted from: castle.lua
 */

import * as des from '../sp_lev.js';
import { selection, shuffle } from '../sp_lev.js';

export function generate() {
    // NetHack castle castle.lua	$NHDT-Date: 1652196024 2022/5/10 15:20:24 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.7 $
    // Copyright (c) 1989 by Jean-Christophe Collet
    // NetHack may be freely redistributed.  See license for details.
    // 
    // 
    // This is the stronghold level :
    // there are several ways to enter it :
    // - opening the drawbridge (wand of opening, knock spell, playing
    // the appropriate tune)
    // 
    // - enter via the back entry (this suppose a ring of levitation, boots
    // of water walking, etc.)
    // 
    // Note : If you don't play the right tune, you get indications like in the
    // MasterMind game...args
    // 
    // To motivate the player : there are 4 storerooms (armors, weapons, food &&
    // gems) && a wand of wishing in one of the 4 towers...args

    des.level_init({ style: "mazegrid", bg: "-" });

    des.level_flags("mazelevel", "noteleport", "noflipy");

    des.map(`

    }}}}}}}}}.............................................}}}}}}}}}
    }-------}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}-------}
    }|.....|-----------------------------------------------|.....|}
    }|.....+...............................................+.....|}
    }-------------------------------+-----------------------------}
    }}}}}}|........|..........+...........|.......S.S.......|}}}}}}
    .....}|........|..........|...........|.......|.|.......|}.....
    .....}|........------------...........---------S---------}.....
    .....}|...{....+..........+.........\.S.................+......
    .....}|........------------...........---------S---------}.....
    .....}|........|..........|...........|.......|.|.......|}.....
    }}}}}}|........|..........+...........|.......S.S.......|}}}}}}
    }-------------------------------+-----------------------------}
    }|.....+...............................................+.....|}
    }|.....|-----------------------------------------------|.....|}
    }-------}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}-------}
    }}}}}}}}}.............................................}}}}}}}}}

    `);

    // Random registers initialisation
    let object = [ "[", ")", "*", "%" ];
    shuffle(object)

    let place = selection.new();
    place.set(4,2);
    place.set(58,2);
    place.set(4,14);
    place.set(58,14);

    let monster = [ "L", "N", "E", "H", "M", "O", "R", "T", "X", "Z" ]
    shuffle(monster)

    des.teleport_region({ region: [1,0,10,20], region_islev: 1, exclude: [1,1,61,15], dir: "down" });
    des.teleport_region({ region: [69,0,79,20], region_islev: 1, exclude: [1,1,61,15], dir: "up" });
    des.levregion({ region: [1,0,10,20], region_islev: 1, exclude: [0,0,62,16], type: "stair-up" });
    des.feature("fountain", 10,8);
    // Doors
    des.door("closed",7,3);
    des.door("closed",55,3);
    des.door("locked",32,4);
    des.door("locked",26,5);
    des.door("locked",46,5);
    des.door("locked",48,5);
    des.door("locked",47,7);
    des.door("closed",15,8);
    des.door("closed",26,8);
    des.door("locked",38,8);
    des.door("locked",56,8);
    des.door("locked",47,9);
    des.door("locked",26,11);
    des.door("locked",46,11);
    des.door("locked",48,11);
    des.door("locked",32,12);
    des.door("closed",7,13);
    des.door("closed",55,13);
    // The drawbridge
    des.drawbridge({ dir: "east", state: "closed", x: 5,y: 8});
    // Storeroom number 1
    des.object(object[1],39,5);
    des.object(object[1],40,5);
    des.object(object[1],41,5);
    des.object(object[1],42,5);
    des.object(object[1],43,5);
    des.object(object[1],44,5);
    des.object(object[1],45,5);
    des.object(object[1],39,6);
    des.object(object[1],40,6);
    des.object(object[1],41,6);
    des.object(object[1],42,6);
    des.object(object[1],43,6);
    des.object(object[1],44,6);
    des.object(object[1],45,6);
    // Storeroom number 2
    des.object(object[2],49,5);
    des.object(object[2],50,5);
    des.object(object[2],51,5);
    des.object(object[2],52,5);
    des.object(object[2],53,5);
    des.object(object[2],54,5);
    des.object(object[2],55,5);
    des.object(object[2],49,6);
    des.object(object[2],50,6);
    des.object(object[2],51,6);
    des.object(object[2],52,6);
    des.object(object[2],53,6);
    des.object(object[2],54,6);
    des.object(object[2],55,6);
    // Storeroom number 3
    des.object(object[3],39,10);
    des.object(object[3],40,10);
    des.object(object[3],41,10);
    des.object(object[3],42,10);
    des.object(object[3],43,10);
    des.object(object[3],44,10);
    des.object(object[3],45,10);
    des.object(object[3],39,11);
    des.object(object[3],40,11);
    des.object(object[3],41,11);
    des.object(object[3],42,11);
    des.object(object[3],43,11);
    des.object(object[3],44,11);
    des.object(object[3],45,11);
    // Storeroom number 4
    des.object(object[4],49,10);
    des.object(object[4],50,10);
    des.object(object[4],51,10);
    des.object(object[4],52,10);
    des.object(object[4],53,10);
    des.object(object[4],54,10);
    des.object(object[4],55,10);
    des.object(object[4],49,11);
    des.object(object[4],50,11);
    des.object(object[4],51,11);
    des.object(object[4],52,11);
    des.object(object[4],53,11);
    des.object(object[4],54,11);
    des.object(object[4],55,11);
    // THE WAND OF WISHING in 1 of the 4 towers
    let loc = place.rndcoord(1);
    des.object({ id: "chest", trapped: 0, locked: 1, coord: loc ,
                 contents: function() {
                    des.object("wishing");
                    des.object("potion of gain level");
                 }
    });
    // Prevent monsters from eating it.  (@'s never eat objects)
    des.engraving({ coord: loc, type: "burn", text: "Elbereth" });
    des.object({ id: "scroll of scare monster", coord: loc, buc: "cursed" });
    // The treasure of the lord
    des.object("chest",37,8);
    // Traps
    des.trap("trap door",40,8);
    des.trap("trap door",44,8);
    des.trap("trap door",48,8);
    des.trap("trap door",52,8);
    des.trap("trap door",55,8);
    // Soldiers guarding the entry hall
    des.monster("soldier",8,6);
    des.monster("soldier",9,5);
    des.monster("soldier",11,5);
    des.monster("soldier",12,6);
    des.monster("soldier",8,10);
    des.monster("soldier",9,11);
    des.monster("soldier",11,11);
    des.monster("soldier",12,10);
    des.monster("lieutenant",9,8);
    // Soldiers guarding the towers
    des.monster("soldier",3,2);
    des.monster("soldier",5,2);
    des.monster("soldier",57,2);
    des.monster("soldier",59,2);
    des.monster("soldier",3,14);
    des.monster("soldier",5,14);
    des.monster("soldier",57,14);
    des.monster("soldier",59,14);
    // The four dragons that are guarding the storerooms
    des.monster("D",47,5);
    des.monster("D",47,6);
    des.monster("D",47,10);
    des.monster("D",47,11);
    // Sea monsters in the moat
    des.monster("giant eel",5,7);
    des.monster("giant eel",5,9);
    des.monster("giant eel",57,7);
    des.monster("giant eel",57,9);
    des.monster("shark",5,0);
    des.monster("shark",5,16);
    des.monster("shark",57,0);
    des.monster("shark",57,16);
    // The throne room && the court monsters
    des.monster(monster[10],27,5);
    des.monster(monster[1],30,5);
    des.monster(monster[2],33,5);
    des.monster(monster[3],36,5);
    des.monster(monster[4],28,6);
    des.monster(monster[5],31,6);
    des.monster(monster[6],34,6);
    des.monster(monster[7],37,6);
    des.monster(monster[8],27,7);
    des.monster(monster[9],30,7);
    des.monster(monster[10],33,7);
    des.monster(monster[1],36,7);
    des.monster(monster[2],28,8);
    des.monster(monster[3],31,8);
    des.monster(monster[4],34,8);
    des.monster(monster[5],27,9);
    des.monster(monster[6],30,9);
    des.monster(monster[7],33,9);
    des.monster(monster[8],36,9);
    des.monster(monster[9],28,10);
    des.monster(monster[10],31,10);
    des.monster(monster[1],34,10);
    des.monster(monster[2],37,10);
    des.monster(monster[3],27,11);
    des.monster(monster[4],30,11);
    des.monster(monster[5],33,11);
    des.monster(monster[6],36,11);
    // MazeWalks
    des.mazewalk(0,10,"west");
    des.mazewalk(62,6,"east");
    // Non diggable walls
    des.non_diggable(selection.area(0,0,62,16));
    // Subrooms:
    // Entire castle area
    des.region(selection.area(0,0,62,16),"unlit");
    // Courtyards
    des.region(selection.area(0,5,5,11),"lit");
    des.region(selection.area(57,5,62,11),"lit");
    // Throne room
    des.region({ region: [27,5, 37,11],lit: 1,type: "throne", filled: 2 });
    // Antechamber
    des.region(selection.area(7,5,14,11),"lit");
    // Storerooms
    des.region(selection.area(39,5,45,6),"lit");
    des.region(selection.area(39,10,45,11),"lit");
    des.region(selection.area(49,5,55,6),"lit");
    des.region(selection.area(49,10,55,11),"lit");
    // Corners
    des.region(selection.area(2,2,6,3),"lit");
    des.region(selection.area(56,2,60,3),"lit");
    des.region(selection.area(2,13,6,14),"lit");
    des.region(selection.area(56,13,60,14),"lit");
    // Barracks
    des.region({ region: [16,5, 25,6],lit: 1,type: "barracks", filled: 1 });
    des.region({ region: [16,10, 25,11],lit: 1,type: "barracks", filled: 1 });
    // Hallways
    des.region(selection.area(8,3,54,3),"unlit");
    des.region(selection.area(8,13,54,13),"unlit");
    des.region(selection.area(16,8,25,8),"unlit");
    des.region(selection.area(39,8,55,8),"unlit");
    // Storeroom alcoves
    des.region(selection.area(47,5,47,6),"unlit");
    des.region(selection.area(47,10,47,11),"unlit");


    return des.finalize_level();
}

