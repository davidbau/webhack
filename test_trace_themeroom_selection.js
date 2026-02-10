// test_trace_themeroom_selection.js - Trace which theme rooms are selected

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

console.log('=== Tracing Theme Room Selection at Depth 2 ===\n');

const beforeDepth2 = getRngLog().length;
const map2 = makelevel(2);

const fullLog = getRngLog();
const depth2Log = fullLog.slice(beforeDepth2);

// Theme room generation pattern:
// 1. rnd_rect() returns a rect → rn2(rect_count)
// 2. Either vault check (if nroom >= 6) → rn2(2)
// 3. Or themerooms_generate → reservoir sampling with many rn2() calls
// 4. If theme room selected → rn2(100) build_room check before create_room

console.log('Looking for theme room selection patterns:\n');
console.log('Pattern: rn2(1) [rnd_rect] → ... → rn2(100) [build check]\n');

let i = 0;
let iteration = 0;
while (i < Math.min(depth2Log.length, 300)) {
    const entry = depth2Log[i];
    const compact = entry.replace(/^\d+\s+/, '');

    // Look for rnd_rect success (rn2(1)=0 or rn2(2)=0, etc)
    if (compact.match(/^rn2\(\d+\)=0/) && i < 100) {
        console.log(`\n--- Makerooms iteration ${++iteration} ---`);
        console.log(`[${i}] ${compact} <- Possible rnd_rect SUCCESS`);

        // Look ahead for build_room checks (rn2(100))
        let buildChecks = [];
        for (let j = i + 1; j < Math.min(i + 50, depth2Log.length); j++) {
            const ahead = depth2Log[j].replace(/^\d+\s+/, '');
            if (ahead.startsWith('rn2(100)=')) {
                buildChecks.push({ idx: j, entry: ahead });
            }
            // Stop at next rnd_rect attempt
            if (ahead.match(/^rn2\(\d+\)=/) && j > i + 5) {
                break;
            }
        }

        if (buildChecks.length > 0) {
            console.log(`  Found ${buildChecks.length} build_room check(s):`);
            for (const bc of buildChecks) {
                console.log(`  [${bc.idx}] ${bc.entry}`);
            }
        } else {
            console.log(`  No build_room checks found (theme room failed?)`);
        }

        i += 40; // Skip ahead
    }
    i++;
}

console.log(`\n\nFinal: ${map2.nroom} rooms, ${map2.nsubroom || 0} subrooms`);
