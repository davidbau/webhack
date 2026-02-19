// test/comparison/comparators.js -- Pure comparison helpers for session replay.
import { decodeDecSpecialChar } from './symset_normalization.js';

function stripRngSourceTag(entry) {
    if (!entry || typeof entry !== 'string') return '';
    const noPrefix = entry.replace(/^\d+\s+/, '');
    const atIndex = noPrefix.indexOf(' @ ');
    return atIndex >= 0 ? noPrefix.substring(0, atIndex) : noPrefix;
}

function isMidlogEntry(entry) {
    return typeof entry === 'string' && entry.length > 0 && (entry[0] === '>' || entry[0] === '<');
}

function isCompositeEntry(entry) {
    return typeof entry === 'string'
        && (entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d('));
}

function normalizeRngEntries(entries, {
    ignoreMidlog = true,
    ignoreComposite = true,
} = {}) {
    const list = Array.isArray(entries) ? entries : [];
    return list
        .map(stripRngSourceTag)
        .filter((entry) => {
            if (!entry) return false;
            if (ignoreMidlog && isMidlogEntry(entry)) return false;
            if (ignoreComposite && isCompositeEntry(entry)) return false;
            return true;
        });
}

// Build index mapping from normalized entries back to raw entries
function buildIndexMap(entries, options) {
    const list = Array.isArray(entries) ? entries : [];
    const ignoreMidlog = options.ignoreMidlog !== false;
    const ignoreComposite = options.ignoreComposite !== false;
    const map = [];
    for (let i = 0; i < list.length; i++) {
        const stripped = stripRngSourceTag(list[i]);
        if (!stripped) continue;
        if (ignoreMidlog && isMidlogEntry(stripped)) continue;
        if (ignoreComposite && isCompositeEntry(stripped)) continue;
        map.push(i);
    }
    return map;
}

// Extract the call stack (recent >funcname entries) before a given raw index
function extractCallStack(rawEntries, rawIndex, maxDepth = 3) {
    const stack = [];
    for (let i = rawIndex - 1; i >= 0 && stack.length < maxDepth; i--) {
        const entry = rawEntries[i];
        if (typeof entry === 'string' && entry.startsWith('>')) {
            stack.unshift(entry); // prepend to maintain order
        }
    }
    return stack;
}

// Shift-aware RNG comparison: uses greedy forward matching with bounded
// lookahead to identify insertions (extra calls on one side) separately
// from value mismatches at aligned positions.
export function compareRngShiftAware(jsRng = [], expectedRng = [], options = {}) {
    const js = normalizeRngEntries(jsRng, options);
    const session = normalizeRngEntries(expectedRng, options);
    const jsRaw = Array.isArray(jsRng) ? jsRng : [];
    const sessionRaw = Array.isArray(expectedRng) ? expectedRng : [];
    const jsIndexMap = buildIndexMap(jsRng, options);
    const sessionIndexMap = buildIndexMap(expectedRng, options);

    const K = options.lookahead || 20; // max lookahead for resync
    const shifts = [];
    const diffs = [];
    let matched = 0;
    let i = 0; // js index
    let j = 0; // session index

    while (i < js.length && j < session.length) {
        if (js[i] === session[j]) {
            matched++;
            i++;
            j++;
            continue;
        }

        // Try to resync: find smallest skip on either side
        let bestSkipJs = -1;
        let bestSkipSession = -1;
        let bestTotal = K + 1;

        // Try skipping 1..K on JS side (JS has extra calls)
        for (let skip = 1; skip <= K && i + skip < js.length; skip++) {
            if (js[i + skip] === session[j]) {
                if (skip < bestTotal) {
                    bestSkipJs = skip;
                    bestSkipSession = 0;
                    bestTotal = skip;
                }
                break;
            }
        }

        // Try skipping 1..K on session side (session/C has extra calls)
        for (let skip = 1; skip <= K && j + skip < session.length; skip++) {
            if (js[i] === session[j + skip]) {
                if (skip < bestTotal) {
                    bestSkipJs = 0;
                    bestSkipSession = skip;
                    bestTotal = skip;
                }
                break;
            }
        }

        if (bestTotal <= K) {
            // Record shifts for skipped entries
            if (bestSkipJs > 0) {
                for (let s = 0; s < bestSkipJs; s++) {
                    const rawIdx = jsIndexMap[i + s];
                    shifts.push({
                        type: 'js_extra',
                        jsIndex: i + s,
                        entry: js[i + s],
                        raw: rawIdx !== undefined ? jsRaw[rawIdx] : undefined,
                        stack: rawIdx !== undefined ? extractCallStack(jsRaw, rawIdx) : [],
                    });
                }
                i += bestSkipJs;
            }
            if (bestSkipSession > 0) {
                for (let s = 0; s < bestSkipSession; s++) {
                    const rawIdx = sessionIndexMap[j + s];
                    shifts.push({
                        type: 'c_extra',
                        sessionIndex: j + s,
                        entry: session[j + s],
                        raw: rawIdx !== undefined ? sessionRaw[rawIdx] : undefined,
                        stack: rawIdx !== undefined ? extractCallStack(sessionRaw, rawIdx) : [],
                    });
                }
                j += bestSkipSession;
            }
            // Now i,j should be aligned on a match; continue to pick it up
        } else {
            // No resync within K: record as a value diff and advance both
            diffs.push({
                jsIndex: i,
                sessionIndex: j,
                js: js[i],
                session: session[j],
                jsRaw: jsIndexMap[i] !== undefined ? jsRaw[jsIndexMap[i]] : undefined,
                sessionRaw: sessionIndexMap[j] !== undefined ? sessionRaw[sessionIndexMap[j]] : undefined,
            });
            i++;
            j++;
        }
    }

    // Remaining entries on JS side are JS extras
    while (i < js.length) {
        const rawIdx = jsIndexMap[i];
        shifts.push({
            type: 'js_extra',
            jsIndex: i,
            entry: js[i],
            raw: rawIdx !== undefined ? jsRaw[rawIdx] : undefined,
            stack: rawIdx !== undefined ? extractCallStack(jsRaw, rawIdx) : [],
        });
        i++;
    }

    // Remaining entries on session side are C extras
    while (j < session.length) {
        const rawIdx = sessionIndexMap[j];
        shifts.push({
            type: 'c_extra',
            sessionIndex: j,
            entry: session[j],
            raw: rawIdx !== undefined ? sessionRaw[rawIdx] : undefined,
            stack: rawIdx !== undefined ? extractCallStack(sessionRaw, rawIdx) : [],
        });
        j++;
    }

    const total = Math.max(js.length, session.length);
    return { matched, total, shifts, diffs };
}

export function compareRng(jsRng = [], expectedRng = [], options = {}) {
    const actual = normalizeRngEntries(jsRng, options);
    const expected = normalizeRngEntries(expectedRng, options);
    // Keep original entries (with source locations) for display
    const jsRaw = Array.isArray(jsRng) ? jsRng : [];
    const sessionRaw = Array.isArray(expectedRng) ? expectedRng : [];
    // Build index maps to find raw entries from normalized indices
    const jsIndexMap = buildIndexMap(jsRng, options);
    const sessionIndexMap = buildIndexMap(expectedRng, options);
    const total = Math.max(actual.length, expected.length);

    let matched = 0;
    let firstDivergence = null;

    for (let i = 0; i < total; i++) {
        if (actual[i] === expected[i]) {
            matched++;
            continue;
        }
        if (!firstDivergence) {
            const jsRawIndex = jsIndexMap[i];
            const sessionRawIndex = sessionIndexMap[i];
            firstDivergence = {
                index: i,
                js: actual[i],
                session: expected[i],
                // Include original entries with source locations
                jsRaw: jsRawIndex !== undefined ? jsRaw[jsRawIndex] : undefined,
                sessionRaw: sessionRawIndex !== undefined ? sessionRaw[sessionRawIndex] : undefined,
                // Include call stack context (recent >funcname entries)
                jsStack: jsRawIndex !== undefined ? extractCallStack(jsRaw, jsRawIndex) : [],
                sessionStack: sessionRawIndex !== undefined ? extractCallStack(sessionRaw, sessionRawIndex) : [],
            };
        }
    }

    return {
        matched,
        total,
        index: firstDivergence ? firstDivergence.index : -1,
        js: firstDivergence ? firstDivergence.js : null,
        session: firstDivergence ? firstDivergence.session : null,
        firstDivergence,
    };
}

function normalizeScreenLine(line) {
    return String(line || '').replace(/ +$/, '');
}

export function compareScreenLines(actualLines = [], expectedLines = []) {
    const actual = Array.isArray(actualLines) ? actualLines : [];
    const expected = Array.isArray(expectedLines) ? expectedLines : [];
    const total = Math.max(actual.length, expected.length);

    let matched = 0;
    const diffs = [];

    for (let i = 0; i < total; i++) {
        const jsLine = normalizeScreenLine(actual[i]);
        const sessionLine = normalizeScreenLine(expected[i]);
        if (jsLine === sessionLine) {
            matched++;
        } else {
            diffs.push({ row: i, js: jsLine, session: sessionLine });
        }
    }

    return {
        matched,
        total,
        match: matched === total,
        diffs,
        firstDiff: diffs.length > 0 ? diffs[0] : null,
    };
}

function ansiSpacesFromCursorForward(text) {
    return String(text || '').replace(/\x1b\[(\d*)C/g, (_m, n) => ' '.repeat(Math.max(1, Number(n || '1'))));
}

function parseAnsiLineToCells(line) {
    const src = ansiSpacesFromCursorForward(line);
    const cells = [];
    let i = 0;
    let fg = 7;
    let bg = 0;
    let attr = 0; // bit1=inverse, bit2=bold, bit4=underline
    let decGraphics = false; // SO/SI state for DEC special graphics

    const applySgr = (codes) => {
        if (codes.length === 0) codes = [0];
        for (const code of codes) {
            if (code === 0) {
                fg = 7; bg = 0; attr = 0;
            } else if (code === 1) attr |= 2;
            else if (code === 4) attr |= 4;
            else if (code === 7) attr |= 1;
            else if (code === 22) attr &= ~2;
            else if (code === 24) attr &= ~4;
            else if (code === 27) attr &= ~1;
            else if (code >= 30 && code <= 37) fg = code - 30;
            else if (code >= 90 && code <= 97) fg = 8 + (code - 90);
            else if (code === 39) fg = 7;
            else if (code >= 40 && code <= 47) bg = code - 40;
            else if (code >= 100 && code <= 107) bg = 8 + (code - 100);
            else if (code === 49) bg = 0;
        }
    };

    while (i < src.length) {
        const ch = src[i];
        if (ch === '\x0e') {
            decGraphics = true;
            i++;
            continue;
        }
        if (ch === '\x0f') {
            decGraphics = false;
            i++;
            continue;
        }
        if (ch === '\x1b' && src[i + 1] === '[') {
            let j = i + 2;
            while (j < src.length && src[j] !== 'm') j++;
            if (j < src.length && src[j] === 'm') {
                const body = src.slice(i + 2, j);
                const codes = body.length === 0
                    ? [0]
                    : body.split(';').map((s) => Number.parseInt(s || '0', 10)).filter((n) => Number.isFinite(n));
                applySgr(codes);
                i = j + 1;
                continue;
            }
        }
        if (ch !== '\r' && ch !== '\n') {
            const outCh = decGraphics ? decodeDecSpecialChar(ch) : ch;
            cells.push({ ch: outCh, fg, bg, attr });
        }
        i++;
    }
    return cells;
}

function normalizeAnsiCells(cells, width = 80) {
    const out = Array.isArray(cells) ? cells.slice(0, width) : [];
    while (out.length < width) out.push({ ch: ' ', fg: 7, bg: 0, attr: 0 });
    return out;
}

export function ansiLineToCells(line, width = 80) {
    return normalizeAnsiCells(parseAnsiLineToCells(line), width);
}

export function compareScreenAnsi(actualAnsi = [], expectedAnsi = []) {
    const actual = Array.isArray(actualAnsi) ? actualAnsi : [];
    const expected = Array.isArray(expectedAnsi) ? expectedAnsi : [];
    const total = Math.max(actual.length, expected.length);
    let matched = 0;
    const diffs = [];

    for (let row = 0; row < total; row++) {
        const aCells = ansiLineToCells(actual[row] || '');
        const eCells = ansiLineToCells(expected[row] || '');
        let rowMatch = true;
        let firstCol = -1;
        for (let col = 0; col < 80; col++) {
            const a = aCells[col];
            const e = eCells[col];
            if (a.ch !== e.ch || a.fg !== e.fg || a.bg !== e.bg || a.attr !== e.attr) {
                rowMatch = false;
                firstCol = col;
                break;
            }
        }
        if (rowMatch) {
            matched++;
        } else {
            const a = aCells[firstCol];
            const e = eCells[firstCol];
            diffs.push({
                row,
                col: firstCol,
                js: { ch: a.ch, fg: a.fg, bg: a.bg, attr: a.attr },
                session: { ch: e.ch, fg: e.fg, bg: e.bg, attr: e.attr },
            });
        }
    }

    return {
        matched,
        total,
        match: matched === total,
        diffs,
        firstDiff: diffs.length > 0 ? diffs[0] : null,
    };
}

export function compareGrids(actualGrid = [], expectedGrid = []) {
    const diffs = [];
    const rows = Math.max(actualGrid.length || 0, expectedGrid.length || 0);

    for (let y = 0; y < rows; y++) {
        const actualRow = Array.isArray(actualGrid[y]) ? actualGrid[y] : [];
        const expectedRow = Array.isArray(expectedGrid[y]) ? expectedGrid[y] : [];
        const cols = Math.max(actualRow.length || 0, expectedRow.length || 0);

        for (let x = 0; x < cols; x++) {
            if (actualRow[x] !== expectedRow[x]) {
                diffs.push({ x, y, js: actualRow[x], session: expectedRow[x] });
            }
        }
    }

    return diffs;
}

export function findFirstGridDiff(actualGrid = [], expectedGrid = []) {
    const rows = Math.max(actualGrid.length || 0, expectedGrid.length || 0);
    for (let y = 0; y < rows; y++) {
        const actualRow = Array.isArray(actualGrid[y]) ? actualGrid[y] : [];
        const expectedRow = Array.isArray(expectedGrid[y]) ? expectedGrid[y] : [];
        const cols = Math.max(actualRow.length || 0, expectedRow.length || 0);
        for (let x = 0; x < cols; x++) {
            if (actualRow[x] !== expectedRow[x]) {
                return { x, y, js: actualRow[x], session: expectedRow[x] };
            }
        }
    }
    return null;
}

export function formatRngDivergence(divergence, options = {}) {
    if (!divergence) return 'No divergence';

    const lines = [];
    lines.push(`First divergence at index ${divergence.index}:`);
    lines.push(`  JS:      ${divergence.js || '(missing)'}`);
    lines.push(`  Session: ${divergence.session || '(missing)'}`);

    if (options.showContext && divergence.contextBefore) {
        if (divergence.contextBefore.js.length > 0) {
            lines.push('  Context before:');
            divergence.contextBefore.js.forEach((entry, i) => {
                const sessionEntry = divergence.contextBefore.session[i] || '(missing)';
                const match = entry === sessionEntry ? '=' : '!';
                lines.push(`    [${divergence.index - divergence.contextBefore.js.length + i}] ${match} JS: ${entry}`);
                if (entry !== sessionEntry) {
                    lines.push(`        ${match} S:  ${sessionEntry}`);
                }
            });
        }
    }

    return lines.join('\n');
}

export function formatScreenDiff(comparison, options = {}) {
    if (!comparison || comparison.match) return 'Screens match';

    const lines = [];
    lines.push(`Screen mismatch: ${comparison.matched}/${comparison.total} lines match`);

    const maxDiffs = options.maxDiffs || 5;
    const diffs = comparison.diffs.slice(0, maxDiffs);

    for (const diff of diffs) {
        lines.push(`  Row ${diff.row}:`);
        lines.push(`    JS:      "${diff.js}"`);
        lines.push(`    Session: "${diff.session}"`);
    }

    if (comparison.diffs.length > maxDiffs) {
        lines.push(`  ... and ${comparison.diffs.length - maxDiffs} more differences`);
    }

    return lines.join('\n');
}

export function formatGridDiff(diffs, options = {}) {
    if (!diffs || diffs.length === 0) return 'Grids match';

    const lines = [];
    lines.push(`Grid mismatch: ${diffs.length} cells differ`);

    const maxDiffs = options.maxDiffs || 10;
    const shown = diffs.slice(0, maxDiffs);

    for (const diff of shown) {
        lines.push(`  (${diff.x},${diff.y}): JS=${diff.js} Session=${diff.session}`);
    }

    if (diffs.length > maxDiffs) {
        lines.push(`  ... and ${diffs.length - maxDiffs} more differences`);
    }

    return lines.join('\n');
}

export function createDiagnosticReport(result, options = {}) {
    const report = {
        session: result.session || result.file,
        type: result.type,
        seed: result.seed,
        passed: result.passed,
        channels: {},
    };

    if (result.firstDivergence) {
        report.channels.rng = {
            divergenceIndex: result.firstDivergence.index,
            step: result.firstDivergence.step,
            depth: result.firstDivergence.depth,
            js: result.firstDivergence.js,
            session: result.firstDivergence.session,
            formatted: formatRngDivergence(result.firstDivergence, options),
        };
    }

    if (result.metrics?.grids?.matched < result.metrics?.grids?.total) {
        report.channels.grid = {
            matched: result.metrics.grids.matched,
            total: result.metrics.grids.total,
        };
    }

    if (result.metrics?.screens?.matched < result.metrics?.screens?.total) {
        report.channels.screen = {
            matched: result.metrics.screens.matched,
            total: result.metrics.screens.total,
        };
    }

    if (result.error) {
        report.channels.error = {
            message: typeof result.error === 'string' ? result.error : result.error.message,
            stack: result.error.stack,
        };
    }

    return report;
}
