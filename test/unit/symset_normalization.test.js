import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDecSpecialChar, normalizeSymsetLine } from '../comparison/symset_normalization.js';

describe('symset normalization', () => {
    it('maps DEC wall and floor characters to Unicode', () => {
        assert.equal(normalizeSymsetLine('lqkxmjntuvw~', { decGraphics: true }), '┌─┐│└┘┼├┤┴┬·');
    });

    it('maps DEC open-door checkerboard correctly', () => {
        assert.equal(decodeDecSpecialChar('a'), '▒');
        assert.equal(normalizeSymsetLine('a', { decGraphics: true }), '▒');
    });

    it('leaves non-dec lines unchanged', () => {
        assert.equal(normalizeSymsetLine('a~lq', { decGraphics: false }), 'a~lq');
    });
});
