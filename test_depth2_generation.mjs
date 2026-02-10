#!/usr/bin/env node
// test_depth2_generation.mjs -- Test depth 2 level generation directly

import { HeadlessGame } from './selfplay/runner/headless_runner.js';

console.log('Testing depth 2 generation for seed163...\n');

// Enable corridor debug
process.env.DEBUG_CORRIDORS = '1';

const game = new HeadlessGame(163, 11); // Seed 163, Valkyrie

// Generate depth 1
console.log('=== Generating Depth 1 ===');
game.player.dlevel = 1;
game.generate_level(1);

console.log(`\n=== Depth 1 terrain counts ===`);
const map1 = game.map;
const counts1 = {};
for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 80; x++) {
        const typ = map1.locations[x][y].typ;
        counts1[typ] = (counts1[typ] || 0) + 1;
    }
}
console.log(`ROOM: ${counts1[1] || 0}, CORR: ${counts1[2] || 0}, DOOR: ${counts1[8] || 0}, SDOOR: ${counts1[7] || 0}`);
console.log(`Total rooms: ${map1.rooms.length}`);

// Now generate depth 2
console.log('\n=== Generating Depth 2 ===');
game.player.dlevel = 2;
game.generate_level(2);

console.log(`\n=== Depth 2 terrain counts ===`);
const map2 = game.map;
const counts2 = {};
for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 80; x++) {
        const typ = map2.locations[x][y].typ;
        counts2[typ] = (counts2[typ] || 0) + 1;
    }
}
console.log(`ROOM: ${counts2[1] || 0}, CORR: ${counts2[2] || 0}, DOOR: ${counts2[8] || 0}, SDOOR: ${counts2[7] || 0}, SCORR: ${counts2[11] || 0}`);
console.log(`Total rooms: ${map2.rooms.length}`);

console.log('\nExpected from C (seed163 depth 2):');
console.log('ROOM: 219, CORR: 192, DOOR: 23, SDOOR: 4');

console.log('\nDone!');
