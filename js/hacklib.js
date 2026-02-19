// hacklib.js — String and character utility functions
// Faithful port of hacklib.c from NetHack 3.7.
//
// Note on JS semantics: C functions that modify strings in-place (lcase, ucase,
// upstart, upwords, mungspaces, trimspaces, strip_newline, strkitten, copynchars,
// strcasecpy, tabexpand) return new strings in JS because JS strings are immutable.

// ============================================================================
// Character predicates and case conversion
// C ref: hacklib.c:125-150
// ============================================================================

// hacklib.c:125 — is 'c' a digit?
export function digit(c) {
    return c >= '0' && c <= '9';
}

// hacklib.c:132 — is 'c' a letter? note: '@' classed as letter
export function letter(c) {
    return ('@' <= c && c <= 'Z') || ('a' <= c && c <= 'z');
}

// hacklib.c:139 — force 'c' into uppercase
export function highc(c) {
    return (c >= 'a' && c <= 'z')
        ? String.fromCharCode(c.charCodeAt(0) & ~0x20)
        : c;
}

// hacklib.c:146 — force 'c' into lowercase
export function lowc(c) {
    return (c >= 'A' && c <= 'Z')
        ? String.fromCharCode(c.charCodeAt(0) | 0x20)
        : c;
}

// ============================================================================
// String case conversion
// C ref: hacklib.c:153-203
// Note: JS versions return new strings (C modifies in-place).
// ============================================================================

// hacklib.c:153 — convert a string into all lowercase
export function lcase(s) {
    return s.toLowerCase();
}

// hacklib.c:166 — convert a string into all uppercase
export function ucase(s) {
    return s.toUpperCase();
}

// hacklib.c:177 — convert first character of a string to uppercase
export function upstart(s) {
    if (!s) return s;
    return highc(s[0]) + s.slice(1);
}

// hacklib.c:186 — capitalize first letter of every word in a string
export function upwords(s) {
    let result = '';
    let space = true;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === ' ') {
            space = true;
            result += c;
        } else if (space && letter(c)) {
            result += highc(c);
            space = false;
        } else {
            result += c;
            space = false;
        }
    }
    return result;
}

// ============================================================================
// String whitespace and newline handling
// C ref: hacklib.c:205-255
// Note: JS versions return new strings (C modifies in-place).
// ============================================================================

// hacklib.c:205 — remove excess whitespace (collapse runs, trim ends, stop at \n)
export function mungspaces(bp) {
    let result = '';
    let was_space = true;
    for (let i = 0; i < bp.length; i++) {
        let c = bp[i];
        if (c === '\n') break;
        if (c === '\t') c = ' ';
        if (c !== ' ' || !was_space) result += c;
        was_space = (c === ' ');
    }
    if (was_space && result.length > 0)
        result = result.slice(0, -1);
    return result;
}

// hacklib.c:227 — skip leading whitespace; remove trailing whitespace
export function trimspaces(txt) {
    return txt.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
}

// hacklib.c:243 — remove \n from end of line (and \r if present)
export function strip_newline(str) {
    return str.replace(/\r?\n$/, '');
}

// ============================================================================
// String end/length utilities
// C ref: hacklib.c:257-274
// Note: C eos() returns a char* pointer to '\0'. JS returns the string length
// (the index where '\0' would be), which is the natural JS equivalent.
// ============================================================================

// hacklib.c:257 — return the index of the end of a string (= length)
export function eos(s) {
    return s.length;
}

// hacklib.c:266 — const version of eos()
export function c_eos(s) {
    return s.length;
}

// ============================================================================
// String comparison utilities
// C ref: hacklib.c:277-337
// ============================================================================

// hacklib.c:277 — determine whether 'str' starts with 'chkstr', optionally case-blind
export function str_start_is(str, chkstr, caseblind) {
    if (caseblind)
        return str.toLowerCase().startsWith(chkstr.toLowerCase());
    return str.startsWith(chkstr);
}

// hacklib.c:305 — determine whether 'str' ends with 'chkstr'
export function str_end_is(str, chkstr) {
    return str.endsWith(chkstr);
}

// hacklib.c:316 — return max line length from newline-separated string
export function str_lines_maxlen(str) {
    let max_len = 0;
    const lines = str.split('\n');
    for (const line of lines) {
        if (line.length > max_len) max_len = line.length;
    }
    return max_len;
}

// ============================================================================
// String building utilities
// C ref: hacklib.c:340-408
// Note: strkitten/copynchars/strcasecpy return new strings in JS.
// ============================================================================

// hacklib.c:340 — append a character to a string: strcat(s, {c,'\0'})
export function strkitten(s, c) {
    return s + c;
}

// hacklib.c:350 — truncating string copy (stops at n chars or '\n')
// Returns the copied string (JS: no separate dst buffer needed).
export function copynchars(src, n) {
    let result = '';
    for (let i = 0; i < n && i < src.length && src[i] !== '\n'; i++) {
        result += src[i];
    }
    return result;
}

// hacklib.c:365 — convert char nc into oc's case
export function chrcasecpy(oc, nc) {
    if ('a' <= oc && oc <= 'z') {
        if ('A' <= nc && nc <= 'Z') nc = String.fromCharCode(nc.charCodeAt(0) + ('a'.charCodeAt(0) - 'A'.charCodeAt(0)));
    } else if ('A' <= oc && oc <= 'Z') {
        if ('a' <= nc && nc <= 'z') nc = String.fromCharCode(nc.charCodeAt(0) + ('A'.charCodeAt(0) - 'a'.charCodeAt(0)));
    }
    return nc;
}

// hacklib.c:387 — overwrite string, preserving old chars' case
// In JS: applies old string's case pattern to new string src.
export function strcasecpy(dst, src) {
    let result = '';
    let dst_exhausted = false;
    let dstIdx = 0;
    for (let i = 0; i < src.length; i++) {
        if (!dst_exhausted && dstIdx >= dst.length) dst_exhausted = true;
        const oc = dst_exhausted ? dst[dst.length - 1] : dst[dstIdx++];
        result += chrcasecpy(oc || '', src[i]);
    }
    return result;
}

// ============================================================================
// English suffix helpers (used by message formatting)
// C ref: hacklib.c:409-494
// ============================================================================

// hacklib.c:409 — return a name converted to possessive
export function s_suffix(s) {
    const lower = s.toLowerCase();
    if (lower === 'it') return s + 's';       // it -> its
    if (lower === 'you') return s + 'r';      // you -> your
    if (s[s.length - 1] === 's') return s + "'";  // Xs -> Xs'
    return s + "'s";                           // X -> X's
}

// hacklib.c:427 — construct a gerund (verb + "ing")
export function ing_suffix(s) {
    const vowel = 'aeiouwy';
    let buf = s;
    let onoff = '';

    // Extract trailing " on", " off", " with"
    if (buf.length >= 3 && buf.slice(-3).toLowerCase() === ' on') {
        onoff = ' on'; buf = buf.slice(0, -3);
    } else if (buf.length >= 4 && buf.slice(-4).toLowerCase() === ' off') {
        onoff = ' off'; buf = buf.slice(0, -4);
    } else if (buf.length >= 5 && buf.slice(-5).toLowerCase() === ' with') {
        onoff = ' with'; buf = buf.slice(0, -5);
    }

    const p = buf.length;
    if (p >= 2 && buf.slice(-2).toLowerCase() === 'er') {
        // slither + ing — nothing
    } else if (p >= 3
        && !vowel.includes(buf[p - 1].toLowerCase())
        && vowel.includes(buf[p - 2].toLowerCase())
        && !vowel.includes(buf[p - 3].toLowerCase())) {
        // tip -> tipp + ing
        buf = buf + buf[p - 1];
    } else if (p >= 2 && buf.slice(-2).toLowerCase() === 'ie') {
        // vie -> vy + ing
        buf = buf.slice(0, -2) + 'y';
    } else if (p >= 1 && buf[p - 1] === 'e') {
        // grease -> greas + ing
        buf = buf.slice(0, -1);
    }

    return buf + 'ing' + onoff;
}

// ============================================================================
// Miscellaneous utilities
// C ref: hacklib.c:482-575
// ============================================================================

// hacklib.c:483 — is a string entirely whitespace?
export function onlyspace(s) {
    for (let i = 0; i < s.length; i++) {
        if (s[i] !== ' ' && s[i] !== '\t') return false;
    }
    return true;
}

// hacklib.c:493 — expand tabs into proper number of spaces (8-column tabs)
// JS returns a new string (C modifies in-place).
export function tabexpand(sbuf) {
    let result = '';
    let idx = 0;
    for (let i = 0; i < sbuf.length; i++) {
        if (sbuf[i] === '\t') {
            do { result += ' '; } while (++idx % 8);
        } else {
            result += sbuf[i];
            idx++;
        }
        if (idx >= 512) break; // BUFSZ safety limit
    }
    return result;
}

// hacklib.c:533 — make a displayable string from a character
// In C this returns one of 5 rotating static buffers; in JS just returns a string.
export function visctrl(c) {
    const code = typeof c === 'string' ? c.charCodeAt(0) : c;
    let result = '';
    let ch = code;
    if (ch & 0x80) {
        result += 'M-';
        ch &= 0x7f;
    }
    if (ch < 0x20) {
        result += '^' + String.fromCharCode(ch | 0x40); // letter
    } else if (ch === 0x7f) {
        result += '^?';
    } else {
        result += String.fromCharCode(ch);
    }
    return result;
}

// ============================================================================
// String strip utilities
// C ref: hacklib.c:560-595
// Note: C functions modify strings in-place; JS versions return new strings.
// ============================================================================

// hacklib.c:560 — strip all chars in stuff_to_strip from orig
// C signature: stripchars(char *bp, const char *stuff_to_strip, const char *orig)
// JS: bp output buffer dropped; takes (orig, stuff_to_strip), returns new string.
export function stripchars(orig, stuff_to_strip) {
    let result = '';
    for (let i = 0; i < orig.length; i++) {
        if (!stuff_to_strip.includes(orig[i])) result += orig[i];
    }
    return result;
}

// hacklib.c:584 — remove digits from string
export function stripdigits(s) {
    return s.replace(/[0-9]/g, '');
}

// ============================================================================
// String substitution utilities
// C ref: hacklib.c:599-684
// Note: C functions modify strings in-place; JS versions return new strings.
// Note: strNsubst C return value is substitution count; JS returns new string.
// ============================================================================

// hacklib.c:599 — substitute first occurrence of orig with replacement in bp
export function strsubst(bp, orig, replacement) {
    const idx = bp.indexOf(orig);
    if (idx < 0) return bp;
    return bp.slice(0, idx) + replacement + bp.slice(idx + orig.length);
}

// hacklib.c:619 — substitute Nth occurrence of orig with replacement (n=0: all)
// C: modifies inoutbuf in place, returns substitution count.
// JS: returns the modified string.
export function strNsubst(inoutbuf, orig, replacement, n) {
    const len = orig.length;
    if (len === 0) {
        // Special case: empty orig — insert replacement before Nth char (n>0)
        // or before every char (n=0), or append if n==strlen+1.
        let result = '';
        let ocount = 0;
        for (let i = 0; i < inoutbuf.length; i++) {
            if (++ocount === n || n === 0) result += replacement;
            result += inoutbuf[i];
        }
        if (inoutbuf.length + 1 === n) result += replacement;
        return result;
    }
    let result = '';
    let ocount = 0;
    let bp = 0;
    while (bp < inoutbuf.length) {
        if (inoutbuf.startsWith(orig, bp) && (++ocount === n || n === 0)) {
            result += replacement;
            bp += len;
        } else {
            result += inoutbuf[bp++];
        }
    }
    return result;
}

// hacklib.c:663 — search for word in space-separated list
// C: returns pointer into list at start of found word, or NULL.
// JS: returns the slice of list starting at the found word, or null.
export function findword(list, word, wordlen, ignorecase) {
    const w = word.slice(0, wordlen);
    let p = 0;
    while (p < list.length) {
        while (p < list.length && list[p] === ' ') p++;
        if (p >= list.length) break;
        const candidate = list.slice(p, p + wordlen);
        const afterWord = p + wordlen;
        const atWordEnd = afterWord >= list.length || list[afterWord] === ' ';
        const matches = ignorecase
            ? candidate.toLowerCase() === w.toLowerCase()
            : candidate === w;
        if (matches && atWordEnd) return list.slice(p);
        // advance to next space (C: strchr(p + 1, ' '))
        const spaceIdx = list.indexOf(' ', p + 1);
        if (spaceIdx < 0) break;
        p = spaceIdx;
    }
    return null;
}

// ============================================================================
// Case-insensitive string comparison
// C ref: hacklib.c:781-843
// ============================================================================

// hacklib.c:781 — case-insensitive counted string comparison
// Returns negative if s1 < s2, 0 if equal, positive if s1 > s2.
export function strncmpi(s1, s2, n) {
    for (let i = 0; i < n; i++) {
        if (i >= s2.length) return s1.length > i ? 1 : 0;
        if (i >= s1.length) return -1;
        const t1 = s1[i].toLowerCase();
        const t2 = s2[i].toLowerCase();
        if (t1 < t2) return -1;
        if (t1 > t2) return 1;
    }
    return 0;
}

// hacklib.c:803 — case-insensitive substring search
// C: returns pointer to match in str, or NULL.
// JS: returns the slice of str starting at the match, or null.
export function strstri(str, sub) {
    if (sub === '') return str;
    const idx = str.toLowerCase().indexOf(sub.toLowerCase());
    return idx < 0 ? null : str.slice(idx);
}

// hacklib.c:848 — compare two strings ignoring specified chars, optionally case-blind
export function fuzzymatch(s1, s2, ignore_chars, caseblind) {
    let i1 = 0, i2 = 0;
    for (;;) {
        while (i1 < s1.length && ignore_chars.includes(s1[i1])) i1++;
        while (i2 < s2.length && ignore_chars.includes(s2[i2])) i2++;
        const c1 = i1 < s1.length ? s1[i1++] : null;
        const c2 = i2 < s2.length ? s2[i2++] : null;
        if (!c1 || !c2) return c1 === c2;
        const cmp1 = caseblind ? c1.toLowerCase() : c1;
        const cmp2 = caseblind ? c2.toLowerCase() : c2;
        if (cmp1 !== cmp2) return false;
    }
}

// ============================================================================
// Number formatting utilities
// C ref: hacklib.c:689-717
// ============================================================================

// hacklib.c:689 — return the ordinal suffix of a number (1st, 2nd, 3rd, 4th...)
export function ordin(n) {
    const dd = n % 10;
    return (dd === 0 || dd > 3 || Math.floor((n % 100) / 10) === 1)
        ? 'th' : (dd === 1) ? 'st' : (dd === 2) ? 'nd' : 'rd';
}

// hacklib.c:701 — make a signed digit string from a number ("+3" or "-2")
export function sitoa(n) {
    return n < 0 ? String(n) : '+' + String(n);
}

// hacklib.c:714 — return the sign of a number: -1, 0, or 1
export function sgn(n) {
    return n < 0 ? -1 : (n !== 0 ? 1 : 0);
}

// ============================================================================
// Geometry utilities
// C ref: hacklib.c:720-774
// ============================================================================

// hacklib.c:720 — distance between two points in moves (Chebyshev distance)
export function distmin(x0, y0, x1, y1) {
    const dx = Math.abs(x0 - x1), dy = Math.abs(y0 - y1);
    return dx < dy ? dy : dx;
}

// hacklib.c:737 — square of Euclidean distance between pair of points
export function dist2(x0, y0, x1, y1) {
    const dx = x0 - x1, dy = y0 - y1;
    return dx * dx + dy * dy;
}

// hacklib.c:746 — integer square root (floor(sqrt(val))); not in C comment block
export function isqrt(val) {
    return Math.floor(Math.sqrt(val));
}

// hacklib.c:768 — are two points lined up (orthogonal or diagonal)?
export function online2(x0, y0, x1, y1) {
    const dx = x0 - x1, dy = y0 - y1;
    return !dy || !dx || dy === dx || dy === -dx;
}

// ============================================================================
// Bit manipulation
// C ref: hacklib.c:894-900
// ============================================================================

// hacklib.c:894 — swap bit at position bita with bit at position bitb in val
export function swapbits(val, bita, bitb) {
    const tmp = ((val >> bita) & 1) ^ ((val >> bitb) & 1);
    return val ^ ((tmp << bita) | (tmp << bitb));
}

// ============================================================================
// Deterministic sort (stable, index-tiebreaking)
// C ref: hacklib.c:36-122 nh_deterministic_qsort()
//
// JS version: sorts array in place using comparator, with original-index
// tiebreaking to ensure deterministic order across platforms.
// Unlike C which operates on raw bytes, this takes a JS array directly.
// ============================================================================

// hacklib.c:36 — deterministic replacement for qsort(), stable across platforms
export function nh_deterministic_qsort(arr, comparator) {
    if (!arr || arr.length < 2) return;
    const indexed = arr.map((item, i) => ({ item, i }));
    indexed.sort((a, b) => {
        const c = comparator(a.item, b.item);
        return c !== 0 ? c : a.i - b.i;
    });
    for (let i = 0; i < arr.length; i++) arr[i] = indexed[i].item;
}

// ============================================================================
// Data file utilities (JS-only, no C counterpart)
// ============================================================================

// xcrypt: XOR each char that has bit 5 or 6 set with a rotating bitmask
// (1,2,4,8,16). C ref: hacklib.c:464 xcrypt().
// JS version: takes str only (no output buffer needed), returns new string.
export function xcrypt(str) {
    let result = '';
    let bitmask = 1;
    for (let i = 0; i < str.length; i++) {
        let ch = str.charCodeAt(i);
        if (ch & (32 | 64)) ch ^= bitmask;
        if ((bitmask <<= 1) >= 32) bitmask = 1;
        result += String.fromCharCode(ch);
    }
    return result;
}

// Strip trailing underscores added by makedefs padding.
// C ref: rumors.c unpadline() — strips trailing '_' characters.
export function unpadline(str) {
    return str.replace(/_+$/, '');
}

// Parse a makedefs-compiled encrypted data file (epitaph, engrave, etc.).
// Format: 1 header line (skipped) + N encrypted+padded data lines.
// Returns { texts: string[], lineBytes: number[], chunksize: number }
export function parseEncryptedDataFile(fileText) {
    const allLines = fileText.split('\n');
    // Skip header line ("# This data file is generated by makedefs...")
    // and trailing empty string from final newline
    const dataLines = allLines.slice(1).filter(l => l.length > 0);
    const texts = [];
    const lineBytes = [];
    for (const line of dataLines) {
        const decrypted = unpadline(xcrypt(line));
        texts.push(decrypted);
        lineBytes.push(line.length + 1); // +1 for newline byte in file
    }
    const chunksize = lineBytes.reduce((a, b) => a + b, 0);
    return { texts, lineBytes, chunksize };
}

// Parse the makedefs-compiled rumors file which has two sections (true + false).
// Format: header line, index line, then true rumors followed by false rumors.
// Index line: "%04d,%06ld,%06lx;%04d,%06ld,%06lx;0,0,%06lx"
//   = trueCount(dec), trueSize(dec), trueOffset(hex);
//     falseCount(dec), falseSize(dec), falseOffset(hex); 0,0,eofOffset(hex)
// Returns { trueTexts, trueLineBytes, trueSize, falseTexts, falseLineBytes, falseSize }
export function parseRumorsFile(fileText) {
    const allLines = fileText.split('\n');
    // Line 0: "# This data file..." header (skipped)
    // Line 1: index line with section sizes and offsets
    const indexLine = allLines[1];
    const [truePart, falsePart] = indexLine.split(';');
    const trueParts = truePart.split(',');
    const falseParts = falsePart.split(',');
    const trueSize = parseInt(trueParts[1], 10);
    const falseSize = parseInt(falseParts[1], 10);

    // Data lines start at line 2
    const dataLines = allLines.slice(2).filter(l => l.length > 0);

    const trueTexts = [];
    const trueLineBytes = [];
    const falseTexts = [];
    const falseLineBytes = [];
    let cumBytes = 0;

    for (const line of dataLines) {
        const bytes = line.length + 1; // +1 for newline
        const decrypted = unpadline(xcrypt(line));
        if (cumBytes < trueSize) {
            trueTexts.push(decrypted);
            trueLineBytes.push(bytes);
        } else {
            falseTexts.push(decrypted);
            falseLineBytes.push(bytes);
        }
        cumBytes += bytes;
    }

    return { trueTexts, trueLineBytes, trueSize, falseTexts, falseLineBytes, falseSize };
}
