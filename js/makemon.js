// makemon.js -- Monster creation
// Mirrors makemon.c from the C source.

import { COLNO, ROWNO, ROOM, CORR, STAIRS, FOUNTAIN, ALTAR,
         IS_ROOM, ACCESSIBLE, isok } from './config.js';
import { rn2, rnd, rn1, d } from './rng.js';
import { CLR_RED, CLR_BROWN, CLR_GREEN, CLR_GRAY, CLR_CYAN,
         CLR_YELLOW, CLR_WHITE, CLR_ORANGE, CLR_MAGENTA, CLR_BLUE,
         CLR_BRIGHT_GREEN, CLR_BRIGHT_BLUE } from './display.js';

// Monster class symbols (from sym.h MONSYMS)
// C ref: include/sym.h -- MONSYMS_S_ENUM
export const S_ANT = 'a';
export const S_BLOB = 'b';
export const S_COCKATRICE = 'c';
export const S_DOG = 'd';
export const S_EYE = 'e';
export const S_FELINE = 'f';
export const S_GREMLIN = 'g';
export const S_HUMANOID = 'h';
export const S_IMP = 'i';
export const S_JELLY = 'j';
export const S_KOBOLD = 'k';
export const S_LEPRECHAUN = 'l';
export const S_MIMIC = 'm';
export const S_NYMPH = 'n';
export const S_ORC = 'o';
export const S_PIERCER = 'p';
export const S_QUADRUPED = 'q';
export const S_RODENT = 'r';
export const S_SPIDER = 's';
export const S_TRAPPER = 't';
export const S_UNICORN = 'u';
export const S_VORTEX = 'v';
export const S_WORM = 'w';
export const S_XAN = 'x';
export const S_LIGHT = 'y';
export const S_ZRUTY = 'z';
export const S_ANGEL = 'A';
export const S_BAT = 'B';
export const S_CENTAUR = 'C';
export const S_DRAGON = 'D';
export const S_ELEMENTAL = 'E';
export const S_FUNGUS = 'F';
export const S_GNOME = 'G';
export const S_GIANT = 'H';
export const S_JABBERWOCK = 'J';
export const S_KOP = 'K';
export const S_LICH = 'L';
export const S_MUMMY = 'M';
export const S_NAGA = 'N';
export const S_OGRE = 'O';
export const S_PUDDING = 'P';
export const S_QUANTMECH = 'Q';
export const S_RUSTMONST = 'R';
export const S_SNAKE = 'S';
export const S_TROLL = 'T';
export const S_UMBER = 'U';
export const S_VAMPIRE = 'V';
export const S_WRAITH = 'W';
export const S_XORN = 'X';
export const S_YETI = 'Y';
export const S_ZOMBIE = 'Z';
export const S_HUMAN = '@';
export const S_GHOST = ' ';
export const S_GOLEM = '\'';
export const S_DEMON = '&';
export const S_EEL = ';';
export const S_LIZARD = ':';
export const S_WORM_TAIL = '~';
export const S_MIMIC_DEF = ']';

// Simplified monster type table
// C ref: include/monsters.h -- we include the most important monsters
// for the first dungeon levels. Full data is in monsters.js (generated).
export const monsterTypes = [
    // Level 0-2 monsters (common early dungeon)
    { name: 'grid bug',       symbol: 'x', color: CLR_MAGENTA,  level: 0, speed: 12, ac: 9, mr: 0, hp: [1,4], attacks: [{dmg: [1,1]}] },
    { name: 'bat',            symbol: 'B', color: CLR_BROWN,    level: 0, speed: 22, ac: 8, mr: 0, hp: [1,4], attacks: [{dmg: [1,4]}] },
    { name: 'sewer rat',      symbol: 'r', color: CLR_BROWN,    level: 0, speed: 12, ac: 7, mr: 0, hp: [1,4], attacks: [{dmg: [1,3]}] },
    { name: 'newt',           symbol: ':', color: CLR_YELLOW,   level: 0, speed: 6,  ac: 8, mr: 0, hp: [1,4], attacks: [{dmg: [1,2]}] },
    { name: 'jackal',         symbol: 'd', color: CLR_BROWN,    level: 0, speed: 12, ac: 7, mr: 0, hp: [1,6], attacks: [{dmg: [1,2]}] },
    { name: 'fox',            symbol: 'd', color: CLR_RED,      level: 0, speed: 15, ac: 7, mr: 0, hp: [1,6], attacks: [{dmg: [1,3]}] },
    { name: 'lichen',         symbol: 'F', color: CLR_BRIGHT_GREEN, level: 0, speed: 1, ac: 9, mr: 0, hp: [1,4], attacks: [{dmg: [0,0], special: 'stick'}] },
    { name: 'kobold',         symbol: 'k', color: CLR_RED,      level: 0, speed: 6,  ac: 7, mr: 0, hp: [1,4], attacks: [{dmg: [1,4]}] },
    { name: 'goblin',         symbol: 'o', color: CLR_GRAY,     level: 0, speed: 6,  ac: 7, mr: 0, hp: [1,6], attacks: [{dmg: [1,4]}] },
    // Level 1-3 monsters
    { name: 'giant ant',      symbol: 'a', color: CLR_BROWN,    level: 2, speed: 18, ac: 3, mr: 0, hp: [2,6], attacks: [{dmg: [1,4]}] },
    { name: 'gnome',          symbol: 'G', color: CLR_BROWN,    level: 1, speed: 6,  ac: 5, mr: 0, hp: [1,6], attacks: [{dmg: [1,6]}] },
    { name: 'floating eye',   symbol: 'e', color: CLR_BLUE,     level: 2, speed: 1,  ac: 9, mr: 10, hp: [1,6], attacks: [{dmg: [0,0], special: 'paralyze'}], passive: true },
    { name: 'yellow light',   symbol: 'y', color: CLR_YELLOW,   level: 3, speed: 15, ac: 0, mr: 0, hp: [1,6], attacks: [{dmg: [0,0], special: 'blind'}] },
    { name: 'acid blob',      symbol: 'b', color: CLR_GREEN,    level: 1, speed: 3,  ac: 8, mr: 0, hp: [1,8], attacks: [{dmg: [1,8]}] },
    { name: 'coyote',         symbol: 'd', color: CLR_BROWN,    level: 1, speed: 12, ac: 7, mr: 0, hp: [1,6], attacks: [{dmg: [1,4]}] },
    { name: 'large kobold',   symbol: 'k', color: CLR_RED,      level: 1, speed: 6,  ac: 6, mr: 0, hp: [1,6], attacks: [{dmg: [1,6]}] },
    { name: 'hobgoblin',      symbol: 'o', color: CLR_BROWN,    level: 1, speed: 9,  ac: 5, mr: 0, hp: [1,8], attacks: [{dmg: [1,6]}] },
    // Level 3-5 monsters
    { name: 'dwarf',          symbol: 'h', color: CLR_RED,      level: 2, speed: 6,  ac: 4, mr: 10, hp: [2,6], attacks: [{dmg: [1,8]}] },
    { name: 'rothé',          symbol: 'q', color: CLR_BROWN,    level: 2, speed: 9,  ac: 7, mr: 0, hp: [2,6], attacks: [{dmg: [1,3]},{dmg: [1,3]},{dmg: [1,8]}] },
    { name: 'orc',            symbol: 'o', color: CLR_RED,      level: 1, speed: 9,  ac: 6, mr: 0, hp: [1,8], attacks: [{dmg: [1,8]}] },
    { name: 'imp',            symbol: 'i', color: CLR_RED,      level: 3, speed: 12, ac: 2, mr: 20, hp: [2,6], attacks: [{dmg: [1,4]}] },
    { name: 'rock piercer',   symbol: 'p', color: CLR_GRAY,     level: 3, speed: 1,  ac: 3, mr: 0, hp: [2,6], attacks: [{dmg: [2,6]}] },
    // Mid-level monsters
    { name: 'pony',           symbol: 'u', color: CLR_BROWN,    level: 3, speed: 16, ac: 6, mr: 0, hp: [3,6], attacks: [{dmg: [1,6]},{dmg: [1,2]}] },
    { name: 'fog cloud',      symbol: 'v', color: CLR_GRAY,     level: 3, speed: 1,  ac: 0, mr: 0, hp: [3,6], attacks: [{dmg: [1,6]}] },
    { name: 'gnome lord',     symbol: 'G', color: CLR_BLUE,     level: 3, speed: 8,  ac: 4, mr: 0, hp: [3,6], attacks: [{dmg: [1,8]}] },
    { name: 'iguana',         symbol: ':', color: CLR_BROWN,     level: 2, speed: 6,  ac: 7, mr: 0, hp: [2,6], attacks: [{dmg: [1,4]}] },
    { name: 'killer bee',     symbol: 'a', color: CLR_YELLOW,   level: 1, speed: 18, ac: -1, mr: 0, hp: [1,6], attacks: [{dmg: [1,3], special: 'poison'}] },
    { name: 'snake',          symbol: 'S', color: CLR_BROWN,    level: 4, speed: 15, ac: 3, mr: 0, hp: [3,6], attacks: [{dmg: [1,6]},{dmg: [0,0], special: 'poison'}] },
    { name: 'hill orc',       symbol: 'o', color: CLR_YELLOW,   level: 2, speed: 9,  ac: 6, mr: 0, hp: [2,6], attacks: [{dmg: [1,6]}] },
    { name: 'wolf',           symbol: 'd', color: CLR_BROWN,    level: 2, speed: 12, ac: 4, mr: 0, hp: [2,8], attacks: [{dmg: [2,4]}] },
    { name: 'centipede',      symbol: 's', color: CLR_YELLOW,   level: 2, speed: 4,  ac: 3, mr: 0, hp: [2,4], attacks: [{dmg: [1,3], special: 'poison'}] },
];

// Create a monster on the map
// C ref: makemon.c makemon()
export function createMonster(map, typeOrNull, x, y, depth) {
    let type;

    if (typeOrNull) {
        type = typeOrNull;
    } else {
        // Choose a random monster appropriate for depth
        // C ref: makemon.c -- monster selection based on difficulty
        type = selectMonsterType(depth);
    }

    if (!type) return null;

    // If no position specified, find a random one
    if (x === undefined || y === undefined) {
        const pos = findMonsterSpot(map);
        if (!pos) return null;
        x = pos.x;
        y = pos.y;
    }

    // Create the monster instance
    // C ref: makemon.c -- struct monst initialization
    const mon = {
        type: type,
        name: type.name,
        displayChar: type.symbol,
        displayColor: type.color,
        mx: x,
        my: y,
        mhp: d(type.hp[0], type.hp[1]),
        mhpmax: 0,
        mlevel: type.level,
        mac: type.ac,
        speed: type.speed,
        movement: 0, // C ref: makemon.c — *mtmp = cg.zeromonst (zero-init, not NORMAL_SPEED)
        attacks: type.attacks,
        peaceful: false,
        tame: false,
        flee: false,
        confused: false,
        stunned: false,
        blind: false,
        sleeping: rn2(3) === 0,  // 1/3 chance of starting asleep
        dead: false,
        passive: type.passive || false,
        // C ref: monst.h — coord mtrack[MTSZ] for backtracking avoidance
        mtrack: [{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],
    };
    mon.mhpmax = mon.mhp;

    // Don't place on player or existing monster
    if (map.monsterAt(x, y)) return null;

    map.monsters.unshift(mon); // C ref: fmon prepend (LIFO order)
    return mon;
}

// Select a random monster type appropriate for depth
// C ref: makemon.c select_newcham_form() and difficulty-based selection
function selectMonsterType(depth) {
    // C ref: makemon.c -- monster difficulty is roughly (monster level) vs (dungeon depth)
    // On level 1, mostly level-0 monsters with occasional level 1
    const maxLevel = Math.floor(depth / 2) + depth;
    const candidates = monsterTypes.filter(m => m.level <= maxLevel);
    if (candidates.length === 0) return monsterTypes[0];

    // Weight towards lower-level monsters (more appropriate for depth)
    // C ref: makemon.c -- picks based on frequency and difficulty
    // Give preference to monsters whose level is close to depth
    const weighted = [];
    for (const m of candidates) {
        // Weight: monsters near the depth level appear more often
        const diff = Math.abs(m.level - depth);
        const weight = Math.max(1, 4 - diff);
        for (let i = 0; i < weight; i++) {
            weighted.push(m);
        }
    }
    return weighted[rn2(weighted.length)];
}

// Find a suitable spot for a monster on the map
function findMonsterSpot(map) {
    for (let attempts = 0; attempts < 200; attempts++) {
        const x = rn1(COLNO - 4, 2);
        const y = rn1(ROWNO - 4, 2);
        const loc = map.at(x, y);
        if (loc && ACCESSIBLE(loc.typ) && !map.monsterAt(x, y)) {
            return { x, y };
        }
    }
    return null;
}

// Populate a level with monsters
// C ref: makemon.c -- called from mklev.c
export function populateLevel(map, depth) {
    // Number of initial monsters: roughly 5-8 on level 1, more on deeper levels
    // C ref: mklev.c -- monster creation loop (typically 5-12 depending on depth)
    const numMonsters = rn1(4, 3 + Math.floor(depth / 2));

    for (let i = 0; i < numMonsters; i++) {
        createMonster(map, null, undefined, undefined, depth);
    }
}
