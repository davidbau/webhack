// selfplay/interface/js_adapter.js -- Direct JS port adapter
//
// Interfaces the agent with the JS NetHack port by hooking directly into
// the game's Display buffer and input queue. Can run headless (no DOM)
// using a HeadlessGame-like approach for maximum speed.
//
// This adapter drives the game by pushing keys into the input queue
// and reading the display grid directly, bypassing the browser entirely.

import { GameAdapter } from './adapter.js';
import { COLNO, ROWNO, MAP_ROW_START, DOOR, STAIRS, SDOOR } from '../../js/config.js';
import { CLR_BLACK, CLR_GRAY, CLR_WHITE, CLR_BROWN, CLR_MAGENTA } from '../../js/display.js';

// Display geometry
const TERMINAL_ROWS = 24;
const TERMINAL_COLS = 80;

/**
 * Adapter for the JS NetHack port.
 *
 * Usage:
 *   const adapter = new JSAdapter(game);
 *   await adapter.start();
 *   const grid = await adapter.readScreen();
 *   await adapter.sendKey('h');
 */
export class JSAdapter extends GameAdapter {
    /**
     * @param {Object} game - A NetHackGame or HeadlessGame instance
     * @param {Object} [options]
     * @param {function} [options.pushInput] - The pushInput function from input.js
     * @param {function} [options.rhack] - The rhack function from commands.js
     * @param {function} [options.movemon] - The movemon function from monmove.js
     */
    constructor(game, options = {}) {
        super();
        this.game = game;
        this.pushInput = options.pushInput || null;
        this.rhack = options.rhack || null;
        this.movemon = options.movemon || null;
        this._running = false;
    }

    async start(options = {}) {
        this._running = true;
    }

    /**
     * Send a keystroke by pushing it into the game's input queue,
     * then executing one game turn (rhack + movemon).
     */
    async sendKey(key) {
        if (!this._running) return;

        const ch = typeof key === 'number' ? key : key.charCodeAt(0);

        if (this.rhack) {
            // Drive the game directly: execute the command
            const result = await this.rhack(ch, this.game);

            // If the command took time, run monster movement
            if (result && result.tookTime && this.movemon) {
                this.movemon(
                    this.game.map,
                    this.game.player,
                    this.game.display,
                    this.game.fov
                );
            }
        } else if (this.pushInput) {
            // Just push the key and let the game's main loop handle it
            this.pushInput(ch);
        }
    }

    /**
     * Read the current screen from the game's display grid.
     * Returns a 24x80 grid of {ch, color}.
     */
    async readScreen() {
        const display = this.game.display;
        if (!display || !display.grid) {
            // Return blank grid if no display
            return makeBlankGrid();
        }

        // The Display.grid is already in the right format: [row][col] = {ch, color}
        // Return a copy to prevent mutation issues
        const grid = [];
        for (let r = 0; r < TERMINAL_ROWS; r++) {
            grid[r] = [];
            for (let c = 0; c < TERMINAL_COLS; c++) {
                const cell = display.grid[r] && display.grid[r][c];
                grid[r][c] = cell ? { ch: cell.ch, color: cell.color } : { ch: ' ', color: 7 };
            }
        }
        return grid;
    }

    async isRunning() {
        return this._running && !this.game.gameOver;
    }

    async stop() {
        this._running = false;
    }
}

/**
 * A minimal display that captures output without DOM rendering.
 * Drop-in replacement for Display in headless mode.
 */
export class HeadlessDisplay {
    constructor() {
        this.cols = TERMINAL_COLS;
        this.rows = TERMINAL_ROWS;
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = { ch: ' ', color: 7 };
            }
        }
        this.messages = [];
        this.topMessage = '';
    }

    setCell(col, row, ch, color) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
        this.grid[row][col] = { ch, color };
    }

    clearRow(row) {
        for (let c = 0; c < this.cols; c++) {
            this.grid[row][c] = { ch: ' ', color: 7 };
        }
    }

    putstr(col, row, str, color = 7) {
        for (let i = 0; i < str.length && col + i < this.cols; i++) {
            this.setCell(col + i, row, str[i], color);
        }
    }

    putstr_message(msg) {
        this.clearRow(0);
        this.putstr(0, 0, msg.substring(0, this.cols), 14); // CLR_WHITE
        this.topMessage = msg;
        if (msg.trim()) this.messages.push(msg);
    }

    async morePrompt() {
        // In headless mode, auto-dismiss --More-- prompts
    }

    renderMap(gameMap, player, fov) {
        if (!gameMap || !player) return;

        for (let y = 0; y < ROWNO; y++) {
            for (let x = 0; x < COLNO; x++) {
                const row = y + MAP_ROW_START;
                const col = x;

                // Check FOV
                if (!fov || !fov.canSee(x, y)) {
                    // Show remembered terrain or nothing
                    const loc = gameMap.at(x, y);
                    if (loc && loc.seenv) {
                        const sym = this.terrainSymbol(loc);
                        this.setCell(col, row, sym.ch, CLR_BLACK);
                    } else {
                        this.setCell(col, row, ' ', CLR_GRAY);
                    }
                    continue;
                }

                const loc = gameMap.at(x, y);
                if (!loc) {
                    this.setCell(col, row, ' ', CLR_GRAY);
                    continue;
                }

                // Mark as seen
                loc.seenv = 0xFF;

                // Check for player
                if (x === player.x && y === player.y) {
                    this.setCell(col, row, '@', CLR_WHITE);
                    continue;
                }

                // Check for monsters
                const mon = gameMap.monsterAt(x, y);
                if (mon) {
                    this.setCell(col, row, mon.displayChar, mon.displayColor);
                    continue;
                }

                // Check for objects
                const objs = gameMap.objectsAt(x, y);
                if (objs.length > 0) {
                    const topObj = objs[objs.length - 1];
                    this.setCell(col, row, topObj.displayChar, topObj.displayColor);
                    continue;
                }

                // Check for traps
                const trap = gameMap.trapAt(x, y);
                if (trap && trap.tseen) {
                    this.setCell(col, row, '^', CLR_MAGENTA);
                    continue;
                }

                // Show terrain
                const sym = this.terrainSymbol(loc);
                this.setCell(col, row, sym.ch, sym.color);
            }
        }
    }

    terrainSymbol(loc) {
        const typ = loc.typ;

        // Doors
        if (typ === DOOR) {
            if (loc.flags & 1) { // D_ISOPEN
                return { ch: '\u00b7', color: CLR_BROWN };  // middle dot
            } else if (loc.flags & (2 | 4)) { // D_CLOSED | D_LOCKED
                return { ch: '+', color: CLR_BROWN };
            } else {
                return { ch: '\u00b7', color: CLR_GRAY };
            }
        }

        // Stairs (CRITICAL FIX)
        if (typ === STAIRS) {
            if (loc.flags === 1) { // up
                return { ch: '<', color: CLR_GRAY };
            } else { // down
                return { ch: '>', color: CLR_GRAY };
            }
        }

        // Secret doors (appear as walls)
        if (typ === SDOOR) {
            return loc.horizontal
                ? { ch: '\u2500', color: CLR_GRAY }
                : { ch: '\u2502', color: CLR_GRAY };
        }

        // Default terrain symbols (simplified)
        const TERRAIN_SYMBOLS = {
            0: { ch: ' ', color: CLR_GRAY },      // STONE
            1: { ch: '.', color: CLR_GRAY },       // ROOM floor
            2: { ch: '#', color: CLR_GRAY },       // CORR corridor
            // Add more as needed
        };

        return TERRAIN_SYMBOLS[typ] || { ch: '.', color: CLR_GRAY };
    }

    renderStatus(player) {
        if (!player) return;

        // Status line 1
        const line1 = `${player.name} St:${player.attributes[0]} Dx:${player.attributes[3]} Co:${player.attributes[4]} In:${player.attributes[1]} Wi:${player.attributes[2]} Ch:${player.attributes[5]}`;
        this.putstr(0, 22, line1.substring(0, this.cols), CLR_WHITE);

        // Status line 2
        const depth = player.dungeonLevel || 1;
        const line2 = `Dlvl:${depth} $:${player.gold || 0} HP:${player.hp}(${player.hpmax}) Pw:${player.pw}(${player.pwmax}) AC:${player.ac}`;
        this.putstr(0, 23, line2.substring(0, this.cols), CLR_WHITE);
    }
    clearScreen() {
        for (let r = 0; r < this.rows; r++) this.clearRow(r);
    }
    cursorOnPlayer() {}
    renderChargenMenu() { return 0; }
    renderLoreText() {}
    renderTombstone() {}
    renderTopTen() {}

    async showMenu(title, items) {
        // In headless mode, auto-select first item
        return items.length > 0 ? items[0] : null;
    }
}

function makeBlankGrid() {
    const grid = [];
    for (let r = 0; r < TERMINAL_ROWS; r++) {
        grid[r] = [];
        for (let c = 0; c < TERMINAL_COLS; c++) {
            grid[r][c] = { ch: ' ', color: 7 };
        }
    }
    return grid;
}
