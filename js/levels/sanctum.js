/**
 * Sanctum - Moloch's temple (final Gehennom level)
 * Ported from nethack-c/dat/sanctum.lua
 */

import { des, selection } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport', 'hardfloor', 'nommap');

    // This is outside the main map, below, so we must do it before adding
    // that map and anchoring coordinates to it. This extends the invisible
    // barrier up to the top row, which falls outside the drawn map.
    des.non_passwall(selection.area(39, 0, 41, 0));

    des.map(`
----------------------------------------------------------------------------
|             --------------                                               |
|             |............|             -------                           |
|       -------............-----         |.....|                           |
|       |......................|        --.....|            ---------      |
|    ----......................---------|......----         |.......|      |
|    |........---------..........|......+.........|     ------+---..|      |
|  ---........|.......|..........--S----|.........|     |........|..|      |
|  |..........|.......|.............|   |.........-------..----------      |
|  |..........|.......|..........----   |..........|....|..|......|        |
|  |..........|.......|..........|      --.......----+---S---S--..|        |
|  |..........---------..........|       |.......|.............|..|        |
|  ---...........................|       -----+-------S---------S---       |
|    |...........................|          |...| |......|    |....|--     |
|    ----.....................----          |...---....---  ---......|     |
|       |.....................|             |..........|    |.....----     |
|       -------...........-----             --...-------    |.....|        |
|             |...........|                  |...|          |.....|        |
|             -------------                  -----          -------        |
----------------------------------------------------------------------------
`);

    // Temple region with altar
    des.region({ region: [15, 7, 21, 10], lit: true, type: 'temple', filled: 2 });
    des.altar({ x: 18, y: 8, align: 'noalign', type: 'sanctum' });

    // Morgue region
    des.region({ region: [41, 6, 48, 11], lit: false, type: 'morgue', filled: 1, irregular: true });

    // Non diggable walls
    des.non_diggable(selection.area(0, 0, 75, 19));

    // Invisible barrier separating the left & right halves of the level
    des.non_passwall(selection.area(37, 0, 39, 19));

    // Doors
    des.door('closed', 40, 6);
    des.door('locked', 62, 6);
    des.door('closed', 46, 12);
    des.door('closed', 53, 10);

    // Surround the temple with fire
    for (let x = 13; x <= 23; x++) {
        des.trap('fire', x, 5);
        des.trap('fire', x, 12);
    }
    for (let y = 6; y <= 11; y++) {
        des.trap('fire', 13, y);
        des.trap('fire', 23, y);
    }

    // Some traps
    des.trap('spiked pit');
    des.trap('fire');
    des.trap('sleep gas');
    des.trap('anti magic');
    des.trap('fire');
    des.trap('magic');

    // Some random objects
    des.object('[');
    des.object('[');
    des.object('[');
    des.object('[');
    des.object(')');
    des.object(')');
    des.object('*');
    des.object('!');
    des.object('!');
    des.object('!');
    des.object('!');
    des.object('?');
    des.object('?');
    des.object('?');
    des.object('?');
    des.object('?');

    // Some monsters
    des.monster({ id: 'horned devil', x: 14, y: 12, peaceful: 0 });
    des.monster({ id: 'barbed devil', x: 18, y: 8, peaceful: 0 });
    des.monster({ id: 'erinys', x: 10, y: 4, peaceful: 0 });
    des.monster({ id: 'marilith', x: 7, y: 9, peaceful: 0 });
    des.monster({ id: 'nalfeshnee', x: 27, y: 8, peaceful: 0 });

    // Moloch's horde (aligned clerics)
    des.monster({ id: 'aligned cleric', x: 20, y: 3, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 15, y: 4, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 11, y: 5, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 11, y: 7, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 11, y: 9, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 11, y: 12, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 15, y: 13, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 17, y: 13, align: 'noalign', peaceful: 0 });
    des.monster({ id: 'aligned cleric', x: 21, y: 13, align: 'noalign', peaceful: 0 });

    // A few nasties
    des.monster('L');
    des.monster('L');
    des.monster('V');
    des.monster('V');
    des.monster('V');

    // Upstairs
    des.stair('up', 63, 15);

    // Teleporting to this level is allowed after the invocation creates its
    // entrance. Force arrival in that case to be on rightmost third of level.
    des.teleport_region({ region: [54, 1, 79, 18], region_islev: 1, dir: 'down' });

    return des.finalize_level();
}
