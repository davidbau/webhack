#!/usr/bin/env node
/**
 * Test stuck seeds with longer turn limits
 */

import { runHeadless } from './selfplay/runner/headless_runner.js';

// Test the stuck seeds with more turns
const STUCK_SEEDS = [22222, 44444];
const TURN_LIMITS = [500, 1000, 1500, 2000];

console.log(`Testing stuck seeds with varying turn limits...\n`);

for (const seed of STUCK_SEEDS) {
    console.log(`\n=== Seed ${seed} ===`);

    for (const maxTurns of TURN_LIMITS) {
        try {
            const result = await runHeadless({
                seed,
                maxTurns,
                roleIndex: 12, // Wizard
                verbose: false,
                dumpMaps: false,
            });

            const status = result.stats.maxDepth >= 2 ? '✓ SUCCESS' : '✗ STUCK';
            console.log(`  ${maxTurns.toString().padStart(4)} turns: Dlvl ${result.stats.maxDepth} ${status}`);

            // If it succeeds, no need to test higher turn counts
            if (result.stats.maxDepth >= 2) {
                break;
            }
        } catch (error) {
            console.error(`  ${maxTurns.toString().padStart(4)} turns: ERROR - ${error.message}`);
        }
    }
}

console.log(`\nDone.`);
