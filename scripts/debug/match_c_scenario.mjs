#!/usr/bin/env node
// Try to match C's scenario by creating more rooms

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration, init_rect} from './js/dungeon.js';
import {GameMap} from './js/map.js';
import {setLevelContext, clearLevelContext, room, shuffle} from './js/sp_lev.js';

initRng(3);
enableRngLog(false);
rn2(1);
initLevelGeneration(11);

console.log('After init: RNG call', getRngLog().length);

const map = new GameMap();
init_rect();
setLevelContext(map, 1);

// Create multiple rooms until we reach call 340+
for (let i = 0; i < 5; i++) {
    const before = getRngLog().length;
    if (before >= 340) break;
    
    if (i === 1) {
        // Room 1: Pillars (w=10, h=10 with shuffle)
        console.log(`\nRoom ${i}: Pillars at call ${before}`);
        room({ 
            type: "themed", 
            w: 10, 
            h: 10,
            contents: function(rm) {
                const terr = [ "-", "-", "-", "-", "L", "P", "T" ];
                shuffle(terr);
            }
        });
    } else {
        // Other rooms: default
        console.log(`\nRoom ${i}: default at call ${before}`);
        room({ type: "ordinary", filled: 1 });
    }
    
    console.log(`  After: call ${getRngLog().length}, consumed ${getRngLog().length - before}`);
}

clearLevelContext();

const log = getRngLog();
if (log.length > 340) {
    console.log('\n=== RNG calls 335-360 ===');
    for (let i = 335; i <= Math.min(360, log.length - 1); i++) {
        const marker = (i >= 340 && i <= 343) ? ' ← Expected Room creation' :
                       (i >= 344 && i <= 347) ? ' ← MYSTERY' :
                       (i >= 348 && i <= 353) ? ' ← Expected Shuffle' : '';
        console.log(`  [${i}] ${log[i]}${marker}`);
    }
} else {
    console.log(`\nOnly reached call ${log.length - 1}, need to create more rooms`);
}
