/**
 * Vlad's Tower - Level 2 (Middle stage)
 * Ported from nethack-c/dat/tower2.lua
 */

import { des, selection, shuffle, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport', 'hardfloor', 'solidify');

    des.map({
        halign: 'half-left',
        valign: 'center',
        map: `
  --- --- ---
  |.| |.| |.|
---S---S---S---
|.S.........S.|
---.------+----
  |......|..|
--------.------
|.S......+..S.|
---S---S---S---
  |.| |.| |.|
  --- --- ---
`
    });

    // Random places are the 10 niches
    const place = [
        { x: 3, y: 1 }, { x: 7, y: 1 }, { x: 11, y: 1 },
        { x: 1, y: 3 }, { x: 13, y: 3 },
        { x: 1, y: 7 }, { x: 13, y: 7 },
        { x: 3, y: 9 }, { x: 7, y: 9 }, { x: 11, y: 9 }
    ];
    shuffle(place);

    des.ladder('up', 11, 5);
    des.ladder('down', 3, 7);

    des.door('locked', 10, 4);
    des.door('locked', 9, 7);

    // Monsters
    des.monster({ id: '&', coord: place[9] });
    des.monster({ id: '&', coord: place[0] });
    des.monster({ id: 'hell hound pup', coord: place[1] });
    des.monster({ id: 'hell hound pup', coord: place[2] });
    des.monster({ id: 'winter wolf', coord: place[3] });

    // Treasures - basic chests (TODO: add contents function support)
    des.object({ id: 'chest', coord: place[4] });
    des.object({ id: 'chest', coord: place[5] });
    des.object({ id: 'water walking boots', coord: place[6] });
    des.object({ id: 'crystal plate mail', coord: place[7] });

    // Random spellbook - pick one
    const spbooks = [
        'spellbook of invisibility',
        'spellbook of cone of cold',
        'spellbook of create familiar',
        'spellbook of clairvoyance',
        'spellbook of charm monster',
        'spellbook of stone to flesh',
        'spellbook of polymorph'
    ];
    shuffle(spbooks);
    des.object({ id: spbooks[0], coord: place[8] });

    // Walls in the tower are non diggable
    des.non_diggable(selection.area(0, 0, 14, 10));

    return finalize_level();
}
