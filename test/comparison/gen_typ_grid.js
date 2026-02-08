// test/comparison/gen_typ_grid.js -- Generate raw terrain type grids for C comparison
// Produces the same 21×80 grid as the C #dumpmap command, but from the JS side.
// Each cell is the integer terrain type (levl[x][y].typ equivalent).
//
// Output format: 21 rows, each containing 80 space-separated integers.
// This matches the C dumpmap patch output exactly.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COLNO, ROWNO } from '../../js/config.js';
import { initRng, enableRngLog, getRngLog, disableRngLog } from '../../js/rng.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOLDEN_DIR = join(__dirname, 'golden');

// Generate a raw typ grid for (seed, depth): array of 21 strings,
// each containing 80 space-separated integers.
export function generateTypGrid(seed, depth) {
    initRng(seed);
    initLevelGeneration();
    const map = makelevel(depth);
    wallification(map);

    const rows = [];
    for (let y = 0; y < ROWNO; y++) {
        const vals = [];
        for (let x = 0; x < COLNO; x++) {
            const loc = map.at(x, y);
            vals.push(loc ? loc.typ : 0);
        }
        rows.push(vals.join(' '));
    }
    return rows;
}

// Generate typ grids for multiple depths sequentially (one continuous RNG stream).
// Used for Phase 2+ multi-level C-vs-JS comparison where the C side generates
// levels 1→2→...→N in sequence via wizard mode level teleport.
export function generateTypGridSequential(seed, maxDepth) {
    initRng(seed);
    initLevelGeneration();
    const grids = {};
    for (let depth = 1; depth <= maxDepth; depth++) {
        const map = makelevel(depth);
        wallification(map);
        const rows = [];
        for (let y = 0; y < ROWNO; y++) {
            const vals = [];
            for (let x = 0; x < COLNO; x++) {
                const loc = map.at(x, y);
                vals.push(loc ? loc.typ : 0);
            }
            rows.push(vals.join(' '));
        }
        grids[depth] = rows;
    }
    return grids;
}

// Test configurations (same as gen_golden.js)
const CONFIGS = [
    { seed: 42,  depth: 1 },
    { seed: 42,  depth: 3 },
    { seed: 42,  depth: 5 },
    { seed: 100, depth: 1 },
    { seed: 100, depth: 3 },
    { seed: 100, depth: 5 },
    { seed: 999, depth: 1 },
    { seed: 999, depth: 3 },
    { seed: 999, depth: 5 },
    { seed: 7,   depth: 1 },
    { seed: 7,   depth: 3 },
    { seed: 7,   depth: 5 },
    { seed: 314, depth: 1 },
    { seed: 314, depth: 3 },
    { seed: 314, depth: 5 },
    { seed: 555, depth: 1 },
    { seed: 555, depth: 3 },
    { seed: 555, depth: 5 },
    { seed: 1,     depth: 1 },
    { seed: 1,     depth: 3 },
    { seed: 1,     depth: 5 },
    { seed: 200,   depth: 1 },
    { seed: 200,   depth: 3 },
    { seed: 200,   depth: 5 },
    { seed: 2468,  depth: 1 },
    { seed: 2468,  depth: 3 },
    { seed: 2468,  depth: 5 },
    { seed: 31337, depth: 1 },
    { seed: 31337, depth: 3 },
    { seed: 31337, depth: 5 },
    // Seeds that exercise des.room() themeroom picks 1-4, 8-10
    { seed: 119, depth: 1 },  // pick 1: Fake Delphi
    { seed: 72,  depth: 1 },  // pick 2: Room in a room
    { seed: 306, depth: 1 },  // pick 3: Huge room
    { seed: 212, depth: 1 },  // pick 4: Nesting rooms
    { seed: 112, depth: 1 },  // pick 8: Pillars
    { seed: 163, depth: 1 },  // pick 9: Mausoleum
    { seed: 16,  depth: 1 },  // pick 10: Random feature
];

export { CONFIGS };

// Collect unique seeds from CONFIGS
function uniqueSeeds() {
    const seeds = new Set();
    for (const { seed } of CONFIGS) seeds.add(seed);
    return [...seeds].sort((a, b) => a - b);
}

// Convert JS RNG log entry to compact session format.
// JS: "1 rn2(12) = 2" → "rn2(12)=2"
function toCompactRng(entry) {
    return entry.replace(/^\d+\s+/, '').replace(' = ', '=');
}

// Generate v2 map-only session JSON files using sequential generation.
// Each session covers depths 1→maxDepth for one seed.
// When withRng is true, full RNG traces are included per level.
function generateSessions(maxDepth = 5, withRng = false) {
    const sessionsDir = join(__dirname, 'maps');
    mkdirSync(sessionsDir, { recursive: true });

    for (const seed of uniqueSeeds()) {
        enableRngLog();
        initRng(seed);
        initLevelGeneration();

        const levels = [];
        let prevCount = 0;
        for (let depth = 1; depth <= maxDepth; depth++) {
            const map = makelevel(depth);
            wallification(map);
            const grid = [];
            for (let y = 0; y < ROWNO; y++) {
                const row = [];
                for (let x = 0; x < COLNO; x++) {
                    const loc = map.at(x, y);
                    row.push(loc ? loc.typ : 0);
                }
                grid.push(row);
            }
            const fullLog = getRngLog();
            const depthLog = fullLog.slice(prevCount);
            const levelData = { depth, typGrid: grid, rngCalls: depthLog.length };
            if (withRng) {
                levelData.rng = depthLog.map(toCompactRng);
            }
            levels.push(levelData);
            prevCount = fullLog.length;
        }
        disableRngLog();

        const session = {
            version: 2,
            seed,
            type: 'map',
            source: 'js',
            levels,
        };

        // Write with compact typGrid rows (arrays of numbers on one line)
        const raw = JSON.stringify(session, null, 2);
        const lines = raw.split('\n');
        const result = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            // Detect start of a number array
            if (line.trimEnd().endsWith('[') && i + 1 < lines.length) {
                const next = lines[i + 1].trim();
                if (next && /^-?\d/.test(next.replace(/,$/, ''))) {
                    const prefix = line.trimEnd();
                    const nums = [];
                    let j = i + 1;
                    while (j < lines.length) {
                        const t = lines[j].trim();
                        if (t === ']' || t === '],') {
                            result.push(`${prefix}${nums.join(', ')}${t}`);
                            i = j + 1;
                            break;
                        }
                        nums.push(t.replace(/,$/, ''));
                        j++;
                    }
                    continue;
                }
            }
            result.push(line);
            i++;
        }

        const filename = `seed${seed}_maps.session.json`;
        const filepath = join(sessionsDir, filename);
        writeFileSync(filepath, result.join('\n') + '\n', 'utf-8');
        console.log(`Wrote ${filepath} (${levels.length} levels)`);
    }
}

// When executed directly, write golden typ grid files or session files
function main() {
    const mode = process.argv[2];

    if (mode === '--sessions') {
        const args = process.argv.slice(3);
        const withRng = args.includes('--with-rng');
        const maxDepth = parseInt(args.find(a => !a.startsWith('--')) || '5', 10);
        generateSessions(maxDepth, withRng);
        return;
    }

    mkdirSync(GOLDEN_DIR, { recursive: true });
    for (const { seed, depth } of CONFIGS) {
        const rows = generateTypGrid(seed, depth);
        const filename = `typ_seed${seed}_depth${depth}.txt`;
        const filepath = join(GOLDEN_DIR, filename);
        writeFileSync(filepath, rows.join('\n') + '\n', 'utf-8');
        console.log(`Wrote ${filepath}`);
    }
    console.log('Typ grid generation complete.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main();
}
