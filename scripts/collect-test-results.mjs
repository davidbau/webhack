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

import { spawn, execSync } from 'child_process';
import { readdir, readFile, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Allow REPO_ROOT to be overridden via environment variable or use cwd
const REPO_ROOT = process.env.REPO_ROOT || process.cwd();

const SUMMARY_ONLY = process.argv.includes('--summary');
const SKIP_COMPARISON = process.argv.includes('--skip-comparison');  // Skip session/comparison tests
const SKIP_E2E = process.argv.includes('--skip-e2e');  // Skip slow browser tests (default: skip)

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

// Special level names from special_levels_comparison.test.js
const SPECIAL_LEVEL_NAMES = [
    'castle', 'knox', 'vlad', 'tower', 'medusa', 'valley', 'sanctum',
    'juiblex', 'baalzebub', 'asmodeus', 'orcus', 'wizard', 'sokoban', 'soko',
    'bigroom', 'big room', 'oracle', 'mines', 'minetown', 'minend', 'minefill',
    'rogue', 'quest', 'strt', 'loca', 'goal', 'filler', 'tutorial', 'tut-',
    'gehennom', 'planes', 'earth', 'air', 'fire', 'water', 'astral'
];

// Determine category from test name
function categorize(testName) {
    const lower = testName.toLowerCase();
    if (lower.includes('chargen')) return 'chargen';
    if (lower.includes('gameplay') || lower.includes('selfplay')) return 'gameplay';
    // Check for special level names
    for (const levelName of SPECIAL_LEVEL_NAMES) {
        if (lower.includes(levelName)) return 'special';
    }
    if (lower.includes('special') || lower.includes('oracle') || lower.includes('bigroom')) return 'special';
    if (lower.includes('map') || lower.includes('depth')) return 'map';
    if (lower.includes('option')) return 'options';
    return 'unit';
}

// Extract special level session name (e.g., "Castle - seed 42" -> "special_castle_seed42")
function extractSpecialLevelSession(testName) {
    const lower = testName.toLowerCase();
    // Match pattern like "Castle - seed 42" or "Vlad Tower 1 - seed 42"
    const match = testName.match(/^([A-Za-z0-9 ]+)\s*-\s*seed\s*(\d+)/i);
    if (match) {
        const levelName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        const seed = match[2];
        return `special_${levelName}_seed${seed}`;
    }
    return null;
}

// Extract session name from test name
function extractSessionName(testName) {
    // Test names like "seed1_gameplay step 45" or "seed3_selfplay_100turns_gameplay step 45"
    // Match seed followed by digits, then underscore, then alphanumeric/underscore until space or end
    const match = testName.match(/(seed\d+_[a-z0-9_]+?)(?:\s|\.session|$)/i);
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

                // Track session-level info for all session-based tests
                if (sessionName) {
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
            categories: {},
            sessions: {},  // Track special level sessions
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

                const category = categorize(parsed.name);
                results[parsed.status].push('unit/' + parsed.name);

                // Track by category
                if (!results.categories[category]) {
                    results.categories[category] = { total: 0, pass: 0, fail: 0 };
                }
                results.categories[category].total++;
                results.categories[category][parsed.status === 'skip' ? 'pass' : parsed.status]++;

                // Track special level sessions
                if (category === 'special') {
                    const sessionName = extractSpecialLevelSession(parsed.name);
                    if (sessionName) {
                        if (!results.sessions[sessionName]) {
                            results.sessions[sessionName] = {
                                status: 'pass',
                                type: 'special',
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
            }

            resolve(results);
        });
    });
}

// Categorize a session name into one of the 4 groups
function categorizeSession(sessionName) {
    const name = sessionName.toLowerCase();
    if (name.includes('chargen')) return 'chargen';
    // Check selfplay before gameplay since selfplay names often contain 'gameplay'
    if (name.includes('selfplay')) return 'selfplay';
    // Check options patterns
    if (name.includes('option') || name.match(/seed\d+_option/)) return 'options';
    if (name.includes('gameplay')) return 'gameplay';
    // Fallback based on pattern
    if (name.includes('inventory') || name.includes('pickup') || name.includes('items')) return 'gameplay';
    return 'other';
}

// Count RNG calls in a gameplay/chargen session
function countSessionRng(session) {
    let rngCalls = 0;
    // Startup RNG calls
    if (session.startup?.rngCalls) {
        rngCalls += session.startup.rngCalls;
    }
    // Per-step RNG calls
    if (session.steps) {
        for (const step of session.steps) {
            if (step.rng) {
                rngCalls += step.rng.length;
            }
        }
    }
    return rngCalls;
}

// Analyze session files for step counts and RNG calls
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
                    totalRng: countSessionRng(session),
                    type: session.type || 'unknown',
                    seed: session.seed,
                    source: 'sessions'
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

// Analyze map session files (special levels)
async function analyzeMapFiles() {
    const mapsDir = join(REPO_ROOT, 'test/comparison/maps');
    const mapInfo = {};

    try {
        const files = await readdir(mapsDir);
        for (const file of files) {
            if (!file.endsWith('.session.json')) continue;

            try {
                const content = await readFile(join(mapsDir, file), 'utf-8');
                const session = JSON.parse(content);
                const name = basename(file, '.session.json');

                // Map sessions have levels array with rngFingerprint
                let totalRng = 0;
                let totalLevels = 0;
                if (session.levels) {
                    totalLevels = session.levels.length;
                    for (const level of session.levels) {
                        if (level.rngFingerprint) {
                            totalRng += level.rngFingerprint.length;
                        }
                    }
                }

                mapInfo[name] = {
                    totalLevels,
                    totalRng,
                    type: 'map',
                    group: session.group || 'unknown',
                    seed: session.seed,
                    source: 'maps'
                };
            } catch (e) {
                // Skip unreadable files
            }
        }
    } catch (e) {
        // Maps dir may not exist in early commits
    }

    return mapInfo;
}

// Collect code metrics for the project
async function collectCodeMetrics() {
    const metrics = {
        main: { files: 0, functions: 0, lines: 0 },
        test: { files: 0, functions: 0, lines: 0 },
        docs: { files: 0, sections: 0, lines: 0 },
        other: { files: 0, lines: 0 }
    };

    try {
        // Main game code: js/**/*.js (the main NetHack JS code)
        const mainFiles = execSync(
            'find js -name "*.js" -type f 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.main.files = parseInt(mainFiles) || 0;

        const mainLines = execSync(
            'find js -name "*.js" -type f -exec cat {} + 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.main.lines = parseInt(mainLines) || 0;

        // Count functions in main code (function declarations and arrow functions)
        const mainFunctions = execSync(
            'find js -name "*.js" -type f -exec grep -E "^\\s*(async\\s+)?function\\s+\\w+|^\\s*(export\\s+)?(const|let|var)\\s+\\w+\\s*=\\s*(async\\s+)?\\(" {} + 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.main.functions = parseInt(mainFunctions) || 0;

        // Test code: test/**/*.js
        const testFiles = execSync(
            'find test -name "*.js" -type f 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.test.files = parseInt(testFiles) || 0;

        const testLines = execSync(
            'find test -name "*.js" -type f -exec cat {} + 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.test.lines = parseInt(testLines) || 0;

        const testFunctions = execSync(
            'find test -name "*.js" -type f -exec grep -E "^\\s*(async\\s+)?function\\s+\\w+|^\\s*(export\\s+)?(const|let|var)\\s+\\w+\\s*=\\s*(async\\s+)?\\(|^\\s*(it|describe|test)\\s*\\(" {} + 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.test.functions = parseInt(testFunctions) || 0;

        // Documentation: *.md files and doc/**
        const docFiles = execSync(
            'find . -maxdepth 2 -name "*.md" -type f 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.docs.files = parseInt(docFiles) || 0;

        const docLines = execSync(
            'find . -maxdepth 2 -name "*.md" -type f -exec cat {} + 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.docs.lines = parseInt(docLines) || 0;

        // Count sections (## headings) in docs
        const docSections = execSync(
            'find . -maxdepth 2 -name "*.md" -type f -exec grep -E "^#{1,3}\\s" {} + 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.docs.sections = parseInt(docSections) || 0;

        // Other files: config, scripts, etc. (excluding node_modules, .git, test, src, docs)
        const otherFiles = execSync(
            'find . -type f \\( -name "*.json" -o -name "*.mjs" -o -name "*.css" -o -name "*.html" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/test/*" -not -path "*/src/*" 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.other.files = parseInt(otherFiles) || 0;

        const otherLines = execSync(
            'find . -type f \\( -name "*.json" -o -name "*.mjs" -o -name "*.css" -o -name "*.html" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/test/*" -not -path "*/src/*" -exec cat {} + 2>/dev/null | wc -l',
            { cwd: REPO_ROOT, encoding: 'utf8' }
        ).trim();
        metrics.other.lines = parseInt(otherLines) || 0;

    } catch (e) {
        console.error('Error collecting code metrics:', e.message);
    }

    return metrics;
}

// Calculate fixture totals from session files (only gameplay/chargen with PRNG data)
// Map files are excluded since their tests are stubs that don't verify PRNG
function calculateFixtureTotals(sessionInfo) {
    const totals = {
        sessions: 0,
        steps: 0,
        rngCalls: 0
    };

    for (const info of Object.values(sessionInfo)) {
        // Only count sessions with actual PRNG verification data
        if (info.totalRng > 0 || info.totalSteps > 0) {
            totals.sessions++;
            totals.steps += info.totalSteps || 0;
            totals.rngCalls += info.totalRng || 0;
        }
    }

    return totals;
}

// Main
async function main() {
    let comparisonResults = {
        pass: [], fail: [], skip: [],
        categories: {}, sessions: {}, duration: 0
    };

    // Run comparison/session tests unless --skip-comparison is specified
    if (!SKIP_COMPARISON) {
        console.error('Running comparison tests (sessions)...');
        comparisonResults = await runTests();
    } else {
        console.error('Skipping comparison tests (--skip-comparison mode)');
    }

    console.error('Running unit tests...');
    const unitResults = await runUnitTests();

    // Analyze session files for PRNG counts (useful even in unit-only mode for metadata)
    console.error('Analyzing session files...');
    const sessionInfo = await analyzeSessionFiles();

    // Analyze map session files for special level RNG data
    console.error('Analyzing map files...');
    const mapInfo = await analyzeMapFiles();

    // Calculate fixture totals (only sessions with actual PRNG data)
    const fixtureTotals = calculateFixtureTotals(sessionInfo);
    // Add map session totals
    for (const info of Object.values(mapInfo)) {
        fixtureTotals.sessions++;
        fixtureTotals.rngCalls += info.totalRng || 0;
    }

    // Collect code metrics
    console.error('Collecting code metrics...');
    const codeMetrics = await collectCodeMetrics();

    // Merge session file info with test results
    for (const [name, info] of Object.entries(sessionInfo)) {
        if (comparisonResults.sessions[name]) {
            comparisonResults.sessions[name].totalSteps = info.totalSteps;
            comparisonResults.sessions[name].totalRng = info.totalRng;
            // Estimate passed steps from test results
            const sessionTests = comparisonResults.sessions[name].tests || [];
            const passingTests = sessionTests.filter(t => t.status === 'pass').length;
            const passRatio = passingTests / Math.max(1, sessionTests.length);
            comparisonResults.sessions[name].passedSteps = Math.round(info.totalSteps * passRatio);
            comparisonResults.sessions[name].passedRng = Math.round(info.totalRng * passRatio);
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

    // Merge unit test categories (special, unit, etc.)
    for (const [cat, stats] of Object.entries(unitResults.categories || {})) {
        if (!comparisonResults.categories[cat]) {
            comparisonResults.categories[cat] = { total: 0, pass: 0, fail: 0 };
        }
        comparisonResults.categories[cat].total += stats.total;
        comparisonResults.categories[cat].pass += stats.pass;
        comparisonResults.categories[cat].fail += stats.fail;
    }

    // Merge special level sessions from unit tests
    for (const [name, session] of Object.entries(unitResults.sessions || {})) {
        comparisonResults.sessions[name] = session;
    }

    // Merge map session RNG data into special level sessions
    // Unit test session: special_{level}_seed{N} -> Map file: seed{N}_special_{group}
    //
    // Two mappings needed:
    // 1. groupMap: maps test session name part to map file group name
    // 2. levelKeyMap: maps test session name part to actual level name in session file

    // Maps unit test level name to map file group name
    const groupMap = {
        // Bigroom
        'big_room': 'bigroom',
        // Planes - all plane levels are in the "planes" group file
        'astral_plane': 'planes',
        'plane_of_air': 'planes',
        'plane_of_earth': 'planes',
        'plane_of_fire': 'planes',
        'plane_of_water': 'planes',
        // Mines - all mine levels are in the "mines" group file
        'mines_town': 'mines',
        'mines_end': 'mines',
        // Rogue
        'rogue_level': 'rogue',
        // Tutorial - all tutorials in one group file
        'tutorial_1': 'tutorial',
        'tutorial_2': 'tutorial',
        // Gehennom group (demon lairs)
        'gehennom_filler': 'gehennom',
        'sanctum': 'gehennom',
        'juiblex': 'gehennom',
        'baalzebub': 'gehennom',
        'asmodeus': 'gehennom',
        'orcus': 'gehennom',
        'fake_wizard_tower_1': 'gehennom',
        'fake_wizard_tower_2': 'gehennom',
        // Wizard tower (separate from gehennom group)
        'wizard1': 'wizard',
        'wizard2': 'wizard',
        'wizard3': 'wizard',
        // Vlad's tower
        'vlad_tower_1': 'vlad',
        'vlad_tower_2': 'vlad',
        'vlad_tower_3': 'vlad',
        // Sokoban
        'sokoban_1': 'sokoban',
        'sokoban_2': 'sokoban',
        'sokoban_3': 'sokoban',
        'sokoban_4': 'sokoban',
        // Quest
        'quest_locate': 'quest',
        'quest_goal': 'quest',
        'quest_start': 'quest',
        'quest_filler': 'quest',
        // Filler levels (hellfill, minefill)
        'gehennom_filler': 'filler',
        'mines_filler': 'filler',
    };

    // Maps unit test level name to actual levelName in session file
    const levelKeyMap = {
        // Planes - match the levelName field in the session files
        'astral_plane': 'astral',
        'plane_of_air': 'air',
        'plane_of_earth': 'earth',
        'plane_of_fire': 'fire',
        'plane_of_water': 'water',
        // Mines
        'mines_town': 'minetn',
        'mines_end': 'minend',
        // Rogue
        'rogue_level': 'rogue',
        // Tutorial
        'tutorial_1': 'tut-1',
        'tutorial_2': 'tut-2',
        // Gehennom levels
        'fake_wizard_tower_1': 'fakewiz1',
        'fake_wizard_tower_2': 'fakewiz2',
        'baalzebub': 'baalz',
        // Vlad tower
        'vlad_tower_1': 'tower1',
        'vlad_tower_2': 'tower2',
        'vlad_tower_3': 'tower3',
        // Sokoban
        'sokoban_1': 'soko1',
        'sokoban_2': 'soko2',
        'sokoban_3': 'soko3',
        'sokoban_4': 'soko4',
        // Bigroom
        'big_room': 'bigrm',
        // Filler
        'gehennom_filler': 'hellfill',
        'mines_filler': 'minefill',
    };

    // Build a lookup of individual level RNG counts from map files
    // Key format: {seed}_{levelName} where levelName matches the session file's level.levelName
    const levelRngLookup = {};
    for (const [mapName, mapSession] of Object.entries(mapInfo)) {
        // Parse: seed42_special_castle -> seed=42, group=castle
        const mapMatch = mapName.match(/^seed(\d+)_special_(.+)$/);
        if (!mapMatch) continue;
        const mapSeed = mapMatch[1];

        // Load the actual session file to get per-level RNG counts
        try {
            const content = require('fs').readFileSync(
                join(REPO_ROOT, 'test/comparison/maps', `${mapName}.session.json`), 'utf-8'
            );
            const sessionData = JSON.parse(content);
            for (const level of sessionData.levels || []) {
                const levelKey = `${mapSeed}_${level.levelName?.toLowerCase()}`;
                levelRngLookup[levelKey] = level.rngFingerprint?.length || 0;
            }
        } catch (e) {
            // Skip if file can't be read
        }
    }

    for (const [unitSessionName, session] of Object.entries(comparisonResults.sessions)) {
        if (!unitSessionName.startsWith('special_')) continue;

        // Parse: special_castle_seed42 -> level=castle, seed=42
        const match = unitSessionName.match(/^special_(.+)_seed(\d+)$/);
        if (!match) continue;

        const levelName = match[1];
        const seed = match[2];

        // Map to the group file name (e.g., plane_of_air -> planes)
        const groupName = groupMap[levelName] || levelName.replace(/_/g, '');

        // Map to the actual levelName in the session file (e.g., plane_of_air -> air)
        const actualLevelName = levelKeyMap[levelName] || levelName.replace(/_/g, '');

        // Try to find specific level RNG count using the mapped level name
        const levelKey = `${seed}_${actualLevelName}`;
        let levelRng = levelRngLookup[levelKey];

        // If not found, try the group's total RNG (for single-level groups)
        if (levelRng === undefined) {
            const mapSessionName = `seed${seed}_special_${groupName}`;
            const mapSession = mapInfo[mapSessionName];
            if (mapSession) {
                // For single-level groups, use total; for multi-level, we couldn't find the specific level
                levelRng = mapSession.totalRng;
                session.totalLevels = mapSession.totalLevels;
            }
        }

        if (levelRng !== undefined) {
            session.totalRng = levelRng;
            if (session.status === 'pass') {
                session.passedRng = levelRng;
            } else {
                session.passedRng = 0;
            }
        }
    }

    // Calculate aggregate session stats by group
    const sessionGroups = {
        chargen: { sessions: [], passing: 0, total: 0, steps: 0, stepsPassing: 0, rng: 0, rngPassing: 0 },
        gameplay: { sessions: [], passing: 0, total: 0, steps: 0, stepsPassing: 0, rng: 0, rngPassing: 0 },
        selfplay: { sessions: [], passing: 0, total: 0, steps: 0, stepsPassing: 0, rng: 0, rngPassing: 0 },
        options: { sessions: [], passing: 0, total: 0, steps: 0, stepsPassing: 0, rng: 0, rngPassing: 0 },
        special: { sessions: [], passing: 0, total: 0, steps: 0, stepsPassing: 0, rng: 0, rngPassing: 0 }
    };

    let sessionsPassing = 0, sessionsTotal = 0;
    let stepsPassing = 0, stepsTotal = 0;
    let rngPassing = 0, rngTotal = 0;

    for (const [name, session] of Object.entries(comparisonResults.sessions)) {
        // Special level sessions (tracked by rngFingerprint from map files)
        if (name.startsWith('special_') || session.type === 'special') {
            const sessionData = {
                name,
                status: session.status,
                levels: session.totalLevels || 0,
                rng: session.totalRng || 0,
                rngPassing: session.passedRng || 0
            };
            sessionGroups.special.sessions.push(sessionData);
            sessionGroups.special.total++;
            if (session.status === 'pass') sessionGroups.special.passing++;
            sessionGroups.special.rng += sessionData.rng;
            sessionGroups.special.rngPassing += sessionData.rngPassing;

            // Count in totals
            sessionsTotal++;
            if (session.status === 'pass') sessionsPassing++;
            rngTotal += sessionData.rng;
            rngPassing += sessionData.rngPassing;
        }
        // Sessions with PRNG verification data
        else if (session.totalRng > 0 || session.totalSteps > 0) {
            const group = categorizeSession(name);
            if (!sessionGroups[group]) {
                sessionGroups[group] = { sessions: [], passing: 0, total: 0, steps: 0, stepsPassing: 0, rng: 0, rngPassing: 0 };
            }

            const sessionData = {
                name,
                status: session.status,
                steps: session.totalSteps || 0,
                stepsPassing: session.passedSteps || 0,
                rng: session.totalRng || 0,
                rngPassing: session.passedRng || 0
            };
            sessionGroups[group].sessions.push(sessionData);
            sessionGroups[group].total++;
            if (session.status === 'pass') sessionGroups[group].passing++;
            sessionGroups[group].steps += sessionData.steps;
            sessionGroups[group].stepsPassing += sessionData.stepsPassing;
            sessionGroups[group].rng += sessionData.rng;
            sessionGroups[group].rngPassing += sessionData.rngPassing;

            // Aggregate totals
            sessionsTotal++;
            if (session.status === 'pass') sessionsPassing++;
            stepsTotal += session.totalSteps || 0;
            stepsPassing += session.passedSteps || 0;
            rngTotal += session.totalRng || 0;
            rngPassing += session.passedRng || 0;
        }
    }

    // Sort sessions within each group by name
    for (const group of Object.values(sessionGroups)) {
        group.sessions.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Build final output
    const output = {
        stats: {
            total: allPass.length + allFail.length + allSkip.length,
            pass: allPass.length,
            fail: allFail.length,
            skip: allSkip.length,
            duration: Math.round((comparisonResults.duration + unitResults.duration) * 10) / 10
        },
        // Aggregate session metrics for dashboard
        sessionStats: {
            sessionsPassing,
            sessionsTotal,
            stepsPassing,
            stepsTotal,
            rngPassing,
            rngTotal
        },
        // Session groups (chargen, gameplay, selfplay, options)
        sessionGroups,
        // Code metrics (main, test, docs, other)
        codeMetrics,
        // Fixture totals (what's available in test fixtures)
        fixtureTotals,
        categories: comparisonResults.categories,
        skipComparison: SKIP_COMPARISON  // Flag to indicate partial test run
    };

    if (!SUMMARY_ONLY) {
        output.tests = {
            pass: allPass,
            fail: allFail,
            skip: allSkip
        };
        // Include full session details in non-summary mode
        output.sessions = comparisonResults.sessions;
    }

    console.log(JSON.stringify(output, null, 2));
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
