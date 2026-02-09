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
    if (args[i] === '--seed' && args[i + 1]) opts.seed = parseInt(args[++i]);
    else if (args[i] === '--turns' && args[i + 1]) opts.maxTurns = parseInt(args[++i]);
    else if (args[i] === '--delay' && args[i + 1]) opts.moveDelay = parseInt(args[++i]);
    else if (args[i] === '--key-delay' && args[i + 1]) opts.keyDelay = parseInt(args[++i]);
    else if (args[i] === '--verbose' || args[i] === '-v') opts.verbose = true;
    else if (args[i] === '--quiet' || args[i] === '-q') opts.verbose = false;
    else if (args[i] === '--help' || args[i] === '-h') {
        console.log('Usage: node c_runner.js [--seed N] [--turns N] [--verbose] [--delay MS]');
        console.log('  --seed N       PRNG seed for deterministic games (default: 42)');
        console.log('  --turns N      Maximum turns to play (default: 200)');
        console.log('  --delay MS     Delay between agent moves in ms (default: 0)');
        console.log('  --key-delay MS Delay after each tmux keystroke in ms (default: 60)');
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
