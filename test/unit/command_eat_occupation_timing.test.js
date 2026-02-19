import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';

function makeGame({ quan = 1 } = {}) {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    const ration = {
        invlet: 'd',
        oclass: 6,
        otyp: 291, // FOOD_RATION
        name: 'food ration',
        quan,
    };
    player.inventory = [ration];

    const display = {
        topMessage: null,
        putstr_message(msg) {
            this.topMessage = msg;
        },
    };

    return {
        player,
        map,
        display,
        fov: null,
        flags: { verbose: false },
    };
}

describe('eat occupation timing', () => {
    beforeEach(() => {
        clearInputQueue();
    });

    it('removes inventory food during the final occupation tick', async () => {
        // C ref: eat.c done_eating()/useup() runs from eatfood() when the
        // occupation completes, before movemon — so food is consumed during the
        // final occupation tick, not deferred to a post-turn hook.
        const game = makeGame();
        const ration = game.player.inventory[0];
        pushInput('d'.charCodeAt(0));

        const result = await rhack('e'.charCodeAt(0), game);
        assert.equal(result.tookTime, true);
        assert.ok(game.occupation, 'expected eating occupation');
        assert.ok(game.player.inventory.includes(ration), 'food should remain during ongoing occupation');

        let sawContinue = false;
        let removedOnFinalTick = false;

        while (game.occupation) {
            const occ = game.occupation;
            const hadBefore = game.player.inventory.includes(ration);
            const cont = occ.fn();
            const hasAfter = game.player.inventory.includes(ration);
            if (cont) {
                sawContinue = true;
                assert.ok(hasAfter, 'food should still be present on non-final occupation turns');
            } else {
                game.occupation = null;
                removedOnFinalTick = hadBefore && !hasAfter;
            }
        }

        assert.ok(sawContinue, 'food ration should require multiple occupation turns');
        assert.ok(removedOnFinalTick, 'food should be removed during the final occupation tick');
    });

    it('keeps split stack piece in inventory until eating finishes', async () => {
        const game = makeGame({ quan: 2 });
        const stack = game.player.inventory[0];
        pushInput('d'.charCodeAt(0));

        const result = await rhack('e'.charCodeAt(0), game);
        assert.equal(result.tookTime, true);
        assert.ok(game.occupation, 'expected eating occupation');
        assert.equal(stack.quan, 1, 'stack should decrement immediately');
        assert.equal(game.player.inventory.length, 2, 'split piece should stay in inventory while eating');

        const splitPiece = game.player.inventory.find((obj) => obj !== stack && obj.invlet === 'd');
        assert.ok(splitPiece, 'expected split piece in inventory');
        assert.equal(splitPiece.quan, 1);

        while (game.occupation) {
            const occ = game.occupation;
            const cont = occ.fn();
            if (!cont) {
                game.occupation = null;
                if (typeof occ.onFinishAfterTurn === 'function') {
                    occ.onFinishAfterTurn(game);
                }
            }
        }

        assert.equal(game.player.inventory.length, 1, 'split piece should be removed on completion');
        assert.equal(game.player.inventory[0], stack, 'original stack should remain');
        assert.equal(stack.quan, 1, 'one ration should remain after eating one from stack');
    });
});
