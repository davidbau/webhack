import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';

function makeGame(verbose = true) {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;

    const messages = [];
    const display = {
        topMessage: null,
        putstr_message(msg) {
            messages.push(msg);
            this.topMessage = msg;
        },
    };

    return {
        game: {
            player,
            map,
            display,
            fov: null,
            flags: { verbose },
            menuRequested: false,
        },
        messages,
    };
}

describe('direction prompt cancel flow', () => {
    beforeEach(() => {
        clearInputQueue();
    });

    it('open command cancels on invalid direction without consuming time', async () => {
        const { game, messages } = makeGame();
        pushInput('t'.charCodeAt(0));

        const result = await rhack('o'.charCodeAt(0), game);

        assert.equal(result.tookTime, false);
        assert.equal(messages[0], 'In what direction?');
        assert.equal(messages.at(-1), 'Never mind.');
    });

    it('close command cancels on invalid direction without consuming time', async () => {
        const { game, messages } = makeGame();
        pushInput('t'.charCodeAt(0));

        const result = await rhack('c'.charCodeAt(0), game);

        assert.equal(result.tookTime, false);
        assert.equal(messages[0], 'In what direction?');
        assert.equal(messages.at(-1), 'Never mind.');
    });

    it('open cancel message is still emitted when verbose is false', async () => {
        const { game, messages } = makeGame(false);
        pushInput('t'.charCodeAt(0));

        const result = await rhack('o'.charCodeAt(0), game);

        assert.equal(result.tookTime, false);
        assert.equal(messages.at(-1), 'Never mind.');
    });
});
