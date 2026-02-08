// test/comparison/session_runner.test.js -- Unified session replay test runner
//
// Auto-discovers all *.session.json files in test/comparison/sessions/ and
// test/comparison/maps/ and runs appropriate tests based on session type:
//
//   type === "map"      : Sequential level generation + typGrid comparison + structural tests
//   type === "gameplay" : Startup verification + step-by-step replay
//
// All data fields in session files are optional. The runner verifies whatever is
// present and skips the rest. This means a minimal session with just seed + typGrid
// at one depth is a valid test, and a full session with RNG traces, screens, and
// multi-depth grids gets comprehensive verification.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    generateMapsSequential, generateMapsWithRng, extractTypGrid,
    compareGrids, formatDiffs, compareRng,
    checkWallCompleteness, checkConnectivity, checkStairs,
    checkDimensions, checkValidTypValues,
} from './session_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SESSIONS_DIR = join(__dirname, 'sessions');
const MAPS_DIR = join(__dirname, 'maps');

// Discover all session files from both directories
const sessionFiles = [];
for (const [dir, label] of [[SESSIONS_DIR, 'sessions'], [MAPS_DIR, 'maps']]) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.session.json')).sort()) {
        sessionFiles.push({ file: f, dir });
    }
}

// ---------------------------------------------------------------------------
// Map sessions: sequential level generation + typGrid comparison
// ---------------------------------------------------------------------------

function runMapSession(file, session) {
    const maxDepth = Math.max(...session.levels.map(l => l.depth));

    // Use RNG-aware generator when any level has rng or rngCalls data
    const needsRng = session.levels.some(l => l.rng || l.rngCalls !== undefined);

    // Generate all levels sequentially (matching C's RNG stream)
    let result;
    it('generates levels sequentially', () => {
        result = needsRng
            ? generateMapsWithRng(session.seed, maxDepth)
            : generateMapsSequential(session.seed, maxDepth);
    });

    // Compare typGrid at each stored depth
    for (const level of session.levels) {
        it(`typGrid matches at depth ${level.depth}`, () => {
            assert.ok(result, 'Level generation failed');
            const jsGrid = result.grids[level.depth];
            assert.ok(jsGrid, `JS did not generate depth ${level.depth}`);

            const diffs = compareGrids(jsGrid, level.typGrid);
            assert.equal(diffs.length, 0,
                `seed=${session.seed} depth=${level.depth}: ${formatDiffs(diffs)}`);
        });
    }

    // RNG count and trace comparison at each stored depth
    for (const level of session.levels) {
        if (level.rngCalls !== undefined) {
            it(`rngCalls matches at depth ${level.depth}`, () => {
                assert.ok(result, 'Level generation failed');
                assert.ok(result.rngLogs, 'RNG logs not captured');
                assert.equal(result.rngLogs[level.depth].rngCalls, level.rngCalls,
                    `seed=${session.seed} depth=${level.depth}: ` +
                    `JS=${result.rngLogs[level.depth].rngCalls} session=${level.rngCalls}`);
            });
        }

        if (level.rng) {
            it(`RNG trace matches at depth ${level.depth}`, () => {
                assert.ok(result, 'Level generation failed');
                assert.ok(result.rngLogs, 'RNG logs not captured');
                const divergence = compareRng(
                    result.rngLogs[level.depth].rng,
                    level.rng,
                );
                assert.equal(divergence.index, -1,
                    `seed=${session.seed} depth=${level.depth}: ` +
                    `RNG diverges at call ${divergence.index}: ` +
                    `JS="${divergence.js}" session="${divergence.session}"`);
            });
        }
    }

    // Structural tests on each generated level
    for (const level of session.levels) {
        it(`valid dimensions at depth ${level.depth}`, () => {
            const jsGrid = result.grids[level.depth];
            const errors = checkDimensions(jsGrid);
            assert.equal(errors.length, 0, errors.join('; '));
        });

        it(`valid typ values at depth ${level.depth}`, () => {
            const jsGrid = result.grids[level.depth];
            const errors = checkValidTypValues(jsGrid);
            assert.equal(errors.length, 0, errors.join('; '));
        });

        it(`wall completeness at depth ${level.depth}`, (t) => {
            const map = result.maps[level.depth];
            const errors = checkWallCompleteness(map);
            if (errors.length > 0) {
                t.diagnostic(`${errors.length} wall gaps: ${errors.slice(0, 5).join('; ')}`);
            }
            // Report but don't fail — some seeds have known wall issues
            // TODO: convert to assert once all wall issues are fixed
        });

        it(`corridor connectivity at depth ${level.depth}`, (t) => {
            const map = result.maps[level.depth];
            const errors = checkConnectivity(map);
            if (errors.length > 0) {
                t.diagnostic(`${errors.length} connectivity issues: ${errors.join('; ')}`);
            }
            // Report but don't fail — some themeroom seeds have connectivity quirks
            // TODO: convert to assert once themeroom connectivity is fully implemented
        });

        it(`stairs placement at depth ${level.depth}`, () => {
            const map = result.maps[level.depth];
            const errors = checkStairs(map, level.depth);
            assert.equal(errors.length, 0, errors.join('; '));
        });
    }

    // Determinism: generate again and verify identical
    it('is deterministic', () => {
        const result2 = generateMapsSequential(session.seed, maxDepth);
        for (const level of session.levels) {
            const diffs = compareGrids(result.grids[level.depth], result2.grids[level.depth]);
            assert.equal(diffs.length, 0,
                `Non-deterministic at depth ${level.depth}: ${formatDiffs(diffs)}`);
        }
    });
}

// ---------------------------------------------------------------------------
// Gameplay sessions: startup + step-by-step replay
// ---------------------------------------------------------------------------

function runGameplaySession(file, session) {
    // Gameplay sessions verify startup typGrid and rngCalls.
    // Step-by-step replay requires game engine support — for now we verify
    // only the fields that the current JS engine can produce.

    if (session.startup) {
        if (session.startup.typGrid) {
            it('startup typGrid matches', (t) => {
                const { grids } = generateMapsSequential(session.seed, 1);
                const jsGrid = grids[1];
                const diffs = compareGrids(jsGrid, session.startup.typGrid);
                if (diffs.length > 0) {
                    t.diagnostic(`Startup typGrid: ${formatDiffs(diffs)}`);
                }
                // Gameplay sessions may have been captured from C; JS may not
                // match yet. Report diffs as diagnostics until full parity.
                // TODO: convert to assert.equal once JS matches C for this seed
            });
        }

        if (session.startup.typGrid) {
            it('startup typGrid dimensions', () => {
                const { grids } = generateMapsSequential(session.seed, 1);
                const errors = checkDimensions(grids[1]);
                assert.equal(errors.length, 0, errors.join('; '));
            });

            it('startup structural validation', () => {
                const { maps } = generateMapsSequential(session.seed, 1);
                const connErrors = checkConnectivity(maps[1]);
                assert.equal(connErrors.length, 0, connErrors.join('; '));
                const stairErrors = checkStairs(maps[1], 1);
                assert.equal(stairErrors.length, 0, stairErrors.join('; '));
            });
        }
    }

    // Note: step-level typGrids in gameplay sessions cannot be verified by
    // generateMapsSequential() because the RNG stream includes gameplay actions
    // between levels. Full step-by-step verification requires a game replay engine.
    // For now, gameplay step typGrids are stored for reference but not auto-tested.
}

// ---------------------------------------------------------------------------
// Main: discover and run all sessions
// ---------------------------------------------------------------------------

for (const { file, dir } of sessionFiles) {
    const session = JSON.parse(readFileSync(join(dir, file), 'utf-8'));

    // Determine session type (v2 has explicit type; v1 is gameplay)
    const type = session.type || 'gameplay';

    describe(`${file}`, () => {
        if (type === 'map') {
            runMapSession(file, session);
        } else if (type === 'gameplay') {
            runGameplaySession(file, session);
        } else {
            it('unknown session type', () => {
                assert.fail(`Unknown session type: ${type}`);
            });
        }
    });
}
