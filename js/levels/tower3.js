/**
 * Vlad's Tower - Level 3 (Lower stage/Entry)
 * Ported from nethack-c/dat/tower3.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

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
-----.........-----
|...|.........+...|
|.---.........---.|
|.|.S.........S.|.|
|.---S---S---S---.|
|...|.|.|.|.|.|...|
---.---.---.---.---
  |.............|
  ---------------
`
    });

    // Random places are the 10 niches (not shuffled in original)
    const place = [
        { x: 5, y: 1 }, { x: 9, y: 1 }, { x: 13, y: 1 },
        { x: 3, y: 3 }, { x: 15, y: 3 },
        { x: 3, y: 7 }, { x: 15, y: 7 },
        { x: 5, y: 9 }, { x: 9, y: 9 }, { x: 13, y: 9 }
    ];

    des.levregion({ type: 'branch', region: { x1: 2, y1: 5, x2: 2, y2: 5 } });
    des.ladder('up', 5, 7);

    // Entry door is locked
    des.door('locked', 14, 5);

    // Dragon behind the door
    des.monster({ id: 'D', x: 13, y: 5 });
    des.monster({ x: 12, y: 4 });
    des.monster({ x: 12, y: 6 });

    // Random monsters
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();
    des.monster();

    // Objects with traps
    des.object({ id: 'long sword', coord: place[3] });
    des.trap({ coord: place[3] });
    des.object({ id: 'lock pick', coord: place[0] });
    des.trap({ coord: place[0] });
    des.object({ id: 'elven cloak', coord: place[1] });
    des.trap({ coord: place[1] });
    des.object({ id: 'blindfold', coord: place[2] });
    des.trap({ coord: place[2] });

    // Walls in the tower are non diggable
    des.non_diggable(selection.area(0, 0, 18, 12));

    return finalize_level();
}
