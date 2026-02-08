// trace_compare.test.js -- Compare per-turn RNG calls against C reference trace
// Verifies that moveMonsters + simulateTurnEnd produce exact RNG alignment
// with C's movemon + mcalcmove + per-turn tail for seed 42 wizard mode.

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initRng, rn2, rnd, rn1, enableRngLog, getRngLog, disableRngLog } from '../../js/rng.js';
import { initLevelGeneration, generateLevel, wallification } from '../../js/dungeon.js';
import { Player, roles } from '../../js/player.js';
import { simulatePostLevelInit } from '../../js/u_init.js';
import { moveMonsters } from '../../js/monmove.js';
import { FOV } from '../../js/fov.js';
import { NORMAL_SPEED, A_DEX } from '../../js/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRACE_DIR = join(__dirname, '../comparison/traces/seed42_reference');

// Parse a C trace file into an array of {idx, call, result} entries
function parseTrace(filename) {
    const text = readFileSync(join(TRACE_DIR, filename), 'utf8');
    const entries = [];
    for (const line of text.trim().split('\n')) {
        if (!line.trim()) continue;
        const m = line.match(/^(\d+)\s+(rn[d12]\(\d+\))\s*=\s*(\d+)/);
        if (m) {
            entries.push({
                idx: parseInt(m[1]),
                call: m[2],
                result: parseInt(m[3]),
            });
        }
    }
    return entries;
}

// Inline mcalcmove (mirrors nethack.js)
function mcalcmove(mon) {
    let mmove = mon.speed;
    const mmoveAdj = mmove % NORMAL_SPEED;
    mmove -= mmoveAdj;
    if (rn2(NORMAL_SPEED) < mmoveAdj) {
        mmove += NORMAL_SPEED;
    }
    return mmove;
}

// Inline simulateTurnEnd (mirrors nethack.js, without display/hunger side effects)
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

// Set up the full game state for seed 42 wizard mode
function setupGame() {
    initRng(42);
    initLevelGeneration();

    const player = new Player();
    player.initRole(11); // PM_VALKYRIE
    player.name = 'Wizard';
    player.gender = 1; // female

    const map = generateLevel(1);
    wallification(map);

    // Place player at upstair
    player.x = map.upstair.x;
    player.y = map.upstair.y;
    player.dungeonLevel = 1;

    simulatePostLevelInit(player, map, 1);

    const fov = new FOV();
    fov.compute(map, player.x, player.y);

    return {
        player,
        map,
        fov,
        display: { putstr_message: () => {} },
        turnCount: 0,
        seerTurn: 0,
    };
}

// Simulate one turn: moveMonsters + simulateTurnEnd
function doTurn(game) {
    moveMonsters(game.map, game.player, game.display, game.fov);
    simulateTurnEnd(game);

    // Recompute FOV for next turn
    game.fov.compute(game.map, game.player.x, game.player.y);
}

// Move the player in a direction (no RNG consumption — pure position update)
function movePlayer(game, dx, dy) {
    game.player.x += dx;
    game.player.y += dy;
}

describe('C trace comparison (seed 42)', () => {
    it('startup consumes exactly 2802 RNG calls', () => {
        // C trace has 2807 lines: 2801 rn2/rnd/rn1 + 1 d() + 5 rne/rnz summaries
        // rne/rnz summaries are NOT additional RNG consumptions (internal rn2 calls
        // are already logged separately), so actual count = 2802
        enableRngLog();
        const game = setupGame();
        const log = getRngLog();
        disableRngLog();

        assert.equal(log.length, 2802,
            `Startup should consume 2802 RNG calls, got ${log.length}`);
    });

    it('diagnostic: dump monster list after setup', () => {
        const game = setupGame();
        console.log(`\n=== Monster list (${game.map.monsters.length} total) ===`);
        for (let i = 0; i < game.map.monsters.length; i++) {
            const m = game.map.monsters[i];
            const sleeping = m.sleeping ? ' SLEEPING' : '';
            const tame = m.tame ? ' TAME' : '';
            console.log(`  [${i}] ${m.name} at (${m.mx},${m.my}) speed=${m.speed} movement=${m.movement}${sleeping}${tame}`);
        }
        console.log(`Player at (${game.player.x},${game.player.y})`);
        console.log(`Objects: ${game.map.objects.length}`);
        console.log(`DEX: ${game.player.attributes[A_DEX]}`);
    });

    it('turn 1 (first h move-west) matches C trace rng_002', () => {
        const game = setupGame();
        const cTrace = parseTrace('rng_002_h_move-west.txt');

        // Move player west
        movePlayer(game, -1, 0);

        // Execute turn
        enableRngLog();
        doTurn(game);
        const jsLog = getRngLog();
        disableRngLog();

        console.log(`\nTurn 1: ${jsLog.length} RNG calls (C expects ${cTrace.length})`);
        if (jsLog.length !== cTrace.length) {
            console.log('JS calls:');
            for (const entry of jsLog) console.log(`  ${entry}`);
            console.log('C calls:');
            for (const entry of cTrace) console.log(`  ${entry.idx} ${entry.call} = ${entry.result}`);
        }

        assert.equal(jsLog.length, cTrace.length,
            `Turn 1: expected ${cTrace.length} RNG calls, got ${jsLog.length}`);

        // Compare each call
        for (let i = 0; i < cTrace.length; i++) {
            const jsEntry = jsLog[i];
            const cEntry = cTrace[i];
            const jsMatch = jsEntry.match(/\d+\s+(rn[d12]\(\d+\))\s*=\s*(\d+)/);
            assert.ok(jsMatch, `Could not parse JS log entry: ${jsEntry}`);
            assert.equal(jsMatch[1], cEntry.call,
                `Turn 1 call ${i}: expected ${cEntry.call}, got ${jsMatch[1]}`);
            assert.equal(parseInt(jsMatch[2]), cEntry.result,
                `Turn 1 call ${i}: ${cEntry.call} expected result ${cEntry.result}, got ${jsMatch[2]}`);
        }
    });

    it('turn 2 (second h move-west) matches C trace rng_003', () => {
        const game = setupGame();
        const cTrace = parseTrace('rng_003_h_move-west.txt');

        // Turn 1: move west
        movePlayer(game, -1, 0);
        doTurn(game);

        // Turn 2: move west
        movePlayer(game, -1, 0);

        enableRngLog();
        doTurn(game);
        const jsLog = getRngLog();
        disableRngLog();

        console.log(`\nTurn 2: ${jsLog.length} RNG calls (C expects ${cTrace.length})`);
        if (jsLog.length !== cTrace.length) {
            console.log('JS calls:');
            for (const entry of jsLog) console.log(`  ${entry}`);
            console.log('C calls:');
            for (const entry of cTrace) console.log(`  ${entry.idx} ${entry.call} = ${entry.result}`);
        }

        assert.equal(jsLog.length, cTrace.length,
            `Turn 2: expected ${cTrace.length} RNG calls, got ${jsLog.length}`);

        for (let i = 0; i < cTrace.length; i++) {
            const jsEntry = jsLog[i];
            const cEntry = cTrace[i];
            const jsMatch = jsEntry.match(/\d+\s+(rn[d12]\(\d+\))\s*=\s*(\d+)/);
            assert.ok(jsMatch, `Could not parse JS log entry: ${jsEntry}`);
            assert.equal(jsMatch[1], cEntry.call,
                `Turn 2 call ${i}: expected ${cEntry.call}, got ${jsMatch[1]}`);
            assert.equal(parseInt(jsMatch[2]), cEntry.result,
                `Turn 2 call ${i}: ${cEntry.call} expected result ${cEntry.result}, got ${jsMatch[2]}`);
        }
    });

    it('turn 3 (l move-east) matches C trace rng_004', () => {
        const game = setupGame();
        const cTrace = parseTrace('rng_004_l_move-east.txt');

        // Turn 1: move west
        movePlayer(game, -1, 0);
        doTurn(game);

        // Turn 2: move west
        movePlayer(game, -1, 0);
        doTurn(game);

        // Turn 3: move east
        movePlayer(game, 1, 0);

        enableRngLog();
        doTurn(game);
        const jsLog = getRngLog();
        disableRngLog();

        console.log(`\nTurn 3: ${jsLog.length} RNG calls (C expects ${cTrace.length})`);
        if (jsLog.length !== cTrace.length) {
            console.log('JS calls:');
            for (const entry of jsLog) console.log(`  ${entry}`);
            console.log('C calls:');
            for (const entry of cTrace) console.log(`  ${entry.idx} ${entry.call} = ${entry.result}`);
        }

        assert.equal(jsLog.length, cTrace.length,
            `Turn 3: expected ${cTrace.length} RNG calls, got ${jsLog.length}`);

        for (let i = 0; i < cTrace.length; i++) {
            const jsEntry = jsLog[i];
            const cEntry = cTrace[i];
            const jsMatch = jsEntry.match(/\d+\s+(rn[d12]\(\d+\))\s*=\s*(\d+)/);
            assert.ok(jsMatch, `Could not parse JS log entry: ${jsEntry}`);
            assert.equal(jsMatch[1], cEntry.call,
                `Turn 3 call ${i}: expected ${cEntry.call}, got ${jsMatch[1]}`);
            assert.equal(parseInt(jsMatch[2]), cEntry.result,
                `Turn 3 call ${i}: ${cEntry.call} expected result ${cEntry.result}, got ${jsMatch[2]}`);
        }
    });

    it('turn 4 (h move-west) matches C trace rng_005', () => {
        const game = setupGame();
        const cTrace = parseTrace('rng_005_h_move-west.txt');

        // Turns 1-3
        movePlayer(game, -1, 0); doTurn(game); // turn 1: h
        movePlayer(game, -1, 0); doTurn(game); // turn 2: h
        movePlayer(game, 1, 0);  doTurn(game); // turn 3: l

        // Turn 4: move west
        movePlayer(game, -1, 0);

        enableRngLog();
        doTurn(game);
        const jsLog = getRngLog();
        disableRngLog();

        console.log(`\nTurn 4: ${jsLog.length} RNG calls (C expects ${cTrace.length})`);
        if (jsLog.length !== cTrace.length) {
            console.log('JS calls:');
            for (const entry of jsLog) console.log(`  ${entry}`);
            console.log('C calls:');
            for (const entry of cTrace) console.log(`  ${entry.idx} ${entry.call} = ${entry.result}`);
        }

        assert.equal(jsLog.length, cTrace.length,
            `Turn 4: expected ${cTrace.length} RNG calls, got ${jsLog.length}`);

        for (let i = 0; i < cTrace.length; i++) {
            const jsEntry = jsLog[i];
            const cEntry = cTrace[i];
            const jsMatch = jsEntry.match(/\d+\s+(rn[d12]\(\d+\))\s*=\s*(\d+)/);
            assert.ok(jsMatch, `Could not parse JS log entry: ${jsEntry}`);
            assert.equal(jsMatch[1], cEntry.call,
                `Turn 4 call ${i}: expected ${cEntry.call}, got ${jsMatch[1]}`);
            assert.equal(parseInt(jsMatch[2]), cEntry.result,
                `Turn 4 call ${i}: ${cEntry.call} expected result ${cEntry.result}, got ${jsMatch[2]}`);
        }
    });
});
