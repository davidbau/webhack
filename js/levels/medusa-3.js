/**
 * Medusa's Lair (variant 3)
 * Simplified port from nethack-c/dat/medusa-1.lua
 */

import { des, selection, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport');

    des.map({
        map: `
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}.}}}}}..}}}}}......}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}....}}}...}}}}}
}...}}.....}}}}}....}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}...............}
}....}}}}}}}}}}....}}}..}}}}}}}}}}}.......}}}}}}}}}}}}}}}}..}}.....}}}...}}
}....}}}}}}}}.....}}}}..}}}}}}.................}}}}}}}}}}}.}}}}.....}}...}}
}....}}}}}}}}}}}}.}}}}.}}}}}}.-----------------.}}}}}}}}}}}}}}}}}.........}
}....}}}}}}}}}}}}}}}}}}.}}}...|...............S...}}}}}}}}}}}}}}}}}}}....}}
}.....}.}}....}}}}}}}}}.}}....--------+--------....}}}}}}..}}}}}}}}}}}...}}
}......}}}}..}}}}}}}}}}}}}........|.......|........}}}}}....}}}}}}}}}}}}}}}
}.....}}}}}}}}}}}}}}}}}}}}........|.......|........}}}}}...}}}}}}}}}.}}}}}}
}.....}}}}}}}}}}}}}}}}}}}}....--------+--------....}}}}}}.}.}}}}}}}}}}}}}}}
}......}}}}}}}}}}}}}}}}}}}}...S...............|...}}}}}}}}}}}}}}}}}.}}}}}}}
}.......}}}}}}}..}}}}}}}}}}}}.-----------------.}}}}}}}}}}}}}}}}}....}}}}}}
}........}}.}}....}}}}}}}}}}}}.................}}}}}..}}}}}}}}}.......}}}}}
}.......}}}}}}}......}}}}}}}}}}}}}}.......}}}}}}}}}.....}}}}}}...}}..}}}}}}
}.....}}}}}}}}}}}.....}}}}}}}}}}}}}}}}}}}}}}.}}}}}}}..}}}}}}}}}}....}}}}}}}
}}..}}}}}}}}}}}}}....}}}}}}}}}}}}}}}}}}}}}}...}}..}}}}}}}.}}.}}}}..}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
`
    });

    // Regions
    des.region(selection.area(0, 0, 74, 19), 'lit');
    des.region(selection.area(31, 7, 45, 7), 'unlit');
    des.region(selection.area(35, 9, 41, 10), 'unlit');
    des.region(selection.area(31, 12, 45, 12), 'unlit');

    // Teleport regions
    des.teleport_region({ region: { x1: 1, y1: 1, x2: 5, y2: 17 } });
    des.teleport_region({ region: { x1: 26, y1: 4, x2: 50, y2: 15 } });

    // Stairs
    des.stair('up', 5, 14);
    des.stair('down', 36, 10);

    // Doors
    des.door('closed', 46, 7);
    des.door('locked', 38, 8);
    des.door('locked', 38, 11);
    des.door('closed', 30, 12);

    // Branch placement
    des.levregion({ type: 'branch', region: { x1: 1, y1: 0, x2: 79, y2: 20 }, exclude: { x1: 30, y1: 6, x2: 46, y2: 13 } });

    // Non-diggable walls
    des.non_diggable(selection.area(30, 6, 46, 13));

    // Perseus statue with loot (simplified)
    des.object({ id: 'statue', x: 36, y: 10 });
    des.object({ id: 'shield of reflection', x: 36, y: 10, buc: 'cursed' });
    des.object({ id: 'levitation boots', x: 36, y: 10 });
    des.object({ id: 'scimitar', x: 36, y: 10, buc: 'blessed', spe: 2 });

    // Empty statues
    for (let i = 0; i < 7; i++) {
        des.object({ id: 'statue' });
    }

    // Random objects
    for (let i = 0; i < 8; i++) {
        des.object();
    }

    // Traps
    for (let i = 0; i < 5; i++) {
        des.trap();
    }
    des.trap({ type: 'board', x: 38, y: 7 });
    des.trap({ type: 'board', x: 38, y: 12 });

    // Monsters - Medusa
    des.monster({ id: 'Medusa', x: 36, y: 10, asleep: 1 });

    // Water creatures
    des.monster({ id: 'giant eel', x: 11, y: 6 });
    des.monster({ id: 'giant eel', x: 23, y: 13 });
    des.monster({ id: 'giant eel', x: 29, y: 2 });
    des.monster({ id: 'jellyfish', x: 2, y: 2 });
    des.monster({ id: 'jellyfish', x: 0, y: 8 });
    des.monster({ id: 'jellyfish', x: 4, y: 18 });
    des.monster({ id: 'water troll', x: 51, y: 3 });
    des.monster({ id: 'water troll', x: 64, y: 11 });

    // Snakes guarding entrances
    des.monster({ class: 'S', x: 38, y: 7 });
    des.monster({ class: 'S', x: 38, y: 12 });

    // Random monsters
    for (let i = 0; i < 10; i++) {
        des.monster();
    }

    return finalize_level();
}
