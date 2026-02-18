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
import { compareRng, replaySession, generateStartupWithRng, hasStartupBurstInFirstStep, getSessionStartup, getSessionCharacter, getSessionGameplaySteps } from './session_helpers.js';
import { normalizeSymsetLine } from './symset_normalization.js';

function loadSession(filepath) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function usage() {
    console.log('Usage: node test/comparison/test_session_replay.js <session.json> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose              Print every step result');
    console.log('  --stop-on-mismatch     Stop at first mismatch');
    console.log('  --no-compare-rng       Disable RNG comparison');
    console.log('  --no-compare-screen    Disable screen comparison (enabled by default)');
    console.log('  --rows-1-23            Exclude row 0 (message row) from screen comparison');
    console.log('  --compare-screen       Explicitly enable screen comparison');
    console.log('  --strict-message-row   Explicitly include row 0 (message row)');
    console.log('  --help                 Show this help');
}

function mismatchLine(prefix, div) {
    return `${prefix} diverges at ${div.index}: JS="${div.js}" C="${div.session}"`;
}

function inferReplayStart(sessionPath, session) {
    if (Number.isInteger(session?.startDnum) || Number.isInteger(session?.startDlevel)) {
        return {
            startDnum: Number.isInteger(session?.startDnum) ? session.startDnum : undefined,
            startDlevel: Number.isInteger(session?.startDlevel) ? session.startDlevel : 1,
            startDungeonAlign: Number.isInteger(session?.startDungeonAlign)
                ? session.startDungeonAlign
                : undefined,
        };
    }
    return {};
}

const DEC_FROM_UNICODE = {
    '\u250c': 'l',
    '\u2500': 'q',
    '\u2510': 'k',
    '\u2502': 'x',
    '\u2514': 'm',
    '\u2518': 'j',
    '\u253c': 'n',
    '\u251c': 't',
    '\u2524': 'u',
    '\u2534': 'v',
    '\u252c': 'w',
    '\u00b7': 'a',
};

function normalizeCapturedLine(line, row, screenMode, isMapScreen, mapConvertEnd = null, prependMissingCol0 = true) {
    let out = (line || '').replace(/\r$/, '').replace(/[\x0e\x0f]/g, '');
    // Some tmux capture paths drop terminal column 0 on non-top rows,
    // regardless of charset mode. Accepting both padded and unpadded
    // captured lines keeps strict comparisons robust to that artifact.
    if (row >= 1 && prependMissingCol0) {
        // tmux capture drops terminal column 0 for non-top rows.
        out = ` ${out}`;
    }
    if (screenMode === 'decgraphics' && !isMapScreen) {
        // Some tmux captures materialize DEC alternate charset glyphs directly
        // in non-map text screens (inventory/menu/messages). Convert those back
        // to their source ASCII bytes for stable comparison.
        out = [...out].map(ch => DEC_FROM_UNICODE[ch] || ch).join('');
    }
    if (isMapScreen && screenMode === 'decgraphics' && row >= 1 && row <= 21) {
        const chars = [...out];
        const end = Number.isInteger(mapConvertEnd) ? mapConvertEnd : chars.length;
        out = chars.map((ch, idx) => (idx < end ? normalizeSymsetLine(ch, { decGraphics: true }) : ch)).join('');
    }
    return out.padEnd(80);
}

function normalizeJsLine(line, row, screenMode, isMapScreen, mapConvertEnd = null) {
    let out = (line || '').replace(/[\x0e\x0f]/g, '');
    if (screenMode === 'decgraphics' && isMapScreen && row >= 1 && row <= 21) {
        const chars = [...out];
        const end = Number.isInteger(mapConvertEnd) ? mapConvertEnd : chars.length;
        out = chars.map((ch, idx) => (idx < end ? normalizeSymsetLine(ch, { decGraphics: true }) : ch)).join('');
    }
    return out.padEnd(80);
}

function normalizeStatusLine(line, row) {
    if (row === 22) {
        const idx = line.indexOf('St:');
        if (idx >= 0) {
            let out = line.slice(idx).trimEnd();
            // C/JS formatting variant: JS may include trailing score ("S:<n>")
            // while captured C status omits it in some sessions.
            out = out.replace(/\s+S:\d+\s*$/, '');
            return out.padEnd(80);
        }
        return line;
    }
    if (row === 23) {
        const idx = line.indexOf('Dlvl:');
        if (idx >= 0) {
            let out = line.slice(idx).trimEnd();
            // Normalize XP display differences: "Xp:1/3" vs "Xp:1".
            out = out.replace(/Xp:(\d+)\/\d+/g, 'Xp:$1');
            return out.padEnd(80);
        }
        return line;
    }
    return line;
}

function compareStepScreen(jsScreen, capturedScreen, screenMode, strictMessageRow = false) {
    if (!Array.isArray(capturedScreen) || capturedScreen.length === 0) {
        return { ok: true, row: -1, js: '', c: '' };
    }
    const isMapScreen = capturedScreen.some(line => typeof line === 'string' && line.includes('Dlvl:'));
    const rowStart = strictMessageRow ? 0 : 1;
    for (let row = rowStart; row < 24; row++) {
        const rawCaptured = (capturedScreen[row] || '').replace(/\r$/, '').replace(/[\x0e\x0f]/g, '');
        const rawJs = (jsScreen?.[row] || '').replace(/[\x0e\x0f]/g, '');
        const detectedTextCol = (() => {
            if (!isMapScreen || row < 1 || row > 21) return null;
            for (const line of [rawCaptured, rawJs]) {
                const rel = line.slice(30).search(/[A-Za-z]/);
                if (rel >= 0) {
                    const idx = 30 + rel;
                    const right = line.slice(idx);
                    if (right.includes(' - ')
                        || /Weapons|Armor|Comestibles|Scrolls|Spellbooks|Potions|Rings|Wands|Tools|\(end\)/.test(right)) {
                        return idx;
                    }
                }
            }
            return null;
        })();
        const cLineWithPad = normalizeStatusLine(
            normalizeCapturedLine(capturedScreen[row], row, screenMode, isMapScreen, detectedTextCol),
            row
        );
        const cLineNoPad = normalizeStatusLine(
            normalizeCapturedLine(capturedScreen[row], row, screenMode, isMapScreen, detectedTextCol, false),
            row
        );
        const jLine = normalizeStatusLine(
            normalizeJsLine(jsScreen?.[row], row, screenMode, isMapScreen, detectedTextCol),
            row
        );
        // Some captured sessions already include terminal column 0 while others
        // reflect tmux's dropped column for non-top rows. Accept either.
        if (cLineWithPad !== jLine && cLineNoPad !== jLine) {
            // Some mixed map+menu rows in captured sessions (notably inventory
            // overlays) can have map cells aligned like padded rows while the
            // right-side text block aligns like unpadded rows. Handle only this
            // narrow artifact by trying a split at the first right-side word.
            const textCol = detectedTextCol;
            if (Number.isInteger(textCol) && textCol >= 30) {
                const hybridPadLeft = cLineWithPad.slice(0, textCol) + cLineNoPad.slice(textCol);
                const hybridNoPadLeft = cLineNoPad.slice(0, textCol) + cLineWithPad.slice(textCol);
                const hybridPadLeftShift = cLineWithPad.slice(0, textCol + 1) + cLineNoPad.slice(textCol + 1);
                const hybridNoPadLeftShift = cLineNoPad.slice(0, textCol + 1) + cLineWithPad.slice(textCol + 1);
                if (
                    hybridPadLeft === jLine
                    || hybridNoPadLeft === jLine
                    || hybridPadLeftShift === jLine
                    || hybridNoPadLeftShift === jLine
                ) {
                    continue;
                }
            }
            return { ok: false, row, js: jLine, c: cLineWithPad };
        }
    }
    return { ok: true, row: -1, js: '', c: '' };
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
    const compareRngEnabled = !args.includes('--no-compare-rng');
    const compareScreen = args.includes('--no-compare-screen')
        ? false
        : true;
    const strictMessageRow = compareScreen && !args.includes('--rows-1-23');

    const session = loadSession(sessionPath);
    const seed = session.seed;
    const sessionStartup = getSessionStartup(session);
    const sessionCharacter = getSessionCharacter(session);
    const gameplaySteps = getSessionGameplaySteps(session);

    console.log(`Session: ${sessionPath}`);
    console.log(`Seed: ${seed}`);
    if (sessionCharacter.name) {
        console.log(`Character: ${sessionCharacter.name} (${sessionCharacter.role} ${sessionCharacter.race} ${sessionCharacter.gender} ${sessionCharacter.align})`);
    }

    let failures = 0;

    if (compareRngEnabled && sessionStartup?.rng && !hasStartupBurstInFirstStep(session)) {
        const startup = generateStartupWithRng(seed, session);
        const div = compareRng(startup.rng, sessionStartup.rng);
        if (div.index === -1) {
            console.log(`startup: ok (${startup.rngCalls} calls)`);
        } else {
            failures++;
            console.log(mismatchLine('startup RNG', div));
            if (stopOnMismatch) {
                process.exit(1);
            }
        }
    } else if (compareRngEnabled && hasStartupBurstInFirstStep(session)) {
        console.log('startup: skipped (keylog trace stores startup RNG in step 0)');
    }

    const replayOpts = inferReplayStart(sessionPath, session);
    const replay = await replaySession(seed, session, {
        ...replayOpts,
        captureScreens: compareScreen,
    });
    const totalSteps = gameplaySteps.length;
    let matchedSteps = 0;
    let matchedScreenSteps = 0;

    for (let i = 0; i < totalSteps; i++) {
        const jsStep = replay.steps[i];
        const cStep = gameplaySteps[i];
        if (compareRngEnabled) {
            const div = compareRng(jsStep?.rng || [], cStep?.rng || []);
            const ok = div.index === -1;
            if (ok) {
                matchedSteps++;
                if (verbose) {
                    console.log(`step ${i}: ok (${cStep.action || cStep.key})`);
                }
            } else {
                failures++;
                console.log(`step ${i} (${cStep.action || cStep.key}): ${mismatchLine('RNG', div)}`);
                if (stopOnMismatch) {
                    break;
                }
            }
        } else {
            matchedSteps++;
        }

        if (compareScreen) {
            const screenCmp = compareStepScreen(
                jsStep?.screen || [],
                cStep?.screen || [],
                session.screenMode || 'decgraphics',
                strictMessageRow
            );
            if (screenCmp.ok) {
                matchedScreenSteps++;
            } else {
                failures++;
                console.log(`step ${i} (${cStep.action || cStep.key}): screen diverges at row ${screenCmp.row}`);
                if (verbose) {
                    console.log(`  C : "${screenCmp.c}"`);
                    console.log(`  JS: "${screenCmp.js}"`);
                }
                if (stopOnMismatch) {
                    break;
                }
            }
        }
    }

    console.log(`steps: ${matchedSteps}/${totalSteps} matched`);
    if (compareScreen) {
        console.log(`screen steps: ${matchedScreenSteps}/${totalSteps} matched${strictMessageRow ? ' (rows 0-23)' : ' (rows 1-23)'}`);
    }
    if (failures > 0) {
        process.exit(1);
    }
    console.log('result: PASS');
}

main().catch((err) => {
    console.error(err);
    process.exit(2);
});
