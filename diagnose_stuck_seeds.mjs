#!/usr/bin/env node
/**
 * Diagnose why seeds 22222 and 44444 are stuck at Dlvl 1
 *
 * Logs exploration behavior to understand pathfinding issues
 */

import { HeadlessGame, HeadlessAdapter } from './selfplay/runner/headless_runner.js';
import { Agent } from './selfplay/agent.js';
import { findPath } from './selfplay/brain/pathing.js';

const SEED = parseInt(process.argv[2]) || 22222;
const MAX_TURNS = 500;
const ROLE_INDEX = 12; // Wizard

console.log(`=== Diagnosing Stuck Seed ${SEED} ===\n`);

// Track exploration metrics
const actionCounts = {};
const positionHistory = [];

// Create game and agent
const game = new HeadlessGame(SEED, ROLE_INDEX);
const adapter = new HeadlessAdapter(game);
const agent = new Agent(adapter, {
    maxTurns: MAX_TURNS,
    onTurn: (info) => {
        if (info.turn % 50 === 0) {
            console.log(`Turn ${info.turn}: Dlvl=${info.dlvl}, pos=(${info.position?.x},${info.position?.y})`);
        }

        // Track position for oscillation detection
        if (info.position) {
            positionHistory.push({ x: info.position.x, y: info.position.y, turn: info.turn });
            if (positionHistory.length > 20) {
                positionHistory.shift();
            }
        }

        // Detailed log every 100 turns
        if (info.turn % 100 === 0 && info.turn > 0) {
            const level = agent.dungeon.currentLevel;
            const explored = level.exploredCount;
            const frontier = level.getExplorationFrontier().length;
            const stairs = level.stairsDown.length > 0 ?
                `(${level.stairsDown[0].x},${level.stairsDown[0].y})` : 'NOT FOUND';

            console.log(`\n[Turn ${info.turn}] Status:`);
            console.log(`  Position: (${info.position?.x},${info.position?.y})`);
            console.log(`  Explored: ${explored} cells (${(100*explored/(80*21)).toFixed(1)}%)`);
            console.log(`  Frontier: ${frontier} cells`);
            console.log(`  Downstairs: ${stairs}`);
            console.log(`  Actions:`, Object.entries(actionCounts).map(([k,v]) => `${k}:${v}`).join(', '));
            console.log(`  Stuck counter: ${agent.levelStuckCounter}`);

            // Check for oscillation
            if (positionHistory.length >= 10) {
                const recent = positionHistory.slice(-10);
                const uniquePos = new Set(recent.map(p => `${p.x},${p.y}`));
                if (uniquePos.size <= 3) {
                    console.log(`  ⚠️  OSCILLATING! Only ${uniquePos.size} unique positions in last 10 turns`);
                }
            }

            // If stuck with stairs found, log more details
            if (level.stairsDown.length > 0 && info.turn > 100) {
                const stairs = level.stairsDown[0];
                const stairCell = level.at(stairs.x, stairs.y);
                console.log(`\n  Stairs analysis:`);
                console.log(`    Type: ${stairCell?.type}`);
                console.log(`    Explored: ${stairCell?.explored}`);
                console.log(`    Walkable: ${stairCell?.walkable}`);

                // Try to path to stairs
                const pathToStairs = findPath(level, info.position.x, info.position.y, stairs.x, stairs.y);
                console.log(`    Path from current pos: ${pathToStairs.found ? `cost ${pathToStairs.cost}` : 'NOT FOUND'}`);

                if (!pathToStairs.found) {
                    const pathWithUnexplored = findPath(level, info.position.x, info.position.y, stairs.x, stairs.y, { allowUnexplored: true });
                    console.log(`    Path (allow unexplored): ${pathWithUnexplored.found ? `cost ${pathWithUnexplored.cost}` : 'NOT FOUND'}`);
                }
            }
        }
    }
});

// Patch agent to count action types and log stuck-far messages
const originalAct = agent._act.bind(agent);
agent._act = async function(action) {
    actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;

    // Log when stuck-far strategy activates
    if (action.reason && action.reason.includes('[STUCK-FAR]')) {
        console.log(`Turn ${this.turnNumber}: ${action.reason}`);
    }

    await originalAct.call(this, action);
};

// Run the agent
const stats = await agent.run();

console.log(`\n=== Final Results ===`);
console.log(`Turns: ${stats.turns}`);
console.log(`Max depth: ${stats.maxDepth}`);
console.log(`Died: ${stats.died ? 'yes' : 'no'}`);
console.log(`\nAction breakdown:`);
for (const [type, count] of Object.entries(actionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count} (${(100*count/stats.turns).toFixed(1)}%)`);
}

// Final analysis
const level = agent.dungeon.currentLevel;
if (level.stairsDown.length > 0) {
    const stairs = level.stairsDown[0];
    console.log(`\n⚠️  STUCK with downstairs visible at (${stairs.x},${stairs.y})`);
    console.log(`Final explored: ${level.exploredCount} cells (${(100*level.exploredCount/(80*21)).toFixed(1)}%)`);
} else {
    console.log(`\nDownstairs NOT found in ${level.exploredCount} explored cells`);
}
