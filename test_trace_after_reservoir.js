// test_trace_after_reservoir.js - See what happens after reservoir sampling

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, wallification, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { simulatePostLevelInit } from './js/u_init.js';
import { Player } from './js/player.js';

// Initialize
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();

// Generate depth 1
const map1 = makelevel(1);
wallification(map1);
const player = new Player();
player.initRole(11);
if (map1.upstair) {
    player.x = map1.upstair.x;
    player.y = map1.upstair.y;
}
simulatePostLevelInit(player, map1, 1);

console.log('=== First Reservoir Sampling Sequence at Depth 2 ===\n');

const beforeDepth2 = getRngLog().length;
const map2 = makelevel(2);

const fullLog = getRngLog();
const depth2Log = fullLog.slice(beforeDepth2);

// Find first reservoir sampling
for (let i = 0; i < depth2Log.length; i++) {
    const entry = depth2Log[i];
    const match = entry.match(/rn2\((\d+)\)=(\d+)/);

    if (match && parseInt(match[1]) === 1000) {
        console.log('Found reservoir sampling start at index', i);
        console.log('\nRNG calls:');

        // Show the next 15 calls
        for (let j = i; j < Math.min(i + 15, depth2Log.length); j++) {
            console.log(`  [${j}] ${depth2Log[j]}`);
        }

        break;
    }
}
