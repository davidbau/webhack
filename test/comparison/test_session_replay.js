#!/usr/bin/env node
/**
 * Replay a captured C NetHack session with the JS engine and report RNG parity.
 *
 * Usage:
 *   node test/comparison/test_session_replay.js <session.json> [--verbose] [--stop-on-mismatch]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { compareRng, replaySession, generateStartupWithRng, hasStartupBurstInFirstStep } from './session_helpers.js';

function loadSession(filepath) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function usage() {
    console.log('Usage: node test/comparison/test_session_replay.js <session.json> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose              Print every step result');
    console.log('  --stop-on-mismatch     Stop at first mismatch');
    console.log('  --help                 Show this help');
}

function mismatchLine(prefix, div) {
    return `${prefix} diverges at ${div.index}: JS="${div.js}" C="${div.session}"`;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('--help')) {
        usage();
        process.exit(0);
    }

    const sessionPath = path.resolve(args[0]);
    const verbose = args.includes('--verbose');
    const stopOnMismatch = args.includes('--stop-on-mismatch');

    const session = loadSession(sessionPath);
    const seed = session.seed;

    console.log(`Session: ${sessionPath}`);
    console.log(`Seed: ${seed}`);
    if (session.character) {
        console.log(`Character: ${session.character.name} (${session.character.role} ${session.character.race} ${session.character.gender} ${session.character.align})`);
    }

    let failures = 0;

    if (session.startup?.rng && !hasStartupBurstInFirstStep(session)) {
        const startup = generateStartupWithRng(seed, session);
        const div = compareRng(startup.rng, session.startup.rng);
        if (div.index === -1) {
            console.log(`startup: ok (${startup.rngCalls} calls)`);
        } else {
            failures++;
            console.log(mismatchLine('startup RNG', div));
            if (stopOnMismatch) {
                process.exit(1);
            }
        }
    } else if (hasStartupBurstInFirstStep(session)) {
        console.log('startup: skipped (keylog trace stores startup RNG in step 0)');
    }

    const replay = await replaySession(seed, session);
    const totalSteps = (session.steps || []).length;
    let matchedSteps = 0;

    for (let i = 0; i < totalSteps; i++) {
        const jsStep = replay.steps[i];
        const cStep = session.steps[i];
        const div = compareRng(jsStep?.rng || [], cStep?.rng || []);
        const ok = div.index === -1;
        if (ok) {
            matchedSteps++;
            if (verbose) {
                console.log(`step ${i}: ok (${cStep.action || cStep.key})`);
            }
            continue;
        }

        failures++;
        console.log(`step ${i} (${cStep.action || cStep.key}): ${mismatchLine('RNG', div)}`);
        if (stopOnMismatch) {
            break;
        }
    }

    console.log(`steps: ${matchedSteps}/${totalSteps} matched`);
    if (failures > 0) {
        process.exit(1);
    }
    console.log('result: PASS');
}

main().catch((err) => {
    console.error(err);
    process.exit(2);
});
