#!/usr/bin/env node
// selfplay/runner/c_runner.js -- Run the AI agent against the C NetHack binary
//
// Uses tmux to communicate with the real C game. This lets us:
// 1. Validate agent behavior against the authoritative game
// 2. Collect gameplay traces for comparison testing
// 3. Stress-test the agent in the real game environment
//
// Usage:
//   node selfplay/runner/c_runner.js [--seed N] [--turns N] [--verbose] [--delay MS]

import { Agent } from '../agent.js';
import { TmuxAdapter } from '../interface/tmux_adapter.js';

// --- CLI entry point ---
const args = process.argv.slice(2);
const opts = {
    seed: 42,
    maxTurns: 200,
    verbose: true,
    keyDelay: 60,
    moveDelay: 0,
};

for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle --key=value format
    if (arg.startsWith('--')) {
        const eqIndex = arg.indexOf('=');
        if (eqIndex !== -1) {
            const key = arg.slice(0, eqIndex);
            const value = arg.slice(eqIndex + 1);
            if (key === '--seed') opts.seed = parseInt(value);
            else if (key === '--turns') opts.maxTurns = parseInt(value);
            else if (key === '--delay') opts.moveDelay = parseInt(value);
            else if (key === '--key-delay') opts.keyDelay = parseInt(value);
            continue;
        }
    }

    // Handle --key value format (original code)
    if (arg === '--seed' && args[i + 1]) opts.seed = parseInt(args[++i]);
    else if (arg === '--turns' && args[i + 1]) opts.maxTurns = parseInt(args[++i]);
    else if (arg === '--delay' && args[i + 1]) opts.moveDelay = parseInt(args[++i]);
    else if (arg === '--key-delay' && args[i + 1]) opts.keyDelay = parseInt(args[++i]);
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--quiet' || arg === '-q') opts.verbose = false;
    else if (arg === '--help' || arg === '-h') {
        console.log('Usage: node c_runner.js [--seed=N] [--turns=N] [--verbose] [--delay=MS]');
        console.log('  --seed=N       PRNG seed for deterministic games (default: 42)');
        console.log('  --turns=N      Maximum turns to play (default: 200)');
        console.log('  --delay=MS     Delay between agent moves in ms (default: 0)');
        console.log('  --key-delay=MS Delay after each tmux keystroke in ms (default: 60)');
        console.log('  --verbose/-v   Verbose output (default: on)');
        console.log('  --quiet/-q     Suppress verbose output');
        process.exit(0);
    }
}

console.log(`NetHack AI Agent vs C Binary`);
console.log(`  Seed: ${opts.seed}`);
console.log(`  Max turns: ${opts.maxTurns}`);
console.log(`  Key delay: ${opts.keyDelay}ms`);
console.log('');

const adapter = new TmuxAdapter({
    keyDelay: opts.keyDelay,
});

try {
    console.log('Starting C NetHack in tmux...');
    await adapter.start({
        seed: opts.seed,
        role: 'Valkyrie',
        race: 'human',
        name: 'Agent',
        gender: 'female',
        align: 'neutral',
    });

    console.log('Game started. Running agent...');
    console.log('');

    const agent = new Agent(adapter, {
        maxTurns: opts.maxTurns,
        moveDelay: opts.moveDelay,
        onTurn: opts.verbose ? (info) => {
            if (info.turn % 20 === 0 || info.turn <= 10) {
                const act = info.action;
                const actionStr = act ? `${act.type}(${act.key}): ${act.reason}` : '?';
                console.log(`  Turn ${info.turn}: HP=${info.hp}/${info.hpmax} Dlvl=${info.dlvl} pos=(${info.position?.x},${info.position?.y}) ${actionStr}`);
            }
            // Dump agent map at intervals for diagnostics
            if (info.turn === 50 || info.turn === 100 || info.turn === 200 || info.turn % 200 === 0) {
                dumpAgentMap(agent, info.turn);
            }
        } : null,
    });

    const stats = await agent.run();

    console.log('');
    console.log(`Game ended after ${stats.turns} turns:`);
    console.log(`  Max depth reached: ${stats.maxDepth}`);
    console.log(`  Death cause: ${stats.deathCause || 'survived'}`);

} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
} finally {
    console.log('\nCleaning up tmux session...');
    await adapter.stop();
    console.log('Done.');
}

function dumpAgentMap(agent, turn) {
    const level = agent.dungeon.currentLevel;
    const px = agent.screen?.playerX ?? -1;
    const py = agent.screen?.playerY ?? -1;
    console.log(`\n=== Agent Map at Turn ${turn} (Dlvl ${agent.dungeon.currentDepth}) ===`);
    let minX = 80, maxX = 0, minY = 21, maxY = 0;
    for (let y = 0; y < 21; y++) {
        for (let x = 0; x < 80; x++) {
            if (level.at(x, y).explored) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    minX = Math.max(0, minX - 2);
    maxX = Math.min(79, maxX + 2);
    minY = Math.max(0, minY - 2);
    maxY = Math.min(20, maxY + 2);
    for (let y = minY; y <= maxY; y++) {
        let row = '';
        for (let x = minX; x <= maxX; x++) {
            if (x === px && y === py) { row += '@'; continue; }
            const cell = level.at(x, y);
            if (!cell.explored) { row += ' '; continue; }
            row += cell.ch === ' ' ? '.' : cell.ch;
        }
        console.log(`  ${String(y).padStart(2)}| ${row}`);
    }
    console.log(`  Stairs up: ${JSON.stringify(level.stairsUp)}`);
    console.log(`  Stairs down: ${JSON.stringify(level.stairsDown)}`);
    console.log(`  Frontier cells: ${level.getExplorationFrontier().length}`);
    console.log(`  Explored cells: ${level.exploredCount}`);
    console.log(`  Failed targets: ${agent.failedTargets.size}`);
    if (agent.committedTarget) {
        console.log(`  Committed target: (${agent.committedTarget.x}, ${agent.committedTarget.y})`);
    }
    console.log('');
}
