/**
 * Fort Ludios (Knox) - The legendary fort
 * Ported from nethack-c/dat/knox.lua
 */

import { des, selection, percent, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport');

    // Fort's entry is via a secret door rather than a drawbridge
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
| |.....|..........}|...............|......\\...S}...................|...|..|
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
    des.non_diggable(selection.area(0, 0, 75, 19));

    // Portal arrival point
    des.levregion({ region: { x1: 8, y1: 16, x2: 8, y2: 16 }, type: 'branch' });

    // Accessible via ^V in wizard mode
    des.teleport_region({ region: { x1: 6, y1: 15, x2: 9, y2: 16 }, dir: 'up' });
    des.teleport_region({ region: { x1: 6, y1: 15, x2: 9, y2: 16 }, dir: 'down' });

    // Throne room, with Croesus on the throne
    des.region({ region: { x1: 37, y1: 8, x2: 46, y2: 11 }, lit: 1, type: 'throne', filled: 1 });

    // 50% chance each to move throne and/or fort's entry secret door up one row
    if (percent(50)) {
        des.monster({ id: 'Croesus', x: 43, y: 10, peaceful: 0 });
    } else {
        des.monster({ id: 'Croesus', x: 43, y: 9, peaceful: 0 });
        des.terrain(43, 9, '\\');
        des.terrain(43, 10, '.');
    }
    if (percent(50)) {
        des.terrain(47, 9, 'S');
        des.terrain(47, 10, '|');
    }

    // The Vault
    des.region({ region: { x1: 21, y1: 8, x2: 35, y2: 11 }, lit: 1, type: 'ordinary' });

    // Treasury - place gold and traps
    // Note: Simplified from Lua's iterate() for now - just place some representative gold/traps
    for (let x = 21; x <= 35; x += 2) {
        for (let y = 8; y <= 11; y++) {
            des.gold({ x, y, amount: 600 + Math.floor(Math.random() * 300) });
            if (Math.random() < 0.33) {
                if (Math.random() < 0.5) {
                    des.trap('spiked pit', x, y);
                } else {
                    des.trap('land mine', x, y);
                }
            }
        }
    }

    // Vault entrance also varies
    if (percent(50)) {
        des.terrain(36, 9, '|');
        des.terrain(36, 10, 'S');
    }

    // Corner towers
    des.region(selection.area(19, 6, 21, 6), 'lit');
    des.region(selection.area(46, 6, 48, 6), 'lit');
    des.region(selection.area(19, 13, 21, 13), 'lit');
    des.region(selection.area(46, 13, 48, 13), 'lit');

    // A welcoming committee
    des.region({ region: { x1: 3, y1: 10, x2: 7, y2: 13 }, lit: 1, type: 'zoo', filled: 1, irregular: 1 });

    // Arrival chamber
    des.region({ region: { x1: 6, y1: 15, x2: 9, y2: 16 }, lit: 0, type: 'ordinary', arrival_room: true });

    // Force walls to be unlit to hide lighting quirks
    des.region(selection.area(5, 14, 5, 17), 'unlit');
    des.region(selection.area(5, 14, 9, 14), 'unlit');

    // Barracks
    des.region({ region: { x1: 62, y1: 3, x2: 71, y2: 4 }, lit: 1, type: 'barracks', filled: 1, irregular: 1 });

    // Doors
    des.door('closed', 6, 14);
    des.door('closed', 9, 3);
    des.door('open', 63, 5);
    des.door('open', 66, 5);
    des.door('open', 68, 8);
    des.door('locked', 8, 11);
    des.door('open', 68, 11);
    des.door('closed', 63, 14);
    des.door('closed', 66, 14);
    des.door('closed', 4, 3);
    des.door('closed', 4, 9);

    // Soldiers guarding the fort
    des.monster({ id: 'soldier', x: 12, y: 14 });
    des.monster({ id: 'soldier', x: 12, y: 13 });
    des.monster({ id: 'soldier', x: 11, y: 10 });
    des.monster({ id: 'soldier', x: 13, y: 2 });
    des.monster({ id: 'soldier', x: 14, y: 3 });
    des.monster({ id: 'soldier', x: 20, y: 2 });
    des.monster({ id: 'soldier', x: 30, y: 2 });
    des.monster({ id: 'soldier', x: 40, y: 2 });
    des.monster({ id: 'soldier', x: 30, y: 16 });
    des.monster({ id: 'soldier', x: 32, y: 16 });
    des.monster({ id: 'soldier', x: 40, y: 16 });
    des.monster({ id: 'soldier', x: 54, y: 16 });
    des.monster({ id: 'soldier', x: 54, y: 14 });
    des.monster({ id: 'soldier', x: 54, y: 13 });
    des.monster({ id: 'soldier', x: 57, y: 10 });
    des.monster({ id: 'soldier', x: 57, y: 9 });
    des.monster({ id: 'lieutenant', x: 15, y: 8 });

    // Possible source of a boulder
    des.monster({ id: 'stone giant', x: 3, y: 1 });

    // Four dragons guarding each side
    des.monster({ id: 'D', x: 18, y: 9 });
    des.monster({ id: 'D', x: 49, y: 10 });
    des.monster({ id: 'D', x: 33, y: 5 });
    des.monster({ id: 'D', x: 33, y: 14 });

    // Eels in the moat
    des.monster({ id: 'giant eel', x: 17, y: 8 });
    des.monster({ id: 'giant eel', x: 17, y: 11 });
    des.monster({ id: 'giant eel', x: 48, y: 8 });
    des.monster({ id: 'giant eel', x: 48, y: 11 });

    // The corner rooms treasures
    des.object({ id: 'diamond', x: 19, y: 6 });
    des.object({ id: 'diamond', x: 20, y: 6 });
    des.object({ id: 'diamond', x: 21, y: 6 });
    des.object({ id: 'emerald', x: 19, y: 13 });
    des.object({ id: 'emerald', x: 20, y: 13 });
    des.object({ id: 'emerald', x: 21, y: 13 });
    des.object({ id: 'ruby', x: 46, y: 6 });
    des.object({ id: 'ruby', x: 47, y: 6 });
    des.object({ id: 'ruby', x: 48, y: 6 });
    des.object({ id: 'amethyst', x: 46, y: 13 });
    des.object({ id: 'amethyst', x: 47, y: 13 });
    des.object({ id: 'amethyst', x: 48, y: 13 });

    finalize_level();
}
