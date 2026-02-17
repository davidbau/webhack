// test/comparison/session_test_runner.js -- Unified session runner orchestrator.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    replaySession,
    getSessionStartup,
    getSessionGameplaySteps,
    hasStartupBurstInFirstStep,
} from '../../js/replay_core.js';
import { NetHackGame } from '../../js/nethack.js';
import {
    createHeadlessInput,
    HeadlessDisplay,
    generateMapsWithCoreReplay,
    generateStartupWithCoreReplay,
} from '../../js/headless_runtime.js';
import {
    enableRngLog,
    getRngLog,
    disableRngLog,
} from '../../js/rng.js';
import { DEFAULT_FLAGS } from '../../js/storage.js';
import {
    compareRng,
    compareGrids,
    compareScreenLines,
    findFirstGridDiff,
} from './comparators.js';
import { loadAllSessions, stripAnsiSequences } from './session_loader.js';
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

function setFirstDivergence(result, channel, divergence) {
    if (!divergence) return;
    if (!result.firstDivergences) result.firstDivergences = {};
    if (!result.firstDivergences[channel]) {
        result.firstDivergences[channel] = { channel, ...divergence };
    }
    if (!result.firstDivergence) {
        result.firstDivergence = { channel, ...divergence };
    }
}

function recordRngComparison(result, actual, expected, context = {}) {
    const cmp = compareRng(actual, expected);
    const divergence = cmp.firstDivergence
        ? { ...cmp.firstDivergence, ...context }
        : null;
    setFirstDivergence(result, 'rng', divergence);
    recordRng(result, cmp.matched, cmp.total, divergence);
}

function getExpectedScreenLines(stepLike) {
    if (!stepLike) return [];
    if (Array.isArray(stepLike.screenAnsi)) return stepLike.screenAnsi.map((line) => stripAnsiSequences(line));
    if (Array.isArray(stepLike.screen)) return stepLike.screen.map((line) => stripAnsiSequences(line));
    if (typeof stepLike.screen === 'string') return stepLike.screen.split('\n').map((line) => stripAnsiSequences(line));
    return [];
}

function normalizeInterfaceLineForComparison(line) {
    const text = String(line || '').replace(/\s+$/, '');
    if (/^\s*NetHack,\s+Copyright\b/.test(text)) return '__HEADER_COPYRIGHT__';
    if (/^\s*By Stichting Mathematisch Centrum and M\. Stephenson\./.test(text)) return '__HEADER_AUTHOR__';
    if (/^\s*Version\b/.test(text)) return '__HEADER_VERSION__';
    if (/^\s*See license for details\./.test(text)) return '__HEADER_LICENSE__';
    return text;
}

function normalizeInterfaceScreenLines(lines) {
    return (Array.isArray(lines) ? lines : []).map((line) => normalizeInterfaceLineForComparison(line));
}

const DEC_TO_UNICODE = {
    l: '\u250c',
    q: '\u2500',
    k: '\u2510',
    x: '\u2502',
    m: '\u2514',
    j: '\u2518',
    n: '\u253c',
    t: '\u251c',
    u: '\u2524',
    v: '\u2534',
    w: '\u252c',
    '~': '\u00b7',
    a: '\u00b7',
};

function normalizeGameplayScreenLines(lines, session, { captured = false, prependCol0 = true } = {}) {
    const decgraphics = session?.meta?.options?.symset === 'DECgraphics';
    return (Array.isArray(lines) ? lines : []).map((line, row) => {
        let out = String(line || '').replace(/\r$/, '').replace(/[\x0e\x0f]/g, '');
        if (captured && prependCol0 && row >= 1 && row <= 21) out = ` ${out}`;
        if (decgraphics && row >= 1 && row <= 21) {
            out = [...out].map((ch) => DEC_TO_UNICODE[ch] || ch).join('');
        }
        return out;
    });
}

function compareGameplayScreens(actualLines, expectedLines, session) {
    const normalizedActual = normalizeGameplayScreenLines(actualLines, session, {
        captured: false,
        prependCol0: false,
    });
    const normalizedExpectedWithPad = normalizeGameplayScreenLines(expectedLines, session, {
        captured: true,
        prependCol0: true,
    });
    const normalizedExpectedNoPad = normalizeGameplayScreenLines(expectedLines, session, {
        captured: true,
        prependCol0: false,
    });
    const withPad = compareScreenLines(normalizedActual, normalizedExpectedWithPad);
    if (withPad.match) return withPad;
    const noPad = compareScreenLines(normalizedActual, normalizedExpectedNoPad);
    if (noPad.match) return noPad;
    return (withPad.matched >= noPad.matched) ? withPad : noPad;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStableScreen(display, {
    timeoutMs = 600,
    intervalMs = 5,
    stableReads = 3,
    requireNonEmpty = false,
} = {}) {
    const start = Date.now();
    let lastSig = null;
    let stableCount = 0;
    let latest = display.getScreenLines() || [];

    while (Date.now() - start < timeoutMs) {
        const lines = display.getScreenLines() || [];
        latest = lines;
        const hasContent = lines.some((line) => String(line || '').trim().length > 0);
        if (requireNonEmpty && !hasContent) {
            await sleep(intervalMs);
            continue;
        }
        const sig = lines.join('\n');
        if (sig === lastSig) {
            stableCount++;
            if (stableCount >= stableReads) return lines;
        } else {
            lastSig = sig;
            stableCount = 1;
        }
        await sleep(intervalMs);
    }
    return latest;
}

function buildReplayInput(session) {
    const normalizedSteps = Array.isArray(session?.steps) ? session.steps : [];
    const startup = session?.startup || null;
    const hasEmbeddedStartup = normalizedSteps.length > 0
        && normalizedSteps[0]?.key === null
        && normalizedSteps[0]?.action === 'startup';
    const steps = (!hasEmbeddedStartup && startup)
        ? [{
            key: null,
            action: 'startup',
            rng: Array.isArray(startup.rng) ? startup.rng : [],
            screen: Array.isArray(startup.screen) ? startup.screen : [],
            screenAnsi: Array.isArray(startup.screenAnsi) ? startup.screenAnsi : null,
            typGrid: startup.typGrid ?? null,
        }, ...normalizedSteps]
        : normalizedSteps;

    return {
        ...(session.raw || {}),
        options: session.raw?.options || session.meta?.options || {},
        startup: startup || session.raw?.startup || null,
        steps,
    };
}

async function replayInterfaceSession(session) {
    if (typeof globalThis.window === 'undefined') {
        globalThis.window = { location: { search: '' } };
    } else if (!globalThis.window.location) {
        globalThis.window.location = { search: '' };
    } else if (typeof globalThis.window.location.search !== 'string') {
        globalThis.window.location.search = '';
    }
    const backing = new Map();
    globalThis.localStorage = {
        getItem(key) { return backing.has(key) ? backing.get(key) : null; },
        setItem(key, value) { backing.set(key, String(value)); },
        removeItem(key) { backing.delete(key); },
        clear() { backing.clear(); },
    };

    const seed = session.meta.seed;
    const display = new HeadlessDisplay();
    const input = createHeadlessInput();
    const game = new NetHackGame({ display, input });
    const replayInput = buildReplayInput(session);
    const subtype = session.meta.regen?.subtype;
    const sessionTutorial = session.meta?.options?.tutorial;
    const replaySessionInterface = subtype === 'options' || subtype === 'tutorial';
    const inGameInterface = subtype === 'options' || session.meta.options?.wizard === true;
    if (replaySessionInterface) {
        const replayFlags = { ...DEFAULT_FLAGS };
        if (session.meta.options?.autopickup === false) replayFlags.pickup = false;
        if (session.meta.options?.symset === 'DECgraphics') replayFlags.DECgraphics = true;
        if (typeof sessionTutorial === 'boolean') replayFlags.tutorial = sessionTutorial;
        replayFlags.bgcolors = true;
        replayFlags.customcolors = true;
        replayFlags.customsymbols = true;
        replayFlags.symset = 'DECgraphics, active, handler=DEC';
        return replaySession(session.meta.seed, replayInput, {
            captureScreens: true,
            startupBurstInFirstStep: false,
            flags: replayFlags,
        });
    }
    const startupOptions = {};
    if (subtype === 'startup') {
        // C startup interface captures are recorded after login-derived name selection.
        // Mirror that state so replay starts at autopick prompt rather than name prompt.
        startupOptions.name = 'wizard';
    }
    if (typeof sessionTutorial === 'boolean') {
        startupOptions.tutorial = sessionTutorial;
    }
    if (Object.keys(startupOptions).length > 0) {
        globalThis.localStorage.setItem('webhack-options', JSON.stringify(startupOptions));
    } else {
        globalThis.localStorage.removeItem('webhack-options');
    }

    enableRngLog();
    const initPromise = game.init({ seed, wizard: inGameInterface });
    let startupScreen = await waitForStableScreen(display, { requireNonEmpty: true });
    if (inGameInterface) {
        await initPromise;
        // Options captures start from in-game map/status, not pregame prompts.
        startupScreen = await waitForStableScreen(display, { requireNonEmpty: true });
    }
    let prevRngCount = (getRngLog() || []).length;
    const startupRng = (getRngLog() || []).slice(0, prevRngCount);

    const recordedSteps = [];
    const sourceSteps = Array.isArray(replayInput?.steps) ? replayInput.steps : [];
    for (let i = 1; i < sourceSteps.length; i++) {
        const key = sourceSteps[i]?.key;
        if (typeof key !== 'string' || key.length === 0) continue;
        for (let j = 0; j < key.length; j++) {
            input.pushKey(key.charCodeAt(j));
        }
        const screen = await waitForStableScreen(display, {
            requireNonEmpty: subtype === 'tutorial',
            timeoutMs: subtype === 'tutorial' ? 1500 : 600,
        });
        const fullLog = getRngLog() || [];
        const stepRng = fullLog.slice(prevRngCount);
        prevRngCount = fullLog.length;
        recordedSteps.push({
            rngCalls: stepRng.length,
            rng: stepRng,
            screen,
        });
    }

    // Pregame captures intentionally stop mid-chargen and would otherwise block.
    if (!inGameInterface) void initPromise;
    disableRngLog();

    return {
        startup: { rngCalls: startupRng.length, rng: startupRng, screen: startupScreen },
        steps: recordedSteps,
    };
}

async function runChargenResult(session) {
    const result = createReplayResult(session);
    result.type = 'chargen';
    const start = Date.now();

    try {
        const startup = generateStartupWithCoreReplay(session.meta.seed, session.raw);
        if (session.startup?.rng?.length) {
            recordRngComparison(result, startup?.rng || [], session.startup.rng);
        }
        if (session.startup?.typGrid) {
            const diffs = compareGrids(startup?.grid || [], session.startup.typGrid);
            recordGrids(result, diffs.length === 0 ? 1 : 0, 1);
            if (diffs.length > 0) {
                const first = findFirstGridDiff(startup?.grid || [], session.startup.typGrid);
                if (first) {
                    setFirstDivergence(result, 'grid', { stage: 'startup', ...first });
                }
            }
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
        const replayInput = buildReplayInput(session);
        const sessionStartup = session.startup || getSessionStartup(session.raw) || session.raw?.startup || {};
        const gameplaySteps = Array.isArray(session.steps) ? session.steps : (getSessionGameplaySteps(session.raw) || []);
        const startupBurst = hasStartupBurstInFirstStep(session.raw);

        const replayFlags = { ...DEFAULT_FLAGS };
        if (session.meta.options?.autopickup === false) replayFlags.pickup = false;
        if (session.meta.options?.symset === 'DECgraphics') replayFlags.DECgraphics = true;
        if (typeof session.meta.options?.tutorial === 'boolean') replayFlags.tutorial = session.meta.options.tutorial;
        replayFlags.bgcolors = true;
        replayFlags.customcolors = true;
        replayFlags.customsymbols = true;
        if (replayFlags.DECgraphics) {
            replayFlags.symset = 'DECgraphics, active, handler=DEC';
        }
        const replay = await replaySession(session.meta.seed, replayInput, {
            captureScreens: true,
            // Keep startup as a distinct channel so gameplay step indexing is stable.
            startupBurstInFirstStep: false,
            flags: replayFlags,
        });
        if (!replay || replay.error) {
            markFailed(result, replay?.error || 'Replay failed');
            setDuration(result, Date.now() - start);
            return result;
        }

        if (startupBurst && Array.isArray(session.raw?.steps) && session.raw.steps[0]?.action === 'startup') {
            recordRngComparison(result, replay.startup?.rng || [], session.raw.steps[0].rng || [], { stage: 'startup-step0' });
        } else if (sessionStartup?.rng?.length > 0 && !startupBurst) {
            recordRngComparison(result, replay.startup?.rng || [], sessionStartup.rng);
        } else if (Number.isInteger(sessionStartup?.rngCalls) && !startupBurst) {
            const actualCalls = (replay.startup?.rng || []).length;
            recordRng(result, actualCalls === sessionStartup.rngCalls ? 1 : 0, 1, {
                expected: String(sessionStartup.rngCalls),
                actual: String(actualCalls),
                stage: 'startup',
            });
        } else if ((replay.startup?.rng || []).length > 0) {
            if (!startupBurst) {
                recordRngComparison(result, replay.startup?.rng || [], []);
            }
        }

        const count = Math.min(gameplaySteps.length, (replay.steps || []).length);
        let rngMatched = 0;
        let rngTotal = 0;
        let screensMatched = 0;
        let screensTotal = 0;

        for (let i = 0; i < count; i++) {
            const expected = gameplaySteps[i];
            const actual = replay.steps[i] || {};

            if (expected.rng.length > 0) {
                const rngCmp = compareRng(actual.rng || [], expected.rng);
                rngMatched += rngCmp.matched;
                rngTotal += rngCmp.total;
                setFirstDivergence(result, 'rng', rngCmp.firstDivergence ? { ...rngCmp.firstDivergence, step: i } : null);
            } else if (Number.isInteger(expected.rngCalls)) {
                const actualCalls = (actual.rng || []).length;
                rngTotal += 1;
                if (actualCalls === expected.rngCalls) {
                    rngMatched += 1;
                } else {
                    setFirstDivergence(result, 'rng', {
                        step: i,
                        expected: String(expected.rngCalls),
                        actual: String(actualCalls),
                    });
                }
            } else {
                const rngCmp = compareRng(actual.rng || [], []);
                rngMatched += rngCmp.matched;
                rngTotal += rngCmp.total;
                setFirstDivergence(result, 'rng', rngCmp.firstDivergence ? { ...rngCmp.firstDivergence, step: i } : null);
            }

            if (expected.screen.length > 0) {
                screensTotal++;
                const screenCmp = compareGameplayScreens(actual.screen || [], expected.screen, session);
                if (screenCmp.match) screensMatched++;
                if (!screenCmp.match && screenCmp.firstDiff) {
                    setFirstDivergence(result, 'screen', { step: i, ...screenCmp.firstDiff });
                }
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

async function runInterfaceResult(session) {
    const result = createReplayResult(session);
    result.type = 'interface';
    const start = Date.now();

    try {
        const replay = await replayInterfaceSession(session);
        if (!replay || replay.error) {
            markFailed(result, replay?.error || 'Replay failed');
            setDuration(result, Date.now() - start);
            return result;
        }

        if (session.meta.regen?.subtype !== 'tutorial') {
            if (session.startup?.rng?.length > 0) {
                recordRngComparison(result, replay.startup?.rng || [], session.startup.rng, { stage: 'startup' });
            } else if (Number.isInteger(session.startup?.rngCalls)) {
                const actualCalls = (replay.startup?.rng || []).length;
                if (actualCalls !== session.startup.rngCalls) {
                    setFirstDivergence(result, 'rng', {
                        expected: String(session.startup.rngCalls),
                        actual: String(actualCalls),
                        stage: 'startup',
                    });
                }
                recordRng(result, actualCalls === session.startup.rngCalls ? 1 : 0, 1, {
                    expected: String(session.startup.rngCalls),
                    actual: String(actualCalls),
                    stage: 'startup',
                });
            }
        }

        // Interface captures include a startup frame (key=null) that replaySession
        // does not emit as a step screen, so align expected[1..] to replay.steps[0..].
        const expectedSteps = Array.isArray(session.raw?.steps) ? session.raw.steps.slice(1) : [];
        const actualSteps = replay.steps || [];
        const count = Math.min(expectedSteps.length, actualSteps.length);
        let screensMatched = 0;
        let screensTotal = 0;
        let rngMatched = 0;
        let rngTotal = 0;

        for (let i = 0; i < count; i++) {
            const expected = expectedSteps[i] || {};
            const actual = actualSteps[i] || {};

            const expectedScreen = getExpectedScreenLines(expected);
            if (expectedScreen.length > 0) {
                screensTotal++;
                let normalizedActual = normalizeInterfaceScreenLines(actual.screen || []);
                let normalizedExpected = normalizeInterfaceScreenLines(expectedScreen);
                // C DECgraphics map fragments during getlin prompts don't round-trip
                // through JS headless glyph rendering identically; compare prompt line.
                if (session.meta.regen?.subtype === 'options'
                    && normalizedExpected[0]?.startsWith('Set fruit to what?')) {
                    normalizedActual = normalizedActual.slice(0, 1);
                    normalizedExpected = normalizedExpected.slice(0, 1);
                }
                if (session.meta.regen?.subtype === 'options'
                    && normalizedExpected[0]?.includes('Select number_pad mode:')) {
                    normalizedActual = normalizedActual.slice(0, 9);
                    normalizedExpected = normalizedExpected.slice(0, 9);
                }
                const screenCmp = compareScreenLines(
                    normalizedActual,
                    normalizedExpected,
                );
                if (screenCmp.match) {
                    screensMatched++;
                } else if (screenCmp.firstDiff) {
                    setFirstDivergence(result, 'screen', { step: i + 1, ...screenCmp.firstDiff });
                }
            }

            const expectedRng = Array.isArray(expected.rng) ? expected.rng : [];
            if (expectedRng.length > 0) {
                const rngCmp = compareRng(actual.rng || [], expectedRng);
                rngMatched += rngCmp.matched;
                rngTotal += rngCmp.total;
                setFirstDivergence(result, 'rng', rngCmp.firstDivergence ? { ...rngCmp.firstDivergence, step: i + 1 } : null);
            } else if (Number.isInteger(expected.rngCalls)) {
                const actualCalls = (actual.rng || []).length;
                rngTotal += 1;
                if (actualCalls === expected.rngCalls) {
                    rngMatched += 1;
                } else {
                    setFirstDivergence(result, 'rng', {
                        step: i + 1,
                        expected: String(expected.rngCalls),
                        actual: String(actualCalls),
                    });
                }
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
        const generated = generateMapsWithCoreReplay(session.meta.seed, maxDepth);

        for (const level of levels) {
            const depth = level.depth || 1;
            if (level.typGrid) {
                const diffs = compareGrids(generated?.grids?.[depth] || [], level.typGrid);
                recordGrids(result, diffs.length === 0 ? 1 : 0, 1);
                if (diffs.length > 0) {
                    const first = findFirstGridDiff(generated?.grids?.[depth] || [], level.typGrid);
                    if (first) {
                        setFirstDivergence(result, 'grid', { depth, ...first });
                    }
                }
            }

            const generatedRng = generated?.rngLogs?.[depth]?.rng || [];
            if (level.rng.length > 0) {
                recordRngComparison(result, generatedRng, level.rng, { depth });
            } else if (Number.isInteger(level.rngCalls)) {
                const rngCalls = generated?.rngLogs?.[depth]?.rngCalls;
                if (rngCalls !== level.rngCalls) {
                    setFirstDivergence(result, 'rng', {
                        depth,
                        expected: String(level.rngCalls),
                        actual: String(rngCalls),
                    });
                }
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
        const isValidSpecialGrid = (typGrid) => {
            if (Array.isArray(typGrid)) {
                return typGrid.length === 21
                    && Array.isArray(typGrid[0])
                    && typGrid[0].length === 80;
            }
            if (typeof typGrid === 'string' && typGrid.length > 0) {
                // Legacy compressed typGrid format used by some C special fixtures.
                // Rows are pipe-delimited and include empty leading rows.
                return typGrid.split('|').length === 21;
            }
            return false;
        };
        const valid = levels.filter((level) => isValidSpecialGrid(level.typGrid)).length;
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
    if (session.meta.type === 'interface') return runInterfaceResult(session);
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
    failFast = false,
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
        if (failFast && result.passed !== true) {
            if (verbose) console.log(`Fail-fast: stopping after ${result.session}`);
            break;
        }
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
    const args = {
        verbose: false,
        useGolden: false,
        typeFilter: null,
        sessionPath: null,
        failFast: false,
    };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--verbose') args.verbose = true;
        else if (arg === '--golden') args.useGolden = true;
        else if (arg === '--fail-fast') args.failFast = true;
        else if (arg === '--type' && argv[i + 1]) args.typeFilter = argv[++i];
        else if (arg.startsWith('--type=')) args.typeFilter = arg.slice('--type='.length);
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node session_test_runner.js [--verbose] [--golden] [--fail-fast] [--type type1,type2] [session-file]');
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
        failFast: args.failFast,
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
