// selfplay/interface/js_adapter.js -- Direct JS port adapter

import { GameAdapter } from './adapter.js';
import { HeadlessDisplay } from '../../js/headless_runtime.js';

const TERMINAL_ROWS = 24;
const TERMINAL_COLS = 80;

export class JSAdapter extends GameAdapter {
    constructor(game, options = {}) {
        super();
        this.game = game;
        this.pushInput = options.pushInput || null;
        this.rhack = options.rhack || null;
        this.movemon = options.movemon || null;
        this._running = false;
    }

    async start() {
        this._running = true;
    }

    async sendKey(key) {
        if (!this._running) return;

        const ch = typeof key === 'number' ? key : key.charCodeAt(0);

        if (this.rhack) {
            const result = await this.rhack(ch, this.game);
            if (result && result.tookTime && this.movemon) {
                this.movemon(this.game.map, this.game.player, this.game.display, this.game.fov);
            }
        } else if (this.pushInput) {
            this.pushInput(ch);
        }
    }

    async readScreen() {
        const display = this.game.display;
        if (!display || !display.grid) {
            return makeBlankGrid();
        }

        const grid = [];
        for (let r = 0; r < TERMINAL_ROWS; r++) {
            grid[r] = [];
            for (let c = 0; c < TERMINAL_COLS; c++) {
                const cell = display.grid[r] && display.grid[r][c];
                if (cell && typeof cell === 'object' && 'ch' in cell) {
                    grid[r][c] = {
                        ch: cell.ch ?? ' ',
                        color: Number.isInteger(cell.color) ? cell.color : 7,
                    };
                } else {
                    const ch = (typeof cell === 'string' && cell.length > 0) ? cell : ' ';
                    const color = display.colors?.[r]?.[c] ?? 7;
                    grid[r][c] = { ch, color };
                }
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

export { HeadlessDisplay };
