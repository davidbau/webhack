/**
 * Orcus Town (Gehennom)
 * Ported from nethack-c/dat/orcus.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'mazegrid', bg: '-' });

    des.level_flags('mazelevel', 'shortsighted');

    // A ghost town
    des.map({
        halign: 'right',
        valign: 'center',
        map: `
.|....|....|....|..............|....|........
.|....|....|....|..............|....|........
.|....|....|....|--...-+-------|.............
.|....|....|....|..............+.............
.|.........|....|..............|....|........
.--+-...-+----+--....-------...--------.-+---
.....................|.....|.................
.....................|.....|.................
.--+----....-+---....|.....|...----------+---
.|....|....|....|....---+---...|......|......
.|.........|....|..............|......|......
.----...---------.....-----....+......|......
.|........................|....|......|......
.----------+-...--+--|....|....----------+---
.|....|..............|....+....|.............
.|....|..............|....|....|.............
`
    });

    // Stairs
    des.levregion({ type: 'stair-up', region: { x1: 1, y1: 0, x2: 20, y2: 20 }, exclude: { x1: 21, y1: 1, x2: 70, y2: 16 } });
    des.levregion({ type: 'stair-down', region: { x1: 1, y1: 0, x2: 20, y2: 20 }, exclude: { x1: 21, y1: 1, x2: 70, y2: 16 } });
    des.levregion({ type: 'branch', region: { x1: 1, y1: 0, x2: 20, y2: 20 }, exclude: { x1: 21, y1: 1, x2: 70, y2: 16 } });
    des.teleport_region({ region: { x1: 1, y1: 0, x2: 20, y2: 20 }, exclude: { x1: 21, y1: 1, x2: 70, y2: 16 } });

    // Doors
    des.door('closed', 3, 5);
    des.door('closed', 8, 5);
    des.door('closed', 14, 5);
    des.door('locked', 27, 2);
    des.door('closed', 27, 3);
    des.door('closed', 43, 5);
    des.door('closed', 3, 8);
    des.door('closed', 9, 8);
    des.door('closed', 43, 8);
    des.door('closed', 21, 9);
    des.door('closed', 27, 11);
    des.door('locked', 12, 13);
    des.door('closed', 17, 13);
    des.door('closed', 43, 13);
    des.door('closed', 27, 14);

    // Entire main area unlit
    des.region(selection.area(1, 1, 45, 16), 'unlit');

    // Non-diggable
    des.non_diggable(selection.area(0, 0, 47, 16));

    // Orcus and his court
    des.monster({ id: 'Orcus', x: 24, y: 7 });
    des.monster({ id: 'shade', x: 23, y: 6 });
    des.monster({ id: 'shade', x: 23, y: 7 });
    des.monster({ id: 'shade', x: 23, y: 8 });
    des.monster({ id: 'shade', x: 24, y: 6 });
    des.monster({ id: 'shade', x: 24, y: 8 });
    des.monster({ id: 'shade', x: 25, y: 6 });
    des.monster({ id: 'shade', x: 25, y: 7 });
    des.monster({ id: 'shade', x: 25, y: 8 });

    // The shops
    des.monster({ id: 'shade', x: 5, y: 2 });
    des.monster({ id: 'shade', x: 5, y: 3 });
    des.monster({ id: 'shade', x: 12, y: 2 });
    des.monster({ id: 'shade', x: 12, y: 3 });
    des.monster({ id: 'shade', x: 19, y: 2 });
    des.monster({ id: 'shade', x: 19, y: 3 });

    // Graveyard
    des.object({ id: 'grave', x: 3, y: 11 });
    des.object({ id: 'grave', x: 8, y: 11 });
    des.object({ id: 'grave', x: 13, y: 11 });
    des.object({ id: 'grave', x: 18, y: 12 });
    des.object({ id: 'grave', x: 18, y: 13 });

    // Random objects
    des.object({ class: '*' });
    des.object({ class: '*' });
    des.object({ class: '!' });
    des.object({ class: '!' });
    des.object({ class: '?' });
    des.object({ class: '?' });
    des.object({ class: '(' });

    // Random traps
    des.trap({ type: 'spiked pit' });
    des.trap({ type: 'sleep gas' });
    des.trap({ type: 'anti magic' });
    des.trap({ type: 'fire' });
    des.trap({ type: 'magic' });

    // Random monsters
    des.monster({ id: 'Z' }); // Zombie
    des.monster({ id: 'Z' });
    des.monster({ id: 'M' }); // Mummy
    des.monster({ id: 'M' });
    des.monster({ id: 'V' }); // Vampire
    des.monster({ id: 'V' });
    des.monster({ id: 'L' }); // Lich
    des.monster({ id: 'L' });

    return finalize_level();
}
