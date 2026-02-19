import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { ROOM } from '../../js/config.js';

function makeGame() {
    const map = new GameMap();
    for (let y = 9; y <= 11; y++) {
        for (let x = 9; x <= 11; x++) {
            map.at(x, y).typ = ROOM;
        }
    }
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    player.inventory = [
        { invlet: 'b', oclass: 1, name: 'dagger' },
        { invlet: 'd', oclass: 7, name: 'potion of healing' },
    ];

    const display = {
        topMessage: null,
        messages: [],
        putstr_message(msg) {
            this.topMessage = msg;
            this.messages.push(msg);
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

describe('throw prompt behavior', () => {
    beforeEach(() => {
        clearInputQueue();
    });

    it('shows inventory letters in throw prompt using C-style format', async () => {
        const game = makeGame();
        pushInput(27);

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.messages[0], 'What do you want to throw? [b or ?*]');
        assert.equal(game.display.topMessage, 'Never mind.');
    });

    it('still allows selecting a non-weapon inventory letter manually', async () => {
        const game = makeGame();
        pushInput('d'.charCodeAt(0));
        pushInput(27);

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.messages[1], 'In what direction?');
        assert.equal(game.display.messages.length, 2);
        assert.equal(game.display.topMessage, null);
    });

    it('treats "-" selection as mime-throw cancel', async () => {
        const game = makeGame();
        pushInput('-'.charCodeAt(0));

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, 'You mime throwing something.');
    });

    it('does not suggest currently wielded weapon as default throw choice', async () => {
        const game = makeGame();
        game.player.weapon = game.player.inventory[0];
        pushInput(27);
        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.messages[0], 'What do you want to throw? [*]');
    });

    it('falls back to coin letter when only wielded weapon plus coins remain', async () => {
        const game = makeGame();
        game.player.inventory = [
            { invlet: 'a', oclass: 1, name: 'scalpel' },
            { invlet: '$', oclass: 11, name: 'gold piece', quan: 50 },
            { invlet: 'e', oclass: 7, name: 'potion of extra healing', quan: 4 },
        ];
        game.player.weapon = game.player.inventory[0];
        game.player.quiver = game.player.inventory[2];
        pushInput(27);
        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.messages[0], 'What do you want to throw? [$ or ?*]');
    });

    it('single throw clears direction prompt without synthetic throw topline', async () => {
        const game = makeGame();
        pushInput('b'.charCodeAt(0));
        pushInput('l'.charCodeAt(0));

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, true);
        assert.equal(game.display.messages[0], 'What do you want to throw? [b or ?*]');
        assert.equal(game.display.messages[1], 'In what direction?');
        assert.equal(game.display.messages.length, 2);
        assert.equal(game.display.topMessage, null);
    });

    it('throw at adjacent monster emits miss message and lands at target square', async () => {
        const game = makeGame();
        game.map.monsters.push({ mx: 11, my: 10, mhp: 5, name: 'kitten' });
        pushInput('b'.charCodeAt(0));
        pushInput('l'.charCodeAt(0));

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, true);
        assert.equal(game.display.messages.at(-1), 'The dagger misses the kitten.');
        const thrown = game.map.objects.find((o) => o.name === 'dagger');
        assert.ok(thrown);
        assert.equal(thrown.ox, 11);
        assert.equal(thrown.oy, 10);
    });

    it('asks direction before rejecting worn item throw', async () => {
        const game = makeGame();
        const worn = { invlet: 'e', oclass: 2, name: 'leather armor' };
        game.player.inventory.push(worn);
        game.player.armor = worn;
        pushInput('e'.charCodeAt(0));
        pushInput('l'.charCodeAt(0));

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.messages[0], 'What do you want to throw? [b or ?*]');
        assert.equal(game.display.messages[1], 'In what direction?');
        assert.equal(game.display.messages.at(-1), 'You cannot throw something you are wearing.');
    });

    it('space cancels throw direction prompt without extra cancel message', async () => {
        const game = makeGame();
        pushInput('d'.charCodeAt(0));
        pushInput(' '.charCodeAt(0));

        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.messages[0], 'What do you want to throw? [b or ?*]');
        assert.equal(game.display.messages[1], 'In what direction?');
        assert.equal(game.display.messages.length, 2);
        assert.equal(game.display.topMessage, null);
    });

    it('keeps throw prompt stable on invalid letters', async () => {
        const game = makeGame();
        pushInput('i'.charCodeAt(0));
        pushInput('o'.charCodeAt(0));
        pushInput('n'.charCodeAt(0));
        pushInput(27);
        const result = await rhack('t'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.deepEqual(game.display.messages, [
            'What do you want to throw? [b or ?*]',
            'Never mind.',
        ]);
    });
});
