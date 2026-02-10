// test_trace_subroom_creation.js - Trace theme room and subroom creation

import { initRng } from './js/rng.js';
import { initLevelGeneration, makelevel, wallification, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { simulatePostLevelInit } from './js/u_init.js';
import { Player } from './js/player.js';

// Monkey-patch create_subroom to trace calls
import * as dungeonModule from './js/dungeon.js';
let subroomAttempts = [];

// Can't monkey-patch ES modules, so let's trace via room structure inspection

// Initialize
initrack();
initRng(163);
setGameSeed(163);
initLevelGeneration();

// Generate depth 1
const map1 = makelevel(1);
wallification(map1);
const player = new Player();
player.initRole(11); // Valkyrie
if (map1.upstair) {
    player.x = map1.upstair.x;
    player.y = map1.upstair.y;
}
simulatePostLevelInit(player, map1, 1);

console.log('=== Depth 2 Theme Room Analysis ===\n');

const map2 = makelevel(2);

console.log(`Total rooms: ${map2.nroom} main, ${map2.nsubroom || 0} sub`);
console.log(`Array length: ${map2.rooms.length}\n`);

// Check each room for subrooms
let totalSubrooms = 0;
for (let i = 0; i < map2.nroom; i++) {
    const room = map2.rooms[i];
    if (room.nsubrooms > 0) {
        console.log(`Room ${i} (rtype=${room.rtype}) has ${room.nsubrooms} subroom(s):`);
        for (let j = 0; j < room.nsubrooms; j++) {
            const sub = room.sbrooms[j];
            if (sub) {
                console.log(`  Sub ${j}: rtype=${sub.rtype}, area=(${sub.lx},${sub.ly})->(${sub.hx},${sub.hy})`);
                totalSubrooms++;
            }
        }
    }
}

console.log(`\nTotal subrooms found via parent.sbrooms[]: ${totalSubrooms}`);
console.log(`map.nsubroom value: ${map2.nsubroom || 0}`);

if (totalSubrooms !== map2.nsubroom) {
    console.log(`\n⚠️  MISMATCH: ${totalSubrooms} subrooms in sbrooms[] but nsubroom=${map2.nsubroom || 0}`);
}

// Check if subrooms are in map.rooms array
if (map2.nsubroom > 0) {
    console.log(`\nChecking map.rooms[${map2.nroom}..${map2.nroom + map2.nsubroom - 1}] for subrooms:`);
    for (let i = map2.nroom; i < map2.nroom + map2.nsubroom; i++) {
        const room = map2.rooms[i];
        if (room) {
            console.log(`  rooms[${i}]: rtype=${room.rtype}, area=(${room.lx},${room.ly})->(${room.hx},${room.hy})`);
        } else {
            console.log(`  rooms[${i}]: undefined`);
        }
    }
}

// Check room types to identify theme rooms
const roomTypes = {};
for (let i = 0; i < map2.nroom; i++) {
    const rtype = map2.rooms[i].rtype;
    roomTypes[rtype] = (roomTypes[rtype] || 0) + 1;
}

console.log(`\nRoom types:`);
for (const [rtype, count] of Object.entries(roomTypes)) {
    const name = getRoomTypeName(parseInt(rtype));
    console.log(`  ${name} (${rtype}): ${count}`);
}

function getRoomTypeName(rtype) {
    const names = {
        0: 'OROOM', 1: 'THEMEROOM', 2: 'COURT', 3: 'SWAMP', 4: 'VAULT',
        5: 'BEEHIVE', 6: 'MORGUE', 7: 'BARRACKS', 8: 'ZOO', 9: 'DELPHI',
        10: 'TEMPLE', 11: 'LEPREHALL', 12: 'COCKNEST', 13: 'ANTHOLE',
        14: 'SHOPBASE', 15: 'ARMORSHOP', 16: 'SCROLLSHOP', 17: 'POTIONSHOP',
        18: 'WEAPONSHOP', 19: 'FOODSHOP', 20: 'RINGSHOP', 21: 'WANDSHOP',
    };
    return names[rtype] || `UNKNOWN(${rtype})`;
}
