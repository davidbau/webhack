import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';

describe('drop count prompt', () => {

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    player.inventory = [
        { invlet: 'b', oclass: 1, name: 'short sword' },
        { invlet: 'c', oclass: 2, name: 'ring mail' },
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

test('drop prompt supports count entry via Ctrl+V digits', async () => {
    const game = makeGame();
    clearInputQueue();
    pushInput('P'.charCodeAt(0));
    pushInput('e'.charCodeAt(0));
    pushInput(22); // Ctrl+V
    pushInput('1'.charCodeAt(0));
    pushInput('8'.charCodeAt(0));
    pushInput('\n'.charCodeAt(0));

    const result = await rhack('d'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.ok(game.display.messages.includes('Count: 18'));
    assert.equal(game.display.topMessage, 'Never mind.');
});

}); // describe
