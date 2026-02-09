/**
 * Vlad's Tower - Level 1 (Upper stage)
 * Ported from nethack-c/dat/tower1.lua
 */

import { des, selection, shuffle, nh, finalize_level } from '../sp_lev.js';

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
|.......+.+...|
---+-----.-----
  |...\\.|.+.|
---+-----.-----
|.......+.+...|
---S---S---S---
  |.| |.| |.|
  --- --- ---
`
    });

    const niches = [
        { x: 3, y: 1 }, { x: 3, y: 9 },
        { x: 7, y: 1 }, { x: 7, y: 9 },
        { x: 11, y: 1 }, { x: 11, y: 9 }
    ];
    shuffle(niches);

    des.ladder('down', 11, 5);

    // The lord and his court
    des.monster({ id: 'Vlad the Impaler', x: 6, y: 5 });
    des.monster({ id: 'V', coord: niches[0] });
    des.monster({ id: 'V', coord: niches[1] });
    des.monster({ id: 'V', coord: niches[2] });

    // The brides - only if vampires not genocided
    const vgenod = nh.is_genocided('vampire');
    if (!vgenod) {
        des.monster({ id: 'vampire lady', coord: niches[3], name: 'Madame', waiting: 1 });
        des.monster({ id: 'vampire lady', coord: niches[4], name: 'Marquise', waiting: 1 });
        des.monster({ id: 'vampire lady', coord: niches[5], name: 'Countess', waiting: 1 });
    }

    // The doors
    des.door('closed', 8, 3);
    des.door('closed', 10, 3);
    des.door('closed', 3, 4);
    des.door('locked', 10, 5);
    des.door('locked', 8, 7);
    des.door('locked', 10, 7);
    des.door('closed', 3, 6);

    // Treasures - basic chests (TODO: add contents function support)
    des.object({ id: 'chest', x: 7, y: 5 });
    des.object({ id: 'chest', coord: niches[5] });
    des.object({ id: 'chest', coord: niches[0] });
    des.object({ id: 'chest', coord: niches[1] });
    des.object({ id: 'chest', coord: niches[2] });
    des.object({ id: 'chest', coord: niches[3] });
    des.object({ id: 'chest', coord: niches[4] });

    // Protect tower against outside attacks
    des.non_diggable(selection.area(0, 0, 14, 10));

    return finalize_level();
}
