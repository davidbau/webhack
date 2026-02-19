import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';
import { GameMap } from '../../js/map.js';
import { Player } from '../../js/player.js';
import { clearInputQueue, pushInput } from '../../js/input.js';
import { COIN_CLASS, GOLD_PIECE, TOOL_CLASS, STETHOSCOPE, WEAPON_CLASS, SCALPEL, SPBOOK_CLASS, OIL_LAMP, ARMOR_CLASS, SMALL_SHIELD } from '../../js/objects.js';

function makeGame() {
    const map = new GameMap();
    const player = new Player();
    player.initRole(11);
    player.x = 10;
    player.y = 10;
    player.inventory = [{
        oclass: COIN_CLASS,
        otyp: GOLD_PIECE,
        invlet: '$',
        quan: 10,
        known: true,
        dknown: true,
        bknown: true,
        blessed: false,
        cursed: false,
        spe: 0,
    }];

    const display = {
        topMessage: null,
        lastOverlay: null,
        putstr_message(msg) {
            this.topMessage = msg;
        },
        renderOverlayMenu(lines) {
            this.lastOverlay = lines;
        },
        renderChargenMenu(lines) {
            this.lastOverlay = lines;
        },
    };

    return {
        game: {
            player,
            map,
            display,
            fov: null,
            flags: { verbose: true },
            menuRequested: false,
        },
    };
}

describe('inventory modal dismissal', () => {
    beforeEach(() => {
        clearInputQueue();
    });

    it('keeps inventory open on non-dismiss keys and closes on space', async () => {
        const { game } = makeGame();
        pushInput('o'.charCodeAt(0));

        const pending = rhack('i'.charCodeAt(0), game);
        const early = await Promise.race([
            pending.then(() => 'resolved'),
            new Promise((resolve) => setTimeout(() => resolve('pending'), 30)),
        ]);

        assert.equal(early, 'pending');
        pushInput(' '.charCodeAt(0));

        const result = await pending;
        assert.equal(result.tookTime, false);
        assert.ok(Array.isArray(game.display.lastOverlay));
    });

    it('closes inventory on enter', async () => {
        const { game } = makeGame();
        pushInput('\n'.charCodeAt(0));
        const result = await rhack('i'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.ok(Array.isArray(game.display.lastOverlay));
    });

    it('renders single-item action menu for stethoscope selections', async () => {
        const { game } = makeGame();
        game.player.inventory.push({
            oclass: TOOL_CLASS,
            otyp: STETHOSCOPE,
            invlet: 'c',
            quan: 1,
            name: 'stethoscope',
        });
        const writes = [];
        game.display.putstr = function putstr(col, row, str, color, attr) {
            writes.push({ col, row, str, color, attr });
        };
        game.display.clearRow = function clearRow() {};

        pushInput('c'.charCodeAt(0));
        pushInput(' '.charCodeAt(0));
        const result = await rhack('i'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.ok(writes.some((w) => w.row === 2 && w.str.includes('Listen through the stethoscope')));
        assert.ok(writes.some((w) => w.row === 0 && w.attr === 1 && w.str.includes('Do what with the stethoscope?')));
    });

    it('keeps item action menu open on invalid keys, then allows c-name flow', async () => {
        const { game } = makeGame();
        const scalpel = {
            oclass: WEAPON_CLASS,
            otyp: SCALPEL,
            invlet: 'a',
            quan: 1,
            name: 'scalpel',
        };
        game.player.inventory = [scalpel];
        game.player.weapon = scalpel;

        const writes = [];
        game.display.putstr = function putstr(col, row, str, color, attr) {
            writes.push({ col, row, str, color, attr });
        };
        game.display.clearRow = function clearRow() {};

        pushInput('a'.charCodeAt(0)); // select item from inventory menu
        pushInput('n'.charCodeAt(0)); // invalid action key, should keep submenu open
        const pending = rhack('i'.charCodeAt(0), game);
        const early = await Promise.race([
            pending.then(() => 'resolved'),
            new Promise((resolve) => setTimeout(() => resolve('pending'), 30)),
        ]);
        assert.equal(early, 'pending');

        pushInput('c'.charCodeAt(0)); // choose "name this specific ..."
        pushInput('e'.charCodeAt(0));
        pushInput('\n'.charCodeAt(0));
        const result = await pending;
        assert.equal(result.tookTime, false);
        assert.ok(writes.some((w) => w.row === 0 && w.str.includes('Do what with the scalpel?')));
        assert.ok(writes.some((w) => w.row === 0 && w.str.includes('What do you want to name this scalpel?')));
        assert.equal(scalpel.oname, 'e');
    });

    it('uses spellbook wording in inventory action prompt', async () => {
        const { game } = makeGame();
        game.player.inventory = [{
            oclass: SPBOOK_CLASS,
            otyp: 0,
            invlet: 'g',
            quan: 1,
            name: 'healing',
        }];
        const writes = [];
        game.display.putstr = function putstr(col, row, str, color, attr) {
            writes.push({ col, row, str, color, attr });
        };
        game.display.clearRow = function clearRow() {};

        pushInput('g'.charCodeAt(0));
        pushInput(' '.charCodeAt(0));
        const result = await rhack('i'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.ok(writes.some((w) => w.row === 0 && w.attr === 1 && w.str.includes('Do what with the spellbook of healing?')));
        assert.ok(writes.some((w) => w.str.includes('r - Study this spellbook')));
    });

    it('shows light and rub actions for oil lamps', async () => {
        const { game } = makeGame();
        game.player.inventory = [{
            oclass: TOOL_CLASS,
            otyp: OIL_LAMP,
            invlet: 'e',
            quan: 1,
            name: 'oil lamp',
            lamplit: false,
        }];
        const writes = [];
        game.display.putstr = function putstr(col, row, str, color, attr) {
            writes.push({ col, row, str, color, attr });
        };
        game.display.clearRow = function clearRow() {};

        pushInput('e'.charCodeAt(0));
        pushInput(' '.charCodeAt(0));
        const result = await rhack('i'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.ok(writes.some((w) => w.str.includes('Do what with the oil lamp?')));
        assert.ok(writes.some((w) => w.str.includes('a - Light this light source')));
        assert.ok(writes.some((w) => w.str.includes('R - Rub this oil lamp')));
    });

    it('shows take-off action for worn armor item submenu', async () => {
        const { game } = makeGame();
        const shield = {
            oclass: ARMOR_CLASS,
            otyp: SMALL_SHIELD,
            invlet: 'c',
            quan: 1,
            name: 'small shield',
        };
        game.player.inventory = [shield];
        game.player.shield = shield;
        const writes = [];
        game.display.putstr = function putstr(col, row, str, color, attr) {
            writes.push({ col, row, str, color, attr });
        };
        game.display.clearRow = function clearRow() {};

        pushInput('c'.charCodeAt(0));
        pushInput(' '.charCodeAt(0));
        const result = await rhack('i'.charCodeAt(0), game);
        assert.equal(result.tookTime, false);
        assert.ok(writes.some((w) => w.str.includes('Do what with the small shield?')));
        assert.ok(writes.some((w) => w.str.includes('i - Adjust inventory by assigning new letter')));
        assert.ok(writes.some((w) => w.str.includes('T - Take off this armor')));
        assert.ok(writes.some((w) => w.str.includes('/ - Look up information about this')));
        assert.ok(!writes.some((w) => w.str.includes('d - Drop this item')));
    });
});
