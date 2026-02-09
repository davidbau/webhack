/**
 * Forest Level (trees and clearings)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: 'T' });

    des.level_flags('mazelevel', 'arboreal');

    // Dense forest with clearings
    des.map({
        map: `
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTT..........TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..........TTTTTTTTTTTTTTTTT
TTTTTTTT............TTTTTTTTTTTTTTTTTTTTTTTTTTTT............TTTTTTTTTTTTTTTT
TTTTTTT..............TTTTTTTTTTTTTTTTTTTTTTTTTT..............TTTTTTTTTTTTTTT
TTTTTT................TTTTTTTTTTTTTTTTTTTTTTTT................TTTTTTTTTTTTTT
TTTTT..................TTTTTTTTTTTTTTTTTTTTTT..................TTTTTTTTTTTTT
TTTT....................TTTTTTTTTTTTTTTTTTTT....................TTTTTTTTTTTT
TTT......................TTTTTTTTTTTTTTTTTT......................TTTTTTTTTTT
TT........................TTTTTTTTTTTTTTTT........................TTTTTTTTTT
T..........................TTTTTTTTTTTTTT..........................TTTTTTTTT
T..........................TTTTTTTTTTTTTT..........................TTTTTTTTT
TT........................TTTTTTTTTTTTTTTT........................TTTTTTTTTT
TTT......................TTTTTTTTTTTTTTTTTT......................TTTTTTTTTTT
TTTT....................TTTTTTTTTTTTTTTTTTTT....................TTTTTTTTTTTT
TTTTT..................TTTTTTTTTTTTTTTTTTTTTT..................TTTTTTTTTTTTT
TTTTTT................TTTTTTTTTTTTTTTTTTTTTTTT................TTTTTTTTTTTTTT
TTTTTTT..............TTTTTTTTTTTTTTTTTTTTTTTTTT..............TTTTTTTTTTTTTTT
TTTTTTTT............TTTTTTTTTTTTTTTTTTTTTTTTTTTT............TTTTTTTTTTTTTTTT
TTTTTTTTT..........TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..........TTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
`
    });

    // Light the clearings
    des.region(selection.area(9, 2, 20, 8), 'lit');
    des.region(selection.area(53, 2, 64, 8), 'lit');
    des.region(selection.area(25, 9, 50, 12), 'lit');

    // Stairs in clearings
    des.stair('up', 14, 5);
    des.stair('down', 58, 5);

    // Non-diggable
    des.non_diggable();

    // Objects
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 6; i++) {
        des.trap();
    }

    // Forest creatures
    des.monster({ id: 'wood nymph' });
    des.monster({ id: 'wood nymph' });
    des.monster({ id: 'woodchuck' });
    des.monster({ id: 'Green-elf' });
    des.monster({ id: 'Green-elf' });
    des.monster({ id: 'Green-elf' });
    des.monster({ id: 'elven wizard' });
    des.monster({ id: 'woodland-elf' });
    des.monster({ id: 'wood troll' });
    des.monster({ id: 'owlbear' });
    des.monster({ id: 'owlbear' });
    des.monster({ id: 'tiger' });
    des.monster({ id: 'jaguar' });

    // Random monsters
    for (let i = 0; i < 15; i++) {
        des.monster();
    }

    return finalize_level();
}
