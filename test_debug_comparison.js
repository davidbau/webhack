// test_debug_comparison.js - Debug the string comparison

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

// Initialize
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();
const map1 = makelevel(1);

const jsLogRaw = getRngLog();
const jsLog = jsLogRaw.filter(e => {
    const cleaned = e.replace(/^\\d+\\s+/, '');
    return !isCompositeEntry(cleaned);
});

// Load C session
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);
const cLog = cDepth1.rng.filter(e => e.length > 0 && e[0] !== '>' && e[0] !== '<');

console.log('=== Debug First 5 Comparisons ===\\n');

for (let i = 0; i < Math.min(5, jsLog.length, cLog.length); i++) {
    const jsRaw = jsLog[i];
    const cRaw = cLog[i];
    const jsCleaned = rngCallPart(jsRaw);
    const cCleaned = rngCallPart(cRaw);

    console.log(`Index ${i}:`);
    console.log(`  JS raw: "${jsRaw}"`);
    console.log(`  JS cleaned: "${jsCleaned}"`);
    console.log(`  C raw: "${cRaw}"`);
    console.log(`  C cleaned: "${cCleaned}"`);
    console.log(`  Match: ${jsCleaned === cCleaned}\\n`);

    if (jsCleaned !== cCleaned) {
        console.log(`  ⚠️  FIRST DIVERGENCE!\\n`);
        break;
    }
}
