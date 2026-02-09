/**
 * Medusa's Island (variant 2)
 * Ported from nethack-c/dat/medusa-2.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport');

    des.map({
        map: `
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}------}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}-------}}}}}}}}--------------}
}|....|}}}}}}}}}..}.}}..}}}}}}}}}}}}}..}}}}}}-.....--}}}}}}}|............|}
}|....|.}}}}}}}}}}}.}...}}..}}}}}}}}}}}}}}}}}---......}}}}}.|............|}
}S....|.}}}}}}---}}}}}}}}}}}}}}}}}}}}}}}}}}---...|..-}}}}}}.S..----------|}
}|....|.}}}}}}-...}}}}}}}}}.}}...}.}}}}.}}}......----}}}}}}.|............|}
}|....|.}}}}}}-....--}}}}}}}}}}}}}}}}}}}}}}----...--}}}}}}}.|..--------+-|}
}|....|.}}}}}}}......}}}}...}}}}}}.}}}}}}}}}}}---..---}}}}}.|..|..S...|..|}
}|....|.}}}}}}-....-}}}}}}}------}}}}}}}}}}}}}}-...|.-}}}}}.|..|..|...|..|}
}|....|.}}}}}}}}}---}}}}}}}........}}}}}}}}}}---.|....}}}}}.|..|..|...|..|}
}|....|.}}}}}}}}}}}}}}}}}}-....|...-}}}}}}}}--...----.}}}}}.|..|..|...|..|}
}|....|.}}}}}}..}}}}}}}}}}---..--------}}}}}-..---}}}}}}}}}.|..|..-------|}
}|...}|...}}}.}}}}}}...}}}}}--..........}}}}..--}}}}}}}}}}}.|..|.........|}
}|...}S...}}.}}}}}}}}}}}}}}}-..--------}}}}}}}}}}}}}}...}}}.|..--------..S}
}|...}|...}}}}}}}..}}}}}}----..|....-}}}}}}}}}}}}}}}}}..}}}.|............|}
}|....|}}}}}....}}}}..}}.-.......----}}......}}}}}}.......}}|............|}
}------}}}}}}}}}}}}}}}}}}---------}}}}}}}}}}}}}}}}}}}}}}}}}}--------------}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
`
    });

    // Regions
    des.region(selection.area(0, 0, 74, 19), 'lit');
    des.region(selection.area(2, 3, 5, 16), 'unlit');
    des.region(selection.area(61, 3, 72, 16), 'unlit');
    des.region(selection.area(71, 8, 72, 11), 'unlit');
    des.region(selection.area(67, 8, 69, 11), 'lit');

    // Teleport regions
    des.teleport_region({ region: { x1: 2, y1: 3, x2: 5, y2: 16 } });
    des.teleport_region({ region: { x1: 61, y1: 3, x2: 72, y2: 16 } });

    // Stairs
    des.stair('up', 4, 9);
    des.stair('down', 68, 10);

    // Door
    des.door('locked', 71, 7);

    // Branch placement
    des.levregion({ type: 'branch', region: { x1: 1, y1: 0, x2: 79, y2: 20 }, exclude: { x1: 59, y1: 1, x2: 73, y2: 17 } });

    // Non-diggable walls
    des.non_diggable(selection.area(1, 2, 6, 17));
    des.non_diggable(selection.area(60, 2, 73, 17));

    // Perseus statue with potential loot (simplified - no percent() randomization)
    des.object({ id: 'statue', x: 68, y: 10 });
    des.object({ id: 'shield of reflection', x: 68, y: 10 });
    des.object({ id: 'levitation boots', x: 68, y: 10 });
    des.object({ id: 'scimitar', x: 68, y: 10, buc: 'blessed', spe: 2 });

    // Statues of petrified adventurers
    des.object({ id: 'statue', x: 64, y: 8 });
    des.object({ id: 'statue', x: 65, y: 8 });
    des.object({ id: 'statue', x: 64, y: 9 });
    des.object({ id: 'statue', x: 65, y: 9 });
    des.object({ id: 'statue', x: 64, y: 10 });
    des.object({ id: 'statue', x: 65, y: 10 });
    des.object({ id: 'statue', x: 64, y: 11 });
    des.object({ id: 'statue', x: 65, y: 11 });

    // Other objects
    des.object({ id: 'boulder', x: 4, y: 4 });
    des.object({ class: '/', x: 52, y: 9 }); // Wand
    des.object({ id: 'boulder', x: 52, y: 9 });
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();
    des.object();

    // Traps
    des.trap({ type: 'magic', x: 3, y: 12 });
    des.trap();
    des.trap();
    des.trap();
    des.trap();

    // Monsters - Medusa and her guardians
    des.monster({ id: 'Medusa', x: 68, y: 10, asleep: 1 });
    des.monster({ id: 'gremlin', x: 2, y: 14 });
    des.monster({ id: 'titan', x: 2, y: 5 });

    // Electric eels in the water
    des.monster({ id: 'electric eel', x: 10, y: 13 });
    des.monster({ id: 'electric eel', x: 11, y: 13 });
    des.monster({ id: 'electric eel', x: 10, y: 14 });
    des.monster({ id: 'electric eel', x: 11, y: 14 });
    des.monster({ id: 'electric eel', x: 10, y: 15 });
    des.monster({ id: 'electric eel', x: 11, y: 15 });

    // Jellyfish
    des.monster({ id: 'jellyfish', x: 1, y: 1 });
    des.monster({ id: 'jellyfish', x: 0, y: 8 });
    des.monster({ id: 'jellyfish', x: 4, y: 19 });

    // Stone golems guarding the statues
    des.monster({ id: 'stone golem', x: 64, y: 8, asleep: 1 });
    des.monster({ id: 'stone golem', x: 65, y: 8, asleep: 1 });
    des.monster({ id: 'stone golem', x: 64, y: 9, asleep: 1 });
    des.monster({ id: 'stone golem', x: 65, y: 9, asleep: 1 });

    // Cobras
    des.monster({ id: 'cobra', x: 64, y: 10, asleep: 1 });
    des.monster({ id: 'cobra', x: 65, y: 10, asleep: 1 });

    // Other guardians
    des.monster({ id: 'A', x: 72, y: 8 }); // Angelic being
    des.monster({ id: 'yellow light', x: 72, y: 11, asleep: 1 });

    // Random monsters at specific locations
    des.monster({ x: 17, y: 7 });
    des.monster({ x: 28, y: 11 });
    des.monster({ x: 32, y: 13 });
    des.monster({ x: 49, y: 9 });
    des.monster({ x: 48, y: 7 });
    des.monster({ x: 65, y: 3 });
    des.monster({ x: 70, y: 4 });
    des.monster({ x: 70, y: 15 });
    des.monster({ x: 65, y: 16 });

    // Additional random monsters
    des.monster();
    des.monster();
    des.monster();
    des.monster();

    return finalize_level();
}
