/**
 * Valley of the Dead - Gehennom entrance
 * Ported from nethack-c/dat/valley.lua
 */

import { des, selection, percent, finalize_level } from '../sp_lev.js';

export function generate() {
    des.level_init({ style: 'solidfill', fg: ' ' });

    des.level_flags('mazelevel', 'noteleport', 'hardfloor', 'nommap', 'temperate');

    des.map(`
----------------------------------------------------------------------------
|...S.|..|.....|  |.....-|      |................|   |...............| |...|
|---|.|.--.---.|  |......--- ----..........-----.-----....---........---.-.|
|   |.|.|..| |.| --........| |.............|   |.......---| |-...........--|
|   |...S..| |.| |.......-----.......------|   |--------..---......------- |
|----------- |.| |-......| |....|...-- |...-----................----       |
|.....S....---.| |.......| |....|...|  |..............-----------          |
|.....|.|......| |.....--- |......---  |....---.......|                    |
|.....|.|------| |....--   --....-- |-------- ----....---------------      |
|.....|--......---BBB-|     |...--  |.......|    |..................|      |
|..........||........-|    --...|   |.......|    |...||.............|      |
|.....|...-||-........------....|   |.......---- |...||.............--     |
|.....|--......---...........--------..........| |.......---------...--    |
|.....| |------| |--.......--|   |..B......----- -----....| |.|  |....---  |
|.....| |......--| ------..| |----..B......|       |.--------.-- |-.....---|
|------ |........|  |.|....| |.....----BBBB---------...........---.........|
|       |........|  |...|..| |.....|  |-.............--------...........---|
|       --.....-----------.| |....-----.....----------     |.........----  |
|        |..|..B...........| |.|..........|.|              |.|........|    |
----------------------------------------------------------------------------
`);

    // Make the path somewhat unpredictable
    // If you get "lucky", you may have to go through all three graveyards.
    if (percent(50)) {
        des.terrain(selection.line(50, 8, 53, 8), '-');
        des.terrain(selection.line(40, 8, 43, 8), 'B');
    }
    if (percent(50)) {
        des.terrain({ x: 27, y: 12, typ: '|' });
        des.terrain(selection.line(27, 3, 29, 3), 'B');
        des.terrain({ x: 28, y: 2, typ: '-' });
    }
    if (percent(50)) {
        des.terrain(selection.line(16, 10, 16, 11), '|');
        des.terrain(selection.line(9, 13, 14, 13), 'B');
    }

    // Dungeon Description
    // The shrine to Moloch
    des.region({ region: { x1: 1, y1: 6, x2: 5, y2: 14 }, lit: 1, type: 'temple', filled: 2 });

    // The Morgues
    des.region({ region: { x1: 19, y1: 1, x2: 24, y2: 8 }, lit: 0, type: 'morgue', filled: 1, irregular: 1 });
    des.region({ region: { x1: 9, y1: 14, x2: 16, y2: 18 }, lit: 0, type: 'morgue', filled: 1, irregular: 1 });
    des.region({ region: { x1: 37, y1: 9, x2: 43, y2: 14 }, lit: 0, type: 'morgue', filled: 1, irregular: 1 });

    // Stairs
    des.stair('down', 1, 1);

    // Branch location
    des.levregion({ type: 'branch', region: { x1: 66, y1: 17, x2: 66, y2: 17 } });
    des.teleport_region({ region: { x1: 58, y1: 9, x2: 72, y2: 18 }, dir: 'down' });

    // Secret Doors
    des.door('locked', 4, 1);
    des.door('locked', 8, 4);
    des.door('locked', 6, 6);

    // The altar of Moloch
    des.altar({ x: 3, y: 10, align: 'noalign', type: 'shrine' });

    // Non diggable walls - everywhere!
    des.non_diggable(selection.area(0, 0, 75, 19));

    // **LOTS** of dead bodies (all human)
    des.object({ id: 'corpse', montype: 'archeologist' });
    des.object({ id: 'corpse', montype: 'archeologist' });
    des.object({ id: 'corpse', montype: 'barbarian' });
    des.object({ id: 'corpse', montype: 'barbarian' });
    des.object({ id: 'corpse', montype: 'caveman' });
    des.object({ id: 'corpse', montype: 'cavewoman' });
    des.object({ id: 'corpse', montype: 'healer' });
    des.object({ id: 'corpse', montype: 'healer' });
    des.object({ id: 'corpse', montype: 'knight' });
    des.object({ id: 'corpse', montype: 'knight' });
    des.object({ id: 'corpse', montype: 'ranger' });
    des.object({ id: 'corpse', montype: 'ranger' });
    des.object({ id: 'corpse', montype: 'rogue' });
    des.object({ id: 'corpse', montype: 'rogue' });
    des.object({ id: 'corpse', montype: 'samurai' });
    des.object({ id: 'corpse', montype: 'samurai' });
    des.object({ id: 'corpse', montype: 'tourist' });
    des.object({ id: 'corpse', montype: 'tourist' });
    des.object({ id: 'corpse', montype: 'valkyrie' });
    des.object({ id: 'corpse', montype: 'valkyrie' });
    des.object({ id: 'corpse', montype: 'wizard' });
    des.object({ id: 'corpse', montype: 'wizard' });

    // Some random weapons and armor
    des.object({ class: '[' });
    des.object({ class: '[' });
    des.object({ class: '[' });
    des.object({ class: '[' });
    des.object({ class: ')' });
    des.object({ class: ')' });
    des.object({ class: ')' });
    des.object({ class: ')' });

    // Some random loot
    des.object({ id: 'ruby' });
    des.object({ class: '*' });
    des.object({ class: '*' });
    des.object({ class: '!' });
    des.object({ class: '!' });
    des.object({ class: '!' });
    des.object({ class: '?' });
    des.object({ class: '?' });
    des.object({ class: '?' });
    des.object({ class: '/' });
    des.object({ class: '/' });
    des.object({ class: '=' });
    des.object({ class: '=' });
    des.object({ class: '+' });
    des.object({ class: '+' });
    des.object({ class: '(' });
    des.object({ class: '(' });
    des.object({ class: '(' });

    // (Not so) Random traps
    des.trap('spiked pit', 5, 2);
    des.trap('spiked pit', 14, 5);
    des.trap('sleep gas', 3, 1);
    des.trap('board', 21, 12);
    des.trap({ type: 'board' });
    des.trap('dart', 60, 1);
    des.trap('dart', 26, 17);
    des.trap({ type: 'anti magic' });
    des.trap({ type: 'anti magic' });
    des.trap({ type: 'magic' });
    des.trap({ type: 'magic' });

    // Random monsters
    // The ghosts
    des.monster({ id: 'ghost' });
    des.monster({ id: 'ghost' });
    des.monster({ id: 'ghost' });
    des.monster({ id: 'ghost' });
    des.monster({ id: 'ghost' });
    des.monster({ id: 'ghost' });

    // Add a few bats for atmosphere
    des.monster({ id: 'vampire bat' });
    des.monster({ id: 'vampire bat' });
    des.monster({ id: 'vampire bat' });

    // And a lich for good measure
    des.monster({ id: 'L' });

    // Some undead nasties
    des.monster({ id: 'V' });
    des.monster({ id: 'V' });
    des.monster({ id: 'V' });
    des.monster({ id: 'Z' });
    des.monster({ id: 'Z' });
    des.monster({ id: 'Z' });
    des.monster({ id: 'Z' });
    des.monster({ id: 'M' });
    des.monster({ id: 'M' });
    des.monster({ id: 'M' });
    des.monster({ id: 'M' });

    finalize_level();
}
