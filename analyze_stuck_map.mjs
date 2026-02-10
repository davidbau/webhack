#!/usr/bin/env node
/**
 * Analyze why a seed is stuck by examining the ground truth map
 */

import { HeadlessGame, HeadlessAdapter } from './selfplay/runner/headless_runner.js';
import { Agent } from './selfplay/agent.js';
import { findPath } from './selfplay/brain/pathing.js';

const SEED = parseInt(process.argv[2]) || 22222;
const ANALYZE_TURN = 300;
const ROLE_INDEX = 12; // Wizard

console.log(`=== Analyzing Stuck Seed ${SEED} ===\n`);

// Create game and agent
const game = new HeadlessGame(SEED, ROLE_INDEX);
const adapter = new HeadlessAdapter(game);
const agent = new Agent(adapter, { maxTurns: ANALYZE_TURN });

// Track if agent ever sees or stands on stairs
let stoodOnStairs = false;
let sawStairs = false;

// Add tracking callback
agent.onTurn = (info) => {
    // Check if standing on stairs location (12, 2)
    if (info.position && info.position.x === 12 && info.position.y === 2 && !stoodOnStairs) {
        stoodOnStairs = true;
        console.log(`[Turn ${info.turn}] Agent is standing on stairs position (12,2)!`);

        // Log what screen shows at this moment
        const cell = agent.screen?.grid?.[2]?.[12];
        if (cell) {
            console.log(`  Screen shows: ch='${cell.ch}' (charCode=${cell.ch?.charCodeAt(0)}), color=${cell.color}`);
        }
        const levelCell = agent.dungeon.currentLevel.at(12, 2);
        console.log(`  Level map shows: type=${levelCell?.type}, explored=${levelCell?.explored}`);
    }

    // Check if stairs discovered
    if (agent.dungeon.currentLevel.stairsDown.length > 0 && !sawStairs) {
        sawStairs = true;
        const stairs = agent.dungeon.currentLevel.stairsDown[0];
        console.log(`[Turn ${info.turn}] Agent discovered downstairs at (${stairs.x}, ${stairs.y})!`);
    }
};

// Run agent to the analysis point
console.log(`Running agent for ${ANALYZE_TURN} turns...`);
await agent.run();

console.log(`\nAgent stood on stairs position: ${stoodOnStairs ? 'YES' : 'NO'}`);
console.log(`Agent saw downstairs: ${sawStairs ? 'YES' : 'NO'}`);

console.log(`\n=== Map Analysis at Turn ${agent.turnNumber} ===\n`);

const level = agent.dungeon.currentLevel;
const pos = agent.status || {};

// Get position from screen if status doesn't have it
if (!pos.x || !pos.y) {
    pos.x = agent.screen?.playerX;
    pos.y = agent.screen?.playerY;
}

// Agent's view
console.log(`Agent position: (${pos.x}, ${pos.y})`);
console.log(`Agent explored: ${level.exploredCount} cells (${(100*level.exploredCount/(80*21)).toFixed(1)}%)`);
console.log(`Agent frontier: ${level.getExplorationFrontier().length} cells`);

// Ground truth from game state
const map = game.map;
const player = game.player;

console.log(`\n--- Ground Truth (from game.map) ---`);
console.log(`Map structure:`, Object.keys(map));
console.log(`Map has ${map.height || '?'} rows, ${map.width || '?'} cols`);

// Find downstairs in actual map
let stairsPos = null;
const mapHeight = map.height || 21;
const mapWidth = map.width || 80;

// Check map cell access
console.log(`Attempting to access map at (0,0):`, map.at ? 'has at()' : 'no at(), trying direct access');

for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
        let cell;
        if (map.at) {
            cell = map.at(x, y);
        } else if (map.cells && map.cells[y]) {
            cell = map.cells[y][x];
        } else if (map[y]) {
            cell = map[y][x];
        }

        if (cell && cell.typ === 26 && cell.flags === 0) { // LADDER down (typ 25 is stairs down)
            stairsPos = { x, y };
            break;
        }
    }
    if (stairsPos) break;
}

let agentStairsCell = null;
if (stairsPos) {
    console.log(`Downstairs location: (${stairsPos.x}, ${stairsPos.y})`);

    // Check if agent knows about the stairs
    agentStairsCell = level.at(stairsPos.x, stairsPos.y);
    console.log(`Agent aware of stairs: ${agentStairsCell?.type === 'stairs_down' ? 'YES' : 'NO'}`);
    console.log(`Stairs cell explored: ${agentStairsCell?.explored ? 'YES' : 'NO'}`);
    if (agentStairsCell) {
        console.log(`Agent's view of stairs cell:`, {
            type: agentStairsCell.type,
            walkable: agentStairsCell.walkable,
            explored: agentStairsCell.explored,
            searched: agentStairsCell.searched || 0
        });
    }

    // Check if agent's level.stairsDown array has this
    console.log(`Agent's stairsDown array:`, level.stairsDown);

    // Check what the screen shows at the stairs location
    const screenCell = agent.screen?.grid?.[stairsPos.y]?.[stairsPos.x];
    if (screenCell) {
        console.log(`Screen buffer at stairs:`, {
            ch: screenCell.ch,
            charCode: screenCell.ch?.charCodeAt(0),
            color: screenCell.color
        });
    }

    // Check if stairs are reachable
    const pathToStairs = findPath(level, pos.x, pos.y, stairsPos.x, stairsPos.y);
    console.log(`Path to stairs: ${pathToStairs.found ? `FOUND (cost ${pathToStairs.cost})` : 'NOT FOUND'}`);

    if (!pathToStairs.found) {
        // Try with allowUnexplored
        const pathUnexplored = findPath(level, pos.x, pos.y, stairsPos.x, stairsPos.y, { allowUnexplored: true });
        console.log(`Path (allow unexplored): ${pathUnexplored.found ? `FOUND (cost ${pathUnexplored.cost})` : 'NOT FOUND'}`);
    }
} else {
    console.log(`ERROR: Could not find downstairs in game map!`);
}

// Analyze what's blocking exploration
console.log(`\n--- Blocking Analysis ---`);

// Count different cell types the agent sees
const typeCounts = {};
for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 80; x++) {
        const cell = level.at(x, y);
        if (cell && cell.explored) {
            typeCounts[cell.type] = (typeCounts[cell.type] || 0) + 1;
        }
    }
}

console.log(`\nAgent's explored cell types:`);
for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
}

// Check for secret doors in the actual map
console.log(`\n--- Secret Door Analysis ---`);
let secretDoorCount = 0;
const secretDoorLocations = [];

for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
        let cell;
        if (map.at) {
            cell = map.at(x, y);
        } else if (map.cells && map.cells[y]) {
            cell = map.cells[y][x];
        } else if (map[y]) {
            cell = map[y][x];
        }

        // typ 8 is SDOOR (secret door), typ 7 is DOOR
        if (cell && cell.typ === 8) {
            secretDoorCount++;
            const agentCell = level.at(x, y);
            const agentKnows = agentCell && agentCell.explored && agentCell.type !== 'wall';
            secretDoorLocations.push({
                x, y,
                discovered: agentKnows,
                searched: agentCell?.searched || 0
            });
        }
    }
}

console.log(`Total secret doors in map: ${secretDoorCount}`);
console.log(`Discovered by agent: ${secretDoorLocations.filter(d => d.discovered).length}`);

if (secretDoorLocations.length > 0) {
    console.log(`\nSecret door locations:`);
    for (const door of secretDoorLocations) {
        const status = door.discovered ? '✓ FOUND' : `✗ UNDISCOVERED (searched ${door.searched}x)`;
        console.log(`  (${door.x}, ${door.y}): ${status}`);
    }
}

// Find closest undiscovered secret door to player
if (secretDoorLocations.some(d => !d.discovered)) {
    const undiscovered = secretDoorLocations.filter(d => !d.discovered);
    undiscovered.sort((a, b) => {
        const distA = Math.abs(a.x - pos.x) + Math.abs(a.y - pos.y);
        const distB = Math.abs(b.x - pos.x) + Math.abs(b.y - pos.y);
        return distA - distB;
    });

    const closest = undiscovered[0];
    const dist = Math.abs(closest.x - pos.x) + Math.abs(closest.y - pos.y);
    console.log(`\nClosest undiscovered secret door: (${closest.x}, ${closest.y}), distance ${dist}`);

    // Can agent reach it?
    const pathToDoor = findPath(level, pos.x, pos.y, closest.x, closest.y);
    console.log(`Path to secret door: ${pathToDoor.found ? `FOUND (cost ${pathToDoor.cost})` : 'NOT REACHABLE with current knowledge'}`);
}

// Summary
console.log(`\n=== DIAGNOSIS ===`);
if (!stairsPos) {
    console.log(`PROBLEM: Downstairs not found in map (map generation issue?)`);
} else if (!agentStairsCell?.explored) {
    if (secretDoorLocations.some(d => !d.discovered)) {
        console.log(`PROBLEM: Agent hasn't discovered secret doors blocking path to downstairs`);
        console.log(`SOLUTION NEEDED: Better secret door search strategy`);
    } else {
        console.log(`PROBLEM: Downstairs exist but agent hasn't explored that area`);
        console.log(`SOLUTION NEEDED: Better exploration coverage`);
    }
} else {
    console.log(`PROBLEM: Agent knows about stairs but can't path to them`);
    console.log(`SOLUTION NEEDED: Check pathfinding or obstacle detection`);
}
