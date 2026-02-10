/**
 * Cavern Level (underground cave system)
 * Original design for NetHack JavaScript port
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: '-' });

    des.level_flags('mazelevel');

    // Natural cavern with irregular walls
    des.map({
        map: `
----------------                  -----------------------
|..............|              --|.....................|--
|...............--          --|........................|---
--.................--      --|..........................|.---
 --..................--  --|.............................|..---
  --...................--|.................................|....---
   --...................................................|.......|--
    --.................................................|.........|.---
     -.................................................|...........|..--
      --................................................|............|...--
       --................................................|...............|.|
       --................................................|...............|.|
      --................................................|............|...--
     -.................................................|...........|..--
    --.................................................|.........|.---
   --...................................................|.......|--
  --...................--|.................................|....---
 --..................--  --|.............................|..---
--.................--      --|..........................|.---
|...............--          --|........................|---
|..............|              --|.....................|--
----------------                  -----------------------
`
    });

    // Mostly unlit cavern
    des.region(selection.area(0, 0, 75, 21), 'unlit');

    // Stairs
    des.stair('up', 8, 5);
    des.stair('down', 55, 10);

    // Non-diggable
    des.non_diggable();

    // Objects
    for (let i = 0; i < 15; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 8; i++) {
        des.trap();
    }

    // Cave dwellers
    des.monster({ id: 'cave spider' });
    des.monster({ id: 'cave spider' });
    des.monster({ id: 'giant spider' });
    des.monster({ id: 'giant spider' });
    des.monster({ id: 'cave troll' });
    des.monster({ id: 'cave troll' });
    des.monster({ id: 'troglodyte' });
    des.monster({ id: 'troglodyte' });
    des.monster({ id: 'umber hulk' });
    des.monster({ id: 'purple worm' });
    des.monster({ id: 'rock troll' });
    des.monster({ id: 'rock mole' });

    // Random monsters
    for (let i = 0; i < 16; i++) {
        des.monster();
    }

    return finalize_level();
}
