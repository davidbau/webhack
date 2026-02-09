// selfplay/interface/tmux_adapter.js -- C NetHack via tmux
//
// Interfaces the agent with the C NetHack binary by running it in a tmux
// session, sending keystrokes via `tmux send-keys`, and reading the screen
// via `tmux capture-pane`.

import { GameAdapter } from './adapter.js';
import { execSync, spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const INSTALL_DIR = join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir');
const NETHACK_BINARY = join(INSTALL_DIR, 'nethack');
const RESULTS_DIR = join(PROJECT_ROOT, 'nethack-c', 'install', 'games', 'lib', 'nethackdir'); // HOME for nethack

const TERMINAL_ROWS = 24;
const TERMINAL_COLS = 80;

// Default delay after sending keys (ms)
const DEFAULT_KEY_DELAY = 80;
const STARTUP_DELAY = 500;

/**
 * Adapter for the C NetHack binary via tmux.
 */
export class TmuxAdapter extends GameAdapter {
    constructor(options = {}) {
        super();
        this.sessionName = options.sessionName || `nethack-agent-${Date.now()}`;
        this.keyDelay = options.keyDelay || DEFAULT_KEY_DELAY;
        this._running = false;
        this._homeDir = null;
    }

    /**
     * Start a new game session.
     * Creates a tmux session, configures .nethackrc, and launches nethack.
     */
    async start(options = {}) {
        const seed = options.seed || Math.floor(Math.random() * 100000);
        const role = options.role || 'Valkyrie';
        const race = options.race || 'human';
        const name = options.name || 'Agent';
        const gender = options.gender || 'female';
        const align = options.align || 'neutral';

        // Set up a temporary home directory with .nethackrc
        this._homeDir = join(PROJECT_ROOT, 'selfplay', '.nethack-home');
        mkdirSync(this._homeDir, { recursive: true });

        const nethackrc = join(this._homeDir, '.nethackrc');
        writeFileSync(nethackrc, [
            `OPTIONS=name:${name}`,
            `OPTIONS=race:${race}`,
            `OPTIONS=role:${role}`,
            `OPTIONS=gender:${gender}`,
            `OPTIONS=align:${align}`,
            'OPTIONS=!autopickup',
            'OPTIONS=!tutorial',
            'OPTIONS=suppress_alert:3.4.3',
            // No symset — use default ASCII (|, -, ., #).
            // DECgraphics and IBMgraphics use special chars lost by tmux capture.
        ].join('\n') + '\n');

        // Clean up stale game state
        this._cleanGameState();

        // Kill any existing tmux session with the same name
        try { execSync(`tmux kill-session -t ${this.sessionName} 2>/dev/null`); } catch {}

        // Create tmux session with nethack
        const env = {
            HOME: this._homeDir,
            NETHACK_SEED: String(seed),
            NETHACKDIR: INSTALL_DIR,
            TERM: 'xterm-256color',
        };

        const envStr = Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ');
        execSync(`tmux new-session -d -s ${this.sessionName} -x ${TERMINAL_COLS} -y ${TERMINAL_ROWS} "env ${envStr} ${NETHACK_BINARY} -u ${name} -D"`);

        // Wait for game to start
        await sleep(STARTUP_DELAY);
        this._running = true;

        // Skip through character selection if needed
        await this._skipChargen();
    }

    /**
     * Send a keystroke to the game.
     */
    async sendKey(key) {
        if (!this._running) return;

        const ch = typeof key === 'number' ? String.fromCharCode(key) : key;

        // Handle special keys
        if (ch === '\x1b') {
            execSync(`tmux send-keys -t ${this.sessionName} Escape`);
        } else if (ch === '\r' || ch === '\n') {
            execSync(`tmux send-keys -t ${this.sessionName} Enter`);
        } else {
            // Use -l for literal key sending
            execSync(`tmux send-keys -t ${this.sessionName} -l "${ch.replace(/"/g, '\\"')}"`);
        }

        await sleep(this.keyDelay);
    }

    /**
     * Read the current screen state.
     * Returns a 24x80 grid of {ch, color}.
     */
    async readScreen() {
        try {
            const output = execSync(
                `tmux capture-pane -t ${this.sessionName} -p -S 0 -E ${TERMINAL_ROWS - 1}`,
                { encoding: 'utf-8', timeout: 5000 }
            );

            const lines = output.split('\n');
            const grid = [];

            for (let r = 0; r < TERMINAL_ROWS; r++) {
                grid[r] = [];
                const line = (lines[r] || '').padEnd(TERMINAL_COLS, ' ');
                for (let c = 0; c < TERMINAL_COLS; c++) {
                    // tmux capture-pane in plain mode doesn't give us colors,
                    // so we use default gray (7). For a color-aware version,
                    // we'd need tmux capture-pane -e for escape sequences.
                    grid[r][c] = { ch: line[c] || ' ', color: 7 };
                }
            }

            return grid;
        } catch (e) {
            return null;
        }
    }

    /**
     * Check if the game is still running.
     */
    async isRunning() {
        if (!this._running) return false;
        try {
            execSync(`tmux has-session -t ${this.sessionName} 2>/dev/null`);
            // Also check the screen for game-over indicators
            const grid = await this.readScreen();
            if (grid) {
                const fullScreen = grid.map(row => row.map(c => c.ch).join('')).join('\n');
                // Detect various game-over screens
                if (fullScreen.includes('Do you want your possessions identified') ||
                    fullScreen.includes('Goodbye') ||
                    fullScreen.includes('Really quit') ||
                    fullScreen.includes('STRSTRSTR')) {
                    return false;
                }
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Stop the game session.
     */
    async stop() {
        this._running = false;
        try {
            execSync(`tmux kill-session -t ${this.sessionName} 2>/dev/null`);
        } catch {}
    }

    /**
     * Skip through character generation screens.
     * The .nethackrc should auto-select character, but there may be
     * confirmation prompts.
     */
    async _skipChargen() {
        // Wait a bit then check what's on screen
        await sleep(300);

        // Dismiss intro story, --More-- prompts, and character selection
        // The C game shows a multi-page intro story with --More-- on various rows,
        // then welcome messages with --More-- on row 0.
        for (let i = 0; i < 20; i++) {
            const g = await this.readScreen();
            if (!g) break;

            // Check ALL rows for --More-- (intro story puts it mid-screen)
            let foundMore = false;
            for (let r = 0; r < TERMINAL_ROWS; r++) {
                const line = g[r].map(c => c.ch).join('');
                if (line.includes('--More--')) {
                    foundMore = true;
                    break;
                }
            }

            if (foundMore) {
                await this.sendKey(' ');
                await sleep(300);
                continue;
            }

            // Check for "Shall I pick..." prompt
            const row0 = g[0].map(c => c.ch).join('');
            if (row0.includes('Shall I pick')) {
                await this.sendKey('y');
                await sleep(200);
                continue;
            }

            // Check if we see a map (player @ visible or dungeon features) — we're in the game
            const fullScreen = g.map(row => row.map(c => c.ch).join('')).join('');
            if (fullScreen.includes('@')) {
                break; // We're in the game
            }

            // Check for any [ynq] prompts
            if (row0.match(/\[yn/)) {
                await this.sendKey('y');
                await sleep(200);
                continue;
            }

            // If status line is present (HP: on row 23), we're likely in-game
            const row23 = g[23].map(c => c.ch).join('');
            if (row23.includes('HP:')) {
                break;
            }

            // Otherwise wait a bit and try again
            await sleep(200);
        }
    }

    /**
     * Clean up stale game state files.
     */
    _cleanGameState() {
        try {
            const saveDir = join(INSTALL_DIR, 'save');
            if (existsSync(saveDir)) {
                for (const f of readdirSync(saveDir)) {
                    unlinkSync(join(saveDir, f));
                }
            }
            // Remove lock files and level files
            if (existsSync(INSTALL_DIR)) {
                for (const f of readdirSync(INSTALL_DIR)) {
                    if (f.includes('Agent') || f.includes('agent') || f.includes('Wizard')) {
                        if (!f.endsWith('.lua')) {
                            try { unlinkSync(join(INSTALL_DIR, f)); } catch {}
                        }
                    }
                }
            }
        } catch {}
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
