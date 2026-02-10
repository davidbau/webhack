#!/usr/bin/env node
/**
 * Generate level traces directly from JS level generators
 *
 * This script generates traces for levels that can't be easily obtained from
 * C NetHack (e.g., elemental planes that require endgame state).
 *
 * Usage: node scripts/generate_js_leveltraces.mjs <levelname> <seed>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Import level generators
const LEVEL_GENERATORS = {
    'air': async () => (await import('../js/levels/air.js')).generate,
    'astral': async () => (await import('../js/levels/astral.js')).generate,
    'earth': async () => (await import('../js/levels/earth.js')).generate,
    'fire': async () => (await import('../js/levels/fire.js')).generate,
    'water': async () => (await import('../js/levels/water.js')).generate,
};

async function generateJSTrace(levelName, seed) {
    console.log(`Generating JS trace for ${levelName} with seed ${seed}...`);

    // Get the generator function
    if (!LEVEL_GENERATORS[levelName]) {
        console.error(`Error: No generator found for level "${levelName}"`);
        console.error(`Available levels: ${Object.keys(LEVEL_GENERATORS).join(', ')}`);
        process.exit(1);
    }

    const getGenerator = LEVEL_GENERATORS[levelName];
    const generator = await getGenerator();

    // Import required modules
    const { initRng } = await import('../js/rng.js');
    const { resetLevelState, getLevelState } = await import('../js/sp_lev.js');

    // Initialize RNG with seed
    initRng(seed);

    // Reset level state
    resetLevelState();

    // Generate the level
    try {
        generator();
    } catch (error) {
        console.error(`Error generating level: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }

    // Get the generated level state
    const state = getLevelState();
    const map = state.map;

    if (!map || !map.locations) {
        console.error('Error: Level generation did not produce a valid map');
        process.exit(1);
    }

    // Extract typGrid from map.locations
    const typGrid = [];
    for (let y = 0; y < 21; y++) {
        const row = [];
        for (let x = 0; x < 80; x++) {
            row.push(map.locations[x][y].typ);
        }
        typGrid.push(row);
    }

    // Create trace object
    const trace = {
        version: 2,
        seed: seed,
        type: 'special',
        source: 'js',  // Mark as JS-generated
        levelName: levelName,
        branch: 'Elemental Planes',
        typGrid: typGrid
    };

    // Write trace file
    const outputDir = path.join(PROJECT_ROOT, 'leveltrace');
    const outputFile = path.join(outputDir, `${levelName}_seed${seed}.json`);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(trace, null, 2));

    console.log(`✓ Wrote ${outputFile}`);
    console.log(`  Grid size: ${typGrid.length} rows × ${typGrid[0].length} cols`);

    return trace;
}

// Main
const args = process.argv.slice(2);

if (args.length === 0) {
    console.log('Usage: node scripts/generate_js_leveltraces.mjs <levelname> [seed]');
    console.log(`Available levels: ${Object.keys(LEVEL_GENERATORS).join(', ')}`);
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/generate_js_leveltraces.mjs air 1');
    console.log('  node scripts/generate_js_leveltraces.mjs astral 42');
    process.exit(0);
}

const levelName = args[0];
const seed = args.length > 1 ? parseInt(args[1]) : 1;

if (isNaN(seed)) {
    console.error('Error: Seed must be a number');
    process.exit(1);
}

generateJSTrace(levelName, seed)
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
