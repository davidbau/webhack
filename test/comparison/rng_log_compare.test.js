// test/comparison/rng_log_compare.test.js -- Compare C and JS PRNG call sequences
//
// This test generates RNG call logs from both the C binary and the JS port,
// then compares them to find where the call sequences diverge.
//
// The C log includes calls from o_init, u_init, etc. before level generation.
// The JS log starts at level generation (no startup sequence yet).
// This test documents both the "skip count" (calls to fast-forward past)
// and the first point of divergence in the level generation calls.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { initRng, enableRngLog, getRngLog, disableRngLog, skipRng } from '../../js/rng.js';
import { generateLevel } from '../../js/dungeon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INSTALL_DIR = join(process.env.HOME || '', 'nethack-minimal/games/lib/nethackdir');
const C_BINARY = join(INSTALL_DIR, 'nethack');
const RESULTS_DIR = join(__dirname, 'c-harness/results');
const DUMPMAP_SCRIPT = join(__dirname, 'c-harness/run_dumpmap.py');

function hasCBinary() {
    return existsSync(C_BINARY);
}
function hasTmux() {
    try { execSync('which tmux', { stdio: 'pipe' }); return true; }
    catch { return false; }
}

// Strip " @ file:line" suffixes from C log lines for comparison
function stripFileInfo(line) {
    return line.replace(/ @ .+$/, '');
}

// Parse a log line into { num, func, args, result }
function parseLogLine(line) {
    const m = line.match(/^(\d+) (\w+)\(([^)]*)\) = (-?\d+)/);
    if (!m) return null;
    return { num: parseInt(m[1]), func: m[2], args: m[3], result: parseInt(m[4]) };
}

// Count ISAAC64 consumptions from log lines (for computing skip count).
// Each rn2/rnd = 1, rnl = 1 (its own RND), d(n,x) = n.
// rne/rnz = 0 (sub-calls are logged separately as rn2 entries).
function countIsaac64Calls(lines) {
    let count = 0;
    for (const line of lines) {
        const p = parseLogLine(line);
        if (!p) continue;
        if (p.func === 'rn2' || p.func === 'rnd' || p.func === 'rnl') {
            count += 1;
        } else if (p.func === 'd') {
            const n = parseInt(p.args.split(',')[0]);
            count += n;
        }
        // rne, rnz: their ISAAC64 consumptions are via internal rn2 calls,
        // which are logged separately, so we don't count them here.
    }
    return count;
}

// Generate C RNG log via tmux automation
function generateCRngLog(seed) {
    const rngLogFile = join(RESULTS_DIR, `c_rnglog_seed${seed}.txt`);
    const dumpFile = join(RESULTS_DIR, `c_dump_seed${seed}.txt`);

    try {
        execSync(
            `NETHACK_RNGLOG=${rngLogFile} python3 ${DUMPMAP_SCRIPT} ${seed} ${dumpFile}`,
            { timeout: 30000, stdio: 'pipe' }
        );
        if (existsSync(rngLogFile)) {
            return readFileSync(rngLogFile, 'utf-8').trim().split('\n');
        }
    } catch (e) {
        console.error(`C RNG log generation failed for seed=${seed}: ${e.message}`);
    }
    return null;
}

// Generate JS RNG log
// generateLevel() now handles its own PRNG alignment internally:
//   init_objects() consumes 198 rn2 calls (logged)
//   skipRng(59) consumes 59 ISAAC64 calls (NOT logged)
// So the JS log starts with 198 init_objects calls, then level gen.
function generateJSRngLog(seed) {
    enableRngLog();
    initRng(seed);
    generateLevel(1);
    const log = getRngLog();
    disableRngLog();
    return log;
}

// Number of logged init_objects calls at the start of generateLevel
const JS_INIT_OBJECTS_CALLS = 198;

// Find the first call from a given file in the C log
function findFirstCallFrom(cLines, targetFile) {
    for (let i = 0; i < cLines.length; i++) {
        if (cLines[i].includes(`@ ${targetFile}:`)) return i;
    }
    return -1;
}

describe('PRNG call log comparison', { skip: !hasCBinary() || !hasTmux() }, () => {
    before(() => {
        mkdirSync(RESULTS_DIR, { recursive: true });
    });

    it('generates C RNG log and counts pre-makelevel calls for seed=42', { timeout: 35000 }, () => {
        const cLines = generateCRngLog(42);
        if (!cLines) return; // skip if generation failed

        // Find where mklev.c calls begin
        const mklevStart = findFirstCallFrom(cLines, 'mklev.c');
        assert.ok(mklevStart > 0, 'Should find mklev.c calls in C log');

        // Count ISAAC64 consumptions before mklev
        const preMklevLines = cLines.slice(0, mklevStart);
        const skipCount = countIsaac64Calls(preMklevLines);

        console.log(`C log: ${cLines.length} total calls`);
        console.log(`  Pre-makelevel: ${mklevStart} log entries, ${skipCount} ISAAC64 consumptions`);
        console.log(`  First 5 C calls: ${cLines.slice(0, 5).map(stripFileInfo).join(', ')}`);

        // Files contributing to pre-makelevel calls
        const files = {};
        for (const line of preMklevLines) {
            const m = line.match(/@ (\S+):\d+$/);
            if (m) files[m[1]] = (files[m[1]] || 0) + 1;
        }
        console.log('  Pre-makelevel call sources:', JSON.stringify(files));
    });

    it('compares C and JS RNG logs for seed=42', { timeout: 35000 }, () => {
        const cLines = generateCRngLog(42);
        if (!cLines) return;

        // Find where mklev.c begins and compute skip count
        const mklevStart = findFirstCallFrom(cLines, 'mklev.c');
        const preMklevLines = cLines.slice(0, mklevStart);
        const skipCount = countIsaac64Calls(preMklevLines);

        // Generate JS log — includes init_objects (198 logged calls) then level gen
        const jsLines = generateJSRngLog(42);

        // Skip the init_objects calls at the start of the JS log
        const jsLevelLines = jsLines.slice(JS_INIT_OBJECTS_CALLS);

        // Compare C's mklev portion against JS level gen
        // Filter out rne/rnz/d wrapper lines from C log — JS only logs
        // the internal rn2/rnd calls, not the wrapper functions.
        const cMklevLines = cLines.slice(mklevStart).filter(line => {
            const p = parseLogLine(stripFileInfo(line));
            return p && (p.func === 'rn2' || p.func === 'rnd' || p.func === 'rnl');
        });

        // Find first divergence (two-pointer walk)
        const maxCompare = Math.min(cMklevLines.length, jsLevelLines.length);
        let firstDivergence = -1;
        for (let i = 0; i < maxCompare; i++) {
            const cStripped = stripFileInfo(cMklevLines[i]);
            const cParsed = parseLogLine(cStripped);
            const jsParsed = parseLogLine(jsLevelLines[i]);
            if (!cParsed || !jsParsed) continue;
            // Compare function and args (ignore call number since they differ)
            if (cParsed.func !== jsParsed.func ||
                cParsed.args !== jsParsed.args ||
                cParsed.result !== jsParsed.result) {
                firstDivergence = i;
                break;
            }
        }

        console.log(`\nRNG Log Comparison (seed=42):`);
        console.log(`  C mklev calls: ${cMklevLines.length} (rn2/rnd/rnl only)`);
        console.log(`  JS level gen calls: ${jsLevelLines.length} (after ${JS_INIT_OBJECTS_CALLS} init_objects calls)`);

        if (firstDivergence >= 0) {
            console.log(`  First divergence at call #${firstDivergence + 1}:`);
            const cLine = stripFileInfo(cMklevLines[firstDivergence]);
            const jsLine = jsLevelLines[firstDivergence];
            console.log(`    C:  ${cLine}`);
            console.log(`    JS: ${jsLine}`);
            // Show context around divergence
            const start = Math.max(0, firstDivergence - 2);
            const end = Math.min(maxCompare, firstDivergence + 3);
            console.log(`  Context (C stripped | JS):`);
            for (let i = start; i < end; i++) {
                const marker = i === firstDivergence ? '>>>' : '   ';
                const c = stripFileInfo(cMklevLines[i] || '');
                const j = jsLevelLines[i] || '';
                const match = stripFileInfo(cMklevLines[i] || '') === jsLevelLines[i] ? '=' : '!';
                console.log(`    ${marker} C:${c}`);
                console.log(`    ${marker} J:${j}  [${match}]`);
            }
        } else if (maxCompare > 0) {
            console.log(`  All ${maxCompare} compared calls MATCH!`);
        }
    });
});
