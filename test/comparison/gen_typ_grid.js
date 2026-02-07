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
import { initRng } from '../../js/rng.js';
import { generateLevel, wallification } from '../../js/dungeon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOLDEN_DIR = join(__dirname, 'golden');

// Generate a raw typ grid for (seed, depth): array of 21 strings,
// each containing 80 space-separated integers.
export function generateTypGrid(seed, depth) {
    initRng(seed);
    const map = generateLevel(depth);
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
];

export { CONFIGS };

// When executed directly, write golden typ grid files
function main() {
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
