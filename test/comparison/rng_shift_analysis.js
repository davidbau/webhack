#!/usr/bin/env node
// RNG Time-Shift Analysis -- Identifies extra/missing PRNG calls between JS and C.
//
// Usage:
//   node test/comparison/rng_shift_analysis.js [session-glob-or-path]
//   node test/comparison/rng_shift_analysis.js --type=gameplay
//   node test/comparison/rng_shift_analysis.js test/comparison/sessions/seed42_*.json
//
// For each session, replays using the existing infrastructure and compares
// per-step RNG sequences using shift-aware alignment (bounded lookahead)
// to distinguish time-shifts (extra/missing calls) from value mismatches.

import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

import { loadAllSessions } from './session_loader.js';
import { compareRngShiftAware } from './comparators.js';
import { runSessionResult } from './session_test_runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');

function parseArgs() {
    const opts = {
        typeFilter: null,
        sessionPath: null,
        verbose: false,
        top: 20,
    };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--verbose' || arg === '-v') opts.verbose = true;
        else if (arg === '--type' && argv[i + 1]) opts.typeFilter = argv[++i];
        else if (arg.startsWith('--type=')) opts.typeFilter = arg.slice('--type='.length);
        else if (arg === '--top' && argv[i + 1]) opts.top = parseInt(argv[++i], 10);
        else if (arg.startsWith('--top=')) opts.top = parseInt(arg.slice('--top='.length), 10);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node rng_shift_analysis.js [options] [session-path]');
            console.log('');
            console.log('Options:');
            console.log('  --type=TYPE   Filter by session type (chargen, gameplay, interface, map)');
            console.log('  --verbose     Show per-step shift details');
            console.log('  --top=N       Show top N shift-causing functions (default: 20)');
            process.exit(0);
        } else if (!arg.startsWith('--')) {
            opts.sessionPath = arg;
        }
    }
    return opts;
}

function extractFunctionFromRaw(raw) {
    // Raw entries look like: "123 rn2(6)=3 @ funcname:file.js:42"
    // Or just: "rn2(6)=3"
    if (!raw || typeof raw !== 'string') return '(unknown)';
    const atIdx = raw.indexOf(' @ ');
    if (atIdx >= 0) {
        const source = raw.slice(atIdx + 3);
        // source is like "funcname:file.js:42" or "file.js:42"
        const parts = source.split(':');
        return parts[0] || '(unknown)';
    }
    return '(unknown)';
}

function extractFunctionFromStack(stack) {
    if (!Array.isArray(stack) || stack.length === 0) return null;
    // Stack entries are like ">funcname"
    const last = stack[stack.length - 1];
    if (typeof last === 'string' && last.startsWith('>')) {
        return last.slice(1);
    }
    return last || null;
}

function analyzeSession(session, replay, opts) {
    const shifts = [];
    const diffs = [];
    let totalMatched = 0;
    let totalEntries = 0;

    // Analyze startup RNG
    const startupExpected = session.startup?.rng || [];
    const startupActual = replay.startup?.rng || [];
    if (startupExpected.length > 0 || startupActual.length > 0) {
        const cmp = compareRngShiftAware(startupActual, startupExpected);
        totalMatched += cmp.matched;
        totalEntries += cmp.total;
        for (const s of cmp.shifts) {
            shifts.push({ ...s, phase: 'startup', step: 0 });
        }
        for (const d of cmp.diffs) {
            diffs.push({ ...d, phase: 'startup', step: 0 });
        }
    }

    // Analyze per-step RNG
    const expectedSteps = session.meta.type === 'interface'
        ? (Array.isArray(session.raw?.steps) ? session.raw.steps.slice(1) : [])
        : session.steps;
    const actualSteps = replay.steps || [];
    const count = Math.min(expectedSteps.length, actualSteps.length);

    for (let i = 0; i < count; i++) {
        const expected = expectedSteps[i] || {};
        const actual = actualSteps[i] || {};
        const expectedRng = Array.isArray(expected.rng) ? expected.rng : [];
        const actualRng = Array.isArray(actual.rng) ? actual.rng : [];

        if (expectedRng.length === 0 && actualRng.length === 0) continue;

        const cmp = compareRngShiftAware(actualRng, expectedRng);
        totalMatched += cmp.matched;
        totalEntries += cmp.total;
        for (const s of cmp.shifts) {
            shifts.push({ ...s, phase: 'step', step: i + 1 });
        }
        for (const d of cmp.diffs) {
            diffs.push({ ...d, phase: 'step', step: i + 1 });
        }
    }

    return { shifts, diffs, totalMatched, totalEntries };
}

async function replayAndAnalyze(session, opts) {
    // Use the session test runner's replay infrastructure
    const { replaySession } = await import('../../js/replay_core.js');
    const { DEFAULT_FLAGS } = await import('../../js/storage.js');

    // Set up environment for replay
    if (typeof globalThis.window === 'undefined') {
        globalThis.window = { location: { search: '' } };
    }
    if (typeof globalThis.localStorage === 'undefined') {
        const backing = new Map();
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem(key) { return backing.has(key) ? backing.get(key) : null; },
                setItem(key, value) { backing.set(key, String(value)); },
                removeItem(key) { backing.delete(key); },
                clear() { backing.clear(); },
            },
            configurable: true,
        });
    }

    process.env.RNG_LOG_TAGS = '1';

    const replayFlags = { ...DEFAULT_FLAGS };
    replayFlags.color = session.meta?.options?.color !== false;
    replayFlags.bgcolors = true;
    replayFlags.customcolors = true;
    replayFlags.customsymbols = true;
    if (session.meta?.options?.autopickup === false) replayFlags.pickup = false;
    if (session.meta?.options?.rest_on_space) replayFlags.rest_on_space = true;
    replayFlags.verbose = session.meta?.options?.verbose === true;
    replayFlags.DECgraphics = session.meta?.options?.symset === 'DECgraphics';
    if (replayFlags.DECgraphics) {
        replayFlags.symset = 'DECgraphics, active, handler=DEC';
    }

    const replay = await replaySession(session.meta.seed, session.raw, {
        captureScreens: false,
        startupBurstInFirstStep: false,
        flags: replayFlags,
    });

    if (!replay || replay.error) {
        return { error: replay?.error || 'Replay failed' };
    }

    return analyzeSession(session, replay, opts);
}

function printSessionSummary(file, analysis, opts) {
    const { shifts, diffs, totalMatched, totalEntries } = analysis;
    const jsExtra = shifts.filter(s => s.type === 'js_extra');
    const cExtra = shifts.filter(s => s.type === 'c_extra');

    if (shifts.length === 0 && diffs.length === 0) {
        if (opts.verbose) console.log(`  ${file}: all matched (${totalMatched}/${totalEntries})`);
        return;
    }

    console.log(`  ${file}: ${totalMatched}/${totalEntries} matched, ${shifts.length} shifts, ${diffs.length} value diffs`);
    if (jsExtra.length > 0) {
        console.log(`    JS extra: ${jsExtra.length} (JS made calls C didn't — premature/misplaced)`);
    }
    if (cExtra.length > 0) {
        console.log(`    C extra:  ${cExtra.length} (C made calls JS didn't — missing implementation)`);
    }

    if (opts.verbose) {
        const maxShow = 10;
        for (const s of shifts.slice(0, maxShow)) {
            const func = extractFunctionFromRaw(s.raw) || extractFunctionFromStack(s.stack) || '?';
            const loc = s.phase === 'startup' ? 'startup' : `step ${s.step}`;
            console.log(`      ${s.type === 'js_extra' ? 'JS+' : 'C+ '} [${loc}] ${s.entry} (${func})`);
        }
        if (shifts.length > maxShow) {
            console.log(`      ... and ${shifts.length - maxShow} more shifts`);
        }
        for (const d of diffs.slice(0, 5)) {
            const loc = d.phase === 'startup' ? 'startup' : `step ${d.step}`;
            console.log(`      DIFF [${loc}] JS=${d.js} C=${d.session}`);
        }
        if (diffs.length > 5) {
            console.log(`      ... and ${diffs.length - 5} more value diffs`);
        }
    }
}

function printAggregate(allResults, opts) {
    const funcCounts = new Map(); // function -> { jsExtra, cExtra }

    for (const { analysis } of allResults) {
        if (!analysis || analysis.error) continue;
        for (const s of analysis.shifts) {
            const func = extractFunctionFromRaw(s.raw) || extractFunctionFromStack(s.stack) || '(unknown)';
            if (!funcCounts.has(func)) funcCounts.set(func, { jsExtra: 0, cExtra: 0 });
            const counts = funcCounts.get(func);
            if (s.type === 'js_extra') counts.jsExtra++;
            else counts.cExtra++;
        }
    }

    if (funcCounts.size === 0) {
        console.log('\nNo shifts found across any session.');
        return;
    }

    const sorted = [...funcCounts.entries()]
        .map(([func, counts]) => ({ func, total: counts.jsExtra + counts.cExtra, ...counts }))
        .sort((a, b) => b.total - a.total);

    console.log(`\n=== Top Shift-Causing Functions (across ${allResults.length} sessions) ===`);
    console.log(`${'Function'.padEnd(40)} ${'JS Extra'.padStart(10)} ${'C Extra'.padStart(10)} ${'Total'.padStart(10)}`);
    console.log('-'.repeat(72));

    const topN = opts.top || 20;
    for (const row of sorted.slice(0, topN)) {
        console.log(`${row.func.padEnd(40)} ${String(row.jsExtra).padStart(10)} ${String(row.cExtra).padStart(10)} ${String(row.total).padStart(10)}`);
    }

    if (sorted.length > topN) {
        console.log(`... and ${sorted.length - topN} more functions`);
    }

    const totalJsExtra = sorted.reduce((sum, r) => sum + r.jsExtra, 0);
    const totalCExtra = sorted.reduce((sum, r) => sum + r.cExtra, 0);
    console.log('-'.repeat(72));
    console.log(`${'TOTAL'.padEnd(40)} ${String(totalJsExtra).padStart(10)} ${String(totalCExtra).padStart(10)} ${String(totalJsExtra + totalCExtra).padStart(10)}`);
}

async function main() {
    const opts = parseArgs();

    const sessions = loadAllSessions({
        sessionsDir: SESSIONS_DIR,
        mapsDir: MAPS_DIR,
        typeFilter: opts.typeFilter,
        sessionPath: opts.sessionPath ? resolve(opts.sessionPath) : null,
    });

    if (sessions.length === 0) {
        console.error('No sessions found.');
        process.exit(1);
    }

    console.log(`=== RNG Time-Shift Analysis ===`);
    console.log(`Sessions: ${sessions.length}`);
    if (opts.typeFilter) console.log(`Type filter: ${opts.typeFilter}`);
    console.log('');

    const allResults = [];
    let done = 0;

    for (const session of sessions) {
        done++;
        process.stderr.write(`\r[${done}/${sessions.length}] ${session.file}...`);

        try {
            const analysis = await replayAndAnalyze(session, opts);
            allResults.push({ file: session.file, analysis });

            if (analysis.error) {
                console.log(`  ${session.file}: ERROR - ${analysis.error}`);
            } else {
                printSessionSummary(session.file, analysis, opts);
            }
        } catch (err) {
            console.log(`  ${session.file}: CRASH - ${err.message}`);
            allResults.push({ file: session.file, analysis: { error: err.message } });
        }
    }

    process.stderr.write('\r' + ' '.repeat(80) + '\r');

    // Aggregate summary
    const withShifts = allResults.filter(r => r.analysis && !r.analysis.error
        && (r.analysis.shifts?.length > 0 || r.analysis.diffs?.length > 0));
    const clean = allResults.filter(r => r.analysis && !r.analysis.error
        && (r.analysis.shifts?.length || 0) === 0 && (r.analysis.diffs?.length || 0) === 0);
    const errors = allResults.filter(r => r.analysis?.error);

    console.log(`\n=== Summary ===`);
    console.log(`Sessions with shifts/diffs: ${withShifts.length}`);
    console.log(`Clean sessions: ${clean.length}`);
    console.log(`Errors: ${errors.length}`);

    printAggregate(allResults, opts);
}

main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
});
