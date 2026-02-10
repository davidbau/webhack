#!/usr/bin/env node
// test_depth2_direct.mjs -- Test depth 2 level generation using makelevel directly

import { initRng } from './js/rng.js';
import { makelevel, wallification, initLevelGeneration } from './js/dungeon.js';
import { ROOM, CORR, DOOR, SDOOR, SCORR } from './js/config.js';

console.log('Testing depth 2 generation for seed163...\n');

// Enable debug flags (only if not already set)
if (!process.env.DEBUG_CORRIDORS) process.env.DEBUG_CORRIDORS = '0';
if (!process.env.DEBUG_CORRIDOR_DETAIL) process.env.DEBUG_CORRIDOR_DETAIL = '0';
if (!process.env.DEBUG_ROOM_FILL) process.env.DEBUG_ROOM_FILL = '0';

// Initialize for seed 163, Valkyrie (role 11)
initRng(163);
initLevelGeneration(11);

// Generate depth 1 first (needed for state setup)
console.log('=== Generating Depth 1 (for state) ===');
const map1 = makelevel(1);
wallification(map1);

console.log(`Depth 1: ${map1.rooms.length} rooms`);

// Now generate depth 2
console.log('\n=== Generating Depth 2 ===');
const map = makelevel(2);
wallification(map);

console.log(`\n=== Depth 2 Room Details (JS) ===`);
console.log(`Total rooms: ${map.rooms.length}`);
map.rooms.forEach((r, i) => {
    const area = (r.hx - r.lx + 1) * (r.hy - r.ly + 1);
    console.log(`  Room ${i}: (${r.lx},${r.ly})-(${r.hx},${r.hy}) size=${r.hx-r.lx+1}x${r.hy-r.ly+1} area=${area}`);
});

console.log(`\n=== Depth 2 Terrain Counts (JS) ===`);
const counts = {};
for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 80; x++) {
        const typ = map.locations[x][y].typ;
        counts[typ] = (counts[typ] || 0) + 1;
    }
}
console.log(`ROOM: ${counts[ROOM] || 0} (typ=${ROOM})`);
console.log(`CORR: ${counts[CORR] || 0} (typ=${CORR})`);
console.log(`DOOR: ${counts[DOOR] || 0} (typ=${DOOR})`);
console.log(`SDOOR: ${counts[SDOOR] || 0} (typ=${SDOOR})`);
console.log(`SCORR: ${counts[SCORR] || 0} (typ=${SCORR})`);

console.log(`\n=== Expected from C (seed163 depth 2) ===`);
console.log('ROOM: 219');
console.log('CORR: 192');
console.log('DOOR: 23');
console.log('SDOOR: 4');

console.log(`\n=== Difference ===`);
console.log(`ROOM: ${(counts[ROOM] || 0) - 219} (JS has ${(counts[ROOM] || 0) - 219 < 0 ? 'fewer' : 'more'})`);
console.log(`CORR: ${(counts[CORR] || 0) - 192} (JS has ${(counts[CORR] || 0) - 192 < 0 ? 'fewer' : 'more'})`);
console.log(`DOOR: ${(counts[DOOR] || 0) - 23} (JS has ${(counts[DOOR] || 0) - 23 < 0 ? 'fewer' : 'more'})`);
console.log(`SDOOR: ${(counts[SDOOR] || 0) - 4} (JS has ${(counts[SDOOR] || 0) - 4 < 0 ? 'fewer' : 'more'})`);

console.log('\nDone!');
