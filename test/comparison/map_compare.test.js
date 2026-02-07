// test/comparison/map_compare.test.js -- Golden-reference comparison tests
// Generates dungeon levels with fixed seeds and compares them character by
// character against golden reference files.  Also validates structural
// properties: dimensions, valid terrain symbols, wall completeness, and
// corridor connectivity.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    COLNO, ROWNO, STONE, VWALL, HWALL, TLCORNER, TRCORNER,
    BLCORNER, BRCORNER, CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL,
    DOOR, CORR, ROOM, STAIRS, FOUNTAIN, THRONE, SINK, GRAVE, ALTAR,
    POOL, MOAT, WATER, LAVAPOOL, LAVAWALL, ICE, IRONBARS, TREE,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, AIR, CLOUD, SDOOR, SCORR,
    OROOM, VAULT,
    IS_WALL, IS_DOOR, ACCESSIBLE, isok
} from '../../js/config.js';
import { initRng } from '../../js/rng.js';
import { generateLevel, wallification } from '../../js/dungeon.js';
import { renderMap, generateMapText, CONFIGS } from './gen_golden.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const GOLDEN_DIR = join(__dirname, 'golden');

// Set of characters that are valid NetHack terrain display symbols
const VALID_TERRAIN_CHARS = new Set([
    ' ',   // stone, air, scorr
    '|',   // vwall, tlwall, trwall, sdoor (vertical), grave
    '-',   // hwall, corners, crosswall, tuwalls, tdwall
    '+',   // closed/locked door
    '.',   // room, open door, doorway, ice, drawbridge_down
    '#',   // corridor, ironbars, tree, drawbridge_up, cloud
    '<',   // upstairs
    '>',   // downstairs
    '{',   // fountain, sink
    '}',   // pool, moat, water, lava
    '_',   // altar
    '\\',  // throne
]);

// ---------------------------------------------------------------------------
// 1. Golden reference comparison -- same seed always produces same map
// ---------------------------------------------------------------------------

describe('Golden reference comparison', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;
        const goldenPath = join(GOLDEN_DIR, `seed${seed}_depth${depth}.txt`);

        it(`matches golden file for ${label}`, () => {
            assert.ok(existsSync(goldenPath),
                `Golden file missing: ${goldenPath} -- run node test/comparison/gen_golden.js`);

            const goldenText = readFileSync(goldenPath, 'utf-8');
            const goldenRows = goldenText.split('\n');
            // Remove trailing empty line from the file if present
            if (goldenRows.length > 0 && goldenRows[goldenRows.length - 1] === '') {
                goldenRows.pop();
            }

            const currentRows = generateMapText(seed, depth);

            assert.equal(currentRows.length, goldenRows.length,
                `Row count mismatch for ${label}: got ${currentRows.length}, expected ${goldenRows.length}`);

            for (let y = 0; y < currentRows.length; y++) {
                assert.equal(currentRows[y], goldenRows[y],
                    `Row ${y} mismatch for ${label}:\n` +
                    `  got:    "${currentRows[y]}"\n` +
                    `  expect: "${goldenRows[y]}"`);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// 2. Map dimension checks
// ---------------------------------------------------------------------------

describe('Map dimensions', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`has 21 rows and 80 columns for ${label}`, () => {
            const rows = generateMapText(seed, depth);
            assert.equal(rows.length, ROWNO,
                `Expected ${ROWNO} rows, got ${rows.length} for ${label}`);
            for (let y = 0; y < rows.length; y++) {
                assert.equal(rows[y].length, COLNO,
                    `Row ${y} has ${rows[y].length} cols, expected ${COLNO} for ${label}`);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// 3. Valid terrain characters
// ---------------------------------------------------------------------------

describe('Valid terrain characters', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`contains only valid NetHack symbols for ${label}`, () => {
            const rows = generateMapText(seed, depth);
            for (let y = 0; y < rows.length; y++) {
                for (let x = 0; x < rows[y].length; x++) {
                    const ch = rows[y][x];
                    assert.ok(VALID_TERRAIN_CHARS.has(ch),
                        `Invalid character '${ch}' (code ${ch.charCodeAt(0)}) ` +
                        `at (${x},${y}) for ${label}`);
                }
            }
        });

        it(`has no '?' (unknown terrain) characters for ${label}`, () => {
            const rows = generateMapText(seed, depth);
            for (let y = 0; y < rows.length; y++) {
                assert.ok(!rows[y].includes('?'),
                    `Found '?' at row ${y} for ${label} -- terrain type has no symbol`);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// 4. Determinism -- generating the same (seed, depth) twice yields identical output
// ---------------------------------------------------------------------------

describe('Deterministic output', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`same seed always produces identical map for ${label}`, () => {
            const rows1 = generateMapText(seed, depth);
            const rows2 = generateMapText(seed, depth);
            assert.deepStrictEqual(rows1, rows2,
                `Non-deterministic output for ${label}`);
        });
    }
});

// ---------------------------------------------------------------------------
// 5. Room wall completeness -- every room interior tile is enclosed by walls
//    (or doors/corridors at openings)
// ---------------------------------------------------------------------------

describe('Room wall completeness', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`all rooms have complete wall borders for ${label}`, () => {
            initRng(seed);
            const map = generateLevel(depth);
            wallification(map);

            for (const room of map.rooms) {
                // Check top edge  (y = ly - 1)
                for (let x = room.lx - 1; x <= room.hx + 1; x++) {
                    const yTop = room.ly - 1;
                    if (!isok(x, yTop)) continue;
                    const loc = map.at(x, yTop);
                    assert.ok(
                        IS_WALL(loc.typ) || IS_DOOR(loc.typ) || loc.typ === CORR || loc.typ === SDOOR || loc.typ === SCORR || loc.typ === IRONBARS,
                        `Gap in top wall at (${x},${yTop}) for ${label}: typ=${loc.typ}`
                    );
                }
                // Check bottom edge (y = hy + 1)
                for (let x = room.lx - 1; x <= room.hx + 1; x++) {
                    const yBot = room.hy + 1;
                    if (!isok(x, yBot)) continue;
                    const loc = map.at(x, yBot);
                    assert.ok(
                        IS_WALL(loc.typ) || IS_DOOR(loc.typ) || loc.typ === CORR || loc.typ === SDOOR || loc.typ === SCORR || loc.typ === IRONBARS,
                        `Gap in bottom wall at (${x},${yBot}) for ${label}: typ=${loc.typ}`
                    );
                }
                // Check left edge (x = lx - 1)
                for (let y = room.ly - 1; y <= room.hy + 1; y++) {
                    const xLeft = room.lx - 1;
                    if (!isok(xLeft, y)) continue;
                    const loc = map.at(xLeft, y);
                    assert.ok(
                        IS_WALL(loc.typ) || IS_DOOR(loc.typ) || loc.typ === CORR || loc.typ === SDOOR || loc.typ === SCORR || loc.typ === IRONBARS,
                        `Gap in left wall at (${xLeft},${y}) for ${label}: typ=${loc.typ}`
                    );
                }
                // Check right edge (x = hx + 1)
                for (let y = room.ly - 1; y <= room.hy + 1; y++) {
                    const xRight = room.hx + 1;
                    if (!isok(xRight, y)) continue;
                    const loc = map.at(xRight, y);
                    assert.ok(
                        IS_WALL(loc.typ) || IS_DOOR(loc.typ) || loc.typ === CORR || loc.typ === SDOOR || loc.typ === SCORR || loc.typ === IRONBARS,
                        `Gap in right wall at (${xRight},${y}) for ${label}: typ=${loc.typ}`
                    );
                }
            }
        });
    }
});

// ---------------------------------------------------------------------------
// 6. Corridor connectivity -- every room is reachable from every other room
//    via a BFS over accessible terrain (rooms, corridors, doors)
// ---------------------------------------------------------------------------

describe('Corridor connectivity', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`all rooms are reachable from first room for ${label}`, () => {
            initRng(seed);
            const map = generateLevel(depth);
            wallification(map);

            // Find first non-vault room
            const nonVaultRooms = map.rooms.filter(r => r.rtype !== VAULT);
            if (nonVaultRooms.length <= 1) return; // nothing to check

            // BFS from center of first non-vault room
            const start = nonVaultRooms[0];
            const sx = Math.floor((start.lx + start.hx) / 2);
            const sy = Math.floor((start.ly + start.hy) / 2);

            const visited = [];
            for (let x = 0; x < COLNO; x++) {
                visited[x] = new Uint8Array(ROWNO); // zeroed
            }

            const queue = [[sx, sy]];
            visited[sx][sy] = 1;

            while (queue.length > 0) {
                const [cx, cy] = queue.shift();
                for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (!isok(nx, ny)) continue;
                    if (visited[nx][ny]) continue;
                    const t = map.at(nx, ny).typ;
                    if (ACCESSIBLE(t) || t === SDOOR || t === SCORR) {
                        visited[nx][ny] = 1;
                        queue.push([nx, ny]);
                    }
                }
            }

            for (let i = 1; i < map.rooms.length; i++) {
                const room = map.rooms[i];
                // Vaults are intentionally disconnected (accessed via teleport)
                if (room.rtype === VAULT) continue;
                const rx = Math.floor((room.lx + room.hx) / 2);
                const ry = Math.floor((room.ly + room.hy) / 2);
                assert.ok(visited[rx][ry] === 1,
                    `Room ${i} (center ${rx},${ry}) is not reachable from room 0 for ${label}`);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// 7. Stairs placement
// ---------------------------------------------------------------------------

describe('Stairs placement', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`has a downstairs for ${label}`, () => {
            initRng(seed);
            const map = generateLevel(depth);

            assert.ok(
                map.dnstair.x > 0 || map.dnstair.y > 0,
                `No downstairs placed for ${label}`
            );
            const loc = map.at(map.dnstair.x, map.dnstair.y);
            assert.equal(loc.typ, STAIRS,
                `Downstairs location is not STAIRS for ${label}`);
        });

        if (depth > 1) {
            it(`has an upstairs for ${label}`, () => {
                initRng(seed);
                const map = generateLevel(depth);

                assert.ok(
                    map.upstair.x > 0 || map.upstair.y > 0,
                    `No upstairs placed for depth=${depth} ${label}`
                );
                const loc = map.at(map.upstair.x, map.upstair.y);
                assert.equal(loc.typ, STAIRS,
                    `Upstairs location is not STAIRS for ${label}`);
            });
        }
    }

    it('downstairs renders as > in the text map', () => {
        initRng(42);
        const map = generateLevel(1);
        wallification(map);
        const rows = renderMap(map);
        const { x, y } = map.dnstair;
        assert.equal(rows[y][x], '>',
            `Downstairs at (${x},${y}) should render as '>', got '${rows[y][x]}'`);
    });

    it('upstairs renders as < in the text map', () => {
        initRng(42);
        const map = generateLevel(3);
        wallification(map);
        const rows = renderMap(map);
        const { x, y } = map.upstair;
        assert.equal(rows[y][x], '<',
            `Upstairs at (${x},${y}) should render as '<', got '${rows[y][x]}'`);
    });
});

// ---------------------------------------------------------------------------
// 8. Non-empty maps -- maps have meaningful content (not all stone)
// ---------------------------------------------------------------------------

describe('Non-empty maps', () => {
    for (const { seed, depth } of CONFIGS) {
        const label = `seed=${seed} depth=${depth}`;

        it(`has rooms, corridors, and walls for ${label}`, () => {
            const rows = generateMapText(seed, depth);
            const allText = rows.join('');

            const roomCount = (allText.match(/\./g) || []).length;
            const corrCount = (allText.match(/#/g) || []).length;
            const wallCount = (allText.match(/[-|]/g) || []).length;

            assert.ok(roomCount > 0, `No room floor tiles for ${label}`);
            assert.ok(corrCount > 0, `No corridor tiles for ${label}`);
            assert.ok(wallCount > 0, `No wall tiles for ${label}`);
        });
    }
});
