// test_full_depth1_comparison.js - Compare full depth 1 generation including init

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

function rngCallPart(entry) {
    let cleaned = entry.replace(/^\\d+\\s+/, ''); // Remove call number prefix
    const atIdx = cleaned.indexOf(' @ ');
    cleaned = atIdx >= 0 ? cleaned.substring(0, atIdx) : cleaned;
    return cleaned.trim();
}

function isCompositeEntry(entry) {
    return entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d(');
}

// Initialize - capture EVERYTHING from start
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);

const beforeInit = getRngLog().length; // Should be 0
initLevelGeneration();
const afterInit = getRngLog().length;

const beforeMakelevel = getRngLog().length;
const map1 = makelevel(1);
const afterMakelevel = getRngLog().length;

// Get full JS log including init
const jsLogRaw = getRngLog();
const jsLog = jsLogRaw.filter(e => {
    const cleaned = e.replace(/^\\d+\\s+/, '');
    return !isCompositeEntry(cleaned);
});

// Load C session
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);
const cLog = cDepth1.rng.filter(e => e.length > 0 && e[0] !== '>' && e[0] !== '<');

console.log('=== Full Depth 1 Comparison (including initialization) ===\\n');
console.log(`JS calls:`);
console.log(`  Init: 0-${afterInit} (${afterInit} calls)`);
console.log(`  Makelevel: ${beforeMakelevel}-${afterMakelevel} (${afterMakelevel - beforeMakelevel} calls)`);
console.log(`  Total (filtered): ${jsLog.length}`);
console.log(`  Total (raw): ${jsLogRaw.length}\\n`);

console.log(`C calls: ${cLog.length}\\n`);

console.log(`JS final map: ${map1.nroom} rooms, ${map1.nsubroom || 0} subrooms\\n`);

// Find first divergence
let divergeIdx = -1;
for (let i = 0; i < Math.min(jsLog.length, cLog.length); i++) {
    const jsCall = rngCallPart(jsLog[i]);
    const cCall = rngCallPart(cLog[i]);

    if (jsCall !== cCall) {
        divergeIdx = i;
        break;
    }
}

if (divergeIdx >= 0) {
    console.log(`❌ First divergence at index ${divergeIdx}:\\n`);
    console.log(`  JS: ${jsLog[divergeIdx]}`);
    console.log(`  C:  ${cLog[divergeIdx]}\\n`);

    console.log('Context (5 calls before and after):\\n');

    console.log('JS:');
    for (let i = Math.max(0, divergeIdx - 5); i <= Math.min(jsLog.length - 1, divergeIdx + 5); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} [${i}] ${jsLog[i]}`);
    }

    console.log('\\nC:');
    for (let i = Math.max(0, divergeIdx - 5); i <= Math.min(cLog.length - 1, divergeIdx + 5); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} [${i}] ${cLog[i]}`);
    }
} else {
    console.log('✅ No divergence found in overlapping region!');
    console.log(`Matched calls: ${Math.min(jsLog.length, cLog.length)}\\n`);

    if (jsLog.length > cLog.length) {
        console.log(`JS has ${jsLog.length - cLog.length} extra calls after C ends.`);
    } else if (cLog.length > jsLog.length) {
        console.log(`C has ${cLog.length - jsLog.length} extra calls after JS ends.`);
        console.log('\\nC extra calls:');
        for (let i = jsLog.length; i < Math.min(jsLog.length + 20, cLog.length); i++) {
            console.log(`  [${i}] ${cLog[i]}`);
        }
    }
}
