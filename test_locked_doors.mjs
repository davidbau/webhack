#!/usr/bin/env node
// test_locked_doors.mjs -- Test locked door handling on seed 55555

import { runHeadless } from './selfplay/runner/headless_runner.js';

console.log('Testing locked door handling on seed 55555...\n');

const result = await runHeadless({
    seed: 55555,
    maxTurns: 500,
    verbose: false,
});

console.log('\n=== RESULTS ===');
console.log(`Seed: ${result.seed}`);
console.log(`Turns taken: ${result.stats.turns}`);
console.log(`Max depth reached: ${result.stats.maxDepth}`);
console.log(`Final HP: ${result.game.player.hp}/${result.game.player.hpmax}`);
console.log(`Status: ${result.stats.deathCause ? 'DEAD' : 'ALIVE'}`);
if (result.stats.deathCause) {
    console.log(`Death cause: ${result.stats.deathCause}`);
}

if (result.stats.maxDepth >= 2) {
    console.log('\n✓ SUCCESS: Reached depth 2+ (locked door handling works!)');
} else {
    console.log('\n✗ STUCK: Still at depth 1 (locked door issue may persist)');
}
