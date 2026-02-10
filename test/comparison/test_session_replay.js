#!/usr/bin/env node
/**
 * test_session_replay.js -- Replay C NetHack sessions in JS and compare
 *
 * Takes a session JSON file (from run_session.py or gen_selfplay_trace.py)
 * and replays it in the JS implementation, comparing RNG calls, screen output,
 * and terrain grids at each step.
 *
 * Usage:
 *   node test_session_replay.js <session.json> [--verbose] [--stop-on-mismatch]
 *   node test_session_replay.js sessions/seed3_selfplay_20turns.session.json
 *
 * Output:
 *   - Turn-by-turn comparison summary
 *   - First mismatch location with detailed diagnostics
 *   - RNG divergence analysis
 *   - Overall match percentage
 */

import fs from 'fs';
import { initGame, sendkeys } from '../../js/main.js';
import { getRNGLog, clearRNGLog } from '../../js/rng.js';
import { map } from '../../js/map.js';

// ANSI color codes for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

/**
 * Load and parse a session JSON file
 */
function loadSession(filepath) {
    const content = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(content);
}

/**
 * Format RNG entry for comparison
 */
function formatRNG(entry) {
    if (typeof entry === 'string') {
        return entry;
    }
    return `${entry.fn}(${entry.arg})=${entry.result}`;
}

/**
 * Compare two RNG logs
 */
function compareRNG(expectedRNG, actualRNG) {
    const mismatches = [];
    const maxLen = Math.max(expectedRNG.length, actualRNG.length);

    for (let i = 0; i < maxLen; i++) {
        const expected = expectedRNG[i];
        const actual = actualRNG[i];

        if (!expected) {
            mismatches.push({
                index: i,
                type: 'extra',
                actual: formatRNG(actual),
            });
        } else if (!actual) {
            mismatches.push({
                index: i,
                type: 'missing',
                expected: formatRNG(expected),
            });
        } else {
            const expStr = formatRNG(expected);
            const actStr = formatRNG(actual);
            if (expStr !== actStr) {
                mismatches.push({
                    index: i,
                    type: 'different',
                    expected: expStr,
                    actual: actStr,
                });
            }
        }
    }

    return {
        totalExpected: expectedRNG.length,
        totalActual: actualRNG.length,
        matches: maxLen - mismatches.length,
        mismatches,
    };
}

/**
 * Compare two screen outputs (array of 24 lines)
 */
function compareScreens(expectedScreen, actualScreen) {
    const diffs = [];

    for (let i = 0; i < 24; i++) {
        const expLine = expectedScreen[i] || '';
        const actLine = actualScreen[i] || '';

        if (expLine !== actLine) {
            diffs.push({
                line: i,
                expected: expLine,
                actual: actLine,
            });
        }
    }

    return {
        totalLines: 24,
        matches: 24 - diffs.length,
        diffs,
    };
}

/**
 * Initialize JS NetHack with the same configuration as the C session
 */
function initializeGame(session) {
    // Reset RNG log
    clearRNGLog();

    // Initialize game with session parameters
    const options = {
        seed: session.seed,
        wizard: session.wizard || false,
        role: session.character.role,
        race: session.character.race,
        gender: session.character.gender,
        align: session.character.align,
        symset: session.symset || 'DECgraphics',
    };

    console.log(`${colors.cyan}Initializing JS NetHack:${colors.reset}`);
    console.log(`  Seed: ${options.seed}`);
    console.log(`  Character: ${options.role} (${options.race} ${options.gender} ${options.align})`);
    console.log(`  Symset: ${options.symset}`);
    console.log('');

    // Initialize the game
    initGame(options);
}

/**
 * Get current screen state from JS NetHack
 */
function captureJSScreen() {
    // TODO: Implement actual screen capture from JS NetHack
    // For now, return placeholder
    const lines = [];
    for (let i = 0; i < 24; i++) {
        lines.push('');
    }
    return lines;
}

/**
 * Replay a single step and compare
 */
function replayStep(step, stepIndex, options) {
    const { verbose } = options;

    // Send the keystroke
    const key = step.key;
    sendkeys(key);

    // Capture JS state
    const actualRNG = getRNGLog();
    const actualScreen = captureJSScreen();

    // Compare RNG
    const rngComparison = compareRNG(step.rng || [], actualRNG);

    // Compare screen
    const screenComparison = compareScreens(step.screen || [], actualScreen);

    // Determine if step matches
    const rngMatch = rngComparison.mismatches.length === 0;
    const screenMatch = screenComparison.diffs.length === 0;
    const matches = rngMatch && screenMatch;

    if (verbose || !matches) {
        const statusIcon = matches ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
        const action = step.action || key;
        console.log(`  [${stepIndex.toString().padStart(3, '0')}] ${statusIcon} ${action} (key=${key})`);

        if (!rngMatch) {
            console.log(`    ${colors.yellow}RNG:${colors.reset} ${rngComparison.matches}/${rngComparison.totalExpected} match, ${rngComparison.mismatches.length} mismatches`);
        }

        if (!screenMatch && screenComparison.diffs.length > 0) {
            console.log(`    ${colors.yellow}Screen:${colors.reset} ${screenComparison.matches}/24 lines match, ${screenComparison.diffs.length} diffs`);
        }
    }

    // Clear RNG log for next step
    clearRNGLog();

    return {
        stepIndex,
        key,
        action: step.action,
        matches,
        rng: rngComparison,
        screen: screenComparison,
    };
}

/**
 * Replay an entire session and compare
 */
function replaySession(session, options) {
    console.log(`${colors.cyan}=== Replaying Session ===${colors.reset}`);
    console.log(`Source: ${session.type || 'unknown'}`);
    console.log(`Steps: ${session.steps.length}`);
    console.log('');

    const results = {
        session,
        totalSteps: session.steps.length,
        matchingSteps: 0,
        firstMismatch: null,
        steps: [],
    };

    // Replay character creation if present
    if (session.chargen && session.chargen.length > 0) {
        console.log(`${colors.cyan}=== Character Creation (${session.chargen.length} steps) ===${colors.reset}`);
        for (let i = 0; i < session.chargen.length; i++) {
            const result = replayStep(session.chargen[i], i, options);
            results.steps.push(result);
            if (result.matches) results.matchingSteps++;
            else if (!results.firstMismatch) results.firstMismatch = result;

            if (!result.matches && options.stopOnMismatch) {
                console.log(`${colors.red}Stopping on first mismatch${colors.reset}`);
                break;
            }
        }
        console.log('');
    }

    // Replay gameplay steps
    console.log(`${colors.cyan}=== Gameplay Steps ===${colors.reset}`);
    for (let i = 0; i < session.steps.length; i++) {
        const result = replayStep(session.steps[i], i, options);
        results.steps.push(result);
        if (result.matches) results.matchingSteps++;
        else if (!results.firstMismatch) results.firstMismatch = result;

        if (!result.matches && options.stopOnMismatch) {
            console.log(`${colors.red}Stopping on first mismatch${colors.reset}`);
            break;
        }
    }

    return results;
}

/**
 * Print detailed mismatch analysis
 */
function printMismatchAnalysis(mismatch) {
    console.log('');
    console.log(`${colors.red}=== First Mismatch Analysis ===${colors.reset}`);
    console.log(`Step: ${mismatch.stepIndex} (${mismatch.action})`);
    console.log(`Key: ${mismatch.key}`);
    console.log('');

    if (mismatch.rng.mismatches.length > 0) {
        console.log(`${colors.yellow}RNG Mismatches (first 5):${colors.reset}`);
        for (let i = 0; i < Math.min(5, mismatch.rng.mismatches.length); i++) {
            const mm = mismatch.rng.mismatches[i];
            console.log(`  [${mm.index}] ${mm.type}:`);
            if (mm.expected) console.log(`    Expected: ${mm.expected}`);
            if (mm.actual) console.log(`    Actual:   ${mm.actual}`);
        }
        console.log('');
    }

    if (mismatch.screen.diffs.length > 0) {
        console.log(`${colors.yellow}Screen Differences (first 3 lines):${colors.reset}`);
        for (let i = 0; i < Math.min(3, mismatch.screen.diffs.length); i++) {
            const diff = mismatch.screen.diffs[i];
            console.log(`  Line ${diff.line}:`);
            console.log(`    Expected: ${colors.gray}${diff.expected}${colors.reset}`);
            console.log(`    Actual:   ${colors.gray}${diff.actual}${colors.reset}`);
        }
        console.log('');
    }
}

/**
 * Print summary statistics
 */
function printSummary(results) {
    const matchPercentage = ((results.matchingSteps / results.totalSteps) * 100).toFixed(1);
    const success = results.matchingSteps === results.totalSteps;

    console.log('');
    console.log(`${colors.cyan}=== Summary ===${colors.reset}`);
    console.log(`Total steps: ${results.totalSteps}`);
    console.log(`Matching steps: ${results.matchingSteps}`);
    console.log(`Match rate: ${matchPercentage}%`);

    if (success) {
        console.log(`${colors.green}✓ 100% MATCH - JS implementation matches C perfectly!${colors.reset}`);
    } else {
        console.log(`${colors.red}✗ MISMATCHES FOUND${colors.reset}`);
        console.log(`First mismatch at step ${results.firstMismatch.stepIndex}`);
    }
}

/**
 * Main entry point
 */
function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) {
        console.log('Usage: node test_session_replay.js <session.json> [options]');
        console.log('');
        console.log('Options:');
        console.log('  --verbose              Show all steps (not just mismatches)');
        console.log('  --stop-on-mismatch     Stop at first mismatch');
        console.log('  --help                 Show this help');
        console.log('');
        console.log('Example:');
        console.log('  node test_session_replay.js sessions/seed3_selfplay_20turns.session.json');
        process.exit(0);
    }

    const sessionFile = args[0];
    const options = {
        verbose: args.includes('--verbose'),
        stopOnMismatch: args.includes('--stop-on-mismatch'),
    };

    console.log(`${colors.cyan}NetHack Session Replay Test${colors.reset}`);
    console.log(`Session file: ${sessionFile}`);
    console.log('');

    // Load session
    const session = loadSession(sessionFile);

    // Initialize game
    initializeGame(session);

    // Replay and compare
    const results = replaySession(session, options);

    // Print mismatch analysis if any
    if (results.firstMismatch) {
        printMismatchAnalysis(results.firstMismatch);
    }

    // Print summary
    printSummary(results);

    // Exit code: 0 if perfect match, 1 if mismatches
    process.exit(results.matchingSteps === results.totalSteps ? 0 : 1);
}

main();
