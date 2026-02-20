import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { DAGGER, WEAPON_CLASS, GEM_CLASS } from '../../js/objects.js';

describe('wield prompt', () => {

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    player.inventory = [{
        invlet: 'b',
        oclass: WEAPON_CLASS,
        otyp: DAGGER,
        name: 'dagger',
        quan: 1,
        known: true,
        dknown: true,
        bknown: true,
        blessed: false,
        cursed: false,
        spe: 0,
    }];
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

test('wield prompt stays open on invalid letters until canceled', async () => {
    const game = makeGame();
    clearInputQueue();
    pushInput('a'.charCodeAt(0));
    pushInput('n'.charCodeAt(0));
    pushInput('d'.charCodeAt(0));
    pushInput(' '.charCodeAt(0));

    const result = await rhack('w'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.display.messages[0], 'What do you want to wield? [- b or ?*]');
    assert.equal(game.display.topMessage, 'Never mind.');
});

test('wielding a non-weapon item is allowed and reports wielded item', async () => {
    const game = makeGame();
    game.player.inventory.push({
        invlet: 'd',
        oclass: GEM_CLASS,
        otyp: 0,
        name: 'rock',
        quan: 1,
    });

    clearInputQueue();
    pushInput('d'.charCodeAt(0));

    const result = await rhack('w'.charCodeAt(0), game);
    assert.equal(result.tookTime, true);
    assert.match(game.display.topMessage, /^d - .* \(wielded\)\.$/);
});

}); // describe
