#!/usr/bin/env node
/**
 * Debug seed 4 trace - Compare C NetHack trace against JS implementation
 *
 * This script:
 * 1. Loads the C trace from seed4_selfplay_150turns.session.json
 * 2. Runs JS NetHack with seed 4
 * 3. Compares RNG calls at each step
 * 4. Identifies where JS diverges from C
 */

import fs from 'fs';
import { makelevel, initLevelGeneration } from '../../js/dungeon.js';
import { initRng, enableRngLog, getRngLog, getRngCallCount, rn2 } from '../../js/rng.js';

const TRACE_FILE = 'test/comparison/sessions/seed4_selfplay_150turns.session.json';

// Load C trace
console.log('Loading C NetHack trace...');
const trace = JSON.parse(fs.readFileSync(TRACE_FILE, 'utf8'));

console.log(`Loaded trace: seed ${trace.seed}`);
console.log(`  Chargen steps: ${trace.chargen.length}`);
console.log(`  Startup RNG calls: ${trace.startup.rngCalls}`);
console.log(`  Gameplay steps: ${trace.steps.length}`);
console.log('');

// Initialize JS with same seed
console.log('Initializing JS NetHack with seed 4...');
initRng(4);

// Simulate the gender selection RNG call that happens in C before init_objects
// C: rn2(1)=0 @ pick_gend(role.c:1157)
const genderCall = rn2(1);
console.log(`Simulated gender selection: rn2(1)=${genderCall}`);

enableRngLog(false); // Enable RNG logging without tags

// Initialize objects (happens during chargen in C)
console.log('Initializing objects...');
initLevelGeneration(11); // 11 = ROLE_VALKYRIE (matches C trace)

// Generate level
console.log('Generating level at depth 1...');
const level = makelevel(1);

// Get RNG log
const jsRngLog = getRngLog();
const jsStartupCalls = getRngCallCount();

console.log(`JS startup RNG calls: ${jsStartupCalls}`);
console.log(`C startup RNG calls: ${trace.startup.rngCalls}`);
console.log(`Difference: ${jsStartupCalls - trace.startup.rngCalls}`);
console.log('');

// Parse JS RNG calls from log (format: "123 rn2(5)=3" or "rn2(5)=3")
const jsRngCalls = [];
for (const entry of jsRngLog) {
    const match = entry.match(/^(?:\d+\s+)?(rn2|rnd|rn1|d)\((\d+)(?:,(\d+))?\)=(\d+)/);
    if (match) {
        jsRngCalls.push({
            fn: match[1],
            arg: parseInt(match[2]),
            arg2: match[3] ? parseInt(match[3]) : undefined,
            result: parseInt(match[4]),
            call: jsRngCalls.length + 1,
        });
    }
}

// Parse C RNG calls from startup
const cRngCalls = [];
let chargenCalls = 0;
if (trace.chargen) {
    for (const step of trace.chargen) {
        if (step.rng) chargenCalls += step.rng.length;
    }
}

console.log(`C chargen RNG calls: ${chargenCalls}`);

if (trace.startup.rng) {
    for (const entry of trace.startup.rng) {
        const match = entry.match(/^(rn2|rnd|rn1|d)\((\d+)(?:,(\d+))?\)=(\d+)/);
        if (match) {
            cRngCalls.push({
                fn: match[1],
                arg: parseInt(match[2]),
                arg2: match[3] ? parseInt(match[3]) : undefined,
                result: parseInt(match[4]),
                call: cRngCalls.length + 1,
            });
        }
    }
}

// Determine where level generation starts in C trace
// Chargen used 1 call for role selection, then level gen started
const cLevelGenStartIdx = 1; // Skip 1 chargen call
const cLevelGenCalls = cRngCalls.slice(cLevelGenStartIdx);

console.log(`Parsed ${jsRngCalls.length} JS RNG calls from log`);
console.log(`Parsed ${cRngCalls.length} C RNG calls total (${cLevelGenCalls.length} after skipping ${cLevelGenStartIdx} chargen calls)`);
console.log('');

// Compare call-by-call (skip chargen calls in C)
console.log('=== CALL-BY-CALL COMPARISON (Level Generation Only) ===');
const maxCalls = Math.max(jsRngCalls.length, cLevelGenCalls.length);
let firstMismatch = -1;
let matchingCalls = 0;

for (let i = 0; i < Math.min(maxCalls, 500); i++) {
    const jCall = jsRngCalls[i];
    const cCall = cLevelGenCalls[i];

    if (!jCall && !cCall) break;

    const match = jCall && cCall &&
                  jCall.fn === cCall.fn &&
                  jCall.arg === cCall.arg &&
                  jCall.result === cCall.result;

    if (match) {
        matchingCalls++;
        if (i < 20 || i % 10 === 0) {
            console.log(`  [${String(i + 1).padStart(4)}] ✓ ${jCall.fn}(${jCall.arg})=${jCall.result}`);
        }
    } else {
        if (firstMismatch === -1) firstMismatch = i;
        console.log(`  [${String(i + 1).padStart(4)}] ✗ MISMATCH`);
        if (jCall) console.log(`         JS: ${jCall.fn}(${jCall.arg})=${jCall.result}`);
        else console.log(`         JS: <missing>`);
        if (cCall) console.log(`         C:  ${cCall.fn}(${cCall.arg})=${cCall.result}`);
        else console.log(`         C:  <missing>`);

        // Show context around first mismatch
        if (i === firstMismatch && i < maxCalls - 5) {
            console.log(`\n  Next 5 calls:`);
            for (let j = i + 1; j < Math.min(i + 6, maxCalls); j++) {
                const jc = jsRngCalls[j];
                const cc = cRngCalls[j];
                const m = jc && cc && jc.fn === cc.fn && jc.arg === cc.arg && jc.result === cc.result;
                console.log(`  [${String(j + 1).padStart(4)}] ${m ? '✓' : '✗'} JS:${jc ? `${jc.fn}(${jc.arg})=${jc.result}` : 'missing'} C:${cc ? `${cc.fn}(${cc.arg})=${cc.result}` : 'missing'}`);
            }
        }

        if (i - firstMismatch > 10) {
            console.log(`  ... (stopping after 10 mismatches)`);
            break;
        }
    }
}

console.log('');
console.log('=== SUMMARY ===');
console.log(`Matching calls: ${matchingCalls}/${Math.min(jsRngCalls.length, cLevelGenCalls.length)}`);
if (firstMismatch >= 0) {
    console.log(`First mismatch at call ${firstMismatch + 1}`);
} else {
    console.log(`All calls match!`);
}
console.log(`JS total: ${jsRngCalls.length} calls`);
console.log(`C level gen: ${cLevelGenCalls.length} calls (${cRngCalls.length} total - ${cLevelGenStartIdx} chargen)`);
console.log(`Gap: ${jsRngCalls.length - cLevelGenCalls.length} calls`);

// Save detailed comparison
const comparison = {
    seed: 4,
    jsStartupCalls,
    cStartupCalls: trace.startup.rngCalls,
    cChargenCalls: chargenCalls,
    cLevelGenStart: cLevelGenStartIdx,
    matchingCalls,
    firstMismatch: firstMismatch >= 0 ? firstMismatch + 1 : null,
    gap: jsRngCalls.length - cLevelGenCalls.length,
    jsCalls: jsRngCalls.slice(0, 500),
    cCalls: cLevelGenCalls.slice(0, 500),
};

fs.writeFileSync('debug_seed4_comparison.json', JSON.stringify(comparison, null, 2));
console.log('\nDetailed comparison saved to debug_seed4_comparison.json');
