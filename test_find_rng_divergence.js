// test_find_rng_divergence.js - Find where RNG diverges with nroom tracking change

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

// Load C session
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);

function isMidlogEntry(entry) {
    return entry.length > 0 && (entry[0] === '>' || entry[0] === '<');
}

function isCompositeEntry(entry) {
    return entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d(');
}

function rngCallPart(entry) {
    // Remove call number prefix (e.g., "123 rn2(5)=3")
    let cleaned = entry.replace(/^\d+\s+/, '');
    // Remove location suffix (e.g., "rn2(5)=3 @ file.c:123")
    const atIdx = cleaned.indexOf(' @ ');
    return atIdx >= 0 ? cleaned.substring(0, atIdx) : cleaned;
}

// Initialize and generate
initrack();
enableRngLog();
initRng(163);
initLevelGeneration();
makelevel(1);

const jsLogRaw = getRngLog();
const cLogRaw = cDepth1.rng.filter(e => !isMidlogEntry(e));

// Filter out composite entries for fair comparison
const jsLog = jsLogRaw.filter(e => {
    const cleaned = e.replace(/^\d+\s+/, '');
    return !isCompositeEntry(cleaned);
});
const cLog = cLogRaw; // C doesn't have composite entries

console.log('JS calls (raw):', jsLogRaw.length);
console.log('JS calls (filtered):', jsLog.length);
console.log('C calls:', cLog.length);
console.log('Difference:', jsLog.length - cLog.length);
console.log();

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
    console.log(`First divergence at index ${divergeIdx}:`);
    console.log(`  JS: ${jsLog[divergeIdx]}`);
    console.log(`  C:  ${cLog[divergeIdx]}`);
    console.log();
    console.log('Context:');
    for (let i = Math.max(0, divergeIdx - 3); i <= Math.min(jsLog.length - 1, divergeIdx + 3); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} JS[${i}]: ${jsLog[i]}`);
    }
    console.log();
    for (let i = Math.max(0, divergeIdx - 3); i <= Math.min(cLog.length - 1, divergeIdx + 3); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} C[${i}]: ${cLog[i]}`);
    }
} else {
    console.log('✅ No divergence found in overlapping calls');
    console.log(`Match count: ${Math.min(jsLog.length, cLog.length)}`);
}
