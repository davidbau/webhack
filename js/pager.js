// pager.js -- In-terminal text pager
// Displays long text documents inside the 80x24 terminal, with scrolling.
// Modeled after NetHack's built-in text display (pager.c).

import { TERMINAL_COLS, TERMINAL_ROWS } from './config.js';
import { nhgetch } from './input.js';
import { CLR_GRAY, CLR_WHITE, CLR_GREEN, CLR_CYAN } from './display.js';

// Number of usable text rows (reserve 1 for status bar at bottom)
const PAGE_ROWS = TERMINAL_ROWS - 1;
const STATUS_LINE = TERMINAL_ROWS - 1;

// Display a text file in the terminal with paging.
// Saves and restores the terminal contents.
//
// Controls:
//   Space, Enter, j, down  = scroll down one page
//   b, k, up               = scroll up one page
//   q, ESC                 = quit
//   /                      = search
//   Home, g                = go to top
//   End, G                 = go to bottom
export async function showPager(display, text, title) {
    // Split text into lines, wrapping long lines to terminal width
    const lines = wrapText(text, TERMINAL_COLS);

    // Save entire terminal state
    const canSaveRestore = !!display?.grid;
    const saved = canSaveRestore ? saveTerminal(display) : null;

    let topLine = 0;
    let searchTerm = null;

    function render() {
        // Clear and draw text
        for (let r = 0; r < PAGE_ROWS; r++) {
            const lineIdx = topLine + r;
            display.clearRow(r);
            if (lineIdx < lines.length) {
                const line = lines[lineIdx];
                if (typeof display.setCell === 'function') {
                    for (let c = 0; c < line.length && c < TERMINAL_COLS; c++) {
                        const isHighlight = searchTerm && isSearchHit(line, c, searchTerm);
                        display.setCell(c, r, line[c], isHighlight ? CLR_CYAN : CLR_GRAY);
                    }
                } else {
                    display.putstr(0, r, line.substring(0, TERMINAL_COLS), CLR_GRAY);
                }
            }
        }

        // Status bar
        display.clearRow(STATUS_LINE);
        const pct = lines.length <= PAGE_ROWS ? '(All)'
            : topLine + PAGE_ROWS >= lines.length ? '(Bot)'
            : topLine === 0 ? '(Top)'
            : `(${Math.round(topLine / (lines.length - PAGE_ROWS) * 100)}%)`;
        const titleStr = title ? title + ' ' : '';
        const status = `${titleStr}-- ${pct} -- [q:quit  space:next  b:back  /:search]`;
        display.putstr(0, STATUS_LINE, status.substring(0, TERMINAL_COLS), CLR_GREEN);
    }

    render();

    // Input loop
    while (true) {
        const ch = await nhgetch();
        const c = String.fromCharCode(ch);

        if (c === 'q' || ch === 27) {
            // Quit
            break;
        } else if (c === ' ' || ch === 13 || c === 'j' || ch === 106) {
            // Next page (space, enter, j)
            if (topLine + PAGE_ROWS < lines.length) {
                topLine = Math.min(topLine + PAGE_ROWS, lines.length - PAGE_ROWS);
                render();
            }
        } else if (c === 'b' || c === 'k') {
            // Previous page
            if (topLine > 0) {
                topLine = Math.max(topLine - PAGE_ROWS, 0);
                render();
            }
        } else if (c === 'g' || ch === 36) {
            // Home - first page (36 = Home key mapped)
            topLine = 0;
            render();
        } else if (c === 'G') {
            // End - last page
            topLine = Math.max(0, lines.length - PAGE_ROWS);
            render();
        } else if (c === '/') {
            // Search
            searchTerm = await getSearchTerm(display);
            if (searchTerm) {
                const found = findNext(lines, topLine + 1, searchTerm);
                if (found >= 0) {
                    topLine = Math.min(found, Math.max(0, lines.length - PAGE_ROWS));
                }
            }
            render();
        } else if (c === 'n' && searchTerm) {
            // Next search match
            const found = findNext(lines, topLine + 1, searchTerm);
            if (found >= 0) {
                topLine = Math.min(found, Math.max(0, lines.length - PAGE_ROWS));
            }
            render();
        }
        // Arrow keys come through as hjkl from input.js
        // h/l = 104/108 — ignore horizontal
        // Down arrow -> j (106), Up arrow -> k (107) — handled above
    }

    // Restore terminal
    if (saved) {
        restoreTerminal(display, saved);
    }
}

// Wrap text to fit terminal width
function wrapText(text, width) {
    const rawLines = text.split('\n');
    const result = [];
    for (const raw of rawLines) {
        if (raw.length <= width) {
            result.push(raw);
        } else {
            // Hard-wrap at width boundary
            for (let i = 0; i < raw.length; i += width) {
                result.push(raw.substring(i, i + width));
            }
        }
    }
    return result;
}

// Save entire terminal state
function saveTerminal(display) {
    const saved = [];
    for (let r = 0; r < TERMINAL_ROWS; r++) {
        saved[r] = [];
        for (let c = 0; c < TERMINAL_COLS; c++) {
            saved[r][c] = { ...display.grid[r][c] };
        }
    }
    return saved;
}

// Restore terminal state
function restoreTerminal(display, saved) {
    for (let r = 0; r < TERMINAL_ROWS; r++) {
        for (let c = 0; c < TERMINAL_COLS; c++) {
            const cell = saved[r][c];
            display.setCell(c, r, cell.ch, cell.color);
        }
    }
}

// Simple inline search prompt on the status line
async function getSearchTerm(display) {
    display.clearRow(STATUS_LINE);
    display.putstr(0, STATUS_LINE, '/', CLR_GREEN);

    let term = '';
    while (true) {
        const ch = await nhgetch();
        if (ch === 13 || ch === 10) {
            return term || null;
        } else if (ch === 27) {
            return null;
        } else if (ch === 8 || ch === 127) {
            if (term.length > 0) {
                term = term.slice(0, -1);
                display.clearRow(STATUS_LINE);
                display.putstr(0, STATUS_LINE, '/' + term, CLR_GREEN);
            }
        } else if (ch >= 32 && ch < 127) {
            term += String.fromCharCode(ch);
            display.putstr(0, STATUS_LINE, '/' + term, CLR_GREEN);
        }
    }
}

// Find next line containing search term (case-insensitive)
function findNext(lines, startLine, term) {
    const lower = term.toLowerCase();
    for (let i = startLine; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(lower)) {
            return i;
        }
    }
    // Wrap around
    for (let i = 0; i < startLine; i++) {
        if (lines[i].toLowerCase().includes(lower)) {
            return i;
        }
    }
    return -1;
}

// Check if position c in line is part of a search match (for highlighting)
function isSearchHit(line, c, term) {
    const lower = line.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const start = c - lowerTerm.length + 1;
    for (let i = Math.max(0, start); i <= c; i++) {
        if (lower.substring(i, i + lowerTerm.length) === lowerTerm) {
            return true;
        }
    }
    return false;
}
