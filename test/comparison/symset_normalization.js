// test/comparison/symset_normalization.js
// Canonical glyph normalization for symbol-set comparisons.

// DEC special graphics mapping (VT100 alternate character set).
// NetHack primarily uses the subset below, but we map the full common range
// so ANSI/SO-SI captures and Unicode-rendered captures compare consistently.
export const DEC_SPECIAL_TO_UNICODE = Object.freeze({
    '`': '\u25c6', // diamond
    a: '\u2592', // checkerboard (open door in DECgraphics)
    f: '\u00b0', // degree
    g: '\u00b1', // plus/minus
    h: '\u2424', // newline symbol
    i: '\u240b', // vertical tab symbol
    j: '\u2518',
    k: '\u2510',
    l: '\u250c',
    m: '\u2514',
    n: '\u253c',
    o: '\u23ba',
    p: '\u23bb',
    q: '\u2500',
    r: '\u23bc',
    s: '\u23bd',
    t: '\u251c',
    u: '\u2524',
    v: '\u2534',
    w: '\u252c',
    x: '\u2502',
    y: '\u2264',
    z: '\u2265',
    '{': '\u03c0',
    '|': '\u2260',
    '}': '\u00a3',
    '~': '\u00b7', // centered dot
});

export function decodeDecSpecialChar(ch) {
    return DEC_SPECIAL_TO_UNICODE[String(ch || '')] || String(ch || '');
}

export function normalizeSymsetLine(line, { decGraphics = false } = {}) {
    const src = String(line || '');
    if (!src) return src;
    if (!decGraphics) return src;
    return [...src].map((ch) => decodeDecSpecialChar(ch)).join('');
}
