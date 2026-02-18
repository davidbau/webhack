import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { DART, RING_MAIL } from '../../js/objects.js';
import { mksobj } from '../../js/mkobj.js';

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

describe('throw behavior parity', () => {
    beforeEach(() => {
        clearInputQueue();
    });

    it('throws one item from a stack instead of removing the full stack', async () => {
        const game = makeBaseGame();
        const darts = mksobj(DART, true, false);
        darts.invlet = 'b';
        darts.quan = 3;
        game.player.inventory = [darts];

        pushInput('b'.charCodeAt(0));
        pushInput('l'.charCodeAt(0));

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, true);
        assert.equal(game.player.inventory.length, 1);
        assert.equal(game.player.inventory[0].quan, 2);
        assert.equal(game.map.objects.length, 1);
        assert.equal(game.map.objects[0].quan, 1);
    });

    it('rejects throwing worn armor with C-style message', async () => {
        const game = makeBaseGame();
        const armor = mksobj(RING_MAIL, true, false);
        armor.invlet = 'a';
        game.player.inventory = [armor];
        game.player.armor = armor;

        pushInput('a'.charCodeAt(0));

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, 'You cannot throw something you are wearing.');
    });
});
