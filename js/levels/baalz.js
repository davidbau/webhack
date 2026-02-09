/**
 * Baalzebub's Lair (Gehennom)
 * Ported from nethack-c/dat/baalz.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ', lit: 0 });

    des.level_flags('mazelevel', 'corrmaze');

    // Fly-shaped lair of Baalzebub
    // The map shows a fly shape with pools (P) and fountains (F) marking special features
    des.map({
        halign: 'right',
        valign: 'center',
        map: `
-------------------------------------------------
|                   ----               ----
|          ----     |     -----------  |
| ------      |  ---------|.........|--P
| F....|  -------|...........--------------
---....|--|..................S............|----
+...--....S..----------------|............S...|
---....|--|..................|............|----
| F....|  -------|...........-----S--------
| ------      |  ---------|.........|--P
|          ----     |     -----------  |
|                   ----               ----
-------------------------------------------------
`
    });

    // Stairs and branch placement
    des.levregion({ type: 'stair-up', region: { x1: 1, y1: 0, x2: 15, y2: 20 }, exclude: { x1: 15, y1: 1, x2: 70, y2: 16 } });
    des.levregion({ type: 'branch', region: { x1: 1, y1: 0, x2: 15, y2: 20 }, exclude: { x1: 15, y1: 1, x2: 70, y2: 16 } });
    des.teleport_region({ region: { x1: 1, y1: 0, x2: 15, y2: 20 }, exclude: { x1: 15, y1: 1, x2: 70, y2: 16 } });

    // Non-diggable walls
    des.non_diggable(selection.area(0, 0, 47, 12));

    // Maze connection and entrance
    des.stair('down', 44, 6);
    des.door('locked', 0, 6);

    // The demon lord
    des.monster({ id: 'Baalzebub', x: 35, y: 6 });

    // Some random weapons and armor
    des.object({ class: '[' });
    des.object({ class: '[' });
    des.object({ class: ')' });
    des.object({ class: ')' });
    des.object({ class: '*' });
    des.object({ class: '!' });
    des.object({ class: '!' });
    des.object({ class: '?' });
    des.object({ class: '?' });
    des.object({ class: '?' });

    // Traps
    des.trap({ type: 'spiked pit' });
    des.trap({ type: 'fire' });
    des.trap({ type: 'sleep gas' });
    des.trap({ type: 'anti magic' });
    des.trap({ type: 'fire' });
    des.trap({ type: 'magic' });
    des.trap({ type: 'magic' });

    // Random monsters
    des.monster({ id: 'ghost', x: 37, y: 7 });
    des.monster({ id: 'horned devil', x: 32, y: 5 });
    des.monster({ id: 'barbed devil', x: 38, y: 7 });
    des.monster({ id: 'L' }); // Lich
    des.monster({ id: 'V' }); // Vampire
    des.monster({ id: 'V' });
    des.monster({ id: 'V' });

    return finalize_level();
}
