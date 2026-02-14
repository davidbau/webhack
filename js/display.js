// display.js -- Browser-based TTY display
// Implements the window_procs interface from winprocs.h for browser rendering.
// See DECISIONS.md #2 for why we use <pre> with <span> elements.

import {
    COLNO, ROWNO, TERMINAL_COLS, TERMINAL_ROWS,
    MESSAGE_ROW, MAP_ROW_START, STATUS_ROW_1, STATUS_ROW_2,
    STONE, VWALL, HWALL, TLCORNER, TRCORNER, BLCORNER, BRCORNER,
    CROSSWALL, TUWALL, TDWALL, TLWALL, TRWALL, DOOR, CORR, ROOM,
    STAIRS, FOUNTAIN, THRONE, SINK, GRAVE, ALTAR, POOL, MOAT,
    WATER, LAVAPOOL, LAVAWALL, ICE, IRONBARS, TREE,
    DRAWBRIDGE_UP, DRAWBRIDGE_DOWN, AIR, CLOUD, SDOOR, SCORR,
    D_NODOOR, D_CLOSED, D_ISOPEN, D_LOCKED,
    IS_WALL, IS_DOOR, IS_ROOM,
    ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
    LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP,
    FIRE_TRAP, PIT, SPIKED_PIT, HOLE, TRAPDOOR, TELEP_TRAP,
    LEVEL_TELEP, MAGIC_PORTAL, WEB, STATUE_TRAP, MAGIC_TRAP,
    ANTI_MAGIC, POLY_TRAP, VIBRATING_SQUARE
} from './config.js';

import { def_monsyms, def_oc_syms } from './symbols.js';

// Color constants (color.h)
// C ref: include/color.h
export const CLR_BLACK = 0;
export const CLR_RED = 1;
export const CLR_GREEN = 2;
export const CLR_BROWN = 3;
export const CLR_BLUE = 4;
export const CLR_MAGENTA = 5;
export const CLR_CYAN = 6;
export const CLR_GRAY = 7;
export const NO_COLOR = 8;
export const CLR_ORANGE = 9;
export const CLR_BRIGHT_GREEN = 10;
export const CLR_YELLOW = 11;
export const CLR_BRIGHT_BLUE = 12;
export const CLR_BRIGHT_MAGENTA = 13;
export const CLR_BRIGHT_CYAN = 14;
export const CLR_WHITE = 15;
export const HI_METAL = CLR_CYAN;
export const HI_WOOD = CLR_BROWN;
export const HI_GOLD = CLR_YELLOW;
export const HI_ZAP = CLR_BRIGHT_BLUE;

// CSS color strings for each NetHack color
// See DECISIONS.md #2 for color choices
// C ref: display.h color constants (0-7, skip 8, 9-15)
const COLOR_CSS = [
    '#555',    // 0  - CLR_BLACK (dark gray for visibility on black bg)
    '#a00',    // 1  - CLR_RED
    '#0a0',    // 2  - CLR_GREEN
    '#a50',    // 3  - CLR_BROWN
    '#00d',    // 4  - CLR_BLUE
    '#a0a',    // 5  - CLR_MAGENTA
    '#0aa',    // 6  - CLR_CYAN
    '#ccc',    // 7  - CLR_GRAY
    '#ccc',    // 8  - NO_COLOR (unused, defaults to gray)
    '#f80',    // 9  - CLR_ORANGE
    '#0f0',    // 10 - CLR_BRIGHT_GREEN
    '#ff0',    // 11 - CLR_YELLOW
    '#55f',    // 12 - CLR_BRIGHT_BLUE
    '#f5f',    // 13 - CLR_BRIGHT_MAGENTA
    '#0ff',    // 14 - CLR_BRIGHT_CYAN
    '#fff',    // 15 - CLR_WHITE
];

// Default symbol for each terrain type
// C ref: defsym.h PCHAR definitions
// Uses Unicode box-drawing characters (DECGraphics / Enhanced1 from dat/symbols)
// ASCII terrain symbols (default, DECgraphics=false)
const TERRAIN_SYMBOLS_ASCII = {
    [STONE]:   { ch: ' ', color: CLR_GRAY },
    [VWALL]:   { ch: '|', color: CLR_GRAY },
    [HWALL]:   { ch: '-', color: CLR_GRAY },
    [TLCORNER]: { ch: '-', color: CLR_GRAY },
    [TRCORNER]: { ch: '-', color: CLR_GRAY },
    [BLCORNER]: { ch: '-', color: CLR_GRAY },
    [BRCORNER]: { ch: '-', color: CLR_GRAY },
    [CROSSWALL]: { ch: '-', color: CLR_GRAY },
    [TUWALL]:  { ch: '-', color: CLR_GRAY },
    [TDWALL]:  { ch: '-', color: CLR_GRAY },
    [TLWALL]:  { ch: '|', color: CLR_GRAY },
    [TRWALL]:  { ch: '|', color: CLR_GRAY },
    [DOOR]:    { ch: '+', color: CLR_BROWN },
    [CORR]:    { ch: '#', color: CLR_GRAY },
    [ROOM]:    { ch: '.', color: CLR_GRAY },
    [STAIRS]:  { ch: '<', color: CLR_GRAY },
    [FOUNTAIN]: { ch: '{', color: CLR_BRIGHT_BLUE },
    [THRONE]:  { ch: '\\', color: HI_GOLD },
    [SINK]:    { ch: '#', color: CLR_GRAY },
    [GRAVE]:   { ch: '|', color: CLR_WHITE },
    [ALTAR]:   { ch: '_', color: CLR_GRAY },
    [POOL]:    { ch: '}', color: CLR_BLUE },
    [MOAT]:    { ch: '}', color: CLR_BLUE },
    [WATER]:   { ch: '}', color: CLR_BRIGHT_BLUE },
    [LAVAPOOL]: { ch: '}', color: CLR_RED },
    [LAVAWALL]: { ch: '}', color: CLR_ORANGE },
    [ICE]:     { ch: '.', color: CLR_CYAN },
    [IRONBARS]: { ch: '#', color: HI_METAL },
    [TREE]:    { ch: '#', color: CLR_GREEN },
    [DRAWBRIDGE_UP]:   { ch: '#', color: CLR_BROWN },
    [DRAWBRIDGE_DOWN]: { ch: '.', color: CLR_BROWN },
    [AIR]:     { ch: ' ', color: CLR_CYAN },
    [CLOUD]:   { ch: '#', color: CLR_GRAY },
    [SDOOR]:   { ch: '|', color: CLR_GRAY },
    [SCORR]:   { ch: ' ', color: CLR_GRAY },
};

// DECgraphics terrain symbols (DECgraphics=true, box-drawing characters)
// C ref: dat/symbols DECgraphics symset
const TERRAIN_SYMBOLS_DEC = {
    [STONE]:   { ch: ' ', color: CLR_GRAY },
    [VWALL]:   { ch: '\u2502', color: CLR_GRAY },   // BOX VERT
    [HWALL]:   { ch: '\u2500', color: CLR_GRAY },   // BOX HORIZ
    [TLCORNER]: { ch: '\u250c', color: CLR_GRAY },  // BOX TL
    [TRCORNER]: { ch: '\u2510', color: CLR_GRAY },  // BOX TR
    [BLCORNER]: { ch: '\u2514', color: CLR_GRAY },  // BOX BL
    [BRCORNER]: { ch: '\u2518', color: CLR_GRAY },  // BOX BR
    [CROSSWALL]: { ch: '\u253c', color: CLR_GRAY }, // BOX CROSS
    [TUWALL]:  { ch: '\u2534', color: CLR_GRAY },   // BOX UP-T
    [TDWALL]:  { ch: '\u252c', color: CLR_GRAY },   // BOX DOWN-T
    [TLWALL]:  { ch: '\u2524', color: CLR_GRAY },   // BOX LEFT-T
    [TRWALL]:  { ch: '\u251c', color: CLR_GRAY },   // BOX RIGHT-T
    [DOOR]:    { ch: '+', color: CLR_BROWN },
    [CORR]:    { ch: '#', color: CLR_GRAY },
    [ROOM]:    { ch: '\u00b7', color: CLR_GRAY },   // MIDDLE DOT
    [STAIRS]:  { ch: '<', color: CLR_GRAY },
    [FOUNTAIN]: { ch: '{', color: CLR_BRIGHT_BLUE },
    [THRONE]:  { ch: '\\', color: HI_GOLD },
    [SINK]:    { ch: '#', color: CLR_GRAY },
    [GRAVE]:   { ch: '\u2020', color: CLR_WHITE },  // DAGGER
    [ALTAR]:   { ch: '_', color: CLR_GRAY },
    [POOL]:    { ch: '\u2248', color: CLR_BLUE },   // APPROX EQUAL
    [MOAT]:    { ch: '\u2248', color: CLR_BLUE },
    [WATER]:   { ch: '\u2248', color: CLR_BRIGHT_BLUE },
    [LAVAPOOL]: { ch: '\u2248', color: CLR_RED },
    [LAVAWALL]: { ch: '\u2248', color: CLR_ORANGE },
    [ICE]:     { ch: '\u00b7', color: CLR_CYAN },   // MIDDLE DOT
    [IRONBARS]: { ch: '#', color: HI_METAL },
    [TREE]:    { ch: '#', color: CLR_GREEN },
    [DRAWBRIDGE_UP]:   { ch: '#', color: CLR_BROWN },
    [DRAWBRIDGE_DOWN]: { ch: '\u00b7', color: CLR_BROWN },
    [AIR]:     { ch: ' ', color: CLR_CYAN },
    [CLOUD]:   { ch: '#', color: CLR_GRAY },
    [SDOOR]:   { ch: '\u2502', color: CLR_GRAY },   // BOX VERT
    [SCORR]:   { ch: ' ', color: CLR_GRAY },
};

export class Display {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.cols = TERMINAL_COLS;
        this.rows = TERMINAL_ROWS;

        // The character grid: [row][col] = {ch, color, attr}
        // attr: 0=normal, 1=inverse, 2=bold, 4=underline (can be OR'd)
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = { ch: ' ', color: CLR_GRAY, attr: 0 };
            }
        }

        // DOM spans: [row][col] = <span>
        this.spans = [];

        // Cell info for hover: [row][col] = { name, desc, color }
        this.cellInfo = [];
        for (let r = 0; r < this.rows; r++) {
            this.cellInfo[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.cellInfo[r][c] = null;
            }
        }

        // Message history
        this.messages = [];
        this.topMessage = '';
        this.messageNeedsMore = false; // C ref: TOPLINE_NEED_MORE - true if message not acknowledged by keypress

        // Game flags (updated by game, used for display options)
        this.flags = {};

        this._createDOM();
    }

    _createDOM() {
        // Create the pre element
        const pre = document.createElement('pre');
        pre.id = 'terminal';
        pre.style.cssText = `
            font-family: "DejaVu Sans Mono", "Courier New", monospace;
            font-size: 16px;
            line-height: 1.2;
            background: #000;
            color: #ccc;
            padding: 8px;
            margin: 0;
            display: inline-block;
            white-space: pre;
            cursor: default;
            user-select: none;
        `;

        // Create spans for each cell
        for (let r = 0; r < this.rows; r++) {
            this.spans[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const span = document.createElement('span');
                span.textContent = ' ';
                span.style.color = COLOR_CSS[CLR_GRAY];
                span.dataset.row = r;
                span.dataset.col = c;
                this.spans[r][c] = span;
                pre.appendChild(span);
            }
            if (r < this.rows - 1) {
                pre.appendChild(document.createTextNode('\n'));
            }
        }

        this.container.innerHTML = '';
        this.container.appendChild(pre);

        // Set up hover info panel
        this._setupHover(pre);
    }

    // Set a character at terminal position (col, row) with color and attributes
    // attr: 0=normal, 1=inverse, 2=bold, 4=underline (can be OR'd together)
    setCell(col, row, ch, color, attr = 0) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
        const cell = this.grid[row][col];
        if (cell.ch === ch && cell.color === color && cell.attr === attr) return; // no change
        cell.ch = ch;
        cell.color = color;
        cell.attr = attr;
        const span = this.spans[row][col];
        span.textContent = ch;

        // Apply color flag - disable colors when color=false
        // C ref: iflags.wc_color
        const displayColor = (this.flags.color !== false) ? color : CLR_GRAY;

        // Apply attributes via CSS
        // C ref: win/tty/termcap.c - inverse video, bold, underline
        const isInverse = (attr & 1) !== 0;
        const isBold = (attr & 2) !== 0;
        const isUnderline = (attr & 4) !== 0;

        if (isInverse) {
            // Inverse video: swap foreground and background
            span.style.color = '#000';
            span.style.backgroundColor = COLOR_CSS[displayColor] || COLOR_CSS[CLR_GRAY];
        } else {
            span.style.color = COLOR_CSS[displayColor] || COLOR_CSS[CLR_GRAY];
            span.style.backgroundColor = '';
        }

        span.style.fontWeight = isBold ? 'bold' : '';
        span.style.textDecoration = isUnderline ? 'underline' : '';
    }

    // Clear a row
    clearRow(row) {
        for (let c = 0; c < this.cols; c++) {
            this.setCell(c, row, ' ', CLR_GRAY);
        }
    }

    // Write a string at position (col, row) with optional attributes
    putstr(col, row, str, color = CLR_GRAY, attr = 0) {
        for (let i = 0; i < str.length && col + i < this.cols; i++) {
            this.setCell(col + i, row, str[i], color, attr);
        }
    }

    // --- Window interface methods (mirrors winprocs.h) ---

    // Display a message on the top line
    // C ref: winprocs.h win_putstr for NHW_MESSAGE
    putstr_message(msg) {
        // Add to message history
        if (msg.trim()) {
            this.messages.push(msg);
            // Keep last 20 messages
            if (this.messages.length > 20) {
                this.messages.shift();
            }
        }

        // If msg_window is enabled, render the message window
        // C ref: win/tty/topl.c — message window modes
        if (this.flags.msg_window) {
            this.renderMessageWindow();
            return;
        }

        // C ref: win/tty/topl.c:262-267 — Concatenate messages if they fit
        // ONLY if no keypress happened between messages (toplin == TOPLINE_NEED_MORE)
        // If there's a current message and both messages fit on one line, combine them
        const notDied = !msg.startsWith('You die');
        // Only concatenate if messageNeedsMore is true (no keypress since last message)
        if (this.topMessage && this.messageNeedsMore && notDied) {
            const combined = this.topMessage + '  ' + msg;
            // Room for combined message + --More-- (8 chars)
            if (combined.length + 3 < this.cols - 8) {
                this.clearRow(MESSAGE_ROW);
                this.putstr(0, MESSAGE_ROW, combined, CLR_WHITE);
                this.topMessage = combined;
                // Keep messageNeedsMore true for potential further concatenation
                return;
            }
        }

        // Otherwise, use traditional single-line message display
        this.clearRow(MESSAGE_ROW);

        // If message fits on one line, display it normally
        if (msg.length <= this.cols) {
            this.putstr(0, MESSAGE_ROW, msg, CLR_WHITE);
            this.topMessage = msg;
        } else {
            // Message is too long - wrap at word boundary
            let breakPoint = msg.lastIndexOf(' ', this.cols);
            if (breakPoint === -1) {
                breakPoint = this.cols;
            }

            const firstLine = msg.substring(0, breakPoint);
            this.putstr(0, MESSAGE_ROW, firstLine, CLR_WHITE);
            this.topMessage = msg;

            const wrapped = msg.substring(breakPoint).trim();
            if (wrapped.length > 0) {
                this.clearRow(MESSAGE_ROW + 1);
                this.putstr(0, MESSAGE_ROW + 1, wrapped.substring(0, this.cols), CLR_WHITE);
            }
        }

        // Mark message as needing acknowledgement (for concatenation logic)
        // C ref: toplin = TOPLINE_NEED_MORE after displaying message
        this.messageNeedsMore = true;
    }

    // Render message window (last 3 messages)
    // C ref: win/tty/topl.c prevmsg_window == 'f' (full)
    renderMessageWindow() {
        const MSG_WINDOW_ROWS = 3;
        // Clear message window area
        for (let r = 0; r < MSG_WINDOW_ROWS; r++) {
            this.clearRow(r);
        }

        // Show last 3 messages (most recent at bottom)
        const recentMessages = this.messages.slice(-MSG_WINDOW_ROWS);
        for (let i = 0; i < recentMessages.length; i++) {
            const msg = recentMessages[i];
            const row = MSG_WINDOW_ROWS - recentMessages.length + i;
            if (msg.length <= this.cols) {
                this.putstr(0, row, msg.substring(0, this.cols), CLR_WHITE);
            } else {
                // Truncate long messages
                this.putstr(0, row, msg.substring(0, this.cols - 3) + '...', CLR_WHITE);
            }
        }
    }

    // Display "--More--" and wait for input
    // C ref: tty_display_nhwindow for message window
    async morePrompt(nhgetch) {
        const msg = this.topMessage;
        const moreStr = '--More--';
        const col = Math.min(msg.length + 1, this.cols - moreStr.length);
        this.putstr(col, MESSAGE_ROW, moreStr, CLR_GREEN);
        await nhgetch();
        this.clearRow(MESSAGE_ROW);
    }

    // Render the map from game state
    // C ref: display.c newsym() and print_glyph()
    renderMap(gameMap, player, fov, flags = {}) {
        // Store flags for use by other methods (e.g., putstr_message, terrainSymbol)
        this.flags = flags;

        // When msg_window is enabled, map starts at row 3 (after 3-line message window)
        // Otherwise map starts at row 1 (after single message line)
        const mapOffset = flags.msg_window ? 3 : MAP_ROW_START;

        for (let y = 0; y < ROWNO; y++) {
            for (let x = 0; x < COLNO; x++) {
                const row = y + mapOffset;
                const col = x;

                if (!fov || !fov.canSee(x, y)) {
                    // Show remembered terrain or nothing
                    const loc = gameMap.at(x, y);
                    if (loc && loc.seenv) {
                        // C-like memory: remembered object glyph overlays
                        // remembered terrain when out of sight.
                        if (loc.mem_obj) {
                            this.setCell(col, row, loc.mem_obj, CLR_BLACK);
                            this.cellInfo[row][col] = { name: 'remembered object', desc: '(remembered)', color: CLR_BLACK };
                            continue;
                        }
                        // Show remembered (dimmed)
                        const sym = this.terrainSymbol(loc, gameMap, x, y);
                        this.setCell(col, row, sym.ch, CLR_BLACK);
                        const desc = this._terrainDesc(loc);
                        this.cellInfo[row][col] = { name: desc, desc: '(remembered)', color: CLR_BLACK };
                    } else {
                        this.setCell(col, row, ' ', CLR_GRAY);
                        this.cellInfo[row][col] = null;
                    }
                    continue;
                }

                const loc = gameMap.at(x, y);
                if (!loc) {
                    this.setCell(col, row, ' ', CLR_GRAY);
                    this.cellInfo[row][col] = null;
                    continue;
                }

                // Mark as seen
                loc.seenv = 0xFF;

                // Check for player at this position
                if (player && x === player.x && y === player.y) {
                    this.setCell(col, row, '@', CLR_WHITE);
                    this.cellInfo[row][col] = { name: player.name || 'you', desc: 'you, the adventurer', color: CLR_WHITE };
                    continue;
                }

                // Check for monsters
                const mon = gameMap.monsterAt(x, y);
                if (mon) {
                    this.setCell(col, row, mon.displayChar, mon.displayColor);
                    const classInfo = this._monsterClassDesc(mon.displayChar);
                    const stats = `Level ${mon.mlevel}, AC ${mon.mac}, Speed ${mon.speed}`;
                    this.cellInfo[row][col] = { name: mon.name, desc: classInfo, stats: stats, color: mon.displayColor };
                    continue;
                }

                // Check for objects on the ground
                const objs = gameMap.objectsAt(x, y);
                if (objs.length > 0) {
                    const topObj = objs[objs.length - 1];
                    loc.mem_obj = topObj.displayChar || 0;
                    this.setCell(col, row, topObj.displayChar, topObj.displayColor);
                    const classInfo = this._objectClassDesc(topObj.oc_class);
                    const extra = objs.length > 1 ? ` (+${objs.length - 1} more)` : '';
                    const stats = this._objectStats(topObj);
                    this.cellInfo[row][col] = { name: topObj.name + extra, desc: classInfo, stats: stats, color: topObj.displayColor };
                    continue;
                }
                loc.mem_obj = 0;

                // Check for traps
                const trap = gameMap.trapAt(x, y);
                if (trap && trap.tseen) {
                    this.setCell(col, row, '^', CLR_MAGENTA);
                    const trapName = this._trapName(trap.ttyp);
                    this.cellInfo[row][col] = { name: trapName, desc: 'trap', color: CLR_MAGENTA };
                    continue;
                }

                // Show terrain
                const sym = this.terrainSymbol(loc, gameMap, x, y);
                this.setCell(col, row, sym.ch, sym.color);
                const desc = this._terrainDesc(loc);
                this.cellInfo[row][col] = { name: desc, desc: '', color: sym.color };
            }
        }
    }

    // Get the display symbol for a terrain type
    // C ref: defsym.h PCHAR definitions, display.c back_to_glyph()
    terrainSymbol(loc, gameMap = null, x = -1, y = -1) {
        const typ = loc.typ;
        const useDEC = this.flags.DECgraphics || false;

        // Choose symbol set based on DECgraphics option
        // C ref: dat/symbols — DECgraphics vs default ASCII
        const TERRAIN_SYMBOLS = useDEC ? TERRAIN_SYMBOLS_DEC : TERRAIN_SYMBOLS_ASCII;

        // Handle door states
        if (typ === DOOR) {
            if (loc.flags & D_ISOPEN) {
                // C ref: defsym.h:13-14 - Open doors use different symbols for vertical vs horizontal
                // S_vodoor (vertical open door): '-'  (walls N/S)
                // S_hodoor (horizontal open door): '|' (walls E/W)
                const isHorizontalDoor = this._isDoorHorizontal(gameMap, x, y);
                return useDEC
                    ? { ch: '\u00b7', color: CLR_BROWN }  // Middle dot for both in DECgraphics
                    : { ch: isHorizontalDoor ? '|' : '-', color: CLR_BROWN };
            } else if (loc.flags & D_CLOSED || loc.flags & D_LOCKED) {
                return { ch: '+', color: CLR_BROWN };
            } else {
                // Doorway: MIDDLE DOT for DEC, '.' for ASCII
                return useDEC
                    ? { ch: '\u00b7', color: CLR_GRAY }
                    : { ch: '.', color: CLR_GRAY };
            }
        }

        // Handle stairs
        if (typ === STAIRS) {
            if (loc.flags === 1) { // up
                return { ch: '<', color: CLR_GRAY };
            } else { // down
                return { ch: '>', color: CLR_GRAY };
            }
        }

        // Handle altar alignment colors
        // C ref: display.h altar_color enum, display.c altarcolors[]
        if (typ === ALTAR) {
            const align = loc.altarAlign !== undefined ? loc.altarAlign : 0;
            let altarColor;
            if (align === 1) {        // A_LAWFUL
                altarColor = CLR_WHITE;
            } else if (align === -1) { // A_CHAOTIC
                altarColor = CLR_BLACK;
            } else {                   // A_NEUTRAL (0) or unaligned
                altarColor = CLR_GRAY;
            }
            return { ch: '_', color: altarColor };
        }

        // Handle secret door/corridor (appears as wall/stone when unseen)
        // C ref: display.c - SDOOR falls through to wall cases, using wall symbols
        // Secret doors must render as the appropriate wall type (including corners)
        // to be truly invisible
        if (typ === SDOOR) {
            // Determine what kind of wall this should appear as based on surroundings
            const wallType = this._determineWallType(gameMap, x, y);
            return TERRAIN_SYMBOLS[wallType] || TERRAIN_SYMBOLS[VWALL];
        }

        // Handle lit_corridor option
        // C ref: flag.h flags.lit_corridor - corridors shown with bright color
        if (typ === CORR && this.flags.lit_corridor) {
            return { ch: '#', color: CLR_CYAN };
        }

        return TERRAIN_SYMBOLS[typ] || { ch: '?', color: CLR_MAGENTA };
    }

    // Render the status lines
    // C ref: botl.c bot(), botl.h
    renderStatus(player) {
        if (!player) return;

        // Status line 1: Name, attributes, etc.
        // C ref: botl.c bot1str()
        const line1Parts = [];
        line1Parts.push(player.name);
        // Use strDisplay for proper 18/xx exceptional strength formatting
        // C ref: attrib.c str_string()
        line1Parts.push(`St:${player.strDisplay}`);
        line1Parts.push(`Dx:${player.attributes[3]}`);
        line1Parts.push(`Co:${player.attributes[4]}`);
        line1Parts.push(`In:${player.attributes[1]}`);
        line1Parts.push(`Wi:${player.attributes[2]}`);
        line1Parts.push(`Ch:${player.attributes[5]}`);
        const alignStr = player.alignment < 0 ? 'Chaotic'
                       : player.alignment > 0 ? 'Lawful' : 'Neutral';
        line1Parts.push(alignStr);
        // Score
        if (player.score > 0) {
            line1Parts.push(`S:${player.score}`);
        }

        const line1 = line1Parts.join('  ');
        this.clearRow(STATUS_ROW_1);
        this.putstr(0, STATUS_ROW_1, line1.substring(0, this.cols), CLR_GRAY);

        // Status line 2: Dungeon level, HP, Pw, AC, etc.
        // C ref: botl.c bot2str()
        const line2Parts = [];
        line2Parts.push(`Dlvl:${player.dungeonLevel}`);
        line2Parts.push(`$:${player.gold}`);
        line2Parts.push(`HP:${player.hp}(${player.hpmax})`);
        line2Parts.push(`Pw:${player.pw}(${player.pwmax})`);
        line2Parts.push(`AC:${player.ac}`);

        // Experience
        if (player.showExp) {
            line2Parts.push(`Xp:${player.level}/${player.exp}`);
        } else {
            line2Parts.push(`Exp:${player.level}`);
        }

        // Turn counter (time option)
        if (player.showTime) {
            line2Parts.push(`T:${player.turns}`);
        }

        // Hunger status
        if (player.hunger <= 50) {
            line2Parts.push('Fainting');
        } else if (player.hunger <= 150) {
            line2Parts.push('Weak');
        } else if (player.hunger <= 300) {
            line2Parts.push('Hungry');
        }

        // Conditions
        if (player.blind) line2Parts.push('Blind');
        if (player.confused) line2Parts.push('Conf');
        if (player.stunned) line2Parts.push('Stun');
        if (player.hallucinating) line2Parts.push('Hallu');

        const line2 = line2Parts.join('  ');
        this.clearRow(STATUS_ROW_2);
        this.putstr(0, STATUS_ROW_2, line2.substring(0, this.cols), CLR_GRAY);

        // Color HP based on percentage
        const hpPct = player.hpmax > 0 ? player.hp / player.hpmax : 1;
        const hpColor = hpPct <= 0.15 ? CLR_RED
                      : hpPct <= 0.33 ? CLR_ORANGE
                      : CLR_GRAY;
        // Find and recolor the HP portion
        const hpStr = `HP:${player.hp}(${player.hpmax})`;
        const hpIdx = line2.indexOf(hpStr);
        if (hpIdx >= 0) {
            for (let i = 0; i < hpStr.length; i++) {
                this.setCell(hpIdx + i, STATUS_ROW_2, hpStr[i], hpColor);
            }
        }
    }

    // Display a simple menu and return selection (async)
    // C ref: winprocs.h win_select_menu
    async showMenu(title, items, nhgetch) {
        // Save the current map area
        const savedCells = [];
        const startRow = MAP_ROW_START + 1;
        const maxItems = Math.min(items.length, ROWNO - 4);

        for (let r = startRow; r < startRow + maxItems + 2; r++) {
            savedCells[r] = [];
            for (let c = 0; c < this.cols; c++) {
                savedCells[r][c] = { ...this.grid[r][c] };
            }
        }

        // Draw menu
        this.clearRow(startRow);
        this.putstr(2, startRow, title, CLR_WHITE);

        const displayItems = items.slice(0, maxItems);
        for (let i = 0; i < displayItems.length; i++) {
            const row = startRow + 1 + i;
            this.clearRow(row);
            const item = displayItems[i];
            const letter = item.letter || String.fromCharCode(97 + i); // a, b, c...
            this.putstr(2, row, `${letter} - ${item.text}`, CLR_GRAY);
        }

        // Wait for selection
        this.putstr_message('(end) ');
        const ch = await nhgetch();

        // Restore map
        for (let r = startRow; r < startRow + maxItems + 2; r++) {
            if (!savedCells[r]) continue;
            for (let c = 0; c < this.cols; c++) {
                const saved = savedCells[r][c];
                this.setCell(c, r, saved.ch, saved.color);
            }
        }
        this.clearRow(MESSAGE_ROW);

        // Find which item was selected
        const charStr = String.fromCharCode(ch);
        const selected = displayItems.find((item, idx) => {
            const letter = item.letter || String.fromCharCode(97 + idx);
            return letter === charStr;
        });

        return selected || null;
    }

    // Clear the entire screen
    clearScreen() {
        for (let r = 0; r < this.rows; r++) {
            this.clearRow(r);
        }
    }

    // Display a chargen menu matching C TTY positioning
    // C ref: wintty.c tty_display_nhwindow() for NHW_MENU
    // lines: array of strings (the menu content lines)
    // isFirstMenu: if true, always renders full-screen (col 0)
    // Returns: the lines displayed and the offx used
    renderChargenMenu(lines, isFirstMenu) {
        // Calculate max content width
        let maxcol = 0;
        for (const line of lines) {
            if (line.length > maxcol) maxcol = line.length;
        }

        // C ref: wintty.c offx calculation
        // offx = max(10, min(41, cols - maxcol - 2))
        // The 41 is the persistent default from C's role menu maxcol tracking.
        // If offx == 10 OR menu too tall for terminal OR first menu: offx = 0, full-screen
        let offx = Math.max(10, Math.min(41, this.cols - maxcol - 2));

        if (isFirstMenu || offx === 10 || lines.length >= this.rows) {
            offx = 0;
        }

        // Always clear entire screen before rendering (C dismisses previous window first)
        this.clearScreen();

        // Render each line at the offset
        // C ref: win/tty/wintty.c - menu headers use inverse video
        for (let i = 0; i < lines.length && i < this.rows; i++) {
            const line = lines[i];
            // First line (menu header) gets inverse video if it starts with space and contains text
            // C ref: role.c - headers like " Pick a role or profession" use inverse
            const isHeader = (i === 0 && line.trim().length > 0 && line.startsWith(' '));
            const attr = isHeader ? 1 : 0;  // 1 = inverse video
            this.putstr(offx, i, line, CLR_WHITE, attr);
        }

        return offx;
    }

    // Display a right-side menu overlay while preserving existing left-side map.
    renderOverlayMenu(lines) {
        let maxcol = 0;
        for (const line of lines) {
            if (line.length > maxcol) maxcol = line.length;
        }
        const offx = Math.max(10, Math.min(41, this.cols - maxcol - 2));

        // Clear only the overlay area.
        for (let r = 0; r < this.rows; r++) {
            for (let c = offx; c < this.cols; c++) {
                this.setCell(c, r, ' ', CLR_GRAY, 0);
            }
        }

        for (let i = 0; i < lines.length && i < this.rows; i++) {
            this.putstr(offx, i, lines[i], CLR_WHITE, 0);
        }
        return offx;
    }

    // Display lore text overlaid on the map area
    // C ref: The lore text is displayed starting at a calculated column offset
    renderLoreText(lines, offx) {
        for (let i = 0; i < lines.length && i < this.rows; i++) {
            // Clear from offx to end of line, then write text
            for (let c = offx; c < this.cols; c++) {
                this.setCell(c, i, ' ', CLR_GRAY);
            }
            this.putstr(offx, i, lines[i], CLR_GRAY);
        }
        // Clear remaining rows in the overlay area
        for (let i = lines.length; i < this.rows - 2; i++) {
            for (let c = offx; c < this.cols; c++) {
                this.setCell(c, i, ' ', CLR_GRAY);
            }
        }
    }

    // Place cursor on the player
    // C ref: display.c curs_on_u()
    cursorOnPlayer(player) {
        // In a browser, we could blink or highlight the player cell
        // For now, just ensure the player @ is bright
        if (player) {
            this.setCell(player.x, player.y + MAP_ROW_START, '@', CLR_WHITE);
        }
    }

    // --- Hover info helpers ---

    // Determine if a door is horizontal (walls E/W) or vertical (walls N/S)
    // C ref: display.c glyph_at() - door orientation affects symbol choice
    _isDoorHorizontal(gameMap, x, y) {
        if (!gameMap || x < 0 || y < 0) return false;

        // Check for walls to east and west (makes door horizontal)
        const hasWallEast = x + 1 < COLNO && IS_WALL(gameMap.at(x + 1, y)?.typ || 0);
        const hasWallWest = x - 1 >= 0 && IS_WALL(gameMap.at(x - 1, y)?.typ || 0);

        // If walls E/W, door is horizontal; otherwise vertical
        return hasWallEast || hasWallWest;
    }

    // Determine what wall type a secret door should appear as
    // C ref: display.c - SDOOR falls through to wall rendering, matching surroundings
    _determineWallType(gameMap, x, y) {
        if (!gameMap || x < 0 || y < 0) return VWALL;

        // Check all 4 directions for walls
        const N = y - 1 >= 0 && IS_WALL(gameMap.at(x, y - 1)?.typ || 0);
        const S = y + 1 < ROWNO && IS_WALL(gameMap.at(x, y + 1)?.typ || 0);
        const E = x + 1 < COLNO && IS_WALL(gameMap.at(x + 1, y)?.typ || 0);
        const W = x - 1 >= 0 && IS_WALL(gameMap.at(x - 1, y)?.typ || 0);

        // Determine wall type based on adjacent walls
        // Corners: walls in two perpendicular directions
        if (N && W && !S && !E) return TLCORNER;  // Top-left: walls above and left
        if (N && E && !S && !W) return TRCORNER;  // Top-right: walls above and right
        if (S && W && !N && !E) return BLCORNER;  // Bottom-left: walls below and left
        if (S && E && !N && !W) return BRCORNER;  // Bottom-right: walls below and right

        // T-junctions and crosses
        if (N && S && E && !W) return TLWALL;     // T pointing left
        if (N && S && W && !E) return TRWALL;     // T pointing right
        if (E && W && N && !S) return TUWALL;     // T pointing up
        if (E && W && S && !N) return TDWALL;     // T pointing down
        if (N && S && E && W) return CROSSWALL;   // Cross

        // Straight walls:
        // C parity: wall orientation tracks rm.horizontal convention used for
        // doors/secret doors. E/W neighbors imply a vertical glyph ('|'),
        // N/S neighbors imply a horizontal glyph ('-').
        if ((N || S) && !E && !W) return HWALL;
        if ((E || W) && !N && !S) return VWALL;

        // Default to vertical wall if unclear
        return VWALL;
    }

    // Get terrain description for a map location
    _terrainDesc(loc) {
        const typ = loc.typ;
        if (typ === DOOR) {
            if (loc.flags & D_ISOPEN) return 'open door';
            if (loc.flags & D_CLOSED || loc.flags & D_LOCKED) return 'closed door';
            return 'doorway';
        }
        if (typ === STAIRS) return loc.flags === 1 ? 'staircase up' : 'staircase down';
        const names = {
            [STONE]: '', [VWALL]: 'wall', [HWALL]: 'wall',
            [TLCORNER]: 'wall', [TRCORNER]: 'wall', [BLCORNER]: 'wall', [BRCORNER]: 'wall',
            [CROSSWALL]: 'wall', [TUWALL]: 'wall', [TDWALL]: 'wall',
            [TLWALL]: 'wall', [TRWALL]: 'wall',
            [CORR]: 'corridor', [ROOM]: 'floor',
            [FOUNTAIN]: 'fountain', [THRONE]: 'throne', [SINK]: 'sink',
            [GRAVE]: 'grave', [ALTAR]: 'altar',
            [POOL]: 'pool of water', [MOAT]: 'moat', [WATER]: 'water',
            [LAVAPOOL]: 'molten lava', [LAVAWALL]: 'wall of lava',
            [ICE]: 'ice', [IRONBARS]: 'iron bars', [TREE]: 'tree',
            [DRAWBRIDGE_UP]: 'drawbridge', [DRAWBRIDGE_DOWN]: 'drawbridge',
            [AIR]: 'air', [CLOUD]: 'cloud',
            [SDOOR]: 'wall', [SCORR]: '',
        };
        return names[typ] || '';
    }

    // Look up monster class description from display character
    _monsterClassDesc(ch) {
        for (let i = 1; i < def_monsyms.length; i++) {
            if (def_monsyms[i].sym === ch) return def_monsyms[i].explain;
        }
        return 'creature';
    }

    // Look up object class description from oc_class
    _objectClassDesc(oc_class) {
        // def_oc_syms is 1-indexed (idx 0 is placeholder)
        const idx = oc_class + 1;
        if (idx > 0 && idx < def_oc_syms.length) return def_oc_syms[idx].explain;
        return 'object';
    }

    // Get stats string for an object based on its class
    _objectStats(obj) {
        const parts = [];
        if (obj.damage) parts.push(`Dmg: ${obj.damage[0]}d${obj.damage[1]}`);
        if (obj.ac) parts.push(`AC ${obj.ac}`);
        if (obj.nutrition) parts.push(`Nutr: ${obj.nutrition}`);
        if (obj.charges) parts.push(`Charges: ${obj.charges}`);
        if (obj.weight) parts.push(`Wt: ${obj.weight}`);
        return parts.join(', ');
    }

    // Get trap name from trap type
    _trapName(ttyp) {
        const names = {
            [ARROW_TRAP]: 'arrow trap', [DART_TRAP]: 'dart trap',
            [ROCKTRAP]: 'falling rock trap', [SQKY_BOARD]: 'squeaky board',
            [BEAR_TRAP]: 'bear trap', [LANDMINE]: 'land mine',
            [ROLLING_BOULDER_TRAP]: 'rolling boulder trap',
            [SLP_GAS_TRAP]: 'sleeping gas trap', [RUST_TRAP]: 'rust trap',
            [FIRE_TRAP]: 'fire trap', [PIT]: 'pit', [SPIKED_PIT]: 'spiked pit',
            [HOLE]: 'hole', [TRAPDOOR]: 'trap door',
            [TELEP_TRAP]: 'teleportation trap', [LEVEL_TELEP]: 'level teleporter',
            [MAGIC_PORTAL]: 'magic portal', [WEB]: 'web',
            [STATUE_TRAP]: 'statue trap', [MAGIC_TRAP]: 'magic trap',
            [ANTI_MAGIC]: 'anti-magic field', [POLY_TRAP]: 'polymorph trap',
            [VIBRATING_SQUARE]: 'vibrating square',
        };
        return names[ttyp] || 'trap';
    }

    // Set up mouseover handling for the hover info panel
    _setupHover(pre) {
        const display = this;
        const panel = document.getElementById('hover-info');
        if (!panel) return;

        const nameEl = document.getElementById('hover-name');
        const descEl = document.getElementById('hover-desc');
        const statsEl = document.getElementById('hover-stats');
        const symbolEl = document.getElementById('hover-symbol');

        pre.addEventListener('mouseover', function(e) {
            const span = e.target;
            if (!span.dataset || span.dataset.row === undefined) return;
            const r = parseInt(span.dataset.row);
            const c = parseInt(span.dataset.col);
            const info = display.cellInfo[r] && display.cellInfo[r][c];
            if (info && info.name) {
                const ch = display.grid[r][c].ch;
                const color = COLOR_CSS[info.color] || COLOR_CSS[CLR_GRAY];
                if (symbolEl) {
                    symbolEl.textContent = ch;
                    symbolEl.style.color = color;
                }
                if (nameEl) nameEl.textContent = info.name;
                if (descEl) descEl.textContent = info.desc;
                if (statsEl) statsEl.textContent = info.stats || '';
                panel.style.visibility = 'visible';
            } else {
                panel.style.visibility = 'hidden';
            }
        });

        pre.addEventListener('mouseout', function(e) {
            // Only hide if leaving the pre entirely
            if (!pre.contains(e.relatedTarget)) {
                panel.style.visibility = 'hidden';
            }
        });
    }

    // Render the C NetHack tombstone ASCII art on a cleared screen.
    // C ref: rip.c genl_outrip()
    // name: player name, gold: gold amount, deathLines: array of pre-wrapped lines,
    // year: 4-digit year string
    renderTombstone(name, gold, deathLines, year) {
        this.clearScreen();

        // C ref: rip.c rip[] — the tombstone art template
        const rip = [
            '                       ----------',
            '                      /          \\',
            '                     /    REST    \\',
            '                    /      IN      \\',
            '                   /     PEACE      \\',
            '                  /                  \\',
        ];

        // Centered text lines on the tombstone face
        // The stone face is 18 chars wide (between | markers), center col ~28
        const CENTER = 28;
        const FACE_WIDTH = 16;

        function centerOnStone(text) {
            if (text.length > FACE_WIDTH) text = text.substring(0, FACE_WIDTH);
            const pad = Math.floor((FACE_WIDTH - text.length) / 2);
            const inner = ' '.repeat(pad) + text + ' '.repeat(FACE_WIDTH - pad - text.length);
            return '                  |' + ' ' + inner + ' ' + '|';
        }

        // Name line
        rip.push(centerOnStone(name));
        // Gold line
        rip.push(centerOnStone(`${gold} Au`));
        // Death description lines (up to 4)
        for (let i = 0; i < 4; i++) {
            rip.push(centerOnStone(deathLines[i] || ''));
        }
        // Empty line
        rip.push(centerOnStone(''));
        // Year line
        rip.push(centerOnStone(year));

        // Bottom of tombstone
        rip.push('                 *|     *  *  *      | *');
        rip.push('        _________)/\\\\__//(\\\\/(/\\\\)/\\\\//\\\\/|_)_______');

        // Render each line
        for (let i = 0; i < rip.length && i < this.rows; i++) {
            this.putstr(0, i, rip[i], CLR_WHITE);
        }
    }

    // Render the topten list on screen.
    // lines: array of {text, highlight} objects.
    // startRow: row to start rendering at.
    renderTopTen(lines, startRow) {
        for (let i = 0; i < lines.length && startRow + i < this.rows; i++) {
            const line = lines[i];
            this.putstr(0, startRow + i, line.text.substring(0, this.cols),
                line.highlight ? CLR_YELLOW : CLR_GRAY);
        }
    }
}
