#!/usr/bin/env node
/**
 * Test Minetown level generation to check corridor connectivity
 *
 * Tests whether des.random_corridors() stub causes disconnected rooms
 */

import { initRng } from './js/rng.js';
import { generate as generateMinetn3 } from './js/levels/minetn-3.js';
import { getLevelState } from './js/sp_lev.js';
import { ROOM, CORR, DOOR, STONE } from './js/config.js';

initRng(42);

console.log('=== Testing Minetown-3 Corridor Connectivity ===\n');

try {
    const level = generateMinetn3();
    const state = getLevelState();

    console.log(`✓ Minetown-3 generated successfully`);
    console.log(`  Rooms: ${state.map?.rooms?.length || 0}`);
    console.log(`  Map dimensions: ${state.map ? '80x21' : 'N/A'}\n`);

    if (!state.map || !state.map.rooms || state.map.rooms.length === 0) {
        console.log('❌ No rooms created');
        process.exit(1);
    }

    // Analyze room positions and connectivity
    console.log('=== Room Layout ===');
    const rooms = state.map.rooms;
    rooms.forEach((room, i) => {
        console.log(`Room ${i}: (${room.lx},${room.ly})-(${room.hx},${room.hy}) ` +
                    `size ${room.hx - room.lx + 1}x${room.hy - room.ly + 1}`);
    });

    // Check for corridor tiles
    let corridorTiles = 0;
    let doorTiles = 0;
    let roomTiles = 0;
    let stoneTiles = 0;

    for (let y = 0; y < 21; y++) {
        for (let x = 0; x < 80; x++) {
            const typ = state.map.locations[x][y].typ;
            if (typ === CORR) corridorTiles++;
            else if (typ === DOOR) doorTiles++;
            else if (typ === ROOM) roomTiles++;
            else if (typ === STONE) stoneTiles++;
        }
    }

    console.log(`\n=== Terrain Analysis ===`);
    console.log(`  ROOM tiles: ${roomTiles}`);
    console.log(`  CORR tiles: ${corridorTiles} ${corridorTiles === 0 ? '❌ NO CORRIDORS!' : '✓'}`);
    console.log(`  DOOR tiles: ${doorTiles}`);
    console.log(`  STONE tiles: ${stoneTiles}`);

    // Check if rooms are adjacent (touching or overlapping)
    console.log(`\n=== Room Adjacency Check ===`);
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const r1 = rooms[i];
            const r2 = rooms[j];

            // Check if rooms overlap or are adjacent (within 1 tile)
            const xOverlap = !(r1.hx < r2.lx - 1 || r2.hx < r1.lx - 1);
            const yOverlap = !(r1.hy < r2.ly - 1 || r2.hy < r1.ly - 1);

            if (xOverlap && yOverlap) {
                console.log(`  ✓ Room ${i} and ${j} are adjacent/overlapping`);
            }
        }
    }

    // Simple ASCII visualization of room positions
    console.log(`\n=== Level Map (rooms only, first 50x21) ===`);
    for (let y = 0; y < 21; y++) {
        let line = '';
        for (let x = 0; x < 50; x++) {
            const typ = state.map.locations[x][y].typ;
            if (typ === ROOM) {
                line += '.';
            } else if (typ === CORR) {
                line += '#';
            } else if (typ === DOOR) {
                line += '+';
            } else {
                line += ' ';
            }
        }
        console.log(line);
    }

    // Final assessment
    console.log(`\n=== Assessment ===`);
    if (corridorTiles === 0 && rooms.length > 1) {
        console.log(`⚠️  WARNING: Multiple rooms but NO corridors!`);
        console.log(`   This suggests des.random_corridors() needs implementation.`);
        console.log(`   Rooms may be disconnected and unreachable.`);
    } else if (corridorTiles > 0) {
        console.log(`✓ Corridors present - rooms should be connected`);
    } else {
        console.log(`ℹ️  Single room or nested rooms - corridors not needed`);
    }

} catch (err) {
    console.error('❌ Minetown-3 test FAILED');
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
}
