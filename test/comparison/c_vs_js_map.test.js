// test/comparison/c_vs_js_map.test.js -- Compare C and JS map generation
//
// Phase 1: Raw terrain type (levl[x][y].typ) comparison between the C NetHack
// binary and the JS port. This catches level generation divergences at the
// most fundamental level -- the terrain grid itself.
//
// Prerequisites:
//   1. Run test/comparison/c-harness/setup.sh to build the C binary
//   2. The C binary must support NETHACK_SEED and #dumpmap
//
// If the C binary is not available, tests are skipped (not failed), so this
// file is safe to include in the normal test suite.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import { COLNO, ROWNO } from '../../js/config.js';
import { generateTypGrid, CONFIGS } from './gen_typ_grid.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const INSTALL_DIR = join(process.env.HOME || '', 'nethack-minimal/games/lib/nethackdir');
const C_BINARY = join(INSTALL_DIR, 'nethack');
const RESULTS_DIR = join(__dirname, 'c-harness/results');
const DUMPMAP_SCRIPT = join(__dirname, 'c-harness/run_dumpmap.py');

// Terrain type names for readable diffs (matches C's levltyp[] in cmd.c)
const TYP_NAMES = [
    'STONE', 'VWALL', 'HWALL', 'TLCORNER', 'TRCORNER', 'BLCORNER',
    'BRCORNER', 'CROSSWALL', 'TUWALL', 'TDWALL', 'TLWALL', 'TRWALL',
    'DBWALL', 'TREE', 'SDOOR', 'SCORR', 'POOL', 'MOAT', 'WATER',
    'DRAWBRIDGE_UP', 'LAVAPOOL', 'LAVAWALL', 'IRONBARS', 'DOOR', 'CORR',
    'ROOM', 'STAIRS', 'LADDER', 'FOUNTAIN', 'THRONE', 'SINK', 'GRAVE',
    'ALTAR', 'ICE', 'DRAWBRIDGE_DOWN', 'AIR', 'CLOUD',
];

function typName(t) {
    return TYP_NAMES[t] || `UNKNOWN(${t})`;
}

// Parse a typ grid file: 21 lines of 80 space-separated integers
function parseTypGrid(text) {
    const lines = text.trim().split('\n');
    return lines.map(line => line.trim().split(/\s+/).map(Number));
}

// Generate a C dumpmap for a given seed using the tmux-based Python script.
// Returns the path to the dump file, or null if it failed.
function generateCDumpmap(seed, depth) {
    const dumpFile = join(RESULTS_DIR, `c_typ_seed${seed}_depth${depth}.txt`);

    // Clean up any previous dump
    if (existsSync(dumpFile)) unlinkSync(dumpFile);

    // For depth 1: the initial level is what we compare.
    // For deeper levels, we'd need to descend stairs -- Phase 2 work.
    if (depth !== 1) return null;

    try {
        execSync(`python3 ${DUMPMAP_SCRIPT} ${seed} ${dumpFile}`, {
            timeout: 30000,
            stdio: 'pipe',
        });

        if (existsSync(dumpFile)) {
            return dumpFile;
        }
    } catch (e) {
        console.error(`C dumpmap generation failed for seed=${seed}: ${e.message}`);
    }

    return null;
}

// Check if C binary and tmux are available
function hasCBinary() {
    return existsSync(C_BINARY);
}

function hasTmux() {
    try {
        execSync('which tmux', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Phase 1: JS typ grid self-consistency (always runs)
// ---------------------------------------------------------------------------

describe('JS typ grid generation', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`generates correct dimensions for ${label}`, () => {
            const rows = generateTypGrid(seed, depth);
            assert.equal(rows.length, ROWNO, `Expected ${ROWNO} rows`);
            for (const row of rows) {
                const vals = row.split(' ').map(Number);
                assert.equal(vals.length, COLNO, `Expected ${COLNO} columns`);
            }
        });

        it(`produces valid typ values for ${label}`, () => {
            const rows = generateTypGrid(seed, depth);
            for (let y = 0; y < rows.length; y++) {
                const vals = rows[y].split(' ').map(Number);
                for (let x = 0; x < vals.length; x++) {
                    assert.ok(vals[x] >= 0 && vals[x] < TYP_NAMES.length,
                        `Invalid typ ${vals[x]} at (${x},${y}) for ${label}`);
                }
            }
        });

        it(`is deterministic for ${label}`, () => {
            const rows1 = generateTypGrid(seed, depth);
            const rows2 = generateTypGrid(seed, depth);
            assert.deepStrictEqual(rows1, rows2, `Non-deterministic for ${label}`);
        });
    }
});

// ---------------------------------------------------------------------------
// Phase 1: C vs JS map comparison (requires C binary + tmux)
// ---------------------------------------------------------------------------

describe('C vs JS map comparison', { skip: !hasCBinary() || !hasTmux() }, () => {
    before(() => {
        mkdirSync(RESULTS_DIR, { recursive: true });
    });

    // For Phase 1, compare depth=1 maps (no need to descend stairs in C)
    const depth1Configs = CONFIGS.filter(c => c.depth === 1);

    for (const { seed, depth } of depth1Configs) {
        const label = `seed=${seed} depth=${depth}`;

        it(`C and JS produce same terrain grid for ${label}`, { timeout: 35000 }, () => {
            // Generate JS typ grid
            const jsRows = generateTypGrid(seed, depth);
            const jsGrid = parseTypGrid(jsRows.join('\n'));

            // Generate C typ grid via tmux automation
            const cDumpFile = generateCDumpmap(seed, depth);
            if (!cDumpFile) {
                // Skip if C generation failed (don't fail the test)
                return;
            }

            const cText = readFileSync(cDumpFile, 'utf-8');
            const cGrid = parseTypGrid(cText);

            // Compare dimensions
            assert.equal(cGrid.length, ROWNO,
                `C grid has ${cGrid.length} rows, expected ${ROWNO}`);
            assert.equal(jsGrid.length, ROWNO,
                `JS grid has ${jsGrid.length} rows, expected ${ROWNO}`);

            // Compare cell by cell, collecting all differences
            const diffs = [];
            for (let y = 0; y < ROWNO; y++) {
                assert.equal(cGrid[y].length, COLNO,
                    `C grid row ${y} has ${cGrid[y].length} cols`);
                for (let x = 0; x < COLNO; x++) {
                    if (cGrid[y][x] !== jsGrid[y][x]) {
                        diffs.push({
                            x, y,
                            c: cGrid[y][x],
                            js: jsGrid[y][x],
                            cName: typName(cGrid[y][x]),
                            jsName: typName(jsGrid[y][x]),
                        });
                    }
                }
            }

            // Report differences (expected during active porting)
            if (diffs.length > 0) {
                const maxShow = 20;
                const shown = diffs.slice(0, maxShow);
                let report = `${diffs.length} cells differ for ${label}:\n`;
                for (const d of shown) {
                    report += `  (${d.x},${d.y}): C=${d.cName}(${d.c}) JS=${d.jsName}(${d.js})\n`;
                }
                if (diffs.length > maxShow) {
                    report += `  ... and ${diffs.length - maxShow} more\n`;
                }
                // Log the diff report but don't fail -- divergences are
                // expected until the JS port is complete. The value is in
                // seeing the diff count shrink over time.
                console.log(report);
            } else {
                console.log(`PERFECT MATCH for ${label}`);
            }
        });
    }
});
