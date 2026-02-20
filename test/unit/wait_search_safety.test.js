import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../../js/commands.js';

describe('wait search safety', () => {

function createGame({ multi = 0, hostileAdjacent = false } = {}) {
    const messages = [];
    const clearRows = [];
    const player = { x: 10, y: 10, kickedloc: null };
    const hostile = hostileAdjacent ? { dead: false, tame: false, peaceful: false } : null;
    const map = {
        monsterAt(x, y) {
            if (x === 11 && y === 10) return hostile;
            return null;
        },
        at() {
            return { typ: 0, flags: 0 };
        },
        trapAt() {
            return null;
        },
    };
    const display = {
        prevMessageCycleIndex: null,
        topMessage: '',
        messageNeedsMore: false,
        clearRow(row) {
            clearRows.push(row);
            if (row === 0) this.topMessage = '';
        },
        putstr_message(msg) {
            messages.push(msg);
            this.topMessage = msg;
        },
    };
    return {
        player,
        map,
        display,
        fov: null,
        flags: { safe_wait: true, cmdassist: true },
        menuRequested: false,
        multi,
        occupation: null,
        messages,
        clearRows,
    };
}

test('wait safety blocks rest when hostile adjacent and no count', async () => {
    const game = createGame({ multi: 0, hostileAdjacent: true });
    const result = await rhack('.'.charCodeAt(0), game);

    assert.deepEqual(result, { moved: false, tookTime: false });
    assert.equal(game.occupation, null);
    assert.equal(
        game.messages.at(-1),
        "Are you waiting to get hit?  Use 'm' prefix to force a no-op (to rest)."
    );
});

test('counted rest bypasses wait safety and starts waiting occupation', async () => {
    const game = createGame({ multi: 3, hostileAdjacent: true });
    const result = await rhack('.'.charCodeAt(0), game);

    assert.deepEqual(result, { moved: false, tookTime: true });
    assert.ok(game.occupation);
    assert.equal(game.occupation.occtxt, 'waiting');
    assert.equal(
        game.messages.find((m) => m.includes('Are you waiting to get hit?')),
        undefined
    );

    const continueOcc = game.occupation.fn(game);
    assert.equal(continueOcc, true);
    assert.equal(game.multi, 2);
});

test('search safety blocks search when hostile adjacent and no count', async () => {
    const game = createGame({ multi: 0, hostileAdjacent: true });
    const result = await rhack('s'.charCodeAt(0), game);

    assert.deepEqual(result, { moved: false, tookTime: false });
    assert.equal(game.occupation, null);
    assert.equal(
        game.messages.at(-1),
        "You already found a monster.  Use 'm' prefix to force another search."
    );
});

test('repeated search safety warning is suppressed with no-rep behavior', async () => {
    const game = createGame({ multi: 0, hostileAdjacent: true });
    await rhack('s'.charCodeAt(0), game);
    const result = await rhack('s'.charCodeAt(0), game);

    assert.deepEqual(result, { moved: false, tookTime: false });
    assert.equal(game.messages.length, 1);
    assert.equal(game.display.topMessage, '');
    assert.equal(game.clearRows.includes(0), true);
});

test('counted search bypasses safety and starts searching occupation', async () => {
    const game = createGame({ multi: 2, hostileAdjacent: true });
    const result = await rhack('s'.charCodeAt(0), game);

    assert.deepEqual(result, { moved: false, tookTime: true });
    assert.ok(game.occupation);
    assert.equal(game.occupation.occtxt, 'searching');
    assert.equal(
        game.messages.find((m) => m.includes("already found a monster")),
        undefined
    );

    const continueOcc = game.occupation.fn(game);
    assert.equal(continueOcc, true);
    assert.equal(game.multi, 1);
});

}); // describe
