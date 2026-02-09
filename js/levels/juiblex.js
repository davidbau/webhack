/**
 * Juiblex's Swamp (Gehennom)
 * Ported from nethack-c/dat/juiblex.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_flags('mazelevel', 'shortsighted', 'noflip', 'temperate');

    // Swamp style creates procedural swampy terrain
    des.level_init({ style: 'swamp', lit: 0 });

    // Guarantee at least one open spot (bottom left) for stair placement
    des.map({
        halign: 'left',
        valign: 'bottom',
        map: `
 xxxxxxxx
xx...xxx
xxx...xx
xxxx.xxx
 xxxxxxxx
`
    });
    des.object({ id: 'boulder' });

    // Guarantee another open spot (top right)
    des.map({
        halign: 'right',
        valign: 'top',
        map: `
 xxxxxxxx
xxxx.xxx
xxx...xx
xx...xxx
 xxxxxxxx
`
    });
    des.object({ id: 'boulder' });

    // Main lair with pools
    des.map({
        map: `
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxx
xxx...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...xxx
xxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxx
xxxxxxxxxxxxxxxxxxxxxxxx}}}xxxxxxxxxxxxxxx}}}}}xxxx
xxxxxxxxxxxxxxxxxxxxxxx}}}}}xxxxxxxxxxxxx}.....}xxx
xxxxxxxxxxxxxxxxxxxxxx}}...}}xxxxxxxxxxx}..P.P..}xx
xxxxxxxxxxxxxxxxxxxxx}}..P..}}xxxxxxxxxxx}.....}xxx
xxxxxxxxxxxxxxxxxxxxx}}.P.P.}}xxxxxxxxxxxx}...}xxxx
xxxxxxxxxxxxxxxxxxxxx}}..P..}}xxxxxxxxxxxx}...}xxxx
xxxxxxxxxxxxxxxxxxxxxx}}...}}xxxxxxxxxxxxxx}}}xxxxx
xxxxxxxxxxxxxxxxxxxxxxx}}}}}xxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxx}}}xxxxxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
xxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxx
xxx...xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...xxx
xxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
`
    });

    // Dungeon description - swamp region
    des.region(selection.area(0, 0, 50, 17), 'unlit', 'swamp', 2);

    // Stair and branch placement
    des.levregion({ type: 'stair-down', region: { x1: 1, y1: 0, x2: 11, y2: 20 }, exclude: { x1: 0, y1: 0, x2: 50, y2: 17 } });
    des.levregion({ type: 'stair-up', region: { x1: 69, y1: 0, x2: 79, y2: 20 }, exclude: { x1: 0, y1: 0, x2: 50, y2: 17 } });
    des.levregion({ type: 'branch', region: { x1: 1, y1: 0, x2: 11, y2: 20 }, exclude: { x1: 0, y1: 0, x2: 50, y2: 17 } });
    des.teleport_region({ region: { x1: 1, y1: 0, x2: 11, y2: 20 }, exclude: { x1: 0, y1: 0, x2: 50, y2: 17 } });
    des.teleport_region({ region: { x1: 69, y1: 0, x2: 79, y2: 20 }, exclude: { x1: 0, y1: 0, x2: 50, y2: 17 } });

    // Fountains at corners - one real, three mimics
    // In Lua they use selection for random placement, we'll approximate
    des.feature({ type: 'fountain', x: 4, y: 2 });
    des.monster({ id: 'giant mimic', x: 46, y: 2 }); // TODO: appear_as fountain
    des.monster({ id: 'giant mimic', x: 4, y: 15 }); // TODO: appear_as fountain
    des.monster({ id: 'giant mimic', x: 46, y: 15 }); // TODO: appear_as fountain

    // The demon of the swamp
    des.monster({ id: 'Juiblex', x: 25, y: 8 });

    // Lemures guarding treasure
    des.monster({ id: 'lemure', x: 43, y: 8 });
    des.monster({ id: 'lemure', x: 44, y: 8 });
    des.monster({ id: 'lemure', x: 45, y: 8 });

    // Treasure
    des.object({ class: '*', x: 43, y: 6 });
    des.object({ class: '*', x: 45, y: 6 });
    des.object({ class: '!', x: 43, y: 9 });
    des.object({ class: '!', x: 44, y: 9 });
    des.object({ class: '!', x: 45, y: 9 });

    // Blobby monsters surrounding Juiblex
    // In Lua these use shuffled monster types, we'll use specific ones
    des.monster({ id: 'F', x: 25, y: 6 });  // Fungus
    des.monster({ id: 'j', x: 24, y: 7 });  // Jelly
    des.monster({ id: 'b', x: 26, y: 7 });  // Blob
    des.monster({ id: 'P', x: 23, y: 8 });  // Pudding
    des.monster({ id: 'P', x: 27, y: 8 });  // Pudding
    des.monster({ id: 'b', x: 24, y: 9 });  // Blob
    des.monster({ id: 'j', x: 26, y: 9 });  // Jelly
    des.monster({ id: 'F', x: 25, y: 10 }); // Fungus

    // More random blobby monsters
    des.monster({ id: 'j' });
    des.monster({ id: 'j' });
    des.monster({ id: 'j' });
    des.monster({ id: 'j' });
    des.monster({ id: 'P' });
    des.monster({ id: 'P' });
    des.monster({ id: 'P' });
    des.monster({ id: 'P' });
    des.monster({ id: 'b' });
    des.monster({ id: 'b' });
    des.monster({ id: 'b' });
    des.monster({ id: 'F' });
    des.monster({ id: 'F' });
    des.monster({ id: 'F' });
    des.monster({ id: 'm' }); // Small mimic
    des.monster({ id: 'm' });
    des.monster({ id: 'jellyfish' });
    des.monster({ id: 'jellyfish' });

    // Random objects
    des.object({ class: '!' });
    des.object({ class: '!' });
    des.object({ class: '!' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ class: '%' });
    des.object({ id: 'boulder' });

    // Traps
    des.trap({ type: 'sleep gas' });
    des.trap({ type: 'sleep gas' });
    des.trap({ type: 'anti magic' });
    des.trap({ type: 'anti magic' });
    des.trap({ type: 'magic' });
    des.trap({ type: 'magic' });

    return finalize_level();
}
