import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { STAIRS, VWALL } from '../../js/config.js';

describe('force fight terrain message', () => {

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
    return { player, map, display, fov: null, flags: { verbose: false }, forceFight: true };
}

test('force-fight into upstairs reports harmless staircase attack', async () => {
    const game = makeGame();
    const loc = game.map.at(10, 11);
    loc.typ = STAIRS;
    loc.stairdir = 1;

    const result = await rhack('j'.charCodeAt(0), game);
    assert.equal(result.tookTime, true);
    assert.equal(game.display.topMessage, 'You harmlessly attack the branch staircase up.');
});

test('force-fight into wall reports harmless wall attack', async () => {
    const game = makeGame();
    const loc = game.map.at(10, 9);
    loc.typ = VWALL;

    const result = await rhack('k'.charCodeAt(0), game);
    assert.equal(result.tookTime, true);
    assert.equal(game.display.topMessage, 'You harmlessly attack the wall.');
});

}); // describe
