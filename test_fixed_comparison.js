// test_fixed_comparison.js - Fixed comparison with correct regex

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

function rngCallPart(entry) {
    let cleaned = entry.replace(/^\d+\s+/, ''); // Remove call number prefix
    const atIdx = cleaned.indexOf(' @ ');
    cleaned = atIdx >= 0 ? cleaned.substring(0, atIdx) : cleaned;
    return cleaned.trim();
}

function isCompositeEntry(entry) {
    return entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d(');
}

// Initialize
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();
const map1 = makelevel(1);

const jsLogRaw = getRngLog();
const jsLog = jsLogRaw.filter(e => {
    const cleaned = e.replace(/^\d+\s+/, '');
    return !isCompositeEntry(cleaned);
});

// Load C session
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);
const cLog = cDepth1.rng.filter(e => e.length > 0 && e[0] !== '>' && e[0] !== '<');

console.log('=== Full Depth 1 Comparison ===\n');
console.log(`JS: ${jsLog.length} calls (${jsLogRaw.length} raw)`);
console.log(`C: ${cLog.length} calls\n`);
console.log(`JS final map: ${map1.nroom} rooms, ${map1.nsubroom || 0} subrooms\n`);

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
    console.log(`❌ First divergence at index ${divergeIdx}:\n`);
    console.log(`  JS: ${rngCallPart(jsLog[divergeIdx])}`);
    console.log(`  C:  ${rngCallPart(cLog[divergeIdx])}\n`);

    console.log('Context (10 before/after):\n');

    console.log('JS:');
    for (let i = Math.max(0, divergeIdx - 10); i <= Math.min(jsLog.length - 1, divergeIdx + 10); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} [${i}] ${rngCallPart(jsLog[i])}`);
    }

    console.log('\nC:');
    for (let i = Math.max(0, divergeIdx - 10); i <= Math.min(cLog.length - 1, divergeIdx + 10); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} [${i}] ${rngCallPart(cLog[i])}`);
    }
} else {
    console.log('✅ No divergence in overlapping region!');
    console.log(`Matched: ${Math.min(jsLog.length, cLog.length)} calls\n`);

    if (jsLog.length < cLog.length) {
        const missing = cLog.length - jsLog.length;
        console.log(`C has ${missing} extra calls after JS ends:\n`);
        for (let i = jsLog.length; i < Math.min(jsLog.length + 20, cLog.length); i++) {
            console.log(`  [${i}] ${rngCallPart(cLog[i])}`);
        }
    }
}
