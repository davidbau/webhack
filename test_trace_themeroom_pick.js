// test_trace_themeroom_pick.js - Trace which theme room is selected

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, wallification, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { simulatePostLevelInit } from './js/u_init.js';
import { Player } from './js/player.js';

// Monkey-patch themerooms_generate to trace execution
import * as themermsModule from './js/themerms.js';
const originalGenerate = themermsModule.themerooms_generate;

let traceCalls = [];
themermsModule.themerooms_generate = function(map, depth) {
    const rngBefore = getRngLog().length;
    const result = originalGenerate.call(this, map, depth);
    const rngAfter = getRngLog().length;
    const rngConsumed = rngAfter - rngBefore;

    traceCalls.push({
        depth,
        result,
        rngBefore,
        rngAfter,
        rngConsumed
    });

    return result;
};

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

console.log('=== Tracing Theme Room Pick at Depth 2 ===\n');

traceCalls = []; // Reset for depth 2
const beforeDepth2 = getRngLog().length;
const map2 = makelevel(2);

console.log(`themerooms_generate called ${traceCalls.length} times at depth 2:\n`);

for (let i = 0; i < traceCalls.length; i++) {
    const call = traceCalls[i];
    console.log(`Call ${i + 1}:`);
    console.log(`  Result: ${call.result}`);
    console.log(`  RNG consumed: ${call.rngConsumed} calls`);

    // Show the RNG calls for this invocation
    const fullLog = getRngLog();
    const callLog = fullLog.slice(call.rngBefore, call.rngAfter);
    console.log(`  RNG trace:`);
    for (const entry of callLog.slice(0, 10)) { // First 10 calls
        console.log(`    ${entry}`);
    }
    if (callLog.length > 10) {
        console.log(`    ... ${callLog.length - 10} more calls`);
    }
    console.log();
}

console.log(`Final: ${map2.nroom} rooms, ${map2.nsubroom || 0} subrooms`);
