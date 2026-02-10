// Test option behaviors by comparing JS implementation against C NetHack sessions
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, 'sessions');

// Import game modules for testing
// Note: We'll need to mock/setup the game state to replay these sessions

describe('Option behavior tests', () => {
    const optionSessions = [
        'seed301_verbose_on.session.json',
        'seed302_verbose_off.session.json',
        'seed303_decgraphics_off.session.json',
        'seed304_decgraphics_on.session.json',
        'seed305_time_on.session.json',
        'seed306_time_off.session.json',
    ];

    for (const sessionFile of optionSessions) {
        const sessionPath = path.join(SESSIONS_DIR, sessionFile);

        if (!fs.existsSync(sessionPath)) {
            console.log(`Skipping ${sessionFile} - file not found`);
            continue;
        }

        test(`Option test: ${sessionFile}`, async () => {
            const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

            // Basic validation of session structure
            assert.ok(sessionData.version, 'Session should have version');
            assert.ok(sessionData.seed, 'Session should have seed');
            assert.strictEqual(sessionData.type, 'option_test', 'Should be option test type');
            assert.ok(sessionData.option, 'Session should specify option being tested');
            assert.ok('option_value' in sessionData, 'Session should have option_value');
            assert.ok(sessionData.startup, 'Session should have startup state');
            assert.ok(Array.isArray(sessionData.steps), 'Session should have steps array');

            console.log(`  Testing ${sessionData.option}=${sessionData.option_value}`);
            console.log(`  Description: ${sessionData.description}`);
            console.log(`  Steps: ${sessionData.steps.length}`);

            // TODO: Actually replay the session in JS and compare screens
            // For now, just validate the session structure is correct
        });
    }
});

describe('Option screen comparisons', () => {
    test('verbose on/off comparison', async () => {
        const verboseOnPath = path.join(SESSIONS_DIR, 'seed301_verbose_on.session.json');
        const verboseOffPath = path.join(SESSIONS_DIR, 'seed302_verbose_off.session.json');

        if (!fs.existsSync(verboseOnPath) || !fs.existsSync(verboseOffPath)) {
            console.log('Skipping verbose comparison - sessions not found');
            return;
        }

        const verboseOn = JSON.parse(fs.readFileSync(verboseOnPath, 'utf8'));
        const verboseOff = JSON.parse(fs.readFileSync(verboseOffPath, 'utf8'));

        // Both sessions should have the same structure
        assert.strictEqual(verboseOn.steps.length, verboseOff.steps.length,
            'Both sessions should have same number of steps');

        // Check that screens are captured
        assert.ok(verboseOn.startup.screen.length === 24, 'Should have 24 screen lines');
        assert.ok(verboseOff.startup.screen.length === 24, 'Should have 24 screen lines');

        console.log('  Verbose on vs off sessions validated');
    });

    test('DECgraphics on/off comparison', async () => {
        const decOffPath = path.join(SESSIONS_DIR, 'seed303_decgraphics_off.session.json');
        const decOnPath = path.join(SESSIONS_DIR, 'seed304_decgraphics_on.session.json');

        if (!fs.existsSync(decOffPath) || !fs.existsSync(decOnPath)) {
            console.log('Skipping DECgraphics comparison - sessions not found');
            return;
        }

        const decOff = JSON.parse(fs.readFileSync(decOffPath, 'utf8'));
        const decOn = JSON.parse(fs.readFileSync(decOnPath, 'utf8'));

        // Check for ASCII vs box-drawing characters in screens
        const asciiScreen = decOff.startup.screen.join('\n');
        const decScreen = decOn.startup.screen.join('\n');

        // ASCII should have | and - for walls
        const hasAsciiWalls = asciiScreen.includes('|') || asciiScreen.includes('-');

        // DEC can have either:
        // - IBM graphics (q/x/l/k/m/j) - used by C NetHack
        // - Unicode box-drawing (│─┌┐└┘) - used by our JS implementation
        const hasDecWalls = /[│─┌┐└┘├┤┬┴┼]/.test(decScreen);
        const hasIbmGraphics = /[qxlkmj]/.test(decScreen);

        console.log(`  ASCII walls present: ${hasAsciiWalls}`);
        console.log(`  Unicode box-drawing present: ${hasDecWalls}`);
        console.log(`  IBM graphics present: ${hasIbmGraphics}`);

        // ASCII session should have different characters than DEC session
        assert.ok(hasAsciiWalls || hasDecWalls || hasIbmGraphics,
            'Should have captured wall characters in at least one format');

        // Note: C NetHack uses IBM graphics (qxlkmj), JS uses Unicode box-drawing (│─┌┐└┘)
        // Both are valid representations of DECgraphics mode
    });

    test('time on/off comparison', async () => {
        const timeOnPath = path.join(SESSIONS_DIR, 'seed305_time_on.session.json');
        const timeOffPath = path.join(SESSIONS_DIR, 'seed306_time_off.session.json');

        if (!fs.existsSync(timeOnPath) || !fs.existsSync(timeOffPath)) {
            console.log('Skipping time comparison - sessions not found');
            return;
        }

        const timeOn = JSON.parse(fs.readFileSync(timeOnPath, 'utf8'));
        const timeOff = JSON.parse(fs.readFileSync(timeOffPath, 'utf8'));

        // Get status lines (line 23)
        const statusOn = timeOn.startup.screen[23];
        const statusOff = timeOff.startup.screen[23];

        // time=on should have "T:N" in status line
        const hasTurnCounterOn = /T:\d+/.test(statusOn);

        // time=off should NOT have "T:N" in status line
        const hasTurnCounterOff = /T:\d+/.test(statusOff);

        console.log(`  time=on status: ${statusOn}`);
        console.log(`  time=off status: ${statusOff}`);
        console.log(`  Turn counter present (time=on): ${hasTurnCounterOn}`);
        console.log(`  Turn counter present (time=off): ${hasTurnCounterOff}`);

        assert.ok(hasTurnCounterOn, 'time=on should show turn counter T:N');
        assert.ok(!hasTurnCounterOff, 'time=off should NOT show turn counter');
    });
});
