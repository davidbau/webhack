/**
 * Garden Level (peaceful garden with fountains)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel');

    // Formal garden with paths and fountains
    des.map({
        map: `
---------------------------------------------------------------------------
|.........................................................................|
|..TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT.|
|..T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T.|
|..TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT.|
|.........................................................................|
|...{.......................{.......................{....................|
|.........................................................................|
|..TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT.|
|..T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T.|
|..TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT.|
|.........................................................................|
|...{.......................{.......................{....................|
|.........................................................................|
|..TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT.|
|..T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T...T.T.|
|..TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT...TTT.|
|.........................................................................|
---------------------------------------------------------------------------
`
    });

    // Mostly lit, peaceful garden
    des.region(selection.area(1, 1, 73, 17), 'lit');

    // Stairs
    des.stair('up');
    des.stair('down');

    // Non-diggable walls
    des.non_diggable();

    // Objects scattered around
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Few traps in a garden
    for (let i = 0; i < 4; i++) {
        des.trap();
    }

    // Peaceful creatures
    des.monster({ id: 'water nymph' });
    des.monster({ id: 'wood nymph' });
    des.monster({ id: 'mountain nymph' });
    des.monster({ id: 'white unicorn' });
    des.monster({ id: 'gray unicorn' });
    des.monster({ id: 'black unicorn' });
    des.monster({ id: 'ki-rin' });
    des.monster({ id: 'Green-elf' });
    des.monster({ id: 'elven wizard' });
    des.monster({ id: 'Woodland-elf' });

    // Some animals
    des.monster({ id: 'jaguar' });
    des.monster({ id: 'tiger' });
    des.monster({ id: 'panther' });
    des.monster({ id: 'housecat' });
    des.monster({ id: 'kitten' });

    // Random monsters
    for (let i = 0; i < 13; i++) {
        des.monster();
    }

    return finalize_level();
}
