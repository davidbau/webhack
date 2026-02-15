// test/comparison/backfill_runner.js
// Session-based test runner for backfill testing
//
// Produces per-session results in standard format for git notes.
// Supports --golden flag to fetch sessions from golden branch.
//
// Usage: node test/comparison/backfill_runner.js [--verbose] [--golden]

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
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
const VERBOSE = process.argv.includes('--verbose');
const USE_GOLDEN = process.argv.includes('--golden');
const GOLDEN_BRANCH = process.env.GOLDEN_BRANCH || 'golden';

// ============================================================================
// Comparison utilities
// ============================================================================

function compareGrids(grid1, grid2) {
    if (!grid1 || !grid2) return { match: false, matched: 0, total: 1 };
    let diffs = 0;
    const rows = Math.min(grid1.length, grid2.length);
    for (let y = 0; y < rows; y++) {
        const cols = Math.min(grid1[y]?.length || 0, grid2[y]?.length || 0);
        for (let x = 0; x < cols; x++) {
            if (grid1[y][x] !== grid2[y][x]) diffs++;
        }
    }
    return { match: diffs === 0, matched: diffs === 0 ? 1 : 0, total: 1, diffs };
}

function isMidlogEntry(entry) {
    return entry && entry.length > 0 && (entry[0] === '>' || entry[0] === '<');
}

function isCompositeEntry(entry) {
    return entry && (entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d('));
}

function rngCallPart(entry) {
    if (!entry || typeof entry !== 'string') return '';
    let s = entry.replace(/^\d+\s+/, '');
    const atIdx = s.indexOf(' @ ');
    return atIdx >= 0 ? s.substring(0, atIdx) : s;
}

function compareRngArrays(jsRng, cRng) {
    if (!jsRng || !cRng) return { match: false, matched: 0, total: 0 };
    const jsFiltered = jsRng.map(rngCallPart).filter(e => !isMidlogEntry(e) && !isCompositeEntry(e));
    const cFiltered = cRng.map(rngCallPart).filter(e => !isMidlogEntry(e) && !isCompositeEntry(e));
    const len = Math.min(jsFiltered.length, cFiltered.length);
    let matched = 0;
    let firstDivergence = null;
    for (let i = 0; i < len; i++) {
        if (jsFiltered[i] === cFiltered[i]) {
            matched++;
        } else if (!firstDivergence) {
            firstDivergence = {
                rngCall: i,
                expected: cFiltered[i],
                actual: jsFiltered[i],
            };
        }
    }
    return {
        match: matched === len && jsFiltered.length === cFiltered.length,
        matched,
        total: Math.max(jsFiltered.length, cFiltered.length),
        firstDivergence,
    };
}

function compareScreens(screen1, screen2) {
    if (!screen1 || !screen2) return { match: false, matched: 0, total: 1 };
    const lines1 = Array.isArray(screen1) ? screen1 : [];
    const lines2 = Array.isArray(screen2) ? screen2 : [];
    const len = Math.max(lines1.length, lines2.length);
    let matching = 0;
    for (let i = 0; i < len; i++) {
        const l1 = stripAnsi(lines1[i] || '');
        const l2 = stripAnsi(lines2[i] || '');
        if (l1 === l2) matching++;
    }
    return { match: matching === len, matched: matching === len ? 1 : 0, total: 1 };
}

function getSessionStartup(session) {
    if (!session?.steps?.[0]) return null;
    const firstStep = session.steps[0];
    if (firstStep.key === null && firstStep.action === 'startup') {
        return {
            rng: firstStep.rng || [],
            typGrid: firstStep.typGrid,
            screen: firstStep.screen,
        };
    }
    return null;
}

function getGameplaySteps(session) {
    if (!session?.steps) return [];
    if (session.steps[0]?.key === null) return session.steps.slice(1);
    return session.steps;
}

function stripAnsi(str) {
    if (!str) return '';
    return String(str)
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        .replace(/\x1b[@-Z\\-_]/g, '')
        .replace(/\x9b[0-?]*[ -/]*[@-~]/g, '');
}

// ============================================================================
// Module loading
// ============================================================================

async function tryImport(path) {
    try {
        return await import(path);
    } catch (e) {
        return { _error: e.message };
    }
}

function readGoldenFile(relativePath) {
    try {
        return execSync(`git show ${GOLDEN_BRANCH}:${relativePath}`, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } catch {
        return null;
    }
}

function listGoldenDir(relativePath) {
    try {
        const output = execSync(`git ls-tree --name-only ${GOLDEN_BRANCH}:${relativePath}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return output.trim().split('\n').filter(f => f);
    } catch {
        return [];
    }
}

function loadSessions(dir, filter = () => true) {
    const relativePath = dir.replace(process.cwd() + '/', '');
    if (USE_GOLDEN) {
        const files = listGoldenDir(relativePath).filter(f => f.endsWith('.session.json'));
        return files.map(f => {
            try {
                const content = readGoldenFile(`${relativePath}/${f}`);
                if (!content) return null;
                const data = JSON.parse(content);
                return { file: f, dir: `golden:${relativePath}`, ...data };
            } catch {
                return null;
            }
        }).filter(s => s && filter(s));
    }
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter(f => f.endsWith('.session.json'))
        .map(f => {
            try {
                const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
                return { file: f, dir, ...data };
            } catch {
                return null;
            }
        })
        .filter(s => s && filter(s));
}

// ============================================================================
// Main test runner
// ============================================================================

async function runBackfillTests() {
    const sessionResults = [];
    const capabilities = {
        rng: false, config: false, dungeon: false, helpers: false,
        levelGen: false, rngLog: false, chargen: false, gameplay: false,
    };

    console.log('=== Backfill Test Runner ===');
    if (USE_GOLDEN) console.log(`Using golden branch: ${GOLDEN_BRANCH}`);
    console.log('');

    // Phase 1: Test imports
    console.log('Phase 1: Testing imports...');
    const rng = await tryImport('../../js/rng.js');
    const config = await tryImport('../../js/config.js');
    const dungeon = await tryImport('../../js/dungeon.js');
    const helpers = await tryImport('./session_helpers.js');

    capabilities.rng = !rng._error;
    capabilities.config = !config._error;
    capabilities.dungeon = !dungeon._error;
    capabilities.helpers = !helpers._error;

    console.log(`  rng.js: ${capabilities.rng ? 'OK' : 'FAIL'}`);
    console.log(`  config.js: ${capabilities.config ? 'OK' : 'FAIL'}`);
    console.log(`  dungeon.js: ${capabilities.dungeon ? 'OK' : 'FAIL'}`);
    console.log(`  helpers: ${capabilities.helpers ? 'OK' : 'SKIP'}`);

    // Phase 2: Test capabilities
    console.log('\nPhase 2: Testing capabilities...');
    if (capabilities.rng && rng.enableRngLog && rng.getRngLog) {
        capabilities.rngLog = true;
    }
    if (capabilities.rng && capabilities.dungeon && capabilities.config) {
        const { initRng } = rng;
        const { makelevel, setGameSeed, initLevelGeneration } = dungeon;
        capabilities.levelGen = !!(initRng && makelevel && setGameSeed && initLevelGeneration);
    }
    if (capabilities.helpers) {
        capabilities.chargen = typeof helpers.generateStartupWithRng === 'function';
        capabilities.gameplay = typeof helpers.replaySession === 'function';
    }

    console.log(`  RNG logging: ${capabilities.rngLog ? 'OK' : 'SKIP'}`);
    console.log(`  Level gen: ${capabilities.levelGen ? 'OK' : 'SKIP'}`);
    console.log(`  Chargen: ${capabilities.chargen ? 'OK' : 'SKIP'}`);
    console.log(`  Gameplay: ${capabilities.gameplay ? 'OK' : 'SKIP'}`);

    // Phase 3: Load sessions
    console.log('\nPhase 3: Loading sessions...');
    const sessionsDir = join(__dirname, 'sessions');
    const chargenSessions = loadSessions(sessionsDir, s => s.file.includes('_chargen'));
    const gameplaySessions = loadSessions(sessionsDir, s => s.file.includes('_gameplay'));

    console.log(`  Chargen sessions: ${chargenSessions.length}`);
    console.log(`  Gameplay sessions: ${gameplaySessions.length}`);

    // Phase 4: Run tests
    console.log('\nPhase 4: Running tests...');

    // Chargen tests
    if (capabilities.chargen) {
        for (const session of chargenSessions) {
            const result = createSessionResult(session);
            const startTime = Date.now();

            try {
                const jsResult = helpers.generateStartupWithRng(session.seed, session);
                if (!jsResult || !jsResult.grid) {
                    markFailed(result, 'No grid returned');
                    setDuration(result, Date.now() - startTime);
                    sessionResults.push(result);
                    continue;
                }

                // Compare startup RNG
                const startup = getSessionStartup(session);
                if (startup?.rng?.length > 0) {
                    const rngCmp = compareRngArrays(jsResult.rng || [], startup.rng);
                    recordRng(result, rngCmp.matched, rngCmp.total, rngCmp.firstDivergence);
                }

                // Compare grid if present
                if (startup?.typGrid) {
                    const gridCmp = compareGrids(jsResult.grid, startup.typGrid);
                    recordGrids(result, gridCmp.matched, gridCmp.total);
                }

                // Count screens
                const stepsWithScreen = (session.steps || []).filter(s => s.screen);
                if (stepsWithScreen.length > 0) {
                    recordScreens(result, stepsWithScreen.length, stepsWithScreen.length);
                }
            } catch (e) {
                markFailed(result, e);
            }

            setDuration(result, Date.now() - startTime);
            sessionResults.push(result);
            if (VERBOSE) console.log(`  ${formatResult(result)}`);
        }
        const passed = sessionResults.filter(r => r.type === 'chargen' && r.passed).length;
        console.log(`  Chargen: ${passed}/${chargenSessions.length} passed`);
    }

    // Gameplay tests
    if (capabilities.gameplay) {
        for (const session of gameplaySessions) {
            const result = createSessionResult(session);
            const startTime = Date.now();

            try {
                const jsResult = await helpers.replaySession(session.seed, session, { captureScreens: true });
                if (!jsResult || jsResult.error) {
                    markFailed(result, jsResult?.error || 'Replay failed');
                    setDuration(result, Date.now() - startTime);
                    sessionResults.push(result);
                    continue;
                }

                // Compare startup RNG
                const startup = getSessionStartup(session);
                const startupRng = startup?.rng || [];
                const jsStartupRng = jsResult.startup?.rng || [];
                if (startupRng.length > 0 || jsStartupRng.length > 0) {
                    const rngCmp = compareRngArrays(jsStartupRng, startupRng);
                    recordRng(result, rngCmp.matched, rngCmp.total, rngCmp.firstDivergence);
                }

                // Compare startup grid
                if (startup?.typGrid) {
                    const gridCmp = compareGrids(jsResult.startup?.grid, startup.typGrid);
                    recordGrids(result, gridCmp.matched, gridCmp.total);
                }

                // Compare gameplay steps
                const goldenSteps = getGameplaySteps(session);
                const jsSteps = jsResult.steps || [];
                const stepCount = Math.min(goldenSteps.length, jsSteps.length);
                let stepRngMatched = 0, stepRngTotal = 0;
                let screenMatched = 0, screenTotal = 0;

                for (let i = 0; i < stepCount; i++) {
                    const golden = goldenSteps[i];
                    const js = jsSteps[i];

                    // Compare step RNG
                    const goldenRng = golden.rng || [];
                    const jsRng = js?.rng || [];
                    if (goldenRng.length > 0 || jsRng.length > 0) {
                        const rngCmp = compareRngArrays(jsRng, goldenRng);
                        stepRngMatched += rngCmp.matched;
                        stepRngTotal += rngCmp.total;
                        if (!result.firstDivergence && rngCmp.firstDivergence) {
                            result.firstDivergence = rngCmp.firstDivergence;
                            result.firstDivergence.step = i;
                        }
                    }

                    // Compare screen
                    if (golden.screen || golden.screenAnsi) {
                        screenTotal++;
                        const screenCmp = compareScreens(js?.screen, golden.screenAnsi || golden.screen);
                        if (screenCmp.match) screenMatched++;
                    }
                }

                if (stepRngTotal > 0) {
                    recordRng(result, stepRngMatched, stepRngTotal);
                }
                if (screenTotal > 0) {
                    recordScreens(result, screenMatched, screenTotal);
                }
            } catch (e) {
                markFailed(result, e);
            }

            setDuration(result, Date.now() - startTime);
            sessionResults.push(result);
            if (VERBOSE) console.log(`  ${formatResult(result)}`);
        }
        const passed = sessionResults.filter(r => r.type === 'gameplay' && r.passed).length;
        console.log(`  Gameplay: ${passed}/${gameplaySessions.length} passed`);
    }

    // Create and output results bundle
    const bundle = createResultsBundle(sessionResults, {
        goldenBranch: USE_GOLDEN ? GOLDEN_BRANCH : null,
    });

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(formatBundleSummary(bundle));

    // Output JSON for parsing/git notes
    console.log('\n__RESULTS_JSON__');
    console.log(JSON.stringify(bundle));

    process.exit(bundle.summary.failed > 0 ? 1 : 0);
}

runBackfillTests().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
