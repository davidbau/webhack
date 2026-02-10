#!/usr/bin/env node
/**
 * Check what character the screen shows for downstairs
 */

import { HeadlessGame, HeadlessAdapter } from './selfplay/runner/headless_runner.js';

const SEED = 44444;
const ROLE_INDEX = 12; // Wizard

console.log(`=== Checking stairs character for seed ${SEED} ===\n`);

// Create game
const game = new HeadlessGame(SEED, ROLE_INDEX);
const adapter = new HeadlessAdapter(game);

// Start the adapter
await adapter.start();

// Compute FOV first
game.fov.compute(game.map, game.player.x, game.player.y);

console.log(`\n--- FOV Check ---`);
console.log(`Can see stairs at (64,2): ${game.fov.canSee(64, 2) ? 'YES' : 'NO'}`);
console.log(`FOV range: ~${game.fov.range || 'unknown'} cells`);

// Render the map
game.display.renderMap(game.map, game.player, game.fov);
game.display.renderStatus(game.player);

// Read initial screen
const screen = await adapter.readScreen();

// Find downstairs in game.map
let stairsPos = null;
const STAIRS = 26;  // From config.js
for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 80; x++) {
        const cell = game.map.at(x, y);
        // STAIRS typ=26, flags=0 for down, flags=1 for up
        if (cell && cell.typ === STAIRS && cell.flags === 0) {
            stairsPos = { x, y };
            break;
        }
    }
    if (stairsPos) break;
}

if (stairsPos) {
    console.log(`Ground truth: Downstairs at (${stairsPos.x}, ${stairsPos.y})`);

    // Check what the screen shows at that position
    const screenCell = screen[stairsPos.y][stairsPos.x];
    console.log(`\nScreen buffer at stairs location:`);
    console.log(`  ch: '${screenCell.ch}'`);
    console.log(`  charCode: ${screenCell.ch.charCodeAt(0)}`);
    console.log(`  color: ${screenCell.color}`);
    console.log(`  Expected: '>' (charCode 62)`);

    if (screenCell.ch === '>') {
        console.log(`\n✓ Screen correctly shows '>' for stairs`);
    } else {
        console.log(`\n✗ Screen shows '${screenCell.ch}' instead of '>'`);
        console.log(`This is the BUG - screen doesn't display stairs correctly`);
    }

    // Check if player can see this position initially
    const player = game.player;
    console.log(`\nPlayer position: (${player.x}, ${player.y})`);
    const dist = Math.max(Math.abs(stairsPos.x - player.x), Math.abs(stairsPos.y - player.y));
    console.log(`Distance to stairs: ${dist} cells (Chebyshev distance)`);

    // Check a few cells around the stairs
    console.log(`\n--- Cells around stairs ---`);
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const x = stairsPos.x + dx;
            const y = stairsPos.y + dy;
            if (x >= 0 && x < 80 && y >= 0 && y < 21) {
                const cell = screen[y][x];
                const mapCell = game.map.at(x, y);
                console.log(`  (${x},${y}): screen='${cell.ch}' (${cell.ch.charCodeAt(0)}), map.typ=${mapCell?.typ}`);
            }
        }
    }
} else {
    console.log(`ERROR: Could not find downstairs in game.map`);
}
