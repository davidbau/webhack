// test/comparison/comparators.js -- Pure comparison helpers for session replay.

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

export function compareRng(jsRng = [], expectedRng = [], options = {}) {
    const actual = normalizeRngEntries(jsRng, options);
    const expected = normalizeRngEntries(expectedRng, options);
    const total = Math.max(actual.length, expected.length);

    let matched = 0;
    let firstDivergence = null;

    for (let i = 0; i < total; i++) {
        if (actual[i] === expected[i]) {
            matched++;
            continue;
        }
        if (!firstDivergence) {
            firstDivergence = {
                index: i,
                js: actual[i],
                session: expected[i],
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
