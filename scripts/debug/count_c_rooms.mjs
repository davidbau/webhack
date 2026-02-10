#!/usr/bin/env node
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('test/comparison/maps/seed163_maps_c.session.json', 'utf8'));
const depth2 = data.levels[1];  // depth 2 (index 1)

// Count distinct room regions in the type grid
const typGrid = depth2.typGrid;
const ROOM = 25;

// Find all ROOM cells and cluster them into room regions
let roomCount = 0;
const visited = Array(21).fill(0).map(() => Array(80).fill(false));

function floodFill(x, y) {
    if (y < 0 || y >= 21 || x < 0 || x >= 80) return 0;
    if (visited[y][x]) return 0;
    if (typGrid[y][x] !== ROOM) return 0;
    
    visited[y][x] = true;
    let count = 1;
    
    // Check 4 neighbors
    count += floodFill(x+1, y);
    count += floodFill(x-1, y);
    count += floodFill(x, y+1);
    count += floodFill(x, y-1);
    
    return count;
}

const rooms = [];
for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 80; x++) {
        if (typGrid[y][x] === ROOM && !visited[y][x]) {
            const cells = floodFill(x, y);
            if (cells > 0) {
                rooms.push({id: roomCount++, cells});
            }
        }
    }
}

console.log(`C (seed163 depth 2): ${roomCount} room regions`);
rooms.forEach((r, i) => console.log(`  Room ${i}: ${r.cells} cells`));
