// test/unit/headless_replay_api.test.js -- Unit tests for HeadlessGame replay API
//
// Phase 1: Consolidate Core Replay API
// Tests the canonical replay API added to HeadlessGame.

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { HeadlessGame, HeadlessDisplay } from '../../js/headless_runtime.js';
import { ROWNO, COLNO, TERMINAL_ROWS, TERMINAL_COLS } from '../../js/config.js';

describe('HeadlessGame Replay API', () => {
    describe('HeadlessGame.start()', () => {
        it('creates a game instance with default options', async () => {
            const game = await HeadlessGame.start(12345);
            assert.ok(game instanceof HeadlessGame);
            assert.strictEqual(game.seed, 12345);
            assert.strictEqual(game.wizard, true); // default wizard mode
        });

        it('respects roleIndex option', async () => {
            const game = await HeadlessGame.start(12345, { roleIndex: 0 });
            assert.strictEqual(game.roleIndex, 0);
        });

        it('respects name option', async () => {
            const game = await HeadlessGame.start(12345, { name: 'TestPlayer' });
            assert.strictEqual(game.player.name, 'TestPlayer');
        });

        it('respects wizard option', async () => {
            const game = await HeadlessGame.start(12345, { wizard: true });
            assert.strictEqual(game.wizard, true);
            assert.strictEqual(game.player.wizard, true);
        });
    });

    describe('sendKey() and sendKeys()', () => {
        it('sendKey executes a command', async () => {
            const game = await HeadlessGame.start(12345);
            const result = await game.sendKey('.');
            assert.ok(result !== undefined);
        });

        it('sendKeys executes multiple commands', async () => {
            const game = await HeadlessGame.start(12345);
            const results = await game.sendKeys(['.', '.', '.']);
            assert.strictEqual(results.length, 3);
        });
    });

    describe('getTypGrid()', () => {
        it('returns a 21x80 grid', async () => {
            const game = await HeadlessGame.start(12345);
            const grid = game.getTypGrid();

            assert.strictEqual(grid.length, ROWNO);
            for (let y = 0; y < ROWNO; y++) {
                assert.strictEqual(grid[y].length, COLNO, `Row ${y} should have ${COLNO} columns`);
            }
        });

        it('contains valid terrain type integers', async () => {
            const game = await HeadlessGame.start(12345);
            const grid = game.getTypGrid();

            for (let y = 0; y < ROWNO; y++) {
                for (let x = 0; x < COLNO; x++) {
                    const typ = grid[y][x];
                    assert.ok(Number.isInteger(typ), `Grid[${y}][${x}] should be integer`);
                    assert.ok(typ >= 0 && typ < 50, `Grid[${y}][${x}] should be valid typ (0-49)`);
                }
            }
        });

        it('is deterministic for same seed', async () => {
            const game1 = await HeadlessGame.start(99999);
            const game2 = await HeadlessGame.start(99999);

            const grid1 = game1.getTypGrid();
            const grid2 = game2.getTypGrid();

            for (let y = 0; y < ROWNO; y++) {
                for (let x = 0; x < COLNO; x++) {
                    assert.strictEqual(grid1[y][x], grid2[y][x],
                        `Grid[${y}][${x}] should match for same seed`);
                }
            }
        });
    });

    describe('getScreen()', () => {
        it('returns 24 lines', async () => {
            const game = await HeadlessGame.start(12345);
            const screen = game.getScreen();

            assert.strictEqual(screen.length, TERMINAL_ROWS);
        });

        it('lines are strings', async () => {
            const game = await HeadlessGame.start(12345);
            const screen = game.getScreen();

            for (let i = 0; i < screen.length; i++) {
                assert.strictEqual(typeof screen[i], 'string', `Line ${i} should be string`);
            }
        });

        it('contains player @ symbol on map', async () => {
            const game = await HeadlessGame.start(12345);
            const screen = game.getScreen();
            const screenText = screen.join('\n');

            assert.ok(screenText.includes('@'), 'Screen should show player @');
        });
    });

    describe('RNG Instrumentation', () => {
        it('enableRngLogging and getRngLog work', async () => {
            const game = await HeadlessGame.start(12345);
            game.enableRngLogging();

            // Execute a command that consumes RNG
            await game.sendKey('.');

            const log = game.getRngLog();
            assert.ok(Array.isArray(log), 'RNG log should be array');
        });

        it('clearRngLog clears the log', async () => {
            const game = await HeadlessGame.start(12345);
            game.enableRngLogging();
            await game.sendKey('.');

            game.clearRngLog();
            const log = game.getRngLog();

            assert.strictEqual(log.length, 0, 'RNG log should be empty after clear');
        });
    });

    describe('Wizard Mode Helpers', () => {
        it('teleportToLevel changes level', async () => {
            const game = await HeadlessGame.start(12345, { wizard: true });
            assert.strictEqual(game.player.dungeonLevel, 1);

            game.teleportToLevel(2);

            assert.strictEqual(game.player.dungeonLevel, 2);
        });

        it('teleportToLevel generates new level', async () => {
            const game = await HeadlessGame.start(12345, { wizard: true });
            const grid1 = game.getTypGrid();

            game.teleportToLevel(3);

            const grid3 = game.getTypGrid();
            // Level 3 should be different from level 1
            let differences = 0;
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 0; x < COLNO; x++) {
                    if (grid1[y][x] !== grid3[y][x]) differences++;
                }
            }
            assert.ok(differences > 0, 'Level 3 should differ from level 1');
        });

        it('revealMap marks all cells as seen', async () => {
            const game = await HeadlessGame.start(12345, { wizard: true });
            game.revealMap();

            // Check that cells are marked as seen
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 0; x < COLNO; x++) {
                    const loc = game.map.at(x, y);
                    if (loc) {
                        assert.strictEqual(loc.seenv, 0xFF,
                            `Cell (${x},${y}) should be fully seen`);
                    }
                }
            }
        });

        it('teleportToLevel throws without wizard mode', async () => {
            const game = await HeadlessGame.start(12345, { wizard: false });
            game.wizard = false;

            assert.throws(() => {
                game.teleportToLevel(2);
            }, /wizard mode/);
        });

        it('revealMap throws without wizard mode', async () => {
            const game = await HeadlessGame.start(12345, { wizard: false });
            game.wizard = false;

            assert.throws(() => {
                game.revealMap();
            }, /wizard mode/);
        });
    });

    describe('checkpoint()', () => {
        it('captures game state', async () => {
            const game = await HeadlessGame.start(12345, { wizard: true });
            game.enableRngLogging();
            await game.sendKey('.');

            const cp = game.checkpoint('test-phase');

            assert.strictEqual(cp.phase, 'test-phase');
            assert.strictEqual(cp.seed, 12345);
            assert.ok(Number.isInteger(cp.turnCount));
            assert.ok(Number.isInteger(cp.dungeonLevel));
            assert.ok(cp.playerPos.x !== undefined);
            assert.ok(cp.playerPos.y !== undefined);
            assert.ok(Array.isArray(cp.rngLog));
            assert.ok(Array.isArray(cp.typGrid));
            assert.ok(Array.isArray(cp.screen));
        });
    });
});

describe('HeadlessDisplay', () => {
    it('getScreenLines returns 24 lines', () => {
        const display = new HeadlessDisplay();
        const lines = display.getScreenLines();

        assert.strictEqual(lines.length, TERMINAL_ROWS);
    });

    it('setCell and getScreenLines work together', () => {
        const display = new HeadlessDisplay();
        display.setCell(5, 3, 'X');

        const lines = display.getScreenLines();
        assert.ok(lines[3].includes('X'), 'Line 3 should contain X');
    });

    it('clearScreen clears all cells', () => {
        const display = new HeadlessDisplay();
        display.setCell(5, 3, 'X');
        display.clearScreen();

        const lines = display.getScreenLines();
        const allEmpty = lines.every(line => line.trim() === '');
        assert.ok(allEmpty, 'All lines should be empty after clearScreen');
    });
});

describe('HeadlessGame.replayStep (Phase 4)', () => {
    it('executes a command and returns result', async () => {
        const game = await HeadlessGame.start(12345, { wizard: true });
        const result = await game.replayStep('.');

        assert.ok(result, 'Should return result');
        assert.ok('tookTime' in result, 'Result should have tookTime');
        assert.ok(Array.isArray(result.screen), 'Result should have screen');
        assert.ok(Array.isArray(result.typGrid), 'Result should have typGrid');
    });

    it('handles count prefix', async () => {
        const game = await HeadlessGame.start(12345, { wizard: true });
        const initialTurn = game.turnCount;

        // Execute with count prefix of 3 (wait 3 times)
        const result = await game.replayStep('.', { countPrefix: 3 });

        // Turn count should advance more than once
        assert.ok(game.turnCount > initialTurn, 'Turn count should advance');
    });

    it('result includes screen and typGrid', async () => {
        const game = await HeadlessGame.start(12345, { wizard: true });
        const result = await game.replayStep('.');

        assert.strictEqual(result.screen.length, TERMINAL_ROWS);
        assert.strictEqual(result.typGrid.length, ROWNO);
    });
});

describe('HeadlessGame.isCountPrefixDigit', () => {
    it('returns true for digits 0-9', () => {
        for (let i = 0; i <= 9; i++) {
            assert.strictEqual(HeadlessGame.isCountPrefixDigit(String(i)), true);
        }
    });

    it('returns false for non-digits', () => {
        assert.strictEqual(HeadlessGame.isCountPrefixDigit('a'), false);
        assert.strictEqual(HeadlessGame.isCountPrefixDigit('.'), false);
        assert.strictEqual(HeadlessGame.isCountPrefixDigit(' '), false);
    });
});

describe('HeadlessGame.accumulateCountPrefix', () => {
    it('accumulates digit into count', () => {
        const result = HeadlessGame.accumulateCountPrefix(0, '5');
        assert.strictEqual(result.newCount, 5);
        assert.strictEqual(result.isDigit, true);
    });

    it('accumulates multiple digits', () => {
        let count = 0;
        count = HeadlessGame.accumulateCountPrefix(count, '1').newCount;
        count = HeadlessGame.accumulateCountPrefix(count, '2').newCount;
        count = HeadlessGame.accumulateCountPrefix(count, '3').newCount;
        assert.strictEqual(count, 123);
    });

    it('caps at 32767', () => {
        const result = HeadlessGame.accumulateCountPrefix(10000, '9');
        assert.strictEqual(result.newCount, 32767);
    });

    it('returns isDigit false for non-digits', () => {
        const result = HeadlessGame.accumulateCountPrefix(5, 'a');
        assert.strictEqual(result.isDigit, false);
        assert.strictEqual(result.newCount, 5);
    });
});

describe('HeadlessGame.generateStartupWithRng (Phase 3)', () => {
    it('generates grid with correct dimensions', () => {
        const result = HeadlessGame.generateStartupWithRng(12345, {});
        const grid = result.grid;

        assert.strictEqual(grid.length, ROWNO);
        for (let y = 0; y < ROWNO; y++) {
            assert.strictEqual(grid[y].length, COLNO, `Row ${y} should have ${COLNO} columns`);
        }
    });

    it('captures RNG log', () => {
        const result = HeadlessGame.generateStartupWithRng(12345, {});

        assert.ok(result.rngCalls > 0, 'Should have RNG calls');
        assert.ok(Array.isArray(result.rng), 'RNG log should be array');
    });

    it('respects roleIndex option', () => {
        const result = HeadlessGame.generateStartupWithRng(12345, { roleIndex: 0 });

        assert.ok(result.player, 'Should have player');
        // Role index 0 is Archeologist
    });

    it('respects name option', () => {
        const result = HeadlessGame.generateStartupWithRng(12345, { name: 'TestPlayer' });

        assert.strictEqual(result.player.name, 'TestPlayer');
    });

    it('is deterministic for same seed', () => {
        const result1 = HeadlessGame.generateStartupWithRng(99999, {});
        const result2 = HeadlessGame.generateStartupWithRng(99999, {});

        // Compare grids
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 0; x < COLNO; x++) {
                assert.strictEqual(result1.grid[y][x], result2.grid[y][x],
                    `Grid[${y}][${x}] should match for same seed`);
            }
        }
    });

    it('HeadlessGame.getRoleIndex returns correct index', () => {
        // Valkyrie should be index 11
        assert.strictEqual(HeadlessGame.getRoleIndex('Valkyrie'), 11);
        // Unknown role should default to 11
        assert.strictEqual(HeadlessGame.getRoleIndex('UnknownRole'), 11);
    });
});

describe('HeadlessGame.generateMapsWithRng (Phase 2)', () => {
    it('generates grids for each depth', () => {
        const result = HeadlessGame.generateMapsWithRng(12345, 3);

        assert.ok(result.grids[1], 'Should have grid for depth 1');
        assert.ok(result.grids[2], 'Should have grid for depth 2');
        assert.ok(result.grids[3], 'Should have grid for depth 3');
    });

    it('grids have correct dimensions (21x80)', () => {
        const result = HeadlessGame.generateMapsWithRng(12345, 1);
        const grid = result.grids[1];

        assert.strictEqual(grid.length, ROWNO);
        for (let y = 0; y < ROWNO; y++) {
            assert.strictEqual(grid[y].length, COLNO, `Row ${y} should have ${COLNO} columns`);
        }
    });

    it('captures RNG logs for each depth', () => {
        const result = HeadlessGame.generateMapsWithRng(12345, 2);

        assert.ok(result.rngLogs[1], 'Should have RNG log for depth 1');
        assert.ok(result.rngLogs[2], 'Should have RNG log for depth 2');
        assert.ok(result.rngLogs[1].rngCalls > 0, 'Depth 1 should have RNG calls');
        assert.ok(Array.isArray(result.rngLogs[1].rng), 'RNG log should be array');
    });

    it('is deterministic for same seed', () => {
        const result1 = HeadlessGame.generateMapsWithRng(99999, 2);
        const result2 = HeadlessGame.generateMapsWithRng(99999, 2);

        // Compare grids
        for (let depth = 1; depth <= 2; depth++) {
            for (let y = 0; y < ROWNO; y++) {
                for (let x = 0; x < COLNO; x++) {
                    assert.strictEqual(
                        result1.grids[depth][y][x],
                        result2.grids[depth][y][x],
                        `Depth ${depth} grid[${y}][${x}] should match`
                    );
                }
            }
        }
    });

    it('different seeds produce different maps', () => {
        const result1 = HeadlessGame.generateMapsWithRng(11111, 1);
        const result2 = HeadlessGame.generateMapsWithRng(22222, 1);

        let differences = 0;
        for (let y = 0; y < ROWNO; y++) {
            for (let x = 0; x < COLNO; x++) {
                if (result1.grids[1][y][x] !== result2.grids[1][y][x]) {
                    differences++;
                }
            }
        }

        assert.ok(differences > 0, 'Different seeds should produce different maps');
    });
});
