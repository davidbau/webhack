// test_trace_nroom_growth.js - Trace nroom value as rooms are added

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';

// Monkey-patch by modifying the imported module
let roomAdditions = [];

// Read dungeon.js to add logging
import { readFileSync, writeFileSync } from 'fs';

const dungeonPath = './js/dungeon.js';
const original = readFileSync(dungeonPath, 'utf8');

// Add logging to add_room_to_map
const patched = original.replace(
    'map.nroom = (map.nroom || 0) + 1;',
    `map.nroom = (map.nroom || 0) + 1;
    const rngCallNum = (typeof getRngLog === 'function' ? getRngLog().length : 0);
    console.log(\`[ROOM_ADD] nroom now \${map.nroom} at RNG call \${rngCallNum}\`);`
);

if (patched === original) {
    console.log('❌ Could not patch add_room_to_map');
    process.exit(1);
}

// Write patched version temporarily
const patchedPath = './js/dungeon_patched.js';
writeFileSync(patchedPath, patched);

// Import patched version
const { makelevel } = await import('./js/dungeon_patched.js');

// Initialize
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
await import('./js/dungeon_patched.js').then(m => m.initLevelGeneration());

console.log('=== Tracing nroom Growth ===\n');

const map1 = makelevel(1);

console.log(`\nFinal: ${map1.nroom} rooms at RNG call ${getRngLog().length}`);
console.log(`\nDivergence is at call 1172, so we need to see why nroom=4 instead of 5`);

// Cleanup
import { unlinkSync } from 'fs';
unlinkSync(patchedPath);
