#!/usr/bin/env node
/**
 * collect-test-results.mjs
 *
 * Runs all tests and collects detailed results including:
 * - Individual test pass/fail status
 * - Session step-level coverage for comparison tests
 * - Category breakdowns
 *
 * Output: JSON to stdout matching the v2 note schema
 *
 * Usage:
 *   node scripts/collect-test-results.mjs > results.json
 *   node scripts/collect-test-results.mjs --summary     # Just stats, no test lists
 *   node scripts/collect-test-results.mjs --unit-only   # Skip slow E2E tests
 */

import { spawn } from 'child_process';
import { readdir, readFile } from 'fs/promises';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Allow REPO_ROOT to be overridden via environment variable or use cwd
const REPO_ROOT = process.env.REPO_ROOT || process.cwd();

const SUMMARY_ONLY = process.argv.includes('--summary');
const UNIT_ONLY = process.argv.includes('--unit-only');

// Parse --timeout=<seconds> flag (default 60s for backfill, 0 = no timeout)
function parseTimeout() {
    const arg = process.argv.find(a => a.startsWith('--timeout='));
    if (arg) {
        const secs = parseInt(arg.split('=')[1], 10);
        return isNaN(secs) ? 60000 : secs * 1000;
    }
    return 0; // No timeout by default for interactive use
}
const TEST_TIMEOUT = parseTimeout();

// Parse test output line to extract test info
function parseTestLine(line) {
    // Match: ✔ test name (duration)  or  ✖ test name (duration)
    // Allow leading whitespace for nested tests
    const passMatch = line.match(/^\s*✔\s+(.+?)\s+\([\d.]+(?:ms|s)\)$/);
    const failMatch = line.match(/^\s*✖\s+(.+?)\s+\([\d.]+(?:ms|s)\)$/);
    const skipMatch = line.match(/^\s*-\s+(.+?)\s+\([\d.]+(?:ms|s)\)$/);

    if (passMatch) return { status: 'pass', name: passMatch[1].trim() };
    if (failMatch) return { status: 'fail', name: failMatch[1].trim() };
    if (skipMatch) return { status: 'skip', name: skipMatch[1].trim() };
    return null;
}

// Determine category from test name
function categorize(testName) {
    const lower = testName.toLowerCase();
    if (lower.includes('chargen')) return 'chargen';
    if (lower.includes('gameplay') || lower.includes('selfplay')) return 'gameplay';
    if (lower.includes('special') || lower.includes('oracle') || lower.includes('bigroom')) return 'special';
    if (lower.includes('map') || lower.includes('depth')) return 'map';
    if (lower.includes('option')) return 'options';
    return 'unit';
}

// Extract session name from test name
function extractSessionName(testName) {
    // Test names like "seed1_gameplay step 45" or "seed1_gameplay.session.json"
    const match = testName.match(/(seed\d+_[a-z_]+)/i);
    return match ? match[1] : null;
}

// Run tests and capture output
async function runTests() {
    return new Promise((resolve) => {
        const results = {
            pass: [],
            fail: [],
            skip: [],
            categories: {},
            sessions: {},
            duration: 0,
            raw: ''
        };

        const startTime = Date.now();
        let output = '';

        // Run comparison tests (the main ones with session data)
        const testArgs = ['--test', 'test/comparison/*.test.js'];
        if (TEST_TIMEOUT > 0) {
            testArgs.unshift(`--test-timeout=${TEST_TIMEOUT}`);
        }
        const proc = spawn('node', testArgs, {
            cwd: REPO_ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        proc.stdout.on('data', (data) => {
            output += data.toString();
        });

        proc.stderr.on('data', (data) => {
            output += data.toString();
        });

        proc.on('close', () => {
            results.duration = (Date.now() - startTime) / 1000;
            results.raw = output;

            // Parse output line by line
            const lines = output.split('\n');
            for (const line of lines) {
                const parsed = parseTestLine(line);
                if (!parsed) continue;

                const category = categorize(parsed.name);
                const sessionName = extractSessionName(parsed.name);

                // Track by status
                results[parsed.status].push(parsed.name);

                // Track by category
                if (!results.categories[category]) {
                    results.categories[category] = { total: 0, pass: 0, fail: 0 };
                }
                results.categories[category].total++;
                results.categories[category][parsed.status === 'skip' ? 'pass' : parsed.status]++;

                // Track session-level info
                if (sessionName && (category === 'gameplay' || category === 'chargen')) {
                    if (!results.sessions[sessionName]) {
                        results.sessions[sessionName] = {
                            status: 'pass',
                            totalSteps: 0,
                            passedSteps: 0,
                            tests: []
                        };
                    }
                    results.sessions[sessionName].tests.push({
                        name: parsed.name,
                        status: parsed.status
                    });
                    if (parsed.status === 'fail') {
                        results.sessions[sessionName].status = 'fail';
                    }
                }
            }

            resolve(results);
        });
    });
}

// Run unit tests separately
async function runUnitTests() {
    return new Promise((resolve) => {
        const results = {
            pass: [],
            fail: [],
            skip: [],
            duration: 0
        };

        const startTime = Date.now();
        let output = '';

        const unitTestArgs = ['--test', 'test/unit/*.test.js'];
        if (TEST_TIMEOUT > 0) {
            unitTestArgs.unshift(`--test-timeout=${TEST_TIMEOUT}`);
        }
        const proc = spawn('node', unitTestArgs, {
            cwd: REPO_ROOT,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        proc.stdout.on('data', (data) => {
            output += data.toString();
        });

        proc.stderr.on('data', (data) => {
            output += data.toString();
        });

        proc.on('close', () => {
            results.duration = (Date.now() - startTime) / 1000;

            const lines = output.split('\n');
            for (const line of lines) {
                const parsed = parseTestLine(line);
                if (!parsed) continue;
                results[parsed.status].push('unit/' + parsed.name);
            }

            resolve(results);
        });
    });
}

// Analyze session files for step counts
async function analyzeSessionFiles() {
    const sessionsDir = join(REPO_ROOT, 'test/comparison/sessions');
    const sessionInfo = {};

    try {
        const files = await readdir(sessionsDir);
        for (const file of files) {
            if (!file.endsWith('.session.json')) continue;

            try {
                const content = await readFile(join(sessionsDir, file), 'utf-8');
                const session = JSON.parse(content);
                const name = basename(file, '.session.json');

                sessionInfo[name] = {
                    totalSteps: session.steps?.length || 0,
                    type: session.type || 'unknown',
                    seed: session.seed
                };
            } catch (e) {
                // Skip unreadable files
            }
        }
    } catch (e) {
        // Sessions dir may not exist in early commits
    }

    return sessionInfo;
}

// Main
async function main() {
    let comparisonResults = {
        pass: [], fail: [], skip: [],
        categories: {}, sessions: {}, duration: 0
    };

    // Run comparison tests unless --unit-only is specified
    if (!UNIT_ONLY) {
        console.error('Running comparison tests...');
        comparisonResults = await runTests();
    } else {
        console.error('Skipping comparison tests (--unit-only mode)');
    }

    console.error('Running unit tests...');
    const unitResults = await runUnitTests();

    // Analyze session files (useful even in unit-only mode for metadata)
    console.error('Analyzing session files...');
    const sessionInfo = await analyzeSessionFiles();

    // Merge session file info with test results
    for (const [name, info] of Object.entries(sessionInfo)) {
        if (comparisonResults.sessions[name]) {
            comparisonResults.sessions[name].totalSteps = info.totalSteps;
            // Estimate passed steps from test results
            const sessionTests = comparisonResults.sessions[name].tests || [];
            const passingTests = sessionTests.filter(t => t.status === 'pass').length;
            comparisonResults.sessions[name].passedSteps = Math.round(
                info.totalSteps * (passingTests / Math.max(1, sessionTests.length))
            );
            if (info.totalSteps > 0) {
                comparisonResults.sessions[name].coveragePercent =
                    (comparisonResults.sessions[name].passedSteps / info.totalSteps) * 100;
            }
        }
    }

    // Combine results
    const allPass = [...unitResults.pass, ...comparisonResults.pass];
    const allFail = [...unitResults.fail, ...comparisonResults.fail];
    const allSkip = [...unitResults.skip, ...comparisonResults.skip];

    // Add unit category
    comparisonResults.categories.unit = {
        total: unitResults.pass.length + unitResults.fail.length + unitResults.skip.length,
        pass: unitResults.pass.length,
        fail: unitResults.fail.length
    };

    // Build final output
    const output = {
        stats: {
            total: allPass.length + allFail.length + allSkip.length,
            pass: allPass.length,
            fail: allFail.length,
            skip: allSkip.length,
            duration: Math.round((comparisonResults.duration + unitResults.duration) * 10) / 10
        },
        categories: comparisonResults.categories,
        sessions: comparisonResults.sessions,
        unitOnly: UNIT_ONLY  // Flag to indicate partial test run
    };

    if (!SUMMARY_ONLY) {
        output.tests = {
            pass: allPass,
            fail: allFail,
            skip: allSkip
        };
    }

    console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
