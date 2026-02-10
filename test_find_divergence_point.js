// test_find_divergence_point.js - Find where JS and C diverge in detail

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

function extractRngCalls(log) {
    return log.filter(e => e.length > 0 && e[0] !== '>' && e[0] !== '<')
        .map(e => e.replace(/^\\d+\\s+/, ''));
}

function rngCallPart(entry) {
    const atIdx = entry.indexOf(' @ ');
    return atIdx >= 0 ? entry.substring(0, atIdx) : entry;
}

function isCompositeEntry(entry) {
    return entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d(');
}

// Initialize JS
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();

const beforeMakelevel = getRngLog().length;
const map1 = makelevel(1);

const jsLogRaw = getRngLog().slice(beforeMakelevel);
const jsLog = jsLogRaw.filter(e => {
    const cleaned = e.replace(/^\\d+\\s+/, '');
    return !isCompositeEntry(cleaned);
});

// Load C session
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);
const cLog = extractRngCalls(cDepth1.rng);

console.log('=== Finding First Divergence ===\\n');
console.log(`JS: ${jsLog.length} calls (${jsLogRaw.length} raw)`);
console.log(`C: ${cLog.length} calls\\n`);

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
    console.log(`First divergence at index ${divergeIdx}:\\n`);
    console.log(`  JS: ${jsLog[divergeIdx]}`);
    console.log(`  C:  ${cLog[divergeIdx]}\\n`);

    console.log('Context (10 calls before and after):\\n');

    console.log('JS:');
    for (let i = Math.max(0, divergeIdx - 10); i <= Math.min(jsLog.length - 1, divergeIdx + 10); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} [${i}] ${jsLog[i]}`);
    }

    console.log('\\nC:');
    for (let i = Math.max(0, divergeIdx - 10); i <= Math.min(cLog.length - 1, divergeIdx + 10); i++) {
        const marker = i === divergeIdx ? '>>>' : '   ';
        console.log(`${marker} [${i}] ${cLog[i]}`);
    }
} else {
    console.log('✅ No divergence found in overlapping region!');
    console.log(`Matched calls: ${Math.min(jsLog.length, cLog.length)}`);

    if (jsLog.length > cLog.length) {
        console.log(`\\nJS has ${jsLog.length - cLog.length} extra calls after C ends.`);
    } else if (cLog.length > jsLog.length) {
        console.log(`\\nC has ${cLog.length - jsLog.length} extra calls after JS ends.`);
    }
}
