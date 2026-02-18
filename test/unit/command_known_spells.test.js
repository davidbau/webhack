import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { SPE_HEALING, SPE_STONE_TO_FLESH } from '../../js/objects.js';

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;

    const display = {
        topMessage: null,
        messageNeedsMore: false,
        lastOverlay: null,
        putstr_message(msg) {
            this.topMessage = msg;
            this.messageNeedsMore = true;
        },
        renderOverlayMenu(lines) {
            this.lastOverlay = lines;
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

describe('known spells command', () => {
    beforeEach(() => {
        clearInputQueue();
    });

    it('reports when no spells are known', async () => {
        const game = makeGame();
        game.player.inventory = [{ invlet: 'a', oclass: 1, otyp: 1, name: 'long sword' }];
        const result = await rhack('+'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.equal(game.display.topMessage, "You don't know any spells right now.");
    });

    it('opens known-spells overlay when spellbooks are present', async () => {
        const game = makeGame();
        game.player.wizard = true;
        game.player.turns = 6;
        game.player.inventory = [{
            invlet: 'g',
            oclass: 9, // SPBOOK_CLASS
            otyp: SPE_HEALING,
            name: 'healing',
        }, {
            invlet: 'h',
            oclass: 9,
            otyp: SPE_STONE_TO_FLESH,
            name: 'stone to flesh',
        }];
        pushInput(' '.charCodeAt(0));
        const result = await rhack('+'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.ok(Array.isArray(game.display.lastOverlay));
        assert.equal(game.display.lastOverlay[0], 'Currently known spells');
        assert.equal(game.display.lastOverlay[1], '');
        assert.equal(game.display.lastOverlay[2], '    Name                 Level Category     Fail Retention  turns');
        assert.match(game.display.lastOverlay[3], /^a - healing\s+1\s+healing\s+\d+%/);
        assert.match(game.display.lastOverlay[4], /^b - stone to flesh\s+3\s+healing\s+\d+%/);
        assert.equal(game.display.lastOverlay.at(-2), '+ - [sort spells]');
        assert.equal(game.display.lastOverlay.at(-1), '(end)');
    });
});
