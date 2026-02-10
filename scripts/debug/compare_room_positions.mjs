#!/usr/bin/env node
import fs from 'fs';
import { initRng } from './js/rng.js';
import { makelevel, wallification, initLevelGeneration } from './js/dungeon.js';

// Disable debug
process.env.DEBUG_CORRIDORS = '0';
process.env.DEBUG_THEMEROOMS = '0';
process.env.DEBUG_RECTS = '0';

// Generate JS rooms
initRng(163);
initLevelGeneration(11);
const map1 = makelevel(1);
wallification(map1);
const map = makelevel(2);
wallification(map);

console.log('=== JS Rooms (seed163 depth2) ===');
map.rooms.forEach((r, i) => {
    console.log(`Room ${i}: (${r.lx},${r.ly})-(${r.hx},${r.hy})`);
});

// Load C rooms from JSON
const data = JSON.parse(fs.readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const depth2 = data.levels[1];
const typGrid = depth2.typGrid;
const ROOM = 25;

// Find room regions in C output
const visited = Array(21).fill(0).map(() => Array(80).fill(false));

function findBounds(x, y) {
    const cells = [];
    const queue = [{x, y}];
    visited[y][x] = true;
    cells.push({x, y});
    
    while (queue.length > 0) {
        const {x: cx, y: cy} = queue.shift();
        for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (ny >= 0 && ny < 21 && nx >= 0 && nx < 80 && 
                !visited[ny][nx] && typGrid[ny][nx] === ROOM) {
                visited[ny][nx] = true;
                cells.push({x: nx, y: ny});
                queue.push({x: nx, y: ny});
            }
        }
    }
    
    const xs = cells.map(c => c.x);
    const ys = cells.map(c => c.y);
    return {
        lx: Math.min(...xs),
        ly: Math.min(...ys),
        hx: Math.max(...xs),
        hy: Math.max(...ys)
    };
}

const cRooms = [];
for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 80; x++) {
        if (typGrid[y][x] === ROOM && !visited[y][x]) {
            cRooms.push(findBounds(x, y));
        }
    }
}

console.log('\n=== C Rooms (seed163 depth2) ===');
cRooms.forEach((r, i) => {
    console.log(`Room ${i}: (${r.lx},${r.ly})-(${r.hx},${r.hy})`);
});

console.log('\n=== Comparison ===');
console.log(`JS: ${map.rooms.length} rooms`);
console.log(`C: ${cRooms.length} rooms`);
