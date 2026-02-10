#!/usr/bin/env node
/**
 * Oracle Level RNG Alignment Test
 *
 * This test replicates the exact C oracle level generation from wizard mode
 * teleport traces, including full RNG alignment.
 *
 * Strategy:
 * 1. Load C trace with full RNG log
 * 2. Initialize JS RNG with same seed
 * 3. Skip/match initialization RNG calls (calls 1-291)
 * 4. Generate oracle level and compare RNG sequence
 * 5. Compare final terrain grid
 */

import fs from 'fs';
import { initRng, rn2, enableRngLog, getRngLog } from '../../js/rng.js';
import { generate as generateOracle } from '../../js/levels/oracle.js';
import { getLevelState, getTypGrid } from '../../js/sp_lev.js';

function loadCTrace(seed) {
    const path = `./test/comparison/traces/oracle_seed${seed}_c.json`;
    if (!fs.existsSync(path)) {
        console.error(`C trace not found: ${path}`);
        return null;
    }
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function parseJsRngCall(logLine) {
    // Format: "123 rn2(10)=5 @ foo(bar.js:123)"
    const m = logLine.match(/^(\d+)\s+(\w+)\(([^)]*)\)=(\d+)(?:\s+@\s+(.+))?$/);
    if (!m) return null;
    return {
        call: parseInt(m[1]),
        func: m[2],
        args: m[3],
        result: parseInt(m[4]),
        caller: m[5] || null
    };
}

function compareRngSequence(jsLog, cLog, startIdx = 0, count = null) {
    const endIdx = count ? startIdx + count : cLog.length;
    let mismatches = 0;
    let firstMismatch = null;

    for (let i = startIdx; i < endIdx && i < cLog.length; i++) {
        const jsIdx = i - startIdx;
        if (jsIdx >= jsLog.length) {
            console.log(`  ⚠️  JS RNG log ended at ${jsLog.length} calls (C has ${cLog.length})`);
            break;
        }

        const cCall = cLog[i];
        const jsCall = parseJsRngCall(jsLog[jsIdx]);

        if (!jsCall) {
            console.log(`  ⚠️  Failed to parse JS log line: ${jsLog[jsIdx]}`);
            continue;
        }

        // Compare function, args, and result
        if (jsCall.func !== cCall.func ||
            jsCall.args !== cCall.args ||
            jsCall.result !== cCall.result) {

            if (!firstMismatch) {
                firstMismatch = {
                    callNum: i + 1,
                    c: cCall,
                    js: jsCall
                };
            }
            mismatches++;
        }
    }

    return { mismatches, firstMismatch, total: endIdx - startIdx };
}

function compareTypGrid(jsGrid, cGrid) {
    if (!jsGrid || !cGrid) {
        return { matches: 0, mismatches: 0, total: 0 };
    }

    let matches = 0;
    let mismatches = 0;
    let firstMismatch = null;

    for (let y = 0; y < 21; y++) {
        for (let x = 0; x < 80; x++) {
            const jsVal = jsGrid[y]?.[x] ?? 0;
            const cVal = cGrid[y]?.[x] ?? 0;

            if (jsVal === cVal) {
                matches++;
            } else {
                mismatches++;
                if (!firstMismatch) {
                    firstMismatch = { x, y, js: jsVal, c: cVal };
                }
            }
        }
    }

    return { matches, mismatches, total: matches + mismatches, firstMismatch };
}

function skipInitializationCalls(cTrace, count = 291) {
    console.log(`\n  Skipping first ${count} initialization RNG calls...`);

    // For now, just initialize with seed and note that we're not matching init
    // In the future, we could replay these calls to verify perfect alignment

    console.log(`  First init call: ${cTrace.rngLog[0].func}(${cTrace.rngLog[0].args}) = ${cTrace.rngLog[0].result}`);
    console.log(`  @ ${cTrace.rngLog[0].caller}`);
    console.log(`  Last init call: ${cTrace.rngLog[count-1].func}(${cTrace.rngLog[count-1].args}) = ${cTrace.rngLog[count-1].result}`);
    console.log(`  @ ${cTrace.rngLog[count-1].caller}`);

    // Fast-forward RNG state by consuming calls
    for (let i = 0; i < count; i++) {
        const call = cTrace.rngLog[i];
        const arg = parseInt(call.args.split(',')[0]); // Handle "d(n,x)" format
        rn2(arg);
    }
}

function testOracleAlignment(seed) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Oracle RNG Alignment Test - Seed ${seed}`);
    console.log('='.repeat(60));

    // Load C trace
    const cTrace = loadCTrace(seed);
    if (!cTrace) {
        return false;
    }

    console.log(`\nC trace loaded:`);
    console.log(`  RNG calls: ${cTrace.rngLog.length}`);
    console.log(`  Terrain: ${cTrace.typGrid.length}×${cTrace.typGrid[0].length}`);

    // Initialize JS RNG with same seed
    initRng(seed);
    enableRngLog(true);

    // Skip initialization calls to reach oracle generation start
    const oracleStartIdx = 291; // Determined from C trace analysis
    skipInitializationCalls(cTrace, oracleStartIdx);

    enableRngLog(false); // Reset and start fresh log for oracle generation

    // Generate oracle level
    console.log(`\n  Generating oracle level in JS...`);
    try {
        const level = generateOracle();
        const state = getLevelState();
        const jsTypGrid = getTypGrid();
        const jsRngLog = getRngLog();

        console.log(`  JS generation complete:`);
        console.log(`    RNG calls: ${jsRngLog.length}`);
        console.log(`    Rooms: ${state.map?.nroom || 0}`);

        // Compare RNG sequences (oracle generation only)
        console.log(`\n  Comparing RNG sequences...`);
        const cOracleLog = cTrace.rngLog.slice(oracleStartIdx);
        const rngComp = compareRngSequence(jsRngLog, cOracleLog);

        console.log(`    Total calls compared: ${rngComp.total}`);
        console.log(`    Matches: ${rngComp.total - rngComp.mismatches}`);
        console.log(`    Mismatches: ${rngComp.mismatches}`);

        if (rngComp.firstMismatch) {
            const fm = rngComp.firstMismatch;
            console.log(`\n    First mismatch at call ${fm.callNum}:`);
            console.log(`      C:  ${fm.c.func}(${fm.c.args}) = ${fm.c.result}`);
            console.log(`          @ ${fm.c.caller}`);
            console.log(`      JS: ${fm.js.func}(${fm.js.args}) = ${fm.js.result}`);
        }

        // Compare terrain grids
        console.log(`\n  Comparing terrain grids...`);
        const terrainComp = compareTypGrid(jsTypGrid, cTrace.typGrid);

        console.log(`    Total cells: ${terrainComp.total}`);
        console.log(`    Matches: ${terrainComp.matches}`);
        console.log(`    Mismatches: ${terrainComp.mismatches}`);
        console.log(`    Match rate: ${(100 * terrainComp.matches / terrainComp.total).toFixed(2)}%`);

        if (terrainComp.firstMismatch) {
            const fm = terrainComp.firstMismatch;
            console.log(`\n    First terrain mismatch at (${fm.x}, ${fm.y}):`);
            console.log(`      C:  ${fm.c}`);
            console.log(`      JS: ${fm.js}`);
        }

        // Summary
        console.log(`\n${'─'.repeat(60)}`);
        const rngMatch = rngComp.mismatches === 0;
        const terrainMatch = terrainComp.mismatches === 0;

        if (rngMatch && terrainMatch) {
            console.log(`✅ PERFECT ALIGNMENT - RNG and terrain match exactly!`);
            return true;
        } else if (terrainMatch) {
            console.log(`✓ Terrain matches, but RNG sequence diverged`);
            console.log(`  (This is expected if C/JS have different dungeon generation logic)`);
            return false;
        } else {
            console.log(`❌ MISMATCH - Terrain differs from C reference`);
            console.log(`  RNG aligned: ${rngMatch ? 'Yes' : 'No'}`);
            console.log(`  Terrain match rate: ${(100 * terrainComp.matches / terrainComp.total).toFixed(2)}%`);
            return false;
        }

    } catch (err) {
        console.error(`\n❌ Oracle generation failed:`);
        console.error(`   ${err.message}`);
        console.error(err.stack);
        return false;
    }
}

// Run tests
console.log('\nOracle Level RNG Alignment Test Suite');
console.log('Testing exact replication of C oracle generation\n');

const seeds = [42, 1, 100];
let passed = 0;
let failed = 0;

for (const seed of seeds) {
    const result = testOracleAlignment(seed);
    if (result) {
        passed++;
    } else {
        failed++;
    }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Test Summary:`);
console.log(`  Passed: ${passed}/${seeds.length}`);
console.log(`  Failed: ${failed}/${seeds.length}`);
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
