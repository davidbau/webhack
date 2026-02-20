import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { WAND_CLASS } from '../../js/objects.js';

describe('engrave prompt', () => {

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    player.inventory = [
        { oclass: WAND_CLASS, otyp: 0, invlet: 'f', name: 'sleep', spe: 7 },
    ];
    const display = {
        topMessage: null,
        messages: [],
        putstr_message(msg) {
            this.topMessage = msg;
            this.messages.push(msg);
        },
        clearRow() {},
    };
    return { player, map, display, fov: null, flags: { verbose: false } };
}

test('engrave prompt stays open on invalid keys and cancels on enter', async () => {
    const game = makeGame();
    clearInputQueue();
    pushInput('S'.charCodeAt(0));
    pushInput('P'.charCodeAt(0));
    pushInput('\n'.charCodeAt(0));

    const result = await rhack('E'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.display.messages[0], 'What do you want to write with? [- f or ?*]');
    assert.equal(game.display.messages.at(-1), 'Never mind.');
    assert.equal(game.display.topMessage, 'Never mind.');
});

}); // describe
