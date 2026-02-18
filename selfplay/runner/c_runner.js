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
    role: 'Valkyrie',
    symset: 'ASCII', // 'ASCII' or 'DECgraphics'
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
            else if (key === '--role') opts.role = value;
            else if (key === '--graphics') opts.symset = value === 'dec' ? 'DECgraphics' : 'ASCII';
            continue;
        }
    }

    // Handle --key value format (original code)
    if (arg === '--seed' && args[i + 1]) opts.seed = parseInt(args[++i]);
    else if (arg === '--turns' && args[i + 1]) opts.maxTurns = parseInt(args[++i]);
    else if (arg === '--delay' && args[i + 1]) opts.moveDelay = parseInt(args[++i]);
    else if (arg === '--key-delay' && args[i + 1]) opts.keyDelay = parseInt(args[++i]);
    else if (arg === '--role' && args[i + 1]) opts.role = args[++i];
    else if (arg === '--graphics' && args[i + 1]) {
        const val = args[++i];
        opts.symset = val === 'dec' ? 'DECgraphics' : 'ASCII';
    }
    else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--quiet' || arg === '-q') opts.verbose = false;
    else if (arg === '--help' || arg === '-h') {
        console.log('Usage: node c_runner.js [--seed=N] [--turns=N] [--verbose] [--delay=MS]');
        console.log('  --seed=N         PRNG seed for deterministic games (default: 42)');
        console.log('  --turns=N        Maximum turns to play (default: 200)');
        console.log('  --delay=MS       Delay between agent moves in ms (default: 0)');
        console.log('  --key-delay=MS   Delay after each tmux keystroke in ms (default: 60)');
        console.log('  --role=ROLE      Character role/class (default: Valkyrie)');
        console.log('  --graphics=MODE  Symbol set: ascii or dec (DECgraphics) (default: ascii)');
        console.log('  --verbose/-v     Verbose output (default: on)');
        console.log('  --quiet/-q       Suppress verbose output');
        process.exit(0);
    }
}

const runnerLog = console.log.bind(console);
const originalConsoleLog = console.log;
let logsSilenced = false;

function silenceAgentLogs() {
    if (!logsSilenced) {
        console.log = () => {};
        logsSilenced = true;
    }
}

function restoreLogs() {
    if (logsSilenced) {
        console.log = originalConsoleLog;
        logsSilenced = false;
    }
}

runnerLog(`NetHack AI Agent vs C Binary`);
runnerLog(`  Seed: ${opts.seed}`);
runnerLog(`  Max turns: ${opts.maxTurns}`);
runnerLog(`  Role: ${opts.role}`);
runnerLog(`  Key delay: ${opts.keyDelay}ms`);
runnerLog(`  Symbol set: ${opts.symset}`);
runnerLog('');

const adapter = new TmuxAdapter({
    keyDelay: opts.keyDelay,
    symset: opts.symset,
});

try {
    runnerLog('Starting C NetHack in tmux...');
    await adapter.start({
        seed: opts.seed,
        role: opts.role,
        race: 'human',
        name: 'Agent',
        gender: 'female',
        align: 'neutral',
    });

    runnerLog('Game started. Running agent...');
    runnerLog('');

    const progression = {
        maxXL: 0,
        maxXP: 0,
        firstXL2Turn: null,
        firstXL3Turn: null,
        xpAt100: null,
        xpAt200: null,
        xpAt400: null,
        xpAt600: null,
        lastObservedXP: 0,
    };

    const agent = new Agent(adapter, {
        maxTurns: opts.maxTurns,
        moveDelay: opts.moveDelay,
        onTurn: (info) => {
            const xl = info.xl || 0;
            const xp = info.xp || 0;
            if (xl > progression.maxXL) progression.maxXL = xl;
            if (xp > progression.maxXP) progression.maxXP = xp;
            if (xl >= 2 && progression.firstXL2Turn === null) progression.firstXL2Turn = info.turn;
            if (xl >= 3 && progression.firstXL3Turn === null) progression.firstXL3Turn = info.turn;
            progression.lastObservedXP = xp;
            if (progression.xpAt100 === null && info.turn >= 100) progression.xpAt100 = xp;
            if (progression.xpAt200 === null && info.turn >= 200) progression.xpAt200 = xp;
            if (progression.xpAt400 === null && info.turn >= 400) progression.xpAt400 = xp;
            if (progression.xpAt600 === null && info.turn >= 600) progression.xpAt600 = xp;

            if (!opts.verbose) return;
            if (info.turn % 20 === 0 || info.turn <= 10) {
                const act = info.action;
                const actionStr = act ? `${act.type}(${act.key}): ${act.reason}` : '?';
                console.log(`  Turn ${info.turn}: HP=${info.hp}/${info.hpmax} Dlvl=${info.dlvl} XL=${info.xl ?? '?'} XP=${info.xp ?? '?'} pos=(${info.position?.x},${info.position?.y}) ${actionStr}`);
            }
            // Dump agent map at intervals for diagnostics
            if (info.turn === 50 || info.turn === 100 || info.turn === 200 || info.turn % 200 === 0) {
                dumpAgentMap(agent, info.turn);
            }
        },
    });

    if (!opts.verbose) silenceAgentLogs();
    const stats = await agent.run();
    restoreLogs();
    const finalStatus = agent.status;
    const finalXP = finalStatus?.xpPoints ?? progression.lastObservedXP ?? 0;
    const xpAt100 = progression.xpAt100 ?? finalXP;
    const xpAt200 = progression.xpAt200 ?? finalXP;
    const xpAt400 = progression.xpAt400 ?? finalXP;
    const xpAt600 = progression.xpAt600 ?? finalXP;

    runnerLog('');
    runnerLog(`Game ended after ${stats.turns} turns:`);
    runnerLog(`  Max depth reached: ${stats.maxDepth}`);
    runnerLog(`  Death cause: ${stats.deathCause || 'survived'}`);
    runnerLog(`  XP progression: maxXL=${Math.max(stats.maxXpLevel || 0, progression.maxXL)} maxXP=${Math.max(stats.maxXpPoints || 0, progression.maxXP)} XL2_turn=${stats.firstXpLevel2Turn ?? progression.firstXL2Turn ?? 'never'} XL3_turn=${stats.firstXpLevel3Turn ?? progression.firstXL3Turn ?? 'never'}`);
    runnerLog(`  XP checkpoints: t100=${xpAt100} t200=${xpAt200} t400=${xpAt400} t600=${xpAt600}`);
    runnerLog(`  Explore telemetry: assign=${stats.targetAssignments ?? 0} reassign=${stats.targetReassignments ?? 0} complete=${stats.targetCompletions ?? 0} abandonInvalid=${stats.targetAbandonsInvalid ?? 0} abandonNoPath=${stats.targetAbandonsNoPath ?? 0} abandonNoProgress=${stats.targetAbandonsNoProgress ?? 0} failedAdd=${stats.failedTargetAdds ?? 0} failedClear=${stats.failedTargetClears ?? 0} frontierResets=${stats.systematicFrontierResets ?? 0} doorOpen=${stats.doorOpenAttempts ?? 0} doorKick=${stats.doorKickAttempts ?? 0}`);
    if (finalStatus) {
        const hunger = finalStatus.fainting ? 'fainting'
            : finalStatus.weak ? 'weak'
            : finalStatus.hungry ? 'hungry'
            : finalStatus.satiated ? 'satiated'
            : 'normal';
        const debuffs = [
            finalStatus.blind ? 'blind' : null,
            finalStatus.confused ? 'confused' : null,
            finalStatus.stunned ? 'stunned' : null,
            finalStatus.hallucinating ? 'hallucinating' : null,
            finalStatus.ill ? 'ill' : null,
            finalStatus.foodPoisoned ? 'foodpoison' : null,
            finalStatus.slimed ? 'slimed' : null,
        ].filter(Boolean);
        const debuffStr = debuffs.length > 0 ? debuffs.join(',') : 'none';
        const strength = finalStatus.strExtra > 0 ? `${finalStatus.str}/${finalStatus.strExtra}` : `${finalStatus.str}`;
        runnerLog(`  Final status: HP=${finalStatus.hp}/${finalStatus.hpmax} AC=${finalStatus.ac} Dlvl=${finalStatus.dungeonLevel} XL=${finalStatus.xpLevel} XP=${finalStatus.xpPoints} Gold=${finalStatus.gold} Hunger=${hunger} Turn=${finalStatus.turns || stats.turns}`);
        runnerLog(`  Final attributes: St=${strength} Dx=${finalStatus.dex} Co=${finalStatus.con} In=${finalStatus.int} Wi=${finalStatus.wis} Ch=${finalStatus.cha} Align=${finalStatus.alignment || 'unknown'} Debuffs=${debuffStr}`);
    }

} catch (err) {
    restoreLogs();
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
} finally {
    restoreLogs();
    runnerLog('\nCleaning up tmux session...');
    await adapter.stop();
    runnerLog('Done.');
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
