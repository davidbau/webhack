/**
 * Special Levels Comparison Test
 *
 * Compares JS special level generation against C reference sessions
 * captured via wizard mode teleport + #dumpmap
 */

import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resetLevelState } from '../../js/sp_lev.js';
import { getSpecialLevel, DUNGEONS_OF_DOOM, GEHENNOM, VLADS_TOWER, KNOX, SOKOBAN } from '../../js/special_levels.js';
import { initRng } from '../../js/rng.js';

const ROWNO = 21;
const COLNO = 80;

/**
 * Extract typGrid from special level object
 */
function extractTypGrid(level) {
    const grid = [];
    for (let y = 0; y < ROWNO; y++) {
        const row = [];
        for (let x = 0; x < COLNO; x++) {
            const loc = level.locations?.[x]?.[y];
            row.push(loc ? loc.typ : 0);
        }
        grid.push(row);
    }
    return grid;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAPS_DIR = path.join(__dirname, '..', 'comparison', 'maps');

/**
 * Load C reference session for a special level
 */
function loadCReference(seed, group) {
    const sessionPath = path.join(MAPS_DIR, `seed${seed}_special_${group}.session.json`);
    if (!fs.existsSync(sessionPath)) {
        return null;
    }
    const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    return data;
}

/**
 * Compare typGrid terrain layout
 */
function compareTypGrid(jsGrid, cGrid, levelName) {
    assert.strictEqual(jsGrid.length, cGrid.length,
        `${levelName}: Row count mismatch`);

    for (let y = 0; y < jsGrid.length; y++) {
        assert.strictEqual(jsGrid[y].length, cGrid[y].length,
            `${levelName}: Col count mismatch at row ${y}`);

        for (let x = 0; x < jsGrid[y].length; x++) {
            if (jsGrid[y][x] !== cGrid[y][x]) {
                // Show context around mismatch
                const context = [];
                for (let dy = -2; dy <= 2; dy++) {
                    const row = y + dy;
                    if (row >= 0 && row < jsGrid.length) {
                        const jsRow = jsGrid[row].map((c, cx) =>
                            cx === x && dy === 0 ? `[${c}]` : c
                        ).join('');
                        const cRow = cGrid[row].map((c, cx) =>
                            cx === x && dy === 0 ? `[${c}]` : c
                        ).join('');
                        context.push(`  ${row}: JS: ${jsRow}`);
                        context.push(`  ${row}:  C: ${cRow}`);
                    }
                }
                assert.fail(
                    `${levelName}: Terrain mismatch at (${x}, ${y})\n` +
                    `Expected '${cGrid[y][x]}', got '${jsGrid[y][x]}'\n` +
                    `Context:\n${context.join('\n')}`
                );
            }
        }
    }
}

/**
 * Generate JS level and compare with C reference
 */
function testLevel(seed, dnum, dlevel, levelName, cSession) {
    // Find the level in C session
    const levels = cSession.data ? cSession.data.levels : cSession.levels;
    const cLevel = levels.find(l =>
        l.levelName && l.levelName.toLowerCase() === levelName.toLowerCase()
    );

    if (!cLevel) {
        console.log(`Warning: ${levelName} not found in C session`);
        return;
    }

    // Generate JS version
    initRng(seed);
    resetLevelState();

    const specialLevel = getSpecialLevel(dnum, dlevel);
    if (!specialLevel) {
        assert.fail(`No special level registered at ${dnum}:${dlevel} for ${levelName}`);
    }

    const jsLevel = specialLevel.generator();

    // Extract typGrid from JS level
    const jsTypGrid = extractTypGrid(jsLevel);

    // Compare terrain grids
    compareTypGrid(jsTypGrid, cLevel.typGrid, levelName);

    console.log(`  ✓ ${levelName} (seed ${seed}): typGrid matches C`);
}

// Castle tests
test('Castle - seed 42', () => {
    const cSession = loadCReference(42, 'castle');
    if (!cSession) {
        console.log('  ⊘ C reference not found - run gen_special_sessions.py castle');
        return;
    }
    testLevel(42, DUNGEONS_OF_DOOM, 17, 'castle', cSession);
});

// Knox (Fort Ludios) tests
test('Knox - seed 42', () => {
    const cSession = loadCReference(42, 'knox');
    if (!cSession) return;
    testLevel(42, KNOX, 1, 'knox', cSession);
});

test('Knox - seed 1', () => {
    const cSession = loadCReference(1, 'knox');
    if (!cSession) return;
    testLevel(1, KNOX, 1, 'knox', cSession);
});

// Vlad's Tower tests
test('Vlad Tower 1 - seed 42', () => {
    const cSession = loadCReference(42, 'vlad');
    if (!cSession) return;
    testLevel(42, VLADS_TOWER, 1, 'tower1', cSession);
});

test('Vlad Tower 2 - seed 42', () => {
    const cSession = loadCReference(42, 'vlad');
    if (!cSession) return;
    testLevel(42, VLADS_TOWER, 2, 'tower2', cSession);
});

test('Vlad Tower 3 - seed 42', () => {
    const cSession = loadCReference(42, 'vlad');
    if (!cSession) return;
    testLevel(42, VLADS_TOWER, 3, 'tower3', cSession);
});

// Medusa tests
test('Medusa - seed 42', () => {
    const cSession = loadCReference(42, 'medusa');
    if (!cSession) return;
    testLevel(42, DUNGEONS_OF_DOOM, 20, 'medusa', cSession);
});

test('Medusa - seed 1', () => {
    const cSession = loadCReference(1, 'medusa');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, 20, 'medusa', cSession);
});

// Valley tests
test('Valley - seed 42', () => {
    const cSession = loadCReference(42, 'valley');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 1, 'valley', cSession);
});

// Gehennom demon lairs
test('Sanctum - seed 42', () => {
    const cSession = loadCReference(42, 'gehennom');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 10, 'sanctum', cSession);
});

test('Juiblex - seed 42', () => {
    const cSession = loadCReference(42, 'gehennom');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 5, 'juiblex', cSession);
});

test('Baalzebub - seed 42', () => {
    const cSession = loadCReference(42, 'gehennom');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 4, 'baalz', cSession);
});

test('Asmodeus - seed 42', () => {
    const cSession = loadCReference(42, 'gehennom');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 3, 'asmodeus', cSession);
});

test('Orcus - seed 42', () => {
    const cSession = loadCReference(42, 'gehennom');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 6, 'orcus', cSession);
});

// Wizard Tower
test('Wizard1 - seed 42', () => {
    const cSession = loadCReference(42, 'wizard');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 11, 'wizard1', cSession);
});

test('Wizard2 - seed 42', () => {
    const cSession = loadCReference(42, 'wizard');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 12, 'wizard2', cSession);
});

test('Wizard3 - seed 42', () => {
    const cSession = loadCReference(42, 'wizard');
    if (!cSession) return;
    testLevel(42, GEHENNOM, 13, 'wizard3', cSession);
});

// Sokoban
test('Sokoban 1 - seed 42', () => {
    const cSession = loadCReference(42, 'sokoban');
    if (!cSession) return;
    testLevel(42, SOKOBAN, 1, 'soko1', cSession);
});

test('Sokoban 2 - seed 42', () => {
    const cSession = loadCReference(42, 'sokoban');
    if (!cSession) return;
    testLevel(42, SOKOBAN, 2, 'soko2', cSession);
});

test('Sokoban 3 - seed 42', () => {
    const cSession = loadCReference(42, 'sokoban');
    if (!cSession) return;
    testLevel(42, SOKOBAN, 3, 'soko3', cSession);
});

test('Sokoban 4 - seed 42', () => {
    const cSession = loadCReference(42, 'sokoban');
    if (!cSession) return;
    testLevel(42, SOKOBAN, 4, 'soko4', cSession);
});

// Big Room
test('Big Room - seed 42', () => {
    const cSession = loadCReference(42, 'bigroom');
    if (!cSession) return;
    testLevel(42, DUNGEONS_OF_DOOM, 15, 'bigroom', cSession);
});
