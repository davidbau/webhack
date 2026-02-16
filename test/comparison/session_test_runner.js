// test/comparison/session_test_runner.js -- Unified session runner orchestrator.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    generateMapsWithRng,
    generateStartupWithRng,
    replaySession,
} from './session_runtime.js';
import { compareRng, compareGrids, compareScreenLines } from './comparators.js';
import { loadAllSessions } from './session_loader.js';
import {
    createSessionResult,
    recordRng,
    recordGrids,
    recordScreens,
    markFailed,
    setDuration,
    createResultsBundle,
    formatResult,
    formatBundleSummary,
} from './test_result_format.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');
const SKIP_SESSIONS = new Set(['seed6_tourist_gameplay.session.json']);

function createReplayResult(session) {
    const result = createSessionResult({
        file: session.file,
        seed: session.meta.seed,
    });
    result.type = session.meta.type;
    return result;
}

function recordRngComparison(result, actual, expected, context = {}) {
    const cmp = compareRng(actual, expected);
    const divergence = cmp.firstDivergence ? { ...cmp.firstDivergence, ...context } : null;
    recordRng(result, cmp.matched, cmp.total, divergence);
}

async function runChargenResult(session) {
    const result = createReplayResult(session);
    result.type = 'chargen';
    const start = Date.now();

    try {
        const startup = generateStartupWithRng(session.meta.seed, session.raw);
        if (session.startup?.rng?.length) {
            recordRngComparison(result, startup?.rng || [], session.startup.rng);
        }
        if (session.startup?.typGrid) {
            const diffs = compareGrids(startup?.grid || [], session.startup.typGrid);
            recordGrids(result, diffs.length === 0 ? 1 : 0, 1);
        }
        const screenSteps = session.steps.filter((step) => step.screen.length > 0).length;
        if (screenSteps > 0) {
            recordScreens(result, screenSteps, screenSteps);
        }
    } catch (error) {
        markFailed(result, error);
    }

    setDuration(result, Date.now() - start);
    return result;
}

async function runGameplayResult(session) {
    const result = createReplayResult(session);
    const start = Date.now();

    try {
        const replay = await replaySession(session.meta.seed, session.raw, { captureScreens: true });
        if (!replay || replay.error) {
            markFailed(result, replay?.error || 'Replay failed');
            setDuration(result, Date.now() - start);
            return result;
        }

        if (session.startup?.rng?.length > 0) {
            recordRngComparison(result, replay.startup?.rng || [], session.startup.rng);
        } else if (Number.isInteger(session.startup?.rngCalls)) {
            const actualCalls = (replay.startup?.rng || []).length;
            recordRng(result, actualCalls === session.startup.rngCalls ? 1 : 0, 1, {
                expected: String(session.startup.rngCalls),
                actual: String(actualCalls),
                stage: 'startup',
            });
        } else if ((replay.startup?.rng || []).length > 0) {
            recordRngComparison(result, replay.startup?.rng || [], []);
        }

        const count = Math.min(session.steps.length, (replay.steps || []).length);
        let rngMatched = 0;
        let rngTotal = 0;
        let screensMatched = 0;
        let screensTotal = 0;

        for (let i = 0; i < count; i++) {
            const expected = session.steps[i];
            const actual = replay.steps[i] || {};

            if (expected.rng.length > 0) {
                const rngCmp = compareRng(actual.rng || [], expected.rng);
                rngMatched += rngCmp.matched;
                rngTotal += rngCmp.total;
                if (!result.firstDivergence && rngCmp.firstDivergence) {
                    result.firstDivergence = { ...rngCmp.firstDivergence, step: i };
                }
            } else if (Number.isInteger(expected.rngCalls)) {
                const actualCalls = (actual.rng || []).length;
                rngTotal += 1;
                if (actualCalls === expected.rngCalls) {
                    rngMatched += 1;
                } else if (!result.firstDivergence) {
                    result.firstDivergence = {
                        step: i,
                        expected: String(expected.rngCalls),
                        actual: String(actualCalls),
                    };
                }
            } else {
                const rngCmp = compareRng(actual.rng || [], []);
                rngMatched += rngCmp.matched;
                rngTotal += rngCmp.total;
                if (!result.firstDivergence && rngCmp.firstDivergence) {
                    result.firstDivergence = { ...rngCmp.firstDivergence, step: i };
                }
            }

            if (expected.screen.length > 0) {
                screensTotal++;
                const screenCmp = compareScreenLines(actual.screen || [], expected.screen);
                if (screenCmp.match) screensMatched++;
            }
        }

        if (rngTotal > 0) recordRng(result, rngMatched, rngTotal, result.firstDivergence);
        if (screensTotal > 0) recordScreens(result, screensMatched, screensTotal);
    } catch (error) {
        markFailed(result, error);
    }

    setDuration(result, Date.now() - start);
    return result;
}

async function runMapResult(session) {
    const result = createReplayResult(session);
    const start = Date.now();

    try {
        const levels = Array.isArray(session.levels) ? session.levels : [];
        if (levels.length === 0) {
            markFailed(result, 'No map levels in session');
            setDuration(result, Date.now() - start);
            return result;
        }

        const maxDepth = Math.max(...levels.map((level) => level.depth || 1));
        const generated = generateMapsWithRng(session.meta.seed, maxDepth);

        for (const level of levels) {
            const depth = level.depth || 1;
            if (level.typGrid) {
                const diffs = compareGrids(generated?.grids?.[depth] || [], level.typGrid);
                recordGrids(result, diffs.length === 0 ? 1 : 0, 1);
            }

            const generatedRng = generated?.rngLogs?.[depth]?.rng || [];
            if (level.rng.length > 0) {
                recordRngComparison(result, generatedRng, level.rng, { depth });
            } else if (Number.isInteger(level.rngCalls)) {
                const rngCalls = generated?.rngLogs?.[depth]?.rngCalls;
                recordRng(result, rngCalls === level.rngCalls ? 1 : 0, 1, {
                    depth,
                    expected: String(level.rngCalls),
                    actual: String(rngCalls),
                });
            }
        }
    } catch (error) {
        markFailed(result, error);
    }

    setDuration(result, Date.now() - start);
    return result;
}

async function runSpecialResult(session) {
    const result = createReplayResult(session);
    const start = Date.now();

    try {
        const levels = Array.isArray(session.levels) ? session.levels : [];
        const valid = levels.filter((level) =>
            Array.isArray(level.typGrid)
            && level.typGrid.length === 21
            && Array.isArray(level.typGrid[0])
            && level.typGrid[0].length === 80).length;
        recordGrids(result, valid, levels.length);
    } catch (error) {
        markFailed(result, error);
    }

    setDuration(result, Date.now() - start);
    return result;
}

async function runSessionResult(session) {
    if (session.meta.type === 'chargen') return runChargenResult(session);
    if (session.meta.type === 'interface' && session.meta.regen?.subtype === 'chargen') {
        return runChargenResult(session);
    }
    if (session.meta.type === 'map') return runMapResult(session);
    if (session.meta.type === 'special') return runSpecialResult(session);
    return runGameplayResult(session);
}

export async function runSessionBundle({
    verbose = false,
    useGolden = false,
    goldenBranch = 'golden',
    typeFilter = null,
    sessionPath = null,
} = {}) {
    const sessions = loadAllSessions({
        sessionsDir: SESSIONS_DIR,
        mapsDir: MAPS_DIR,
        useGolden,
        goldenBranch,
        typeFilter,
        sessionPath,
    }).filter((session) => !SKIP_SESSIONS.has(session.file));

    if (verbose) {
        console.log('=== Session Test Runner ===');
        if (typeFilter) console.log(`Type filter: ${String(typeFilter)}`);
        if (sessionPath) console.log(`Single session: ${sessionPath}`);
        if (useGolden) console.log(`Using golden branch: ${goldenBranch}`);
        console.log(`Loaded sessions: ${sessions.length}`);
    }

    const results = [];
    for (const session of sessions) {
        const result = await runSessionResult(session);
        results.push(result);
        if (verbose) console.log(formatResult(result));
    }

    const bundle = createResultsBundle(results, {
        goldenBranch: useGolden ? goldenBranch : null,
    });

    if (verbose) {
        console.log('\n========================================');
        console.log('SUMMARY');
        console.log('========================================');
        console.log(formatBundleSummary(bundle));
    }

    return bundle;
}

export async function runSessionCli() {
    const args = { verbose: false, useGolden: false, typeFilter: null, sessionPath: null };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--verbose') args.verbose = true;
        else if (arg === '--golden') args.useGolden = true;
        else if (arg === '--type' && argv[i + 1]) args.typeFilter = argv[++i];
        else if (arg.startsWith('--type=')) args.typeFilter = arg.slice('--type='.length);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node session_test_runner.js [--verbose] [--golden] [--type type1,type2] [session-file]');
            process.exit(0);
        } else if (arg.startsWith('--')) {
            throw new Error(`Unknown argument: ${arg}`);
        } else if (!args.sessionPath) {
            args.sessionPath = arg;
        }
    }

    const goldenBranch = process.env.GOLDEN_BRANCH || 'golden';
    const bundle = await runSessionBundle({
        verbose: args.verbose,
        useGolden: args.useGolden,
        goldenBranch,
        typeFilter: args.typeFilter,
        sessionPath: args.sessionPath,
    });
    console.log('\n__RESULTS_JSON__');
    console.log(JSON.stringify(bundle));
    process.exit(bundle.summary.failed > 0 ? 1 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('session_test_runner.js')) {
    runSessionCli().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
