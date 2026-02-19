import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { BATTLE_AXE, CREDIT_CARD, FLINT, GEM_CLASS, LANCE, SPE_HEALING, STETHOSCOPE } from '../../js/objects.js';

function makeBaseGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;

    const display = {
        topMessage: null,
        messageNeedsMore: false,
        putstr_message(msg) {
            this.topMessage = msg;
            this.messageNeedsMore = true;
        },
        clearRow() {},
    };

    return {
        player,
        map,
        display,
        fov: null,
        flags: { verbose: false },
    };
}

describe('apply prompt behavior', () => {
    beforeEach(() => {
        clearInputQueue();
    });

    it('allows selecting non-suggested inventory letters in apply prompt', async () => {
        const game = makeBaseGame();
        game.player.inventory = [
            { invlet: 'a', oclass: 1, otyp: 1, name: 'long sword' },
            { invlet: 'b', oclass: 1, otyp: LANCE, name: 'lance' },
        ];
        pushInput('q'.charCodeAt(0));
        pushInput('a'.charCodeAt(0));
        pushInput(' '.charCodeAt(0));

        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, "Sorry, I don't know how to use that.");
    });

    it('reports nothing to apply when inventory has no applicable items', async () => {
        const game = makeBaseGame();
        game.player.inventory = [{ invlet: 'a', oclass: 1, otyp: 1, name: 'long sword' }];
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, "You don't have anything to use or apply.");
    });

    it('does not treat flint as an apply-eligible item', async () => {
        const game = makeBaseGame();
        game.player.inventory = [{ invlet: 'f', oclass: GEM_CLASS, otyp: FLINT, name: 'flint stone' }];
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, "You don't have anything to use or apply.");
    });

    it('reports nothing to apply when inventory is empty', async () => {
        const game = makeBaseGame();
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, "You don't have anything to use or apply.");
    });

    it('keeps apply prompt open for invalid letters when a battle-axe is applicable', async () => {
        const game = makeBaseGame();
        game.player.inventory = [{ invlet: 'a', oclass: 1, otyp: BATTLE_AXE, name: 'battle-axe' }];
        pushInput('y'.charCodeAt(0)); // invalid item letter for this prompt
        pushInput(' '.charCodeAt(0)); // cancel
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, 'Never mind.');
    });

    it('prompts for chop direction when applying a battle-axe', async () => {
        const game = makeBaseGame();
        game.player.inventory = [{ invlet: 'a', oclass: 1, otyp: BATTLE_AXE, name: 'battle-axe' }];
        pushInput('a'.charCodeAt(0));
        pushInput('q'.charCodeAt(0)); // direction input consumed by chop prompt
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, null);
    });

    it('flip-through on spellbooks reports ink freshness and consumes time', async () => {
        const game = makeBaseGame();
        game.player.inventory = [{ invlet: 'g', oclass: 9, otyp: SPE_HEALING, name: 'healing', spestudied: 0 }];
        pushInput('g'.charCodeAt(0));
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, true);
        assert.equal(game.display.topMessage, 'The magical ink in this spellbook is fresh.');
    });

    it('stethoscope apply path asks direction and cancels on invalid direction', async () => {
        const game = makeBaseGame();
        game.player.inventory = [{ invlet: 'c', oclass: 5, otyp: STETHOSCOPE, name: 'stethoscope' }];
        pushInput('c'.charCodeAt(0));
        pushInput('t'.charCodeAt(0)); // invalid direction key
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, 'What a strange direction!  Never mind.');
    });

    it('credit card apply path asks direction and cancels on invalid direction', async () => {
        const game = makeBaseGame();
        game.player.inventory = [{ invlet: 'c', oclass: 5, otyp: CREDIT_CARD, name: 'credit card' }];
        pushInput('c'.charCodeAt(0));
        pushInput('t'.charCodeAt(0)); // invalid direction key
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, 'What a strange direction!  Never mind.');
    });

    it('wizard apply direction cancel is silent on invalid direction', async () => {
        const game = makeBaseGame();
        game.player.wizard = true;
        game.player.inventory = [{ invlet: 'c', oclass: 5, otyp: CREDIT_CARD, name: 'credit card' }];
        pushInput('c'.charCodeAt(0));
        pushInput('t'.charCodeAt(0)); // invalid direction key
        const result = await rhack('a'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, null);
    });
});
