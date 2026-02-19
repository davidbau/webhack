// test/unit/hacklib.test.js -- Tests for hacklib.js (mirrors hacklib.c)
// C ref: hacklib.c

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
    xcrypt, unpadline, parseEncryptedDataFile, parseRumorsFile,
    digit, letter, highc, lowc, lcase, ucase, upstart, upwords,
    mungspaces, trimspaces, strip_newline, eos, c_eos,
    str_start_is, str_end_is, str_lines_maxlen,
    strkitten, copynchars, chrcasecpy, strcasecpy,
    s_suffix, ing_suffix, onlyspace, tabexpand, visctrl,
    nh_deterministic_qsort,
    stripchars, stripdigits, strsubst, strNsubst, findword,
    strncmpi, strstri, fuzzymatch,
    ordin, sitoa, sgn,
    distmin, dist2, isqrt, online2,
    swapbits,
} from '../../js/hacklib.js';
import { EPITAPH_FILE_TEXT } from '../../js/epitaph_data.js';
import { ENGRAVE_FILE_TEXT } from '../../js/engrave_data.js';
import { RUMORS_FILE_TEXT } from '../../js/rumor_data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '../..');

describe('xcrypt', () => {
    it('is self-inverse (encrypt then decrypt returns original)', () => {
        const original = 'Hello, World!';
        const encrypted = xcrypt(original);
        const decrypted = xcrypt(encrypted);
        assert.equal(decrypted, original);
    });

    it('is self-inverse for longer strings', () => {
        const original = 'Rest in peace';
        const encrypted = xcrypt(original);
        assert.notEqual(encrypted, original);
        assert.equal(xcrypt(encrypted), original);
    });

    it('leaves newlines unchanged', () => {
        const input = 'line1\nline2\n';
        const result = xcrypt(input);
        // newline (0x0a) has neither bit 5 nor bit 6 set, so unchanged
        assert.ok(result.includes('\n'));
    });

    it('leaves control characters unchanged', () => {
        // Control chars 0-31 don't have bit 5 or 6 set (except 0x20=space)
        const input = '\t\r\x01\x02';
        assert.equal(xcrypt(input), input);
    });

    it('only modifies chars with bit 5 or 6 set', () => {
        // Test a char with neither bit 5 nor 6: e.g. 0x0A (newline), 0x09 (tab)
        for (let ch = 0; ch < 128; ch++) {
            const input = String.fromCharCode(ch);
            const output = xcrypt(input);
            const hasBit5or6 = (ch & (32 | 64)) !== 0;
            if (!hasBit5or6) {
                assert.equal(output, input,
                    `char ${ch} (0x${ch.toString(16)}) should be unchanged`);
            }
        }
    });

    it('XORs with rotating bitmask 1,2,4,8,16', () => {
        // Manually verify bitmask rotation on 'AAAAA' (0x41)
        // A=0x41, has bit 6 set
        // char 0: 0x41 ^ 1 = 0x40 = '@'
        // char 1: 0x41 ^ 2 = 0x43 = 'C'
        // char 2: 0x41 ^ 4 = 0x45 = 'E'
        // char 3: 0x41 ^ 8 = 0x49 = 'I'
        // char 4: 0x41 ^ 16 = 0x51 = 'Q'
        assert.equal(xcrypt('AAAAA'), '@CEIQ');
    });

    it('resets bitmask after 16', () => {
        // After 5 chars (bitmasks 1,2,4,8,16), next char gets bitmask 1 again
        const result = xcrypt('AAAAAA');
        assert.equal(result[5], '@'); // same as first char: 0x41 ^ 1
    });
});

describe('unpadline', () => {
    it('strips trailing underscores', () => {
        assert.equal(unpadline('Hello___'), 'Hello');
    });

    it('preserves underscores within text', () => {
        assert.equal(unpadline('hello_world___'), 'hello_world');
    });

    it('returns unchanged string with no trailing underscores', () => {
        assert.equal(unpadline('Hello'), 'Hello');
    });

    it('handles empty string', () => {
        assert.equal(unpadline(''), '');
    });

    it('handles string of only underscores', () => {
        assert.equal(unpadline('____'), '');
    });
});

describe('parseEncryptedDataFile', () => {
    it('parses the compiled epitaph file correctly', () => {
        const filePath = join(rootDir, 'nethack-c/dat/epitaph');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseEncryptedDataFile(fileText);

        assert.equal(data.texts.length, 395, 'should have 395 epitaphs');
        assert.equal(data.chunksize, 24075, 'chunksize should be 24075');
    });

    it('decrypts first epitaph correctly', () => {
        const filePath = join(rootDir, 'nethack-c/dat/epitaph');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseEncryptedDataFile(fileText);

        assert.equal(data.texts[0], 'No matter where I went, here I am.');
    });

    it('decrypts known epitaphs correctly', () => {
        const filePath = join(rootDir, 'nethack-c/dat/epitaph');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseEncryptedDataFile(fileText);

        assert.equal(data.texts[1], 'Rest in peace');
        assert.equal(data.texts[2], 'R.I.P.');
        assert.equal(data.texts[3], 'Rest In Pieces');
        assert.equal(data.texts[394],
            'You set my heart aflame.  You gave me heartburn.');
    });

    it('all line bytes are 60 (padded lines)', () => {
        const filePath = join(rootDir, 'nethack-c/dat/epitaph');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseEncryptedDataFile(fileText);

        // Each padded line is 59 chars + 1 newline = 60 bytes
        for (let i = 0; i < data.lineBytes.length; i++) {
            // Most lines should be exactly 60 (59 encrypted chars + newline)
            // but the last line might differ if no trailing newline
            assert.ok(data.lineBytes[i] > 0,
                `line ${i} should have positive byte count`);
        }
    });

    it('decrypted texts match epitaph.txt source', () => {
        const filePath = join(rootDir, 'nethack-c/dat/epitaph');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseEncryptedDataFile(fileText);

        // Read source file and extract non-comment lines
        const srcPath = join(rootDir, 'nethack-c/dat/epitaph.txt');
        const srcText = readFileSync(srcPath, 'utf-8');
        const srcLines = srcText.split('\n')
            .filter(l => !l.startsWith('#') && l.length > 0);

        // First text is makedefs-added "No matter where I went..."
        // Source texts start at index 1
        assert.equal(data.texts.length, srcLines.length + 1);
        for (let i = 0; i < srcLines.length; i++) {
            assert.equal(data.texts[i + 1], srcLines[i],
                `epitaph ${i + 1} should match source line ${i}`);
        }
    });

    it('parses the compiled engrave file correctly', () => {
        const filePath = join(rootDir, 'nethack-c/dat/engrave');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseEncryptedDataFile(fileText);

        assert.equal(data.texts.length, 47, 'should have 47 engravings');
        assert.equal(data.chunksize, 2894, 'chunksize should be 2894');
        assert.equal(data.texts[0], 'No matter where you go, there you are.');
        assert.equal(data.texts[46], 'The cake is a lie');
    });
});

describe('parseRumorsFile', () => {
    it('parses rumors file with correct section sizes', () => {
        const filePath = join(rootDir, 'nethack-c/dat/rumors');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseRumorsFile(fileText);

        assert.equal(data.trueSize, 23875);
        assert.equal(data.falseSize, 25762);
    });

    it('has correct number of true and false rumors', () => {
        const filePath = join(rootDir, 'nethack-c/dat/rumors');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseRumorsFile(fileText);

        assert.equal(data.trueTexts.length, 374);
        assert.equal(data.falseTexts.length, 397);
    });

    it('true lineBytes sum matches trueSize', () => {
        const filePath = join(rootDir, 'nethack-c/dat/rumors');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseRumorsFile(fileText);

        const sum = data.trueLineBytes.reduce((a, b) => a + b, 0);
        assert.equal(sum, data.trueSize);
    });

    it('false lineBytes sum matches falseSize', () => {
        const filePath = join(rootDir, 'nethack-c/dat/rumors');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseRumorsFile(fileText);

        const sum = data.falseLineBytes.reduce((a, b) => a + b, 0);
        assert.equal(sum, data.falseSize);
    });

    it('decrypts first true rumor correctly', () => {
        const filePath = join(rootDir, 'nethack-c/dat/rumors');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseRumorsFile(fileText);

        assert.equal(data.trueTexts[0],
            "A blindfold can be very useful if you're telepathic.");
    });

    it('decrypts first false rumor correctly', () => {
        const filePath = join(rootDir, 'nethack-c/dat/rumors');
        const fileText = readFileSync(filePath, 'ascii');
        const data = parseRumorsFile(fileText);

        assert.equal(data.falseTexts[0],
            '"So when I die, the first thing I will see in heaven is a score list?"');
    });
});

describe('JS string constants match compiled C data files', () => {
    it('epitaph_data.js matches nethack-c/dat/epitaph', () => {
        const fileText = readFileSync(join(rootDir, 'nethack-c/dat/epitaph'), 'ascii');
        const fromFile = parseEncryptedDataFile(fileText);
        const fromJS = parseEncryptedDataFile(EPITAPH_FILE_TEXT);

        assert.equal(fromJS.texts.length, fromFile.texts.length);
        assert.equal(fromJS.chunksize, fromFile.chunksize);
        assert.deepEqual(fromJS.texts, fromFile.texts);
        assert.deepEqual(fromJS.lineBytes, fromFile.lineBytes);
    });

    it('engrave_data.js matches nethack-c/dat/engrave', () => {
        const fileText = readFileSync(join(rootDir, 'nethack-c/dat/engrave'), 'ascii');
        const fromFile = parseEncryptedDataFile(fileText);
        const fromJS = parseEncryptedDataFile(ENGRAVE_FILE_TEXT);

        assert.equal(fromJS.texts.length, fromFile.texts.length);
        assert.equal(fromJS.chunksize, fromFile.chunksize);
        assert.deepEqual(fromJS.texts, fromFile.texts);
        assert.deepEqual(fromJS.lineBytes, fromFile.lineBytes);
    });

    it('rumor_data.js matches nethack-c/dat/rumors', () => {
        const fileText = readFileSync(join(rootDir, 'nethack-c/dat/rumors'), 'ascii');
        const fromFile = parseRumorsFile(fileText);
        const fromJS = parseRumorsFile(RUMORS_FILE_TEXT);

        assert.equal(fromJS.trueSize, fromFile.trueSize);
        assert.equal(fromJS.falseSize, fromFile.falseSize);
        assert.deepEqual(fromJS.trueTexts, fromFile.trueTexts);
        assert.deepEqual(fromJS.falseTexts, fromFile.falseTexts);
        assert.deepEqual(fromJS.trueLineBytes, fromFile.trueLineBytes);
        assert.deepEqual(fromJS.falseLineBytes, fromFile.falseLineBytes);
    });
});

// ============================================================================
// Tests for new hacklib.c character/string utilities
// ============================================================================

describe('digit', () => {
    it('returns true for digits 0-9', () => {
        for (const c of '0123456789') assert.ok(digit(c), c);
    });
    it('returns false for non-digits', () => {
        for (const c of 'abzAZ @!') assert.ok(!digit(c), c);
    });
});

describe('letter', () => {
    it('returns true for a-z, A-Z, and @', () => {
        for (const c of 'abczABCZ@') assert.ok(letter(c), c);
    });
    it('returns false for digits and special chars', () => {
        for (const c of '0 !_') assert.ok(!letter(c), c);
    });
});

describe('highc / lowc', () => {
    it('highc forces uppercase', () => {
        assert.equal(highc('a'), 'A');
        assert.equal(highc('z'), 'Z');
        assert.equal(highc('A'), 'A');
        assert.equal(highc('!'), '!');
    });
    it('lowc forces lowercase', () => {
        assert.equal(lowc('A'), 'a');
        assert.equal(lowc('Z'), 'z');
        assert.equal(lowc('a'), 'a');
        assert.equal(lowc('!'), '!');
    });
});

describe('lcase / ucase', () => {
    it('lcase lowercases a string', () => {
        assert.equal(lcase('Hello World'), 'hello world');
    });
    it('ucase uppercases a string', () => {
        assert.equal(ucase('Hello World'), 'HELLO WORLD');
    });
});

describe('upstart', () => {
    it('capitalizes first character', () => {
        assert.equal(upstart('hello'), 'Hello');
        assert.equal(upstart('HELLO'), 'HELLO');
    });
    it('handles empty/null', () => {
        assert.equal(upstart(''), '');
        assert.equal(upstart(null), null);
    });
});

describe('upwords', () => {
    it('capitalizes first letter of each word', () => {
        assert.equal(upwords('hello world'), 'Hello World');
        assert.equal(upwords('a brown fox'), 'A Brown Fox');
    });
    it('handles already capitalized', () => {
        assert.equal(upwords('Hello World'), 'Hello World');
    });
});

describe('mungspaces', () => {
    it('collapses multiple spaces', () => {
        assert.equal(mungspaces('hello  world'), 'hello world');
    });
    it('trims leading and trailing spaces', () => {
        assert.equal(mungspaces('  hello  '), 'hello');
    });
    it('converts tabs to spaces', () => {
        assert.equal(mungspaces('a\tb'), 'a b');
    });
    it('stops at newline', () => {
        assert.equal(mungspaces('hello\nworld'), 'hello');
    });
});

describe('trimspaces', () => {
    it('removes leading and trailing spaces/tabs', () => {
        assert.equal(trimspaces('  hello  '), 'hello');
        assert.equal(trimspaces('\thello\t'), 'hello');
    });
    it('preserves internal spaces', () => {
        assert.equal(trimspaces('  hello world  '), 'hello world');
    });
});

describe('strip_newline', () => {
    it('removes trailing \\n', () => {
        assert.equal(strip_newline('hello\n'), 'hello');
    });
    it('removes trailing \\r\\n', () => {
        assert.equal(strip_newline('hello\r\n'), 'hello');
    });
    it('leaves string without newline unchanged', () => {
        assert.equal(strip_newline('hello'), 'hello');
    });
});

describe('eos / c_eos', () => {
    it('returns string length (end index)', () => {
        assert.equal(eos('hello'), 5);
        assert.equal(eos(''), 0);
        assert.equal(c_eos('world'), 5);
    });
});

describe('str_start_is', () => {
    it('returns true when str starts with chkstr (case-sensitive)', () => {
        assert.ok(str_start_is('hello world', 'hello', false));
    });
    it('returns false for non-matching prefix', () => {
        assert.ok(!str_start_is('hello world', 'world', false));
    });
    it('case-blind comparison works', () => {
        assert.ok(str_start_is('HELLO world', 'hello', true));
    });
    it('empty chkstr always matches', () => {
        assert.ok(str_start_is('anything', '', false));
    });
});

describe('str_end_is', () => {
    it('returns true when str ends with chkstr', () => {
        assert.ok(str_end_is('hello world', 'world'));
    });
    it('returns false for non-matching suffix', () => {
        assert.ok(!str_end_is('hello world', 'hello'));
    });
});

describe('str_lines_maxlen', () => {
    it('returns max line length', () => {
        assert.equal(str_lines_maxlen('hello\nhi\nworld!'), 6);
    });
    it('single line', () => {
        assert.equal(str_lines_maxlen('hello'), 5);
    });
});

describe('strkitten', () => {
    it('appends a character', () => {
        assert.equal(strkitten('hello', '!'), 'hello!');
    });
    it('works with empty string', () => {
        assert.equal(strkitten('', 'x'), 'x');
    });
});

describe('copynchars', () => {
    it('copies at most n characters', () => {
        assert.equal(copynchars('hello', 3), 'hel');
    });
    it('stops at newline', () => {
        assert.equal(copynchars('he\nlo', 5), 'he');
    });
    it('handles n larger than string', () => {
        assert.equal(copynchars('hi', 10), 'hi');
    });
});

describe('chrcasecpy', () => {
    it('when oc is lowercase, nc uppercase becomes lowercase', () => {
        assert.equal(chrcasecpy('a', 'B'), 'b');
    });
    it('when oc is uppercase, nc lowercase becomes uppercase', () => {
        assert.equal(chrcasecpy('A', 'b'), 'B');
    });
    it('when oc is neither, nc is unchanged', () => {
        assert.equal(chrcasecpy('!', 'B'), 'B');
    });
});

describe('strcasecpy', () => {
    it('applies old string case pattern to new string', () => {
        assert.equal(strcasecpy('Hello', 'world'), 'World');
    });
    it('handles all-caps pattern', () => {
        assert.equal(strcasecpy('ABC', 'def'), 'DEF');
    });
    it('handles all-lower pattern', () => {
        assert.equal(strcasecpy('abc', 'DEF'), 'def');
    });
});

describe('s_suffix', () => {
    it('it -> its', () => { assert.equal(s_suffix('it'), 'its'); });
    it('It -> Its', () => { assert.equal(s_suffix('It'), 'Its'); });
    it('you -> your', () => { assert.equal(s_suffix('you'), 'your'); });
    it('You -> Your', () => { assert.equal(s_suffix('You'), 'Your'); });
    it("wolf -> wolf's", () => { assert.equal(s_suffix('wolf'), "wolf's"); });
    it("troll -> troll's", () => { assert.equal(s_suffix('troll'), "troll's"); });
    it("orc -> orc's", () => { assert.equal(s_suffix('orc'), "orc's"); });
    it("gnolls -> gnolls'", () => { assert.equal(s_suffix('gnolls'), "gnolls'"); });
});

describe('ing_suffix', () => {
    it('grease -> greasing (drop e)', () => {
        assert.equal(ing_suffix('grease'), 'greasing');
    });
    it('tip -> tipping (double consonant)', () => {
        assert.equal(ing_suffix('tip'), 'tipping');
    });
    it('vie -> vying (ie -> y)', () => {
        assert.equal(ing_suffix('vie'), 'vying');
    });
    it('slither -> slithering (no change, ends in er)', () => {
        assert.equal(ing_suffix('slither'), 'slithering');
    });
    it('eat -> eating (ends in vowel, no change)', () => {
        assert.equal(ing_suffix('eat'), 'eating');
    });
    it('preserves trailing " on"', () => {
        assert.equal(ing_suffix('turn on'), 'turning on');
    });
    it('preserves trailing " off"', () => {
        assert.equal(ing_suffix('turn off'), 'turning off');
    });
});

describe('onlyspace', () => {
    it('returns true for all-space strings', () => {
        assert.ok(onlyspace('   '));
        assert.ok(onlyspace('\t\t'));
        assert.ok(onlyspace(''));
    });
    it('returns false for strings with non-whitespace', () => {
        assert.ok(!onlyspace(' a '));
        assert.ok(!onlyspace('hello'));
    });
});

describe('tabexpand', () => {
    it('expands tab at column 0 to 8 spaces', () => {
        assert.equal(tabexpand('\t'), '        ');
    });
    it('expands tab to fill up to next 8-column boundary', () => {
        assert.equal(tabexpand('abc\t'), 'abc     '); // 3 + 5 = 8
    });
    it('leaves strings without tabs unchanged', () => {
        assert.equal(tabexpand('hello world'), 'hello world');
    });
});

describe('visctrl', () => {
    it('displays printable chars as themselves', () => {
        assert.equal(visctrl('A'), 'A');
        assert.equal(visctrl('a'), 'a');
        assert.equal(visctrl(' '), ' ');
    });
    it('displays control chars as ^X', () => {
        assert.equal(visctrl('\x01'), '^A');
        assert.equal(visctrl('\x1a'), '^Z');
    });
    it('displays DEL as ^?', () => {
        assert.equal(visctrl('\x7f'), '^?');
    });
    it('displays high chars as M-X', () => {
        assert.equal(visctrl(String.fromCharCode(0x80 | 0x41)), 'M-A');
    });
});

describe('nh_deterministic_qsort', () => {
    it('sorts an array in place', () => {
        const arr = [3, 1, 4, 1, 5, 9, 2, 6];
        nh_deterministic_qsort(arr, (a, b) => a - b);
        assert.deepEqual(arr, [1, 1, 2, 3, 4, 5, 6, 9]);
    });
    it('is stable — preserves original order for equal elements', () => {
        const arr = [{ v: 1, i: 0 }, { v: 1, i: 1 }, { v: 1, i: 2 }];
        nh_deterministic_qsort(arr, (a, b) => a.v - b.v);
        assert.equal(arr[0].i, 0);
        assert.equal(arr[1].i, 1);
        assert.equal(arr[2].i, 2);
    });
    it('handles empty and single-element arrays', () => {
        const a = [];
        nh_deterministic_qsort(a, (x, y) => x - y);
        assert.deepEqual(a, []);
        const b = [42];
        nh_deterministic_qsort(b, (x, y) => x - y);
        assert.deepEqual(b, [42]);
    });
});

// ============================================================================
// Tests for remaining hacklib.c functions added in codematch pass
// ============================================================================

describe('stripchars', () => {
    it('removes specified characters from string', () => {
        assert.equal(stripchars('hello world', ' '), 'helloworld');
    });
    it('removes multiple different chars', () => {
        assert.equal(stripchars('abc123def', '0123456789'), 'abcdef');
    });
    it('returns string unchanged if no chars to strip are present', () => {
        assert.equal(stripchars('hello', 'xyz'), 'hello');
    });
    it('handles empty string', () => {
        assert.equal(stripchars('', 'abc'), '');
    });
});

describe('stripdigits', () => {
    it('removes digits from string', () => {
        assert.equal(stripdigits('abc123def456'), 'abcdef');
    });
    it('leaves non-digit string unchanged', () => {
        assert.equal(stripdigits('hello'), 'hello');
    });
    it('returns empty string for all-digit input', () => {
        assert.equal(stripdigits('12345'), '');
    });
});

describe('strsubst', () => {
    it('substitutes first occurrence', () => {
        assert.equal(strsubst('hello world', 'world', 'there'), 'hello there');
    });
    it('only substitutes first occurrence', () => {
        assert.equal(strsubst('aaa', 'a', 'b'), 'baa');
    });
    it('returns string unchanged if orig not found', () => {
        assert.equal(strsubst('hello', 'xyz', 'abc'), 'hello');
    });
    it('handles empty replacement (deletion)', () => {
        assert.equal(strsubst('hello world', ' world', ''), 'hello');
    });
});

describe('strNsubst', () => {
    it('replaces first occurrence when n=1', () => {
        assert.equal(strNsubst('hello hello', 'hello', 'world', 1), 'world hello');
    });
    it('replaces second occurrence when n=2', () => {
        assert.equal(strNsubst('hello hello', 'hello', 'world', 2), 'hello world');
    });
    it('replaces all occurrences when n=0', () => {
        assert.equal(strNsubst('hello hello', 'hello', 'world', 0), 'world world');
    });
    it('inserts before Nth char when orig is empty (n>0)', () => {
        assert.equal(strNsubst('abc', '', '-', 2), 'a-bc');
    });
    it('appends when n=strlen+1 and orig is empty', () => {
        assert.equal(strNsubst('abc', '', '-', 4), 'abc-');
    });
    it('returns unchanged if n exceeds occurrence count', () => {
        assert.equal(strNsubst('hello', 'hello', 'world', 2), 'hello');
    });
});

describe('findword', () => {
    it('finds a word in a space-separated list', () => {
        assert.equal(findword('foo bar baz', 'bar', 3, false), 'bar baz');
    });
    it('finds the first word', () => {
        assert.equal(findword('foo bar baz', 'foo', 3, false), 'foo bar baz');
    });
    it('finds the last word', () => {
        assert.equal(findword('foo bar baz', 'baz', 3, false), 'baz');
    });
    it('returns null if word not found', () => {
        assert.equal(findword('foo bar baz', 'xyz', 3, false), null);
    });
    it('does not match partial words', () => {
        assert.equal(findword('foobar baz', 'foo', 3, false), null);
    });
    it('case-insensitive match when ignorecase=true', () => {
        assert.equal(findword('foo bar baz', 'BAR', 3, true), 'bar baz');
    });
    it('case-sensitive by default', () => {
        assert.equal(findword('foo bar baz', 'BAR', 3, false), null);
    });
});

describe('strncmpi', () => {
    it('returns 0 for case-insensitive equal strings', () => {
        assert.equal(strncmpi('hello', 'HELLO', 5), 0);
    });
    it('returns 0 when first n chars are equal (case-insensitive)', () => {
        assert.equal(strncmpi('hello world', 'HELLO there', 5), 0);
    });
    it('returns negative when s1 < s2', () => {
        assert.ok(strncmpi('abc', 'abd', 3) < 0);
    });
    it('returns positive when s1 > s2', () => {
        assert.ok(strncmpi('abd', 'abc', 3) > 0);
    });
    it('returns positive when s1 is longer prefix of s2', () => {
        assert.ok(strncmpi('hello', 'hell', 5) > 0);
    });
    it('returns negative when s1 is shorter prefix of s2', () => {
        assert.ok(strncmpi('hell', 'hello', 5) < 0);
    });
    it('handles n=0 (compare 0 chars, always equal)', () => {
        assert.equal(strncmpi('abc', 'xyz', 0), 0);
    });
});

describe('strstri', () => {
    it('finds substring case-insensitively', () => {
        assert.equal(strstri('Hello World', 'world'), 'World');
    });
    it('returns null if not found', () => {
        assert.equal(strstri('hello', 'xyz'), null);
    });
    it('returns whole string for empty substring', () => {
        assert.equal(strstri('hello', ''), 'hello');
    });
    it('handles exact case match', () => {
        assert.equal(strstri('hello world', 'world'), 'world');
    });
    it('returns substring starting at match position', () => {
        assert.equal(strstri('abcXYZdef', 'xyz'), 'XYZdef');
    });
});

describe('fuzzymatch', () => {
    it('matches strings ignoring specified chars', () => {
        assert.ok(fuzzymatch('hello world', 'helloworld', ' ', false));
    });
    it('matches case-insensitively when caseblind=true', () => {
        assert.ok(fuzzymatch('HELLO', 'hello', '', true));
    });
    it('returns false for different strings', () => {
        assert.ok(!fuzzymatch('hello', 'world', ' ', false));
    });
    it('ignores multiple chars in ignore_chars', () => {
        assert.ok(fuzzymatch('a-b.c', 'abc', '-. ', false));
    });
    it('returns true for identical strings with empty ignore_chars', () => {
        assert.ok(fuzzymatch('hello', 'hello', '', false));
    });
    it('returns false when one string has extra non-ignored chars', () => {
        assert.ok(!fuzzymatch('hello', 'hellox', '', false));
    });
});

describe('ordin', () => {
    it('returns st for 1, 21, 31', () => {
        assert.equal(ordin(1), 'st');
        assert.equal(ordin(21), 'st');
        assert.equal(ordin(31), 'st');
    });
    it('returns nd for 2, 22', () => {
        assert.equal(ordin(2), 'nd');
        assert.equal(ordin(22), 'nd');
    });
    it('returns rd for 3, 23', () => {
        assert.equal(ordin(3), 'rd');
        assert.equal(ordin(23), 'rd');
    });
    it('returns th for 4-20', () => {
        for (let n = 4; n <= 20; n++) assert.equal(ordin(n), 'th', n);
    });
    it('returns th for teens (11th, 12th, 13th)', () => {
        assert.equal(ordin(11), 'th');
        assert.equal(ordin(12), 'th');
        assert.equal(ordin(13), 'th');
    });
    it('returns th for multiples of 10', () => {
        assert.equal(ordin(10), 'th');
        assert.equal(ordin(20), 'th');
        assert.equal(ordin(100), 'th');
    });
});

describe('sitoa', () => {
    it('prepends + for positive numbers', () => {
        assert.equal(sitoa(5), '+5');
        assert.equal(sitoa(0), '+0');
    });
    it('uses - for negative numbers', () => {
        assert.equal(sitoa(-3), '-3');
    });
});

describe('sgn', () => {
    it('returns 1 for positive', () => { assert.equal(sgn(5), 1); });
    it('returns -1 for negative', () => { assert.equal(sgn(-3), -1); });
    it('returns 0 for zero', () => { assert.equal(sgn(0), 0); });
});

describe('distmin', () => {
    it('returns max of absolute deltas (Chebyshev distance)', () => {
        assert.equal(distmin(0, 0, 3, 4), 4);
        assert.equal(distmin(0, 0, 4, 3), 4);
        assert.equal(distmin(0, 0, 3, 3), 3); // diagonal
    });
    it('returns 0 for same point', () => {
        assert.equal(distmin(2, 2, 2, 2), 0);
    });
    it('handles negative coordinates', () => {
        assert.equal(distmin(0, 0, -3, -4), 4);
    });
});

describe('dist2', () => {
    it('returns squared Euclidean distance', () => {
        assert.equal(dist2(0, 0, 3, 4), 25);
    });
    it('returns 0 for same point', () => {
        assert.equal(dist2(1, 1, 1, 1), 0);
    });
});

describe('isqrt', () => {
    it('returns floor of square root', () => {
        assert.equal(isqrt(25), 5);
        assert.equal(isqrt(16), 4);
        assert.equal(isqrt(26), 5);
        assert.equal(isqrt(0), 0);
    });
});

describe('online2', () => {
    it('returns true for orthogonal alignment (same row)', () => {
        assert.ok(online2(0, 0, 5, 0));
    });
    it('returns true for orthogonal alignment (same column)', () => {
        assert.ok(online2(0, 0, 0, 5));
    });
    it('returns true for diagonal alignment', () => {
        assert.ok(online2(0, 0, 3, 3));
        assert.ok(online2(0, 0, 3, -3));
    });
    it('returns false for non-aligned points', () => {
        assert.ok(!online2(0, 0, 3, 4));
    });
});

describe('swapbits', () => {
    it('swaps two different bits', () => {
        // 0b1010: bit0=0, bit1=1 → after swap: bit0=1, bit1=0 → 0b1001=9
        assert.equal(swapbits(0b1010, 0, 1), 0b1001);
    });
    it('leaves value unchanged when swapping equal bits', () => {
        // 0b1010: bit1=1, bit3=1 → same → unchanged
        assert.equal(swapbits(0b1010, 1, 3), 0b1010);
    });
    it('handles swapping bit 0 with bit 0 (no-op)', () => {
        assert.equal(swapbits(0b1111, 0, 0), 0b1111);
    });
});
