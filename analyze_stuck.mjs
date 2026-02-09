#!/usr/bin/env node
// Analyze why seed 44444 is stuck

import { initGame } from './js/game.js';

const game = initGame({ seed: 44444, role: 'Val' });

// Run for 100 turns to let agent explore
for (let i = 0; i < 100; i++) {
    game.rhack('.');
}

const map = game.map;
console.log('=== Seed 44444 Map Analysis ===\n');

// Find secret doors and corridors
const secrets = [];
for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
        const loc = map.at(x, y);
        if (loc.typ === 14) { // SDOOR
            secrets.push({ x, y, type: 'SDOOR' });
        } else if (loc.typ === 15) { // SCORR
            secrets.push({ x, y, type: 'SCORR' });
        }
    }
}

console.log(`Secret features: ${secrets.length}`);
for (const secret of secrets) {
    console.log(`  ${secret.type} at (${secret.x}, ${secret.y})`);
}

// Find downstairs
const downstairs = [];
for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
        const loc = map.at(x, y);
        if (loc.typ === 5) { // STAIRS down
            downstairs.push({ x, y });
        }
    }
}

console.log(`\nDownstairs: ${downstairs.length}`);
for (const stairs of downstairs) {
    console.log(`  At (${stairs.x}, ${stairs.y})`);
}

// Check what's adjacent to the secret doors
console.log('\nAdjacent to secrets:');
for (const secret of secrets) {
    const adjacent = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = secret.x + dx;
            const ny = secret.y + dy;
            if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
                const loc = map.at(nx, ny);
                if (loc.typ !== 0 && loc.typ !== 6 && loc.typ !== 14 && loc.typ !== 15) {
                    adjacent.push(`(${nx},${ny}):typ${loc.typ}`);
                }
            }
        }
    }
    console.log(`  ${secret.type} (${secret.x},${secret.y}): ${adjacent.join(', ') || 'only stone/walls nearby'}`);
}
