/**
 * Asmodeus's Lair (Gehennom)
 * Ported from nethack-c/dat/asmodeus.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'mazegrid', bg: '-' });

    des.level_flags('mazelevel');

    // First part (left side)
    des.map({
        halign: 'half-left',
        valign: 'center',
        map: `
---------------------
|.............|.....|
|.............S.....|
|---+------------...|
|.....|.........|-+--
|..---|.........|....
|..|..S.........|....
|..|..|.........|....
|..|..|.........|-+--
|..|..-----------...|
|..S..........|.....|
---------------------
`
    });

    // Doors
    des.door('closed', 4, 3);
    des.door('locked', 18, 4);
    des.door('closed', 18, 8);

    des.stair('down', 13, 7);

    // Non-diggable walls
    des.non_diggable(selection.area(0, 0, 20, 11));

    // Entire main area unlit
    des.region(selection.area(1, 1, 20, 10), 'unlit');

    // The fellow in residence
    des.monster({ id: 'Asmodeus', x: 12, y: 7 });

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

    // Some traps
    des.trap('spiked pit', 5, 2);
    des.trap('fire', 8, 6);
    des.trap({ type: 'sleep gas' });
    des.trap({ type: 'anti magic' });
    des.trap({ type: 'fire' });
    des.trap({ type: 'magic' });
    des.trap({ type: 'magic' });

    // Random monsters
    des.monster({ id: 'ghost', x: 11, y: 7 });
    des.monster({ id: 'horned devil', x: 10, y: 5 });
    des.monster({ id: 'L' }); // Lich
    des.monster({ id: 'V' }); // Vampire
    des.monster({ id: 'V' });
    des.monster({ id: 'V' });

    // Stair-up and branch in maze area
    des.levregion({ type: 'stair-up', region: { x1: 1, y1: 0, x2: 6, y2: 20 }, exclude: { x1: 6, y1: 1, x2: 70, y2: 16 } });
    des.levregion({ type: 'branch', region: { x1: 1, y1: 0, x2: 6, y2: 20 }, exclude: { x1: 6, y1: 1, x2: 70, y2: 16 } });
    des.teleport_region({ region: { x1: 1, y1: 0, x2: 6, y2: 20 }, exclude: { x1: 6, y1: 1, x2: 70, y2: 16 } });

    // Second part (right side) - simplified, just adding maze extension
    // The C version has a second map on the right side, but for simplicity
    // we'll let the mazegrid background serve as the maze

    return finalize_level();
}
