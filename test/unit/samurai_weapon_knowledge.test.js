import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { initRng } from '../../js/rng.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';
import { Player, roles } from '../../js/player.js';
import { simulatePostLevelInit } from '../../js/u_init.js';
import { ORCISH_DAGGER } from '../../js/objects.js';
import { isObjectNameKnown } from '../../js/discovery.js';

describe('samurai weapon knowledge', () => {

function setupRole(seed, roleName) {
    const roleIndex = roles.findIndex((r) => r.name === roleName);
    if (roleIndex < 0) throw new Error(`Unknown role: ${roleName}`);
    initRng(seed);
    initLevelGeneration(roleIndex);
    const player = new Player();
    player.initRole(roleIndex);
    player.name = roleName;
    const map = makelevel(1);
    wallification(map);
    player.x = map.upstair.x;
    player.y = map.upstair.y;
    player.dungeonLevel = 1;
    return { player, map };
}

test('samurai starts with orcish dagger name known', () => {
    const { player, map } = setupRole(110, 'Samurai');
    simulatePostLevelInit(player, map, 1);
    assert.equal(isObjectNameKnown(ORCISH_DAGGER), true);
});

test('wizard does not start with orcish dagger name known', () => {
    const { player, map } = setupRole(113, 'Wizard');
    simulatePostLevelInit(player, map, 1);
    assert.equal(isObjectNameKnown(ORCISH_DAGGER), false);
});

}); // describe
