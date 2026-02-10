#!/usr/bin/env node
// test_multiple_seeds.mjs -- Test descent fix on multiple problem seeds

import { runHeadless } from './selfplay/runner/headless_runner.js';

const SEEDS = [55555, 77777, 88888, 44444, 66666];

console.log('Testing descent fix on multiple seeds...\n');

for (const seed of SEEDS) {
    const result = await runHeadless({
        seed,
        maxTurns: 500,
        verbose: false,
    });

    const status = result.stats.maxDepth >= 2 ? '✓' : '✗';
    console.log(`${status} Seed ${seed}: depth ${result.stats.maxDepth} (${result.stats.turns} turns)`);
}

console.log('\nDone!');
