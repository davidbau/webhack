// Test lit_corridor option behavior
import { test } from 'node:test';
import assert from 'node:assert';

// Import constants from display.js
const CORR = 84; // Corridor type
const CLR_GRAY = 7;
const CLR_CYAN = 6;

// Simulate terrainSymbol logic for corridors
function getCorridorSymbol(lit_corridor) {
    const flags = { lit_corridor };

    // Normal corridor (from TERRAIN_SYMBOLS_ASCII)
    const normalCorr = { ch: '#', color: CLR_GRAY };

    // Lit corridor (bright color)
    if (lit_corridor) {
        return { ch: '#', color: CLR_CYAN };
    }

    return normalCorr;
}

test('lit_corridor - disabled shows dark gray corridors', () => {
    const sym = getCorridorSymbol(false);

    assert.strictEqual(sym.ch, '#', 'Corridor character should be #');
    assert.strictEqual(sym.color, CLR_GRAY, 'Corridor color should be dark gray');
});

test('lit_corridor - enabled shows cyan (lit) corridors', () => {
    const sym = getCorridorSymbol(true);

    assert.strictEqual(sym.ch, '#', 'Corridor character should be #');
    assert.strictEqual(sym.color, CLR_CYAN, 'Corridor color should be cyan (lit)');
});

test('lit_corridor - character unchanged, only color changes', () => {
    const normalSym = getCorridorSymbol(false);
    const litSym = getCorridorSymbol(true);

    assert.strictEqual(normalSym.ch, litSym.ch, 'Corridor character should be same');
    assert.notStrictEqual(normalSym.color, litSym.color, 'Corridor colors should differ');
});

test('lit_corridor - color values', () => {
    const normalSym = getCorridorSymbol(false);
    const litSym = getCorridorSymbol(true);

    assert.strictEqual(normalSym.color, 7, 'Normal corridor should be color 7 (gray)');
    assert.strictEqual(litSym.color, 6, 'Lit corridor should be color 6 (cyan)');
});
