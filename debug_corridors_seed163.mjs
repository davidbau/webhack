#!/usr/bin/env node
// debug_corridors_seed163.mjs -- Debug corridor generation for seed163 depth 2

import { runHeadless } from './selfplay/runner/headless_runner.js';

console.log('Debugging corridor generation for seed163 depth 2...\n');

// Enable corridor debug logging
process.env.DEBUG_CORRIDORS = '1';

let depth2Map = null;

const result = await runHeadless({
    seed: 163,
    maxTurns: 10,  // Give it a few turns to get to depth 2
    verbose: false,
    onPerceive: (info) => {
        if (info.game && info.game.map && info.player && info.player.dlevel === 2 && !depth2Map) {
            depth2Map = info.game.map;
        }
    },
});

if (depth2Map) {
    const map = depth2Map;

    // Count terrain types
    const counts = {};
    for (let y = 0; y < 21; y++) {
        for (let x = 0; x < 80; x++) {
            const loc = map.locations[x][y];
            const typ = loc.typ;
            counts[typ] = (counts[typ] || 0) + 1;
        }
    }

    console.log('\n=== Depth 2 Terrain Counts ===');
    console.log(`ROOM: ${counts[1] || 0}`);
    console.log(`CORR: ${counts[2] || 0}`);
    console.log(`DOOR: ${counts[8] || 0}`);
    console.log(`SDOOR: ${counts[7] || 0}`);
    console.log(`SCORR: ${counts[11] || 0}`);

    console.log(`\nTotal rooms: ${map.rooms.length}`);
    console.log(`Room details:`);
    map.rooms.forEach((r, i) => {
        const area = (r.hx - r.lx + 1) * (r.hy - r.ly + 1);
        console.log(`  Room ${i}: (${r.lx},${r.ly})-(${r.hx},${r.hy}) area=${area}`);
    });
} else {
    console.log('\nWarning: Never reached depth 2');
}

console.log('\nDone!');
