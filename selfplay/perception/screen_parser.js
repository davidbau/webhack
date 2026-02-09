// selfplay/perception/screen_parser.js -- Parse NetHack 80x24 terminal output
//
// Reads the raw terminal grid (characters + colors) and produces a structured
// GameScreen object. Works identically whether the source is the JS Display
// buffer or a tmux capture-pane dump.
//
// The NetHack terminal layout is:
//   Row 0:     Message line
//   Rows 1-21: Map area (80x21, the dungeon)
//   Row 22:    Status line 1 (name, attributes, alignment)
//   Row 23:    Status line 2 (Dlvl, HP, Pw, AC, XL, T, conditions)

// Terminal geometry constants
const COLS = 80;
const ROWS = 24;
const MESSAGE_ROW = 0;
const MAP_ROW_START = 1;
const MAP_ROW_END = 21;   // inclusive
const MAP_ROWS = 21;
const STATUS_ROW_1 = 22;
const STATUS_ROW_2 = 23;

// NetHack map symbol classification
// These characters represent dungeon features, monsters, and items on the map.

// Wall characters (Unicode box-drawing, DECGraphics)
const WALL_CHARS = new Set([
    '\u2502', // BOX VERT  │
    '\u2500', // BOX HORIZ ─
    '\u250c', // BOX TL    ┌
    '\u2510', // BOX TR    ┐
    '\u2514', // BOX BL    └
    '\u2518', // BOX BR    ┘
    '\u253c', // BOX CROSS ┼
    '\u2534', // BOX UP-T  ┴
    '\u252c', // BOX DOWN-T ┬
    '\u2524', // BOX LEFT-T ┤
    '\u251c', // BOX RIGHT-T├
    '|', '-', // ASCII fallback walls
]);

// Floor characters
const FLOOR_CHARS = new Set([
    '\u00b7', // MIDDLE DOT · (room floor, open door, drawbridge down)
    '.', // ASCII floor fallback
]);

// Monster class letters (uppercase and lowercase a-z, plus special)
const MONSTER_LETTERS = /^[a-zA-Z&';:~]$/;

// Item class symbols
const ITEM_SYMBOLS = new Set([
    ')', // weapon
    '[', // armor
    '%', // food
    '?', // scroll
    '+', // spellbook (also closed door, but context-dependent)
    '/', // wand
    '=', // ring
    '"', // amulet
    '(', // tool
    '!', // potion
    '*', // gem/rock
    '$', // gold
    '`', // boulder/statue
    '0', // iron ball
    '_', // altar (also iron chain in some contexts)
]);

// Feature symbols
const FEATURE_SYMBOLS = {
    '<': 'stairs_up',
    '>': 'stairs_down',
    '{': 'fountain',
    '\\': 'throne',
    '\u2020': 'grave', // dagger symbol
    '_': 'altar',
    '^': 'trap',
    '#': 'corridor_or_sink_or_bars', // context-dependent
    '\u2248': 'water_or_lava', // approximately equal sign
};

/**
 * A single cell on the map as perceived by the agent.
 */
export class MapCell {
    constructor(ch, color) {
        this.ch = ch;         // character displayed
        this.color = color;   // color index (0-15)
        this.type = classifyCell(ch, color); // cell type classification
    }
}

/**
 * Classify a map cell by its character and color.
 * Returns a string type: 'wall', 'floor', 'corridor', 'door_open', 'door_closed',
 * 'stairs_up', 'stairs_down', 'fountain', 'altar', 'trap', 'monster', 'item',
 * 'player', 'water', 'lava', 'stone', 'unknown'
 */
function classifyCell(ch, color) {
    if (ch === ' ') return 'stone';
    if (ch === '@') return 'player';

    // Walls (box-drawing characters, typically gray)
    if (WALL_CHARS.has(ch)) return 'wall';

    // Floor / open door (middle dot)
    if (ch === '\u00b7' || ch === '.') {
        // Brown middle dot = open door; gray = floor
        if (color === 3) return 'door_open'; // CLR_BROWN
        return 'floor';
    }

    // Closed door / spellbook
    if (ch === '+') {
        // CLR_BROWN (3) = door. CLR_GRAY (7) = ambiguous (no color from tmux), assume door.
        // Only classify as item (spellbook) when color is clearly non-door.
        if (color === 3 || color === 7) return 'door_closed';
        return 'item'; // spellbook if distinctly colored
    }

    // Stairs
    if (ch === '<') return 'stairs_up';
    if (ch === '>') return 'stairs_down';

    // Features
    if (ch === '{') return 'fountain';
    if (ch === '_') return 'altar';
    if (ch === '\\') return 'throne';
    if (ch === '\u2020') return 'grave';
    if (ch === '^') return 'trap';

    // Water/lava (≈ character, distinguished by color)
    if (ch === '\u2248') {
        if (color === 1) return 'lava'; // CLR_RED
        return 'water';
    }

    // Corridor, sink, iron bars (# character, distinguished by color)
    if (ch === '#') {
        if (color === 6) return 'iron_bars'; // CLR_CYAN (HI_METAL)
        if (color === 2) return 'tree'; // CLR_GREEN
        return 'corridor';
    }

    // Gold
    if (ch === '$') return 'gold';

    // Items
    if (ITEM_SYMBOLS.has(ch)) return 'item';

    // Monsters (letters and special chars)
    if (MONSTER_LETTERS.test(ch)) return 'monster';

    // Special monster symbols
    if (ch === '&') return 'monster'; // demon
    if (ch === '\'') return 'monster'; // golem or piercer
    if (ch === ':') return 'monster'; // lizard/newt
    if (ch === '~') return 'monster'; // mimic
    if (ch === ';') return 'monster'; // sea monster

    return 'unknown';
}

/**
 * Structured game screen parsed from the terminal.
 */
export class GameScreen {
    constructor() {
        // Message line (row 0)
        this.message = '';
        this.hasMore = false;   // '--More--' prompt present

        // Map grid (21 rows x 80 cols of MapCell)
        this.map = [];
        for (let y = 0; y < MAP_ROWS; y++) {
            this.map[y] = [];
            for (let x = 0; x < COLS; x++) {
                this.map[y][x] = new MapCell(' ', 7);
            }
        }

        // Player position (detected from '@' on map)
        this.playerX = -1;
        this.playerY = -1;

        // Status line data (raw text, parsed by status_parser.js)
        this.statusLine1 = '';
        this.statusLine2 = '';

        // UI state
        this.inMenu = false;      // menu overlay is showing
        this.inPrompt = false;    // yn prompt or getlin prompt active
        this.promptText = '';     // the prompt text if any
    }
}

/**
 * Parse a raw terminal grid into a GameScreen.
 *
 * @param {Array} grid - 24-row array. Each row is an array of {ch, color} objects
 *                       (80 columns), matching the Display.grid format.
 * @returns {GameScreen}
 */
export function parseScreen(grid) {
    const screen = new GameScreen();

    if (!grid || grid.length < ROWS) return screen;

    // --- Message line ---
    screen.message = extractRowText(grid[MESSAGE_ROW]);
    screen.hasMore = screen.message.includes('--More--');

    // Detect prompts on the message line
    // Common prompt patterns: "Really attack X [yn]", "What do you want to X?"
    const msgTrimmed = screen.message.trim();
    if (msgTrimmed.endsWith('[yn]') || msgTrimmed.endsWith('[ynq]') ||
        msgTrimmed.endsWith('[ynaq]') || msgTrimmed.includes('? [')) {
        screen.inPrompt = true;
        screen.promptText = msgTrimmed;
    }
    // getlin prompts end with a space and have cursor waiting
    if (msgTrimmed.endsWith('?')) {
        screen.inPrompt = true;
        screen.promptText = msgTrimmed;
    }

    // --- Map area ---
    for (let y = 0; y < MAP_ROWS; y++) {
        const gridRow = grid[MAP_ROW_START + y];
        if (!gridRow) continue;
        for (let x = 0; x < COLS; x++) {
            const cell = gridRow[x];
            if (!cell) continue;
            screen.map[y][x] = new MapCell(cell.ch, cell.color);
            if (cell.ch === '@') {
                screen.playerX = x;
                screen.playerY = y;
            }
        }
    }

    // --- Status lines ---
    screen.statusLine1 = extractRowText(grid[STATUS_ROW_1]);
    screen.statusLine2 = extractRowText(grid[STATUS_ROW_2]);

    // --- Menu detection ---
    // Menus typically have "(end)" at the bottom or alphabetic selectors
    // along the left edge of the map area
    if (screen.message.includes('(end)') || screen.message.includes('Pick ')) {
        screen.inMenu = true;
    }

    return screen;
}

/**
 * Parse a tmux capture-pane text dump into a GameScreen.
 * The dump is plain text (no color info), 24 lines of up to 80 characters.
 *
 * @param {string} text - Raw tmux capture-pane output
 * @returns {GameScreen}
 */
export function parseTmuxCapture(text) {
    const lines = text.split('\n');
    // Build a grid with default gray color (no color info from tmux plain capture)
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
        grid[r] = [];
        const line = (lines[r] || '').padEnd(COLS, ' ');
        for (let c = 0; c < COLS; c++) {
            grid[r][c] = { ch: line[c] || ' ', color: 7 }; // CLR_GRAY default
        }
    }
    return parseScreen(grid);
}

/**
 * Extract text from a grid row.
 */
function extractRowText(row) {
    if (!row) return '';
    let text = '';
    for (let c = 0; c < row.length; c++) {
        text += row[c].ch || ' ';
    }
    return text.trimEnd();
}

/**
 * Find all monsters visible on the current screen.
 * Returns array of {x, y, ch, color} for each monster cell.
 */
export function findMonsters(screen) {
    const monsters = [];
    for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const cell = screen.map[y][x];
            if (cell.type === 'monster') {
                monsters.push({ x, y, ch: cell.ch, color: cell.color });
            }
        }
    }
    return monsters;
}

/**
 * Find all items visible on the current screen.
 * Returns array of {x, y, ch, color} for each item cell.
 */
export function findItems(screen) {
    const items = [];
    for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const cell = screen.map[y][x];
            if (cell.type === 'item' || cell.type === 'gold') {
                items.push({ x, y, ch: cell.ch, color: cell.color });
            }
        }
    }
    return items;
}

/**
 * Find stairs on the current screen.
 * Returns {up: [{x,y}], down: [{x,y}]}
 */
export function findStairs(screen) {
    const stairs = { up: [], down: [] };
    for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const cell = screen.map[y][x];
            if (cell.type === 'stairs_up') stairs.up.push({ x, y });
            if (cell.type === 'stairs_down') stairs.down.push({ x, y });
        }
    }
    return stairs;
}
