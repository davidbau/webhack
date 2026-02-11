#!/usr/bin/env node
// Focus on the specific divergence: calls 340-355 for Room 1 (Pillars)

import {initRng, enableRngLog, getRngLog, rn2} from './js/rng.js';
import {initLevelGeneration, init_rect} from './js/dungeon.js';
import {GameMap} from './js/map.js';
import {setLevelContext, clearLevelContext} from './js/sp_lev.js';

initRng(3);
enableRngLog(false);
rn2(1);
initLevelGeneration(11);

console.log('Starting at RNG call', getRngLog().length);

// Create first room (should use calls up to ~325)
const map = new GameMap();
init_rect();
setLevelContext(map, 1);

// Import room creation
import * as sp_lev from './js/sp_lev.js';

// Create one "default" room first (this matches the test scenario)
console.log('\n=== Room 0 (default) ===');
const r0Before = getRngLog().length;
sp_lev.room({ type: "ordinary", filled: 1 });
console.log(`Consumed ${getRngLog().length - r0Before} RNG calls, now at call ${getRngLog().length}`);

// Create Pillars room (w=10, h=10, with shuffle contents)
console.log('\n=== Room 1 (Pillars) ===');
const r1Before = getRngLog().length;

// Simulate what the Pillars themed room does
import {shuffle} from './js/sp_lev.js';
sp_lev.room({ 
    type: "themed", 
    w: 10, 
    h: 10,
    contents: function(rm) {
        console.log('  Pillars contents executing...');
        const terr = [ "-", "-", "-", "-", "L", "P", "T" ];
        const shuffleBefore = getRngLog().length;
        shuffle(terr);
        console.log(`  Shuffle consumed ${getRngLog().length - shuffleBefore} calls`);
    }
});

console.log(`Room 1 total consumed ${getRngLog().length - r1Before} RNG calls`);
console.log(`Now at RNG call ${getRngLog().length}`);

clearLevelContext();

// Show calls 340-355
const log = getRngLog();
console.log('\n=== RNG calls 335-360 ===');
for (let i = 335; i <= 360 && i < log.length; i++) {
    const marker = (i >= 340 && i <= 343) ? ' ← Room 1 creation' :
                   (i >= 344 && i <= 347) ? ' ← MYSTERY' :
                   (i >= 348 && i <= 353) ? ' ← Shuffle' : '';
    console.log(`  [${i}] ${log[i]}${marker}`);
}
