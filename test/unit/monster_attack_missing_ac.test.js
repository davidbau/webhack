import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { monsterAttackPlayer } from '../../js/combat.js';
import { initRng } from '../../js/rng.js';

describe('monster attack missing AC', () => {

test('monsterAttackPlayer does not crash when replay player AC fields are missing', () => {
    initRng(206);
    const monster = {
        name: 'goblin',
        mlevel: 1,
        attacks: [{ type: 2, dice: 1, sides: 4 }],
    };
    const player = {
        hp: 10,
        hpmax: 10,
        wizard: false,
        takeDamage() { return false; },
    };
    const display = {
        putstr_message() {},
    };

    assert.doesNotThrow(() => monsterAttackPlayer(monster, player, display, null));
});

}); // describe
