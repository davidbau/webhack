#!/usr/bin/env node
/**
 * Detailed RNG comparison tool for debugging JS vs C NetHack divergence
 * Shows side-by-side comparison with context around divergence points
 */

import { enableRngLog, getRngLog, disableRngLog, initRng } from './js/rng.js';
import { makelevel, initLevelGeneration } from './js/dungeon.js';
import fs from 'fs';

const SEED = 72;
const DEPTH = 1;
const CONTEXT = 10; // Lines of context around divergence

// Load C trace
const cSession = JSON.parse(fs.readFileSync('test/comparison/maps/seed72_maps_c.session.json', 'utf8'));
const cRng = cSession.levels[0].rng;

console.log(`\n${'='.repeat(80)}`);
console.log(`RNG COMPARISON: Seed ${SEED}, Depth ${DEPTH}`);
console.log(`${'='.repeat(80)}\n`);

// Generate JS trace
initRng(SEED);
enableRngLog();
// Use role 2 (Monk) to avoid Archeologist/Wizard rn2(100) call
// C's random pick for seed 72 selected a non-Arch/Wiz role
initLevelGeneration(2);
const map = makelevel(DEPTH, 0, DEPTH);
const jsLog = getRngLog();
disableRngLog();

// Parse JS log into same format as C
const jsRng = jsLog.map(entry => {
    // Match both rn2() and rnd()
    const match = entry.match(/(rn[d2])\((\d+)\)=(\d+)/);
    if (match) {
        return `${match[1]}(${match[2]})=${match[3]}`;
    }
    return entry;
});

console.log(`C NetHack:  ${cRng.length.toString().padStart(4)} RNG calls`);
console.log(`JS version: ${jsRng.length.toString().padStart(4)} RNG calls`);
console.log(`Difference: ${Math.abs(cRng.length - jsRng.length).toString().padStart(4)} calls\n`);

// Find all divergence points
const divergences = [];
const maxCompare = Math.min(cRng.length, jsRng.length);

for (let i = 0; i < maxCompare; i++) {
    const cCall = cRng[i].split(' @ ')[0];
    const jsCall = jsRng[i];

    if (cCall !== jsCall) {
        divergences.push({
            index: i,
            cCall: cRng[i],
            jsCall: jsRng[i]
        });

        // Only track first divergence in each "region" (within 5 calls)
        if (divergences.length > 1) {
            const lastDiv = divergences[divergences.length - 2];
            if (i - lastDiv.index < 5) {
                continue; // Skip nearby divergences
            }
        }

        if (divergences.length >= 5) break; // Limit to first 5 divergence regions
    }
}

if (divergences.length === 0 && cRng.length === jsRng.length) {
    console.log(`✅ PERFECT MATCH! All ${cRng.length} RNG calls match exactly.\n`);
    process.exit(0);
}

// Show first few calls that DO match
console.log(`First 10 matching calls:`);
let matchCount = 0;
for (let i = 0; i < Math.min(50, maxCompare); i++) {
    const cCall = cRng[i].split(' @ ')[0];
    const jsCall = jsRng[i];

    if (cCall === jsCall) {
        console.log(`  ${i.toString().padStart(4)}: ${cCall}`);
        matchCount++;
        if (matchCount >= 10) break;
    }
}
console.log();

// Show each divergence with context
divergences.forEach((div, idx) => {
    console.log(`${'─'.repeat(80)}`);
    console.log(`DIVERGENCE #${idx + 1} at call ${div.index}:`);
    console.log(`${'─'.repeat(80)}`);

    const start = Math.max(0, div.index - CONTEXT);
    const end = Math.min(maxCompare, div.index + CONTEXT + 1);

    console.log(`  ${'IDX'.padStart(4)} | ${'C NetHack'.padEnd(50)} | ${'JS Version'.padEnd(40)}`);
    console.log(`  ${'-'.repeat(4)}-+-${'-'.repeat(50)}-+-${'-'.repeat(40)}`);

    for (let i = start; i < end; i++) {
        const cCall = cRng[i];
        const jsCall = jsRng[i] || 'MISSING';
        const cCallShort = cCall.split(' @ ')[0];
        const match = (cCallShort === jsCall) ? ' ' : '→';

        console.log(`${match} ${i.toString().padStart(4)} | ${cCall.padEnd(50)} | ${jsCall}`);
    }
    console.log();
});

// Summary
console.log(`${'='.repeat(80)}`);
console.log(`SUMMARY:`);
console.log(`${'='.repeat(80)}`);
console.log(`  Total divergences found: ${divergences.length} (showing context for each)`);
console.log(`  First divergence at call: ${divergences[0]?.index ?? 'N/A'}`);
console.log(`  Rooms created: ${map.nroom} (JS)`);
console.log();

// Show what's at the divergence point
if (divergences.length > 0) {
    const first = divergences[0];
    console.log(`First divergence analysis:`);
    console.log(`  C expects: ${first.cCall}`);
    console.log(`  JS called: ${first.jsCall}`);
    console.log();
}
