import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HeadlessGame, generateMapsWithCoreReplay } from '../../js/headless_runtime.js';
import { RACE_ELF } from '../../js/config.js';

describe('HeadlessGame replay contract', () => {
    it('start() applies explicit startup options', () => {
        const game = HeadlessGame.start(123, {
            wizard: true,
            character: {
                name: 'ReplayTester',
                role: 'Archeologist',
                race: 'elf',
                gender: 'female',
                align: 'chaotic',
            },
        });

        assert.equal(game.player.name, 'ReplayTester');
        assert.equal(game.player.wizard, true);
        assert.equal(game.wizard, true);
        assert.equal(game.player.gender, 1);
        assert.equal(game.player.alignment, -1);
        assert.equal(game.player.race, RACE_ELF);
    });

    it('sendKey() returns structured per-step observation and invokes hooks', async () => {
        const events = [];
        const game = HeadlessGame.start(5, {
            wizard: true,
            hooks: {
                onStepStart: () => events.push('start'),
                onCommandResult: () => events.push('cmd'),
                onTurnAdvanced: () => events.push('turn'),
                onScreenRendered: () => events.push('screen'),
            },
        });

        game.enableRngLogging();
        const step = await game.sendKey('.');

        assert.equal(step.key, '.');
        assert.equal(typeof step.level, 'number');
        assert.equal(typeof step.turn, 'number');
        assert.equal(Array.isArray(step.rng), true);
        assert.equal(Array.isArray(step.typGrid), true);
        assert.equal(step.typGrid.length, 21);
        assert.equal(step.typGrid[0].length, 80);
        assert.equal(Array.isArray(step.screen), true);
        assert.equal(step.screen.length, 24);
        assert.equal(events.includes('start'), true);
        assert.equal(events.includes('cmd'), true);
        assert.equal(events.includes('turn'), true);
        assert.equal(events.includes('screen'), true);
    });

    it('supports no-loss capture helpers: typgrid/screen/rng/checkpoint', async () => {
        const game = HeadlessGame.start(7, { wizard: true });
        game.enableRngLogging();

        await game.sendKey('.');
        const log = game.getRngLog();
        assert.equal(Array.isArray(log), true);

        const checkpoint = game.checkpoint('after-dot');
        assert.equal(checkpoint.phase, 'after-dot');
        assert.equal(Array.isArray(checkpoint.typGrid), true);
        assert.equal(Array.isArray(checkpoint.screen), true);
        assert.equal(Array.isArray(checkpoint.rng), true);

        game.clearRngLog();
        assert.equal(game.getRngLog().length, 0);
        assert.equal(typeof game.getAnsiScreen(), 'string');
    });

    it('can generate map depth traces via core wizard replay path', () => {
        const out = generateMapsWithCoreReplay(11, 3);
        assert.equal(Object.keys(out.grids).length, 3);
        assert.equal(Object.keys(out.rngLogs).length, 3);
        assert.equal(Array.isArray(out.grids[1]), true);
        assert.equal(Array.isArray(out.grids[2]), true);
        assert.equal(Array.isArray(out.rngLogs[1].rng), true);
        assert.equal(typeof out.rngLogs[1].rngCalls, 'number');
    });
});
