/**
 * Castle (Stronghold) Level
 * Ported from nethack-c/dat/castle.lua
 *
 * The stronghold level with drawbridge, moat, storerooms, and throne room.
 * Contains wand of wishing in one of the 4 towers.
 */

import { des, selection, finalize_level } from '../sp_lev.js';
import { shuffle } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'mazegrid', bg: '-' });

    des.level_flags('mazelevel', 'noteleport', 'noflipy');

    des.map({
        map: `
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
`
    });

    // Random registers initialization
    const objectTypes = ['[', ')', '*', '%'];
    shuffle(objectTypes);

    // Tower locations for wand of wishing
    const towerLocations = selection.new();
    towerLocations.set(4, 2);
    towerLocations.set(58, 2);
    towerLocations.set(4, 14);
    towerLocations.set(58, 14);

    const monsterTypes = ['L', 'N', 'E', 'H', 'M', 'O', 'R', 'T', 'X', 'Z'];
    shuffle(monsterTypes);

    des.teleport_region({ region: { x1: 1, y1: 0, x2: 10, y2: 20 }, region_islev: 1, exclude: { x1: 1, y1: 1, x2: 61, y2: 15 }, dir: 'down' });
    des.teleport_region({ region: { x1: 69, y1: 0, x2: 79, y2: 20 }, region_islev: 1, exclude: { x1: 1, y1: 1, x2: 61, y2: 15 }, dir: 'up' });
    des.levregion({ region: { x1: 1, y1: 0, x2: 10, y2: 20 }, region_islev: 1, exclude: { x1: 0, y1: 0, x2: 62, y2: 16 }, type: 'stair-up' });

    des.feature('fountain', 10, 8);

    // Doors
    des.door('closed', 7, 3);
    des.door('closed', 55, 3);
    des.door('locked', 32, 4);
    des.door('locked', 26, 5);
    des.door('locked', 46, 5);
    des.door('locked', 48, 5);
    des.door('locked', 47, 7);
    des.door('closed', 15, 8);
    des.door('closed', 26, 8);
    des.door('locked', 38, 8);
    des.door('locked', 56, 8);
    des.door('locked', 47, 9);
    des.door('locked', 26, 11);
    des.door('locked', 46, 11);
    des.door('locked', 48, 11);
    des.door('locked', 32, 12);
    des.door('closed', 7, 13);
    des.door('closed', 55, 13);

    // The drawbridge
    des.drawbridge({ dir: 'east', state: 'closed', x: 5, y: 8 });

    // Storeroom #1 (shuffled object type)
    for (let x = 39; x <= 45; x++) {
        des.object({ class: objectTypes[0], x, y: 5 });
        des.object({ class: objectTypes[0], x, y: 6 });
    }

    // Storeroom #2
    for (let x = 49; x <= 55; x++) {
        des.object({ class: objectTypes[1], x, y: 5 });
        des.object({ class: objectTypes[1], x, y: 6 });
    }

    // Storeroom #3
    for (let x = 39; x <= 45; x++) {
        des.object({ class: objectTypes[2], x, y: 10 });
        des.object({ class: objectTypes[2], x, y: 11 });
    }

    // Storeroom #4
    for (let x = 49; x <= 55; x++) {
        des.object({ class: objectTypes[3], x, y: 10 });
        des.object({ class: objectTypes[3], x, y: 11 });
    }

    // THE WAND OF WISHING in one of the 4 towers
    const wishLocation = selection.rndcoord(towerLocations);
    des.object({
        id: 'chest',
        trapped: 0,
        locked: 1,
        x: wishLocation.x,
        y: wishLocation.y
    });
    // In Lua, chest contents are nested, but for now we'll just place the wand nearby
    des.object({ id: 'wishing', x: wishLocation.x, y: wishLocation.y });
    des.object({ id: 'potion of gain level', x: wishLocation.x, y: wishLocation.y });

    // Prevent monsters from eating it
    des.engraving({ x: wishLocation.x, y: wishLocation.y, type: 'burn', text: 'Elbereth' });
    des.object({ id: 'scroll of scare monster', x: wishLocation.x, y: wishLocation.y, buc: 'cursed' });

    // The treasure of the lord
    des.object({ id: 'chest', x: 37, y: 8 });

    // Traps
    des.trap('trap door', 40, 8);
    des.trap('trap door', 44, 8);
    des.trap('trap door', 48, 8);
    des.trap('trap door', 52, 8);
    des.trap('trap door', 55, 8);

    // Soldiers guarding the entry hall
    des.monster({ id: 'soldier', x: 8, y: 6 });
    des.monster({ id: 'soldier', x: 9, y: 5 });
    des.monster({ id: 'soldier', x: 11, y: 5 });
    des.monster({ id: 'soldier', x: 12, y: 6 });
    des.monster({ id: 'soldier', x: 8, y: 10 });
    des.monster({ id: 'soldier', x: 9, y: 11 });
    des.monster({ id: 'soldier', x: 11, y: 11 });
    des.monster({ id: 'soldier', x: 12, y: 10 });
    des.monster({ id: 'lieutenant', x: 9, y: 8 });

    // Soldiers guarding the towers
    des.monster({ id: 'soldier', x: 3, y: 2 });
    des.monster({ id: 'soldier', x: 5, y: 2 });
    des.monster({ id: 'soldier', x: 57, y: 2 });
    des.monster({ id: 'soldier', x: 59, y: 2 });
    des.monster({ id: 'soldier', x: 3, y: 14 });
    des.monster({ id: 'soldier', x: 5, y: 14 });
    des.monster({ id: 'soldier', x: 57, y: 14 });
    des.monster({ id: 'soldier', x: 59, y: 14 });

    // The four dragons guarding the storerooms
    des.monster({ id: 'D', x: 47, y: 5 });
    des.monster({ id: 'D', x: 47, y: 6 });
    des.monster({ id: 'D', x: 47, y: 10 });
    des.monster({ id: 'D', x: 47, y: 11 });

    // Sea monsters in the moat
    des.monster({ id: 'giant eel', x: 5, y: 7 });
    des.monster({ id: 'giant eel', x: 5, y: 9 });
    des.monster({ id: 'giant eel', x: 57, y: 7 });
    des.monster({ id: 'giant eel', x: 57, y: 9 });
    des.monster({ id: 'shark', x: 5, y: 0 });
    des.monster({ id: 'shark', x: 5, y: 16 });
    des.monster({ id: 'shark', x: 57, y: 0 });
    des.monster({ id: 'shark', x: 57, y: 16 });

    // The throne room and the court monsters (shuffled types)
    des.monster({ id: monsterTypes[9], x: 27, y: 5 });
    des.monster({ id: monsterTypes[0], x: 30, y: 5 });
    des.monster({ id: monsterTypes[1], x: 33, y: 5 });
    des.monster({ id: monsterTypes[2], x: 36, y: 5 });
    des.monster({ id: monsterTypes[3], x: 28, y: 6 });
    des.monster({ id: monsterTypes[4], x: 31, y: 6 });
    des.monster({ id: monsterTypes[5], x: 34, y: 6 });
    des.monster({ id: monsterTypes[6], x: 37, y: 6 });
    des.monster({ id: monsterTypes[7], x: 27, y: 7 });
    des.monster({ id: monsterTypes[8], x: 30, y: 7 });
    des.monster({ id: monsterTypes[9], x: 33, y: 7 });
    des.monster({ id: monsterTypes[0], x: 36, y: 7 });
    des.monster({ id: monsterTypes[1], x: 28, y: 8 });
    des.monster({ id: monsterTypes[2], x: 31, y: 8 });
    des.monster({ id: monsterTypes[3], x: 34, y: 8 });
    des.monster({ id: monsterTypes[4], x: 27, y: 9 });
    des.monster({ id: monsterTypes[5], x: 30, y: 9 });
    des.monster({ id: monsterTypes[6], x: 33, y: 9 });
    des.monster({ id: monsterTypes[7], x: 36, y: 9 });
    des.monster({ id: monsterTypes[8], x: 28, y: 10 });
    des.monster({ id: monsterTypes[9], x: 31, y: 10 });
    des.monster({ id: monsterTypes[0], x: 34, y: 10 });
    des.monster({ id: monsterTypes[1], x: 37, y: 10 });
    des.monster({ id: monsterTypes[2], x: 27, y: 11 });
    des.monster({ id: monsterTypes[3], x: 30, y: 11 });
    des.monster({ id: monsterTypes[4], x: 33, y: 11 });
    des.monster({ id: monsterTypes[5], x: 36, y: 11 });

    // Maze walks
    des.mazewalk(0, 10, 'west');
    des.mazewalk(62, 6, 'east');

    // Non-diggable walls
    des.non_diggable(selection.area(0, 0, 62, 16));

    // Regions
    des.region(selection.area(0, 0, 62, 16), 'unlit'); // Entire castle area
    des.region(selection.area(0, 5, 5, 11), 'lit'); // Courtyard left
    des.region(selection.area(57, 5, 62, 11), 'lit'); // Courtyard right
    des.region({ region: { x1: 27, y1: 5, x2: 37, y2: 11 }, lit: 1, type: 'throne', filled: 2 }); // Throne room
    des.region(selection.area(7, 5, 14, 11), 'lit'); // Antechamber
    des.region(selection.area(39, 5, 45, 6), 'lit'); // Storeroom 1
    des.region(selection.area(39, 10, 45, 11), 'lit'); // Storeroom 3
    des.region(selection.area(49, 5, 55, 6), 'lit'); // Storeroom 2
    des.region(selection.area(49, 10, 55, 11), 'lit'); // Storeroom 4
    des.region(selection.area(2, 2, 6, 3), 'lit'); // Corner NW
    des.region(selection.area(56, 2, 60, 3), 'lit'); // Corner NE
    des.region(selection.area(2, 13, 6, 14), 'lit'); // Corner SW
    des.region(selection.area(56, 13, 60, 14), 'lit'); // Corner SE
    des.region({ region: { x1: 16, y1: 5, x2: 25, y2: 6 }, lit: 1, type: 'barracks', filled: 1 }); // Barracks N
    des.region({ region: { x1: 16, y1: 10, x2: 25, y2: 11 }, lit: 1, type: 'barracks', filled: 1 }); // Barracks S
    des.region(selection.area(8, 3, 54, 3), 'unlit'); // Hallway N
    des.region(selection.area(8, 13, 54, 13), 'unlit'); // Hallway S
    des.region(selection.area(16, 8, 25, 8), 'unlit'); // Hallway center W
    des.region(selection.area(39, 8, 55, 8), 'unlit'); // Hallway center E
    des.region(selection.area(47, 5, 47, 6), 'unlit'); // Storeroom alcove N
    des.region(selection.area(47, 10, 47, 11), 'unlit'); // Storeroom alcove S

    return finalize_level();
}
