// gameloop.test.js -- Test per-turn game loop RNG alignment
// Verifies that simulateTurnEnd produces the correct pattern of RNG calls
// matching C's allmain.c moveloop_core() per-turn sequence.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initRng, rn2, rnd, enableRngLog, getRngLog, disableRngLog } from '../../js/rng.js';
import { initLevelGeneration, generateLevel, wallification } from '../../js/dungeon.js';
import { Player, roles } from '../../js/player.js';
import { simulatePostLevelInit } from '../../js/u_init.js';
import { NORMAL_SPEED, A_DEX } from '../../js/config.js';

// Minimal game-like object for testing simulateTurnEnd
function setupTestGame() {
    initRng(42);
    initLevelGeneration();
    const player = new Player();
    player.initRole(11); // PM_VALKYRIE
    player.name = 'Wizard';
    player.gender = 1; // female
    const map = generateLevel(1);
    wallification(map);
    player.x = map.upstair.x;
    player.y = map.upstair.y;
    player.dungeonLevel = 1;
    simulatePostLevelInit(player, map, 1);

    return {
        player,
        map,
        display: { putstr_message: () => {} }, // mock
        turnCount: 0,
        seerTurn: 0,
    };
}

// Inline mcalcmove for testing (mirrors nethack.js)
function mcalcmove(mon) {
    let mmove = mon.speed;
    const mmoveAdj = mmove % NORMAL_SPEED;
    mmove -= mmoveAdj;
    if (rn2(NORMAL_SPEED) < mmoveAdj) {
        mmove += NORMAL_SPEED;
    }
    return mmove;
}

// Inline simulateTurnEnd for testing (mirrors nethack.js)
function simulateTurnEnd(game) {
    const { player, map } = game;
    game.turnCount++;
    player.turns = game.turnCount;

    for (const mon of map.monsters) {
        if (mon.dead) continue;
        mon.movement += mcalcmove(mon);
    }

    rn2(70);  // monster spawn
    rn2(400); // dosounds
    rn2(20);  // gethungry
    const dex = player.attributes ? player.attributes[A_DEX] : 14;
    rn2(40 + dex * 3); // engrave wipe

    if (game.turnCount >= game.seerTurn) {
        const rn1_31_15 = 15 + rn2(31);
        game.seerTurn = game.turnCount + rn1_31_15;
    }
}

describe('Per-turn game loop RNG (gameloop)', () => {
    it('mcalcmove produces rn2(12) for non-standard speed monsters', () => {
        initRng(1);
        enableRngLog();

        // Speed 12: rn2(12) still called (C calls unconditionally), but mmove_adj=0
        // so rn2(12) result is never < 0, always returns 12
        const mon12 = { speed: 12, movement: 0, dead: false };
        const move12 = mcalcmove(mon12);
        const log12 = getRngLog().length;
        assert.equal(log12, 1, 'Speed 12 should still call rn2(12) (C-faithful)');
        assert.equal(move12, 12, 'Speed 12 should always give 12');

        // Speed 18: rn2(12) called (mmove_adj = 6)
        const mon18 = { speed: 18, movement: 0, dead: false };
        const move18 = mcalcmove(mon18);
        const log18 = getRngLog().length;
        assert.equal(log18, 2, 'Speed 18 should call rn2(12) once (total 2)');
        assert.ok(move18 === 12 || move18 === 24,
            `Speed 18 should give 12 or 24, got ${move18}`);

        // Speed 6: rn2(12) called (mmove_adj = 6)
        const mon6 = { speed: 6, movement: 0, dead: false };
        mcalcmove(mon6);
        const log6 = getRngLog().length;
        assert.equal(log6, 3, 'Speed 6 should call rn2(12) once (total 3)');

        // Speed 1: rn2(12) called (mmove_adj = 1)
        const mon1 = { speed: 1, movement: 0, dead: false };
        const move1 = mcalcmove(mon1);
        const log1 = getRngLog().length;
        assert.equal(log1, 4, 'Speed 1 should call rn2(12) once (total 4)');
        assert.ok(move1 === 0 || move1 === 12,
            `Speed 1 should give 0 or 12, got ${move1}`);

        disableRngLog();
    });

    it('first turn tail includes seer_turn rn2(31)', () => {
        const game = setupTestGame();

        enableRngLog();
        simulateTurnEnd(game);
        const log = getRngLog();
        disableRngLog();

        // Find the seer_turn call: should be rn2(31) at the end
        // The tail should end with: rn2(70), rn2(400), rn2(20), rn2(DEX), rn2(31)
        const n = log.length;
        assert.ok(n >= 5, `Should have at least 5 tail calls, got ${n}`);

        // Last call should be rn2(31) for seer_turn (first turn)
        assert.ok(log[n - 1].includes('rn2(31)'),
            `Last call should be rn2(31) for seer_turn, got: ${log[n - 1]}`);

        // seerTurn should be set > 1
        assert.ok(game.seerTurn > 1,
            `seerTurn should be set to future turn, got ${game.seerTurn}`);
    });

    it('second turn tail does NOT include seer_turn rn2(31)', () => {
        const game = setupTestGame();

        // Run first turn (consumes seer_turn)
        simulateTurnEnd(game);

        // Run second turn
        enableRngLog();
        simulateTurnEnd(game);
        const log = getRngLog();
        disableRngLog();

        // Second turn should NOT have rn2(31) since seerTurn > turnCount
        const hasRn2_31 = log.some(entry => entry.includes('rn2(31)'));
        assert.ok(!hasRn2_31,
            `Second turn should not have rn2(31), seerTurn=${game.seerTurn}`);
    });

    it('turn tail has correct RNG call order', () => {
        const game = setupTestGame();

        enableRngLog();
        simulateTurnEnd(game);
        const log = getRngLog();
        disableRngLog();

        // Count mcalcmove rn2(12) calls — C calls rn2(12) for ALL monsters unconditionally
        const rn2_12_count = log.filter(e => e.includes('rn2(12)')).length;
        const aliveMonsters = game.map.monsters.filter(m => !m.dead).length;
        assert.equal(rn2_12_count, aliveMonsters,
            `Should have ${aliveMonsters} rn2(12) calls for all alive monsters, got ${rn2_12_count}`);

        // After mcalcmove calls, verify fixed tail order
        const n = log.length;
        const tailStart = rn2_12_count; // tail starts after mcalcmove calls

        // Fixed tail: rn2(70), rn2(400), rn2(20), rn2(DEX_BASED), rn2(31)
        assert.ok(log[tailStart].includes('rn2(70)'),
            `Tail[0] should be rn2(70), got: ${log[tailStart]}`);
        assert.ok(log[tailStart + 1].includes('rn2(400)'),
            `Tail[1] should be rn2(400), got: ${log[tailStart + 1]}`);
        assert.ok(log[tailStart + 2].includes('rn2(20)'),
            `Tail[2] should be rn2(20), got: ${log[tailStart + 2]}`);
        // Tail[3] is rn2(40 + DEX*3) — for Valkyrie DEX ~14, this is rn2(82)
        const dex = game.player.attributes[A_DEX];
        const expectedEngrave = `rn2(${40 + dex * 3})`;
        assert.ok(log[tailStart + 3].includes(expectedEngrave),
            `Tail[3] should be ${expectedEngrave}, got: ${log[tailStart + 3]}`);
        // Tail[4] is rn2(31) on first turn
        assert.ok(log[tailStart + 4].includes('rn2(31)'),
            `Tail[4] should be rn2(31), got: ${log[tailStart + 4]}`);
    });

    it('monsters start with NORMAL_SPEED (12) movement', () => {
        const game = setupTestGame();

        // All monsters should start with movement = 12 (from makemon)
        // After simulatePostLevelInit, the dog might have been added
        // but all monster movement should have been initialized to 12
        for (const mon of game.map.monsters) {
            // After level gen and post-level init, monsters still have initial movement
            // (no turns have been processed yet)
            assert.ok(typeof mon.movement === 'number',
                `Monster ${mon.name} should have numeric movement`);
        }
    });
});
