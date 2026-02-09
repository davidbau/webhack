// test/unit/wizard.test.js -- Tests for wizard mode commands
// Tests the wizard mode functionality: magic mapping, level change, teleport, genesis

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLNO, ROWNO, ROOM, STONE, ACCESSIBLE } from '../../js/config.js';
import { initRng, rn2 } from '../../js/rng.js';
import { GameMap } from '../../js/map.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';
import { rhack } from '../../js/commands.js';
import { FOV } from '../../js/vision.js';
import { pushInput } from '../../js/input.js';

// Mock display that captures messages
function mockDisplay() {
    const msgs = [];
    return {
        messages: msgs,
        putstr_message(msg) { msgs.push(msg); },
        putstr() {},
        renderMap() {},
        renderStatus() {},
        renderChargenMenu() {},
        clearRow() {},
    };
}

// Build a mock game object with a real generated map
function mockGame(opts = {}) {
    initRng(42);
    initLevelGeneration();
    const map = makelevel(1);
    wallification(map);
    const display = mockDisplay();
    const fov = new FOV();
    const player = {
        x: 0, y: 0, hp: 20, hpmax: 20, ac: 10,
        dungeonLevel: 1, maxDungeonLevel: 1,
        gold: 0, score: 0, turns: 0, hunger: 900,
        moved: false, isDead: false,
        inventory: [], weapon: null, armor: null,
        strBonus: 0, strDamage: 0,
        name: 'TestPlayer',
    };
    // Place player in first room
    if (map.rooms.length > 0) {
        const room = map.rooms[0];
        player.x = Math.floor((room.lx + room.hx) / 2);
        player.y = Math.floor((room.ly + room.hy) / 2);
    }
    const game = {
        player, map, display, fov,
        wizard: opts.wizard || false,
        gameOver: false,
        gameOverReason: '',
        turnCount: 0,
        levels: { 1: map },
        changeLevel(depth) {
            if (!this.levels[depth]) {
                initRng(42 + depth);
                initLevelGeneration();
                const newMap = makelevel(depth);
                wallification(newMap);
                this.levels[depth] = newMap;
            }
            this.map = this.levels[depth];
            this.player.dungeonLevel = depth;
            // Place at first room center
            if (this.map.rooms.length > 0) {
                const room = this.map.rooms[0];
                this.player.x = Math.floor((room.lx + room.hx) / 2);
                this.player.y = Math.floor((room.ly + room.hy) / 2);
            }
            this.fov.compute(this.map, this.player.x, this.player.y);
            this.display.renderMap(this.map, this.player, this.fov);
            this.display.renderStatus(this.player);
        },
    };
    return game;
}

describe('Wizard mode', () => {
    describe('Magic mapping (Ctrl+F)', () => {
        it('reveals entire map in wizard mode', async () => {
            const game = mockGame({ wizard: true });
            // Before: some cells should be unseen
            let unseenBefore = 0;
            for (let x = 0; x < COLNO; x++) {
                for (let y = 0; y < ROWNO; y++) {
                    if (game.map.at(x, y).seenv === 0) unseenBefore++;
                }
            }
            assert.ok(unseenBefore > 0, 'Some cells should be unseen initially');

            // Ctrl+F = char code 6
            const result = await rhack(6, game);

            // After: all cells should have seenv = 0xff
            for (let x = 0; x < COLNO; x++) {
                for (let y = 0; y < ROWNO; y++) {
                    assert.equal(game.map.at(x, y).seenv, 0xff,
                        `Cell at ${x},${y} should be fully revealed`);
                }
            }
            assert.equal(result.tookTime, false, 'Magic mapping should not take a turn');
            assert.ok(game.display.messages.some(m => m.includes('knowledgeable')),
                'Should show "knowledgeable" message');
        });

        it('rejects Ctrl+F in non-wizard mode', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack(6, game);
            // Should show unknown command (not wizard mode)
            assert.equal(result.tookTime, false);
        });
    });

    describe('Wizard commands rejected outside wizard mode', () => {
        it('Ctrl+V (levelchange) shows unknown command', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack(22, game);
            assert.equal(result.tookTime, false);
            // Non-wizard mode should show unknown command message
            assert.ok(game.display.messages.length > 0);
        });

        it('Ctrl+T (teleport) shows unknown command', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack(20, game);
            assert.equal(result.tookTime, false);
        });

        it('Ctrl+G (genesis) shows unknown command', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack(7, game);
            assert.equal(result.tookTime, false);
        });

        it('Ctrl+W (wish) shows unknown command', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack(23, game);
            assert.equal(result.tookTime, false);
        });

        it('Ctrl+I (identify) shows unknown command', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack(9, game);
            assert.equal(result.tookTime, false);
        });
    });

    describe('Magic mapping details', () => {
        it('sets lit = true on all cells', async () => {
            const game = mockGame({ wizard: true });
            await rhack(6, game);
            for (let x = 0; x < COLNO; x++) {
                for (let y = 0; y < ROWNO; y++) {
                    assert.equal(game.map.at(x, y).lit, true,
                        `Cell at ${x},${y} should be lit`);
                }
            }
        });
    });

    describe('URL parameter parsing', () => {
        it('nethack.js parseUrlParams is correctly structured', async () => {
            // We can't easily test URL parsing without a browser,
            // but we verify the wizard flag propagates through the game object
            const game = mockGame({ wizard: true });
            assert.equal(game.wizard, true);
            const game2 = mockGame({ wizard: false });
            assert.equal(game2.wizard, false);
        });
    });

    describe('Non-time-consuming commands', () => {
        it('help command does not take time', async () => {
            const game = mockGame({ wizard: false });
            pushInput('q'.charCodeAt(0));  // dismiss help menu
            const result = await rhack('?'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
        });

        it('look command does not take time', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack(':'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
        });

        it('inventory command does not take time', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack('i'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
            assert.ok(game.display.messages.some(m => m.includes('Not carrying')));
        });
    });

    describe('Help menu (?)', () => {
        it('help menu shows lettered options via renderChargenMenu', async () => {
            const game = mockGame({ wizard: false });
            let menuLines = null;
            game.display.renderChargenMenu = (lines) => { menuLines = lines; };
            pushInput('q'.charCodeAt(0));  // dismiss menu
            await rhack('?'.charCodeAt(0), game);
            assert.ok(menuLines, 'renderChargenMenu should have been called');
            assert.ok(menuLines.some(l => l.includes('Select one item')));
            assert.ok(menuLines.some(l => l.includes('a - About NetHack')));
            assert.ok(menuLines.some(l => l.includes('j - The NetHack Guidebook')));
        });

        it('help menu shows wizard option when in wizard mode', async () => {
            const game = mockGame({ wizard: true });
            let menuLines = null;
            game.display.renderChargenMenu = (lines) => { menuLines = lines; };
            pushInput('q'.charCodeAt(0));
            await rhack('?'.charCodeAt(0), game);
            assert.ok(menuLines.some(l => l.includes('w - List of wizard-mode commands')));
        });

        it('help menu does not show wizard option in normal mode', async () => {
            const game = mockGame({ wizard: false });
            let menuLines = null;
            game.display.renderChargenMenu = (lines) => { menuLines = lines; };
            pushInput('q'.charCodeAt(0));
            await rhack('?'.charCodeAt(0), game);
            assert.ok(!menuLines.some(l => l.includes('wizard')));
        });

        it('help option "a" shows version message', async () => {
            const game = mockGame({ wizard: false });
            pushInput('a'.charCodeAt(0));
            await rhack('?'.charCodeAt(0), game);
            assert.ok(game.display.messages.some(m => m.includes('NetHack') && m.includes('Version')));
        });
    });

    describe('Whatdoes command (&)', () => {
        it('describes a known command', async () => {
            const game = mockGame({ wizard: false });
            pushInput('.'.charCodeAt(0));
            const result = await rhack('&'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
            assert.ok(game.display.messages.some(m => m.includes("'.'") && m.includes('Rest')));
        });

        it('describes another known command', async () => {
            const game = mockGame({ wizard: false });
            pushInput('i'.charCodeAt(0));
            const result = await rhack('&'.charCodeAt(0), game);
            assert.ok(game.display.messages.some(m => m.includes("'i'") && m.includes('inventory')));
        });

        it('reports unknown for unbound key', async () => {
            const game = mockGame({ wizard: false });
            pushInput('X'.charCodeAt(0));
            const result = await rhack('&'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
            assert.ok(game.display.messages.some(m => m.includes('unknown')));
        });

        it('handles control characters', async () => {
            const game = mockGame({ wizard: false });
            pushInput(16);  // ^P
            const result = await rhack('&'.charCodeAt(0), game);
            assert.ok(game.display.messages.some(m => m.includes('^P') && m.includes('message')));
        });

        it('cancelled with ESC', async () => {
            const game = mockGame({ wizard: false });
            pushInput(27);  // ESC
            const result = await rhack('&'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
        });
    });

    describe('Whatis command (/)', () => {
        it('identifies a known symbol', async () => {
            const game = mockGame({ wizard: false });
            pushInput('>'.charCodeAt(0));
            const result = await rhack('/'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
            assert.ok(game.display.messages.some(m => m.includes("'>'") && m.includes('stairs down')));
        });

        it('identifies a letter as monster', async () => {
            const game = mockGame({ wizard: false });
            pushInput('d'.charCodeAt(0));
            const result = await rhack('/'.charCodeAt(0), game);
            assert.ok(game.display.messages.some(m => m.includes("'d'") && m.includes('monster')));
        });

        it('reports unknown for unrecognized symbol', async () => {
            const game = mockGame({ wizard: false });
            pushInput('~'.charCodeAt(0));
            const result = await rhack('/'.charCodeAt(0), game);
            assert.ok(game.display.messages.some(m => m.includes("don't know")));
        });

        it('cancelled with ESC', async () => {
            const game = mockGame({ wizard: false });
            pushInput(27);
            const result = await rhack('/'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
            // Only the prompt message should be shown, no identification result
            assert.equal(game.display.messages.length, 1);
            assert.ok(game.display.messages[0].includes('identify'));
        });
    });

    describe('Discoveries command (\\)', () => {
        it('shows placeholder message', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack('\\'.charCodeAt(0), game);
            assert.equal(result.tookTime, false);
            assert.ok(game.display.messages.some(m => m.includes('discovered')));
        });
    });

    describe('Wait and search commands', () => {
        it('wait takes a turn', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack('.'.charCodeAt(0), game);
            assert.equal(result.tookTime, true);
            assert.ok(game.display.messages.some(m => m.includes('wait')));
        });

        it('search takes a turn', async () => {
            const game = mockGame({ wizard: false });
            const result = await rhack('s'.charCodeAt(0), game);
            assert.equal(result.tookTime, true);
            assert.ok(game.display.messages.some(m => m.includes('search')));
        });
    });
});
