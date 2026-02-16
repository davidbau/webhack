#!/usr/bin/env node
// selfplay/runner/headless_runner.js -- Run the AI agent against the JS port headlessly

import { Agent } from '../agent.js';
import { roles } from '../../js/player.js';
import { buildInventoryLines, createHeadlessGame } from '../../js/headless_runtime.js';

/**
 * Adapter that drives the shared headless runtime.
 */
export class HeadlessAdapter {
    constructor(game) {
        this.game = game;
        this._running = true;
        this.stripColors = false;
    }

    async start() {
        this._running = true;
    }

    _pushKeyCode(code) {
        const input = this.game?.input;
        if (input && typeof input.pushInput === 'function') {
            input.pushInput(code);
        }
    }

    async sendKey(key) {
        if (!this._running) return;

        // Some commands block on follow-up prompts. Arm a fallback that feeds
        // safe dismiss keys if execution stalls.
        let rescueTimer = null;
        let rescueInterval = null;
        const armRescue = () => {
            rescueInterval = setInterval(() => {
                this._pushKeyCode(27); // ESC
                this._pushKeyCode('n'.charCodeAt(0));
                this._pushKeyCode('\n'.charCodeAt(0));
                this._pushKeyCode(' '.charCodeAt(0));
            }, 20);
        };

        try {
            rescueTimer = setTimeout(armRescue, 300);
            await this.game.executeCommand(key);
        } finally {
            if (rescueTimer) clearTimeout(rescueTimer);
            if (rescueInterval) clearInterval(rescueInterval);
        }
    }

    queueInput(key) {
        const ch = typeof key === 'number' ? key : key.charCodeAt(0);
        this._pushKeyCode(ch);
    }

    async getInventoryLines() {
        return buildInventoryLines(this.game.player);
    }

    async readScreen() {
        const display = this.game?.display;
        if (!display || !Array.isArray(display.grid)) return [];

        const rows = display.rows || 24;
        const cols = display.cols || 80;
        const screen = [];
        for (let r = 0; r < rows; r++) {
            screen[r] = [];
            for (let c = 0; c < cols; c++) {
                const ch = display.grid?.[r]?.[c] || ' ';
                const color = this.stripColors
                    ? 7
                    : (display.colors?.[r]?.[c] ?? 7);
                screen[r][c] = { ch, color };
            }
        }
        return screen;
    }

    async isRunning() {
        return this._running && !this.game.gameOver;
    }

    async stop() {
        this._running = false;
    }
}

/**
 * Run the agent headlessly.
 */
export async function runHeadless(options = {}) {
    const seed = Number.isInteger(options.seed)
        ? options.seed
        : Math.floor(Math.random() * 100000);
    const maxTurns = Number.isInteger(options.maxTurns) ? options.maxTurns : 1000;
    const verbose = !!options.verbose;
    const roleIndex = Number.isInteger(options.roleIndex) ? options.roleIndex : 11; // Valkyrie
    const userOnTurn = options.onTurn || null;
    const dumpMaps = options.dumpMaps !== false;

    if (verbose) {
        const roleName = roles[roleIndex]?.name || `role#${roleIndex}`;
        console.log(`Starting headless game: seed=${seed}, maxTurns=${maxTurns}, role=${roleName}`);
    }

    const game = createHeadlessGame(seed, roleIndex, {
        name: options.name || 'Agent',
        wizard: !!options.wizard,
        flags: options.flags,
        DECgraphics: options.DECgraphics,
    });

    const adapter = new HeadlessAdapter(game);
    if (options.colorless) {
        adapter.stripColors = true;
    }

    const onPerceive = options.onPerceive
        ? (info) => options.onPerceive({ ...info, game, adapter })
        : null;

    const agent = new Agent(adapter, {
        maxTurns,
        onPerceive,
        onTurn: (info) => {
            if (verbose) {
                const act = info.action;
                const actionStr = act ? `${act.type}(${act.key}): ${act.reason}` : '?';
                if (info.turn <= 50 || info.turn % 50 === 0 || info.turn % 100 === 0) {
                    console.log(`  Turn ${info.turn}: HP=${info.hp}/${info.hpmax} Dlvl=${info.dlvl} pos=(${info.position?.x},${info.position?.y}) ${actionStr}`);
                }
            }
            if (userOnTurn) {
                userOnTurn(info);
            }
        },
    });

    // Dump the agent's known map at specific turns for debugging.
    const origOnTurn = agent.onTurn;
    agent.onTurn = (info) => {
        if (origOnTurn) origOnTurn(info);
        if (dumpMaps && (info.turn === 50 || info.turn === 200)) {
            dumpAgentMap(agent, info.turn);
        }
    };

    const stats = await agent.run();

    if (verbose) {
        console.log(`\nGame over after ${stats.turns} turns:`);
        console.log(`  Max depth: ${stats.maxDepth}`);
        console.log(`  Death cause: ${stats.deathCause || 'survived'}`);
    }

    return {
        seed,
        stats,
        game,
        agent,
    };
}

// --- CLI entry point ---
if (process.argv[1] && process.argv[1].endsWith('headless_runner.js')) {
    const args = process.argv.slice(2);
    const opts = {};

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
                continue;
            }
        }

        // Handle --key value format
        if (arg === '--seed' && args[i + 1]) opts.seed = parseInt(args[++i]);
        else if (arg === '--turns' && args[i + 1]) opts.maxTurns = parseInt(args[++i]);
        else if (arg === '--verbose' || arg === '-v') opts.verbose = true;
        else if (arg === '--help' || arg === '-h') {
            console.log('Usage: node headless_runner.js [--seed N] [--turns N] [--verbose]');
            process.exit(0);
        }
    }

    opts.verbose = opts.verbose !== false;
    runHeadless(opts).then(result => {
        console.log(`\nFinal: seed=${result.seed} turns=${result.stats.turns} maxDepth=${result.stats.maxDepth}`);
    }).catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
}

/**
 * Dump the agent's known map for debugging.
 * Shows explored cells, frontier cells, and the player position.
 */
function dumpAgentMap(agent, turn) {
    const level = agent.dungeon.currentLevel;
    const px = agent.screen?.playerX ?? -1;
    const py = agent.screen?.playerY ?? -1;
    console.log(`\n=== Agent Map at Turn ${turn} (Dlvl ${agent.dungeon.currentDepth}) ===`);
    // Find bounding box of explored area
    let minX = 80; let maxX = 0; let minY = 21; let maxY = 0;
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
    // Add margin
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
            row += cell.ch === ' ' ? '.' : cell.ch; // show stone-marked cells as '.'
        }
        console.log(`  ${String(y).padStart(2)}| ${row}`);
    }
    // Show stairs and features
    console.log(`  Stairs up: ${JSON.stringify(level.stairsUp)}`);
    console.log(`  Stairs down: ${JSON.stringify(level.stairsDown)}`);
    console.log(`  Frontier cells: ${level.getExplorationFrontier().length}`);
    console.log(`  Explored cells: ${level.exploredCount}`);
    if (agent.committedTarget) {
        console.log(`  Committed target: (${agent.committedTarget.x}, ${agent.committedTarget.y})`);
    }
    console.log('');
}
