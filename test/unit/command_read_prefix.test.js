import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';

describe('read prefix', () => {

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    player.inventory = [];
    const display = {
        topMessage: null,
        messageNeedsMore: false,
        messages: [],
        putstr_message(msg) {
            this.topMessage = msg;
            this.messageNeedsMore = true;
            this.messages.push(msg);
        },
    };
    return { player, map, display, fov: null, flags: { verbose: false }, menuRequested: false };
}

test('m-prefix does not block read command prompt', async () => {
    const game = makeGame();
    clearInputQueue();
    await rhack('m'.charCodeAt(0), game);
    assert.equal(game.menuRequested, true);

    pushInput(' '.charCodeAt(0)); // cancel read prompt
    const result = await rhack('r'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.menuRequested, false);
    assert.equal(game.display.topMessage, 'Never mind.');
});

test('double m-prefix cancels silently', async () => {
    const game = makeGame();
    clearInputQueue();
    await rhack('m'.charCodeAt(0), game);
    assert.equal(game.menuRequested, true);
    assert.equal(game.display.topMessage, null);

    const result = await rhack('m'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.menuRequested, false);
    assert.equal(game.display.topMessage, null);
    assert.equal(game.display.messages.length, 0);
});

test('read command rejects non-readable inventory items with C wording', async () => {
    const game = makeGame();
    game.player.inventory = [{ invlet: 'a', oclass: 7, name: 'potion of healing' }];
    clearInputQueue();
    pushInput('a'.charCodeAt(0));

    const result = await rhack('r'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.display.topMessage, 'That is a silly thing to read.');
});

test('read prompt includes readable inventory letters in C format', async () => {
    const game = makeGame();
    game.player.inventory = [
        { invlet: 'g', oclass: 9, name: 'healing' },
        { invlet: 'h', oclass: 9, name: 'extra healing' },
        { invlet: 'i', oclass: 9, name: 'stone to flesh' },
    ];
    clearInputQueue();
    pushInput(' '.charCodeAt(0));

    const result = await rhack('r'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.display.messages[0], 'What do you want to read? [ghi or ?*]');
    assert.equal(game.display.topMessage, 'Never mind.');
});

test('reading a spellbook prompts for memory refresh', async () => {
    const game = makeGame();
    const SPE_STONE_TO_FLESH = 403;
    game.player.inventory = [
        { invlet: 'i', oclass: 9, otyp: SPE_STONE_TO_FLESH, name: 'stone to flesh' },
    ];
    // Player already knows the spell well (sp_know > SPELL_KEEN/10 = 2000)
    game.player.spells = [
        { otyp: SPE_STONE_TO_FLESH, sp_know: 20000 },
    ];
    clearInputQueue();
    pushInput('i'.charCodeAt(0));
    pushInput('n'.charCodeAt(0));

    const result = await rhack('r'.charCodeAt(0), game);
    assert.equal(result.tookTime, false);
    assert.equal(game.display.messages[0], 'What do you want to read? [i or ?*]');
    assert.equal(game.display.messages[1],
        'You know "stone to flesh" quite well already.  Refresh your memory anyway? [yn] (n)');
});

}); // describe
