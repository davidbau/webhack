import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { Player } from '../../js/player.js';
import { DAGGER, WEAPON_CLASS } from '../../js/objects.js';

describe('player inventory achievement', () => {

test('player pickup clears achievement marker on branch prize objects', () => {
    const player = new Player();
    const obj = {
        otyp: DAGGER,
        oclass: WEAPON_CLASS,
        quan: 1,
        achievement: 1,
    };

    player.addToInventory(obj);
    assert.equal(obj.achievement, 0);
});

}); // describe
