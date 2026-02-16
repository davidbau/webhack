import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { NetHackGame } from '../../js/nethack.js';
import { createInputQueue } from '../../js/input.js';
import { createHeadlessGame, HeadlessDisplay } from '../../js/headless_runtime.js';
import { COLNO, ROWNO, STONE } from '../../js/config.js';

function queueLine(input, text) {
    for (const ch of String(text)) {
        input.pushInput(ch.charCodeAt(0));
    }
    input.pushInput(13); // Enter
}

describe('wizard mode init and commands', () => {
    it('NetHackGame init honors wizard option from init options', async () => {
        const input = createInputQueue();
        const game = new NetHackGame({
            display: new HeadlessDisplay(),
            input,
            lifecycle: {},
            hooks: {},
        });

        await game.init({ seed: 123, wizard: true });

        assert.equal(game.wizard, true);
        assert.equal(game.player.wizard, true);
        assert.equal(game.player.name, 'Wizard');
    });

    it('Ctrl+V level teleport moves through depths 2-5 in wizard mode', async () => {
        const game = createHeadlessGame(5, 11, { wizard: true });

        for (let depth = 2; depth <= 5; depth++) {
            queueLine(game.input, String(depth));
            const result = await game.executeCommand(22); // Ctrl+V
            assert.equal(result.tookTime, true);
            assert.equal(game.player.dungeonLevel, depth);
            assert.ok(game.levels[depth], `Expected cached level ${depth}`);
        }

        assert.ok(game.levels[1], 'Expected original level to remain cached');
    });

    it('Ctrl+V is unavailable when wizard mode is off', async () => {
        const game = createHeadlessGame(5, 11, { wizard: false });
        const beforeDepth = game.player.dungeonLevel;

        queueLine(game.input, '5');
        const result = await game.executeCommand(22); // Ctrl+V

        assert.equal(result.tookTime, false);
        assert.equal(game.player.dungeonLevel, beforeDepth);
    });

    it('Ctrl+F reveals the full level in wizard mode', async () => {
        const game = createHeadlessGame(7, 11, { wizard: true });

        const result = await game.executeCommand(6); // Ctrl+F
        assert.equal(result.tookTime, false);

        for (let x = 0; x < COLNO; x++) {
            for (let y = 0; y < ROWNO; y++) {
                const loc = game.map.at(x, y);
                assert.equal(loc.seenv, 0xff);
                assert.equal(loc.lit, true);
            }
        }
    });

    it('Ctrl+T teleports to requested accessible coordinates in wizard mode', async () => {
        const game = createHeadlessGame(9, 11, { wizard: true });
        const before = { x: game.player.x, y: game.player.y };
        const target = game.map.dnstair;
        assert.ok(target, 'Expected downstairs coordinates');

        queueLine(game.input, `${target.x},${target.y}`);
        const result = await game.executeCommand(20); // Ctrl+T

        assert.equal(result.tookTime, true);
        assert.equal(game.player.x, target.x);
        assert.equal(game.player.y, target.y);
        assert.ok(before.x !== target.x || before.y !== target.y, 'Expected teleport destination to differ from start');
    });

    it('Ctrl+T rejects inaccessible coordinates in wizard mode', async () => {
        const game = createHeadlessGame(9, 11, { wizard: true });
        const before = { x: game.player.x, y: game.player.y };

        let stone = null;
        for (let y = 0; y < ROWNO && !stone; y++) {
            for (let x = 0; x < COLNO; x++) {
                const loc = game.map.at(x, y);
                if (loc?.typ === STONE) {
                    stone = { x, y };
                    break;
                }
            }
        }
        assert.ok(stone, 'Expected at least one stone tile');

        queueLine(game.input, `${stone.x},${stone.y}`);
        const result = await game.executeCommand(20); // Ctrl+T

        assert.equal(result.tookTime, false);
        assert.equal(game.player.x, before.x);
        assert.equal(game.player.y, before.y);
    });

    it('Ctrl+T is unavailable when wizard mode is off', async () => {
        const game = createHeadlessGame(9, 11, { wizard: false });
        const before = { x: game.player.x, y: game.player.y };

        queueLine(game.input, '1,1');
        const result = await game.executeCommand(20); // Ctrl+T

        assert.equal(result.tookTime, false);
        assert.equal(game.player.x, before.x);
        assert.equal(game.player.y, before.y);
    });
});
