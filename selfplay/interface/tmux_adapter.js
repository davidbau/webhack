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

// Tmux socket name for isolated sessions (prevents interference with human tmux usage)
const TMUX_SOCKET = 'selfplay';

// Default delay after sending keys (ms)
const DEFAULT_KEY_DELAY = 80;
const STARTUP_DELAY = 500;

// ANSI to NetHack color mapping
// NetHack uses 16 colors: 0-7 are normal, 8-15 are bright variants
const ANSI_TO_NETHACK_COLOR = {
    30: 0,  // black
    31: 1,  // red
    32: 2,  // green
    33: 3,  // brown/yellow
    34: 4,  // blue
    35: 5,  // magenta
    36: 6,  // cyan
    37: 7,  // gray/white
    90: 8,  // bright black (dark gray)
    91: 9,  // bright red
    92: 10, // bright green
    93: 11, // bright yellow
    94: 12, // bright blue
    95: 13, // bright magenta
    96: 14, // bright cyan
    97: 15, // bright white
};

/**
 * Parse a line with ANSI escape sequences into an array of {ch, color} cells.
 * ANSI SGR (Select Graphic Rendition) sequences look like: \x1b[31m (red), \x1b[0m (reset)
 *
 * @param {string} line - Line with ANSI escape sequences
 * @param {number} maxCols - Maximum number of columns to output
 * @returns {Array} Array of {ch, color} objects
 */
function parseAnsiLine(line, maxCols) {
    const cells = [];
    let currentColor = 7; // default gray
    let currentBright = false;
    let i = 0;

    while (i < line.length && cells.length < maxCols) {
        // Check for ANSI escape sequence: ESC [ ... m
        if (line[i] === '\x1b' && line[i + 1] === '[') {
            // Find the end of the escape sequence (ends with 'm')
            let j = i + 2;
            while (j < line.length && line[j] !== 'm') j++;

            if (j < line.length) {
                // Parse the SGR parameters
                const params = line.slice(i + 2, j).split(';').map(p => parseInt(p) || 0);

                for (const param of params) {
                    if (param === 0) {
                        // Reset to default
                        currentColor = 7;
                        currentBright = false;
                    } else if (param === 1) {
                        // Bright/bold - affects current and future colors
                        currentBright = true;
                        if (currentColor < 8) {
                            currentColor += 8; // Make current color bright
                        }
                    } else if (param >= 30 && param <= 37) {
                        // Foreground color
                        currentColor = ANSI_TO_NETHACK_COLOR[param];
                        if (currentBright) {
                            currentColor += 8; // Apply bright if flag is set
                        }
                    } else if (param >= 90 && param <= 97) {
                        // Bright foreground color (already bright)
                        currentColor = ANSI_TO_NETHACK_COLOR[param];
                    }
                    // Ignore background colors (40-47, 100-107) and other SGR codes
                }

                i = j + 1; // Skip past the 'm'
                continue;
            }
        }

        // Regular character
        cells.push({ ch: line[i], color: currentColor });
        i++;
    }

    // Pad to maxCols if needed
    while (cells.length < maxCols) {
        cells.push({ ch: ' ', color: 7 });
    }

    return cells;
}

/**
 * Adapter for the C NetHack binary via tmux.
 */
export class TmuxAdapter extends GameAdapter {
    constructor(options = {}) {
        super();
        this.sessionName = options.sessionName || `nethack-agent-${Date.now()}`;
        this.keyDelay = options.keyDelay || DEFAULT_KEY_DELAY;
        this.symset = options.symset || 'ASCII'; // 'ASCII' or 'DECgraphics'
        this._running = false;
        this._homeDir = null;
        this.isTmux = true;
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
        const rngLogPath = options.rngLogPath || null;

        // Set up a temporary home directory with .nethackrc
        this._homeDir = join(PROJECT_ROOT, 'selfplay', '.nethack-home');
        mkdirSync(this._homeDir, { recursive: true });

        const nethackrc = join(this._homeDir, '.nethackrc');
        const rcOptions = [
            `OPTIONS=name:${name}`,
            `OPTIONS=race:${race}`,
            `OPTIONS=role:${role}`,
            `OPTIONS=gender:${gender}`,
            `OPTIONS=align:${align}`,
            'OPTIONS=!autopickup',
            'OPTIONS=!tutorial',
            'OPTIONS=suppress_alert:3.4.3',
        ];

        // Add symbol set if specified
        if (this.symset === 'DECgraphics') {
            rcOptions.push('OPTIONS=symset:DECgraphics');
        }

        writeFileSync(nethackrc, rcOptions.join('\n') + '\n');

        // Clean up stale game state
        this._cleanGameState();

        // Kill any existing tmux session with the same name
        try { execSync(`tmux -L ${TMUX_SOCKET} kill-session -t ${this.sessionName} 2>/dev/null`); } catch {}

        // Create tmux session with nethack
        const env = {
            HOME: this._homeDir,
            NETHACK_SEED: String(seed),
            NETHACKDIR: INSTALL_DIR,
            TERM: 'xterm-256color',
        };
        if (rngLogPath) {
            env.NETHACK_RNGLOG = rngLogPath;
        }

        const envStr = Object.entries(env).map(([k, v]) => `${k}=${v}`).join(' ');
        execSync(`tmux -L ${TMUX_SOCKET} new-session -d -s ${this.sessionName} -x ${TERMINAL_COLS} -y ${TERMINAL_ROWS} "env ${envStr} ${NETHACK_BINARY} -u ${name} -D"`);

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
            execSync(`tmux -L ${TMUX_SOCKET} send-keys -t ${this.sessionName} Escape`);
        } else if (ch === '\r' || ch === '\n') {
            execSync(`tmux -L ${TMUX_SOCKET} send-keys -t ${this.sessionName} Enter`);
        } else {
            // Use -l for literal key sending
            execSync(`tmux -L ${TMUX_SOCKET} send-keys -t ${this.sessionName} -l "${ch.replace(/"/g, '\\"')}"`);
        }

        await sleep(this.keyDelay);
    }

    /**
     * Read the current screen state.
     * Returns a 24x80 grid of {ch, color}.
     */
    async readScreen() {
        try {
            // Use -e flag to capture with ANSI escape sequences (preserves colors and Unicode)
            const output = execSync(
                `tmux -L ${TMUX_SOCKET} capture-pane -t ${this.sessionName} -p -e -S 0 -E ${TERMINAL_ROWS - 1}`,
                { encoding: 'utf-8', timeout: 5000 }
            );

            const lines = output.split('\n');
            const grid = [];

            for (let r = 0; r < TERMINAL_ROWS; r++) {
                grid[r] = [];
                const line = lines[r] || '';
                const cells = parseAnsiLine(line, TERMINAL_COLS);

                for (let c = 0; c < TERMINAL_COLS; c++) {
                    grid[r][c] = cells[c] || { ch: ' ', color: 7 };
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
            execSync(`tmux -L ${TMUX_SOCKET} has-session -t ${this.sessionName} 2>/dev/null`);
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
            execSync(`tmux -L ${TMUX_SOCKET} kill-session -t ${this.sessionName} 2>/dev/null`);
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
