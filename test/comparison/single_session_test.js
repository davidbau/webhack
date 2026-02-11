// Focused test for a single session to debug memory/perf issues
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    generateMapsSequential, generateMapsWithRng,
    compareGrids, formatDiffs, compareRng,
} from './session_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAPS_DIR = join(__dirname, 'maps');

// Load just one session file
const sessionFile = 'seed16_maps_c.session.json';
const session = JSON.parse(readFileSync(join(MAPS_DIR, sessionFile), 'utf-8'));

describe(sessionFile, () => {
    const maxDepth = Math.max(...session.levels.map(l => l.depth));
    const needsRng = session.levels.some(l => l.rng || l.rngCalls !== undefined);

    let result;
    before(() => {
        console.log(`Generating levels for seed ${session.seed}, maxDepth=${maxDepth}, needsRng=${needsRng}`);
        result = needsRng
            ? generateMapsWithRng(session.seed, maxDepth)
            : generateMapsSequential(session.seed, maxDepth);
        console.log(`Generation complete: ${Object.keys(result.grids).length} levels generated`);
    });

    // Test typGrid at depth 1
    const level = session.levels.find(l => l.depth === 1);
    if (level) {
        it(`typGrid matches at depth ${level.depth}`, () => {
            assert.ok(result, 'Level generation failed');
            const jsGrid = result.grids[level.depth];
            assert.ok(jsGrid, `JS did not generate depth ${level.depth}`);

            const diffs = compareGrids(jsGrid, level.typGrid);
            assert.equal(diffs.length, 0,
                `seed=${session.seed} depth=${level.depth}: ${formatDiffs(diffs)}`);
        });

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
                    level.rng
                );
                assert.ok(!divergence,
                    `seed=${session.seed} depth=${level.depth}: ${divergence || 'RNG matches'}`);
            });
        }
    }
});
