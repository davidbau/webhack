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
import { resetLevelState, setFinalizeContext } from '../../js/sp_lev.js';
import { getSpecialLevel, resetVariantCache, DUNGEONS_OF_DOOM, GEHENNOM, VLADS_TOWER, KNOX, SOKOBAN, GNOMISH_MINES, QUEST } from '../../js/special_levels.js';
import { initRng, skipRng, rn2, c_d, rne, rnz } from '../../js/rng.js';

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
    const rngCallStart = (
        (typeof cLevel.rngRawCallStart === 'number'
            && typeof cLevel.rngCallStart === 'number'
            && cLevel.rngRawCallStart > cLevel.rngCallStart)
            ? cLevel.rngRawCallStart
            : cLevel.rngCallStart
    );

    const replayPrelude = () => {
        if (!Array.isArray(cLevel.preRngCalls)) return;
        for (const call of cLevel.preRngCalls) {
            if (!call || call.fn !== 'rn2' || typeof call.arg !== 'number') continue;
            rn2(call.arg);
        }
    };

    const calibrateStartOffset = () => {
        if (!Array.isArray(cLevel.rngFingerprint) || cLevel.rngFingerprint.length === 0) {
            return 0;
        }
        if (typeof rngCallStart !== 'number' || rngCallStart <= 0) {
            return 0;
        }

        let bestOffset = 0;
        let bestScore = -1;
        let bestCount = 0;
        const offsets = [];
        for (let off = -6; off <= 6; off++) offsets.push(off);

        for (const off of offsets) {
            initRng(seed);
            skipRng(rngCallStart + off);
            replayPrelude();

            let score = 0;
            for (const fp of cLevel.rngFingerprint) {
                if (!fp || typeof fp.result !== 'number') continue;
                let got = null;
                if ((fp.fn === 'rn2' || fp.fn === 'rnd' || fp.fn === 'rne' || fp.fn === 'rnz')
                    && typeof fp.arg !== 'number') continue;
                if (fp.fn === 'rn2') got = rn2(fp.arg);
                else if (fp.fn === 'rnd') got = (rn2(fp.arg) + 1);
                else if (fp.fn === 'rne') got = rne(fp.arg);
                else if (fp.fn === 'rnz') got = rnz(fp.arg);
                else if (fp.fn === 'd' && Array.isArray(fp.args) && fp.args.length === 2) {
                    got = c_d(fp.args[0], fp.args[1]);
                }
                if (got === null) continue;
                if (got === fp.result) score++;
            }

            if (
                score > bestScore
                || (score === bestScore && Math.abs(off) < Math.abs(bestOffset))
                || (score === bestScore && Math.abs(off) === Math.abs(bestOffset) && off > bestOffset)
            ) {
                bestScore = score;
                bestOffset = off;
                bestCount = 1;
            } else if (score === bestScore) {
                bestCount++;
            }
        }

        // Apply offset only when fingerprint match is exact and unambiguous.
        // Near-matches are too weak because C logged calls can hide additional
        // underlying PRNG draws, which can produce false-positive offsets.
        if (bestScore !== cLevel.rngFingerprint.length) {
            return 0;
        }
        if (bestCount > 1 && bestOffset !== 0) {
            return 0;
        }
        return bestOffset;
    };

    const generateTypGridForOffset = (offset) => {
        initRng(seed);
        if (typeof rngCallStart === 'number' && rngCallStart > 0) {
            skipRng(rngCallStart + offset);
        }
        replayPrelude();
        resetVariantCache();
        resetLevelState();
        setFinalizeContext(null);
        if (cSession.group === 'filler' && levelName.toLowerCase() === 'minefill') {
            setFinalizeContext({ isBranchLevel: true, dunlev: 1, dunlevs: 99 });
        }
        const level = getSpecialLevel(dnum, dlevel);
        if (!level) {
            assert.fail(`No special level registered at ${dnum}:${dlevel} for ${levelName}`);
        }
        return extractTypGrid(level.generator());
    };

    // Generate JS version
    let startOffset = 0;
    if (typeof rngCallStart === 'number' && rngCallStart > 0) {
        startOffset = calibrateStartOffset();
    }
    const jsTypGrid = generateTypGridForOffset(startOffset);

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

// Oracle tests
test('Oracle - seed 1', () => {
    const cSession = loadCReference(1, 'oracle');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, 5, 'oracle', cSession);
});

test('Oracle - seed 42', () => {
    const cSession = loadCReference(42, 'oracle');
    if (!cSession) return;
    testLevel(42, DUNGEONS_OF_DOOM, 5, 'oracle', cSession);
});

test('Oracle - seed 100', () => {
    const cSession = loadCReference(100, 'oracle');
    if (!cSession) return;
    testLevel(100, DUNGEONS_OF_DOOM, 5, 'oracle', cSession);
});

// Gnomish Mines - Town (level 5, has 7 variants)
test('Mines Town - seed 1', () => {
    const cSession = loadCReference(1, 'mines');
    if (!cSession) return;
    testLevel(1, GNOMISH_MINES, 5, 'minetn', cSession);
});

test('Mines Town - seed 42', () => {
    const cSession = loadCReference(42, 'mines');
    if (!cSession) return;
    testLevel(42, GNOMISH_MINES, 5, 'minetn', cSession);
});

test('Mines Town - seed 100', () => {
    const cSession = loadCReference(100, 'mines');
    if (!cSession) return;
    testLevel(100, GNOMISH_MINES, 5, 'minetn', cSession);
});

// Gnomish Mines - End (level 8, has 3 variants)
test('Mines End - seed 1', () => {
    const cSession = loadCReference(1, 'mines');
    if (!cSession) return;
    testLevel(1, GNOMISH_MINES, 8, 'minend', cSession);
});

test('Mines End - seed 42', () => {
    const cSession = loadCReference(42, 'mines');
    if (!cSession) return;
    testLevel(42, GNOMISH_MINES, 8, 'minend', cSession);
});

test('Mines End - seed 100', () => {
    const cSession = loadCReference(100, 'mines');
    if (!cSession) return;
    testLevel(100, GNOMISH_MINES, 8, 'minend', cSession);
});

// Elemental Planes tests
test('Plane of Air - seed 1', () => {
    const cSession = loadCReference(1, 'planes');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, -1, 'air', cSession);
});

test('Plane of Earth - seed 1', () => {
    const cSession = loadCReference(1, 'planes');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, -2, 'earth', cSession);
});

test('Plane of Fire - seed 1', () => {
    const cSession = loadCReference(1, 'planes');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, -3, 'fire', cSession);
});

test('Plane of Water - seed 1', () => {
    const cSession = loadCReference(1, 'planes');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, -4, 'water', cSession);
});

test('Astral Plane - seed 1', () => {
    const cSession = loadCReference(1, 'planes');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, -5, 'astral', cSession);
});

test('Astral Plane - seed 100', () => {
    const cSession = loadCReference(100, 'planes');
    if (!cSession) return;
    testLevel(100, DUNGEONS_OF_DOOM, -5, 'astral', cSession);
});

// Rogue level tests
test('Rogue Level - seed 1', () => {
    const cSession = loadCReference(1, 'rogue');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, 15, 'rogue', cSession);
});

test('Rogue Level - seed 100', () => {
    const cSession = loadCReference(100, 'rogue');
    if (!cSession) return;
    testLevel(100, DUNGEONS_OF_DOOM, 15, 'rogue', cSession);
});

// Quest levels (sample - Archeologist)
test('Quest Start (Arc) - seed 1', () => {
    const cSession = loadCReference(1, 'quest');
    if (!cSession) return;
    testLevel(1, QUEST, 1, 'arc-strt', cSession);
});

test('Quest Locate (Arc) - seed 1', () => {
    const cSession = loadCReference(1, 'quest');
    if (!cSession) return;
    testLevel(1, QUEST, 2, 'arc-loca', cSession);
});

test('Quest Goal (Arc) - seed 1', () => {
    const cSession = loadCReference(1, 'quest');
    if (!cSession) return;
    testLevel(1, QUEST, 5, 'arc-goal', cSession);
});

// Gehennom filler levels
test('Gehennom Filler - seed 1', () => {
    const cSession = loadCReference(1, 'gehennom');
    if (!cSession) return;
    testLevel(1, GEHENNOM, 3, 'gehennom', cSession);
});

test('Gehennom Filler - seed 100', () => {
    const cSession = loadCReference(100, 'gehennom');
    if (!cSession) return;
    testLevel(100, GEHENNOM, 3, 'gehennom', cSession);
});

// Tutorial levels
test('Tutorial 1 - seed 1', () => {
    const cSession = loadCReference(1, 'tutorial');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, 1, 'tut-1', cSession);
});

test('Tutorial 2 - seed 1', () => {
    const cSession = loadCReference(1, 'tutorial');
    if (!cSession) return;
    testLevel(1, DUNGEONS_OF_DOOM, 2, 'tut-2', cSession);
});

// Mines filler levels
test('Mines Filler - seed 1', () => {
    const cSession = loadCReference(1, 'filler');
    if (!cSession) return;
    testLevel(1, GNOMISH_MINES, 3, 'minefill', cSession);
});

test('Mines Filler - seed 100', () => {
    const cSession = loadCReference(100, 'filler');
    if (!cSession) return;
    testLevel(100, GNOMISH_MINES, 3, 'minefill', cSession);
});
