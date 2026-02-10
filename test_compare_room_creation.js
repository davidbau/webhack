// test_compare_room_creation.js - Compare JS vs C room creation patterns

import { initRng, enableRngLog, getRngLog } from './js/rng.js';
import { initLevelGeneration, makelevel, setGameSeed } from './js/dungeon.js';
import { initrack } from './js/monmove.js';
import { readFileSync } from 'fs';

function extractRngCalls(log) {
    return log.filter(e => e.length > 0 && e[0] !== '>' && e[0] !== '<')
        .map(e => e.replace(/^\\d+\\s+/, '').replace(/ @ .*$/, ''));
}

function findRoomCreationEvents(rngLog) {
    const events = [];
    let i = 0;

    while (i < rngLog.length) {
        const entry = rngLog[i];

        // Look for vault check (rn2(2) after likely rnd_rect)
        if (entry.includes('rn2(2)=')) {
            const match = entry.match(/rn2\\(2\\)=(\\d)/);
            if (match) {
                const val = parseInt(match[1]);
                // Check if next call is reservoir sampling (indicating vault check)
                if (i + 1 < rngLog.length && rngLog[i + 1].includes('rn2(1000)=')) {
                    events.push({ index: i, type: 'vault_check', result: val, created: val === 0 || val === 1 });
                    i += 2;
                    continue;
                } else {
                    events.push({ index: i, type: 'vault_attempt', result: val, created: false });
                }
            }
        }

        // Look for reservoir sampling start (theme room generation)
        if (entry.includes('rn2(1000)=')) {
            events.push({ index: i, type: 'theme_room_attempt', created: false });
            // Skip the reservoir sampling sequence (30 calls)
            i += 30;
            continue;
        }

        // Look for rn2(100) which is the build_room check
        if (entry.includes('rn2(100)=')) {
            const match = entry.match(/rn2\\(100\\)=(\\d+)/);
            if (match) {
                const val = parseInt(match[1]);
                events.push({ index: i, type: 'build_room', result: val, created: true });
            }
        }

        i++;
    }

    return events;
}

// Initialize JS
initrack();
enableRngLog();
initRng(163);
setGameSeed(163);
initLevelGeneration();

const beforeMakelevel = getRngLog().length;
const map1 = makelevel(1);
const afterMakelevel = getRngLog().length;

const jsLog = getRngLog().slice(beforeMakelevel, afterMakelevel);
const jsLogCleaned = extractRngCalls(jsLog);

// Load C session
const cSession = JSON.parse(readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const cDepth1 = cSession.levels.find(l => l.depth === 1);
const cLog = cDepth1.rng;
const cLogCleaned = extractRngCalls(cLog);

console.log('=== Room Creation Comparison (Depth 1, Seed 163) ===\\n');
console.log(`JS: ${map1.nroom} rooms, ${map1.nsubroom || 0} subrooms`);
console.log(`C RNG calls: ${cLogCleaned.length}`);
console.log(`JS RNG calls: ${jsLogCleaned.length}\\n`);

// Find room creation events
console.log('JS room creation events:');
const jsEvents = findRoomCreationEvents(jsLogCleaned);
const jsRoomCreations = jsEvents.filter(e => e.created);
console.log(`  Total events: ${jsEvents.length}`);
console.log(`  Rooms created: ${jsRoomCreations.length}`);

console.log('\\nC room creation events:');
const cEvents = findRoomCreationEvents(cLogCleaned);
const cRoomCreations = cEvents.filter(e => e.created);
console.log(`  Total events: ${cEvents.length}`);
console.log(`  Rooms created: ${cRoomCreations.length}`);

console.log('\\n=== Detailed Event Comparison ===\\n');

// Show first 10 events side-by-side
for (let i = 0; i < Math.min(10, Math.max(jsEvents.length, cEvents.length)); i++) {
    const jsE = jsEvents[i] || {};
    const cE = cEvents[i] || {};

    console.log(`Event ${i + 1}:`);
    console.log(`  JS: ${jsE.type || 'none'} ${jsE.created ? '✓ CREATED' : ''}`);
    console.log(`  C:  ${cE.type || 'none'} ${cE.created ? '✓ CREATED' : ''}`);

    if (jsE.type !== cE.type) {
        console.log(`  ⚠️  DIVERGENCE!`);
    }
    console.log();
}
