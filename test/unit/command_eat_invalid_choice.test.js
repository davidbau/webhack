import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { FOOD_CLASS } from '../../js/objects.js';

describe('eat invalid choice', () => {

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    player.inventory = [
        { invlet: 'a', oclass: FOOD_CLASS, otyp: 0, quan: 1, name: 'food ration' },
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

test('eat command reports missing object for invalid inventory letter', async () => {
    const game = makeGame();
    clearInputQueue();
    pushInput('@'.charCodeAt(0));
    pushInput(' '.charCodeAt(0)); // acknowledge --More--
    pushInput(27); // cancel the re-prompt

    const result = await rhack('e'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.display.messages[0], 'What do you want to eat? [a or ?*]');
    assert.equal(game.display.messages[1], "You don't have that object.--More--");
    assert.equal(game.display.messages[2], 'What do you want to eat? [a or ?*]');
    assert.equal(game.display.messages.at(-1), 'Never mind.');
});

}); // describe
