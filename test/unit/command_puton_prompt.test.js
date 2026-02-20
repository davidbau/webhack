import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { RING_CLASS, RIN_PROTECTION } from '../../js/objects.js';

describe('put on prompt', () => {

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    const display = {
        topMessage: null,
        putstr_message(msg) {
            this.topMessage = msg;
        },
    };
    return { player, map, display, fov: null, flags: { verbose: false } };
}

test('put on reports no available accessories when no rings are available', async () => {
    const game = makeGame();
    clearInputQueue();

    const result = await rhack('P'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.display.topMessage, "You don't have anything else to put on.");
});

test('put on allows selecting a ring and equips it', async () => {
    const game = makeGame();
    game.player.inventory = [{
        invlet: 'a',
        oclass: RING_CLASS,
        otyp: RIN_PROTECTION,
        name: 'ring of protection',
        quan: 1,
    }];
    clearInputQueue();
    pushInput('a'.charCodeAt(0));

    const result = await rhack('P'.charCodeAt(0), game);
    assert.equal(result.tookTime, true);
    assert.equal(game.player.leftRing?.invlet, 'a');
});

}); // describe
