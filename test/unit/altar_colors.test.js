// Test altar rendering with alignment-based colors
// C ref: display.h altar_color enum
import { describe, test } from 'node:test';
import assert from 'assert';
import { HeadlessDisplay } from '../comparison/session_helpers.js';
import { GameMap } from '../../js/map.js';
import { ALTAR, A_LAWFUL, A_NEUTRAL, A_CHAOTIC } from '../../js/config.js';

describe('altar colors', () => {

test('altar colors: lawful altar uses white', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = ALTAR;
    map.at(x, y).altarAlign = A_LAWFUL;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '_', 'Altar should use "_" symbol');
    assert.strictEqual(sym.color, 15, 'Lawful altar should use CLR_WHITE (15)');
});

test('altar colors: neutral altar uses gray', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = ALTAR;
    map.at(x, y).altarAlign = A_NEUTRAL;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '_', 'Altar should use "_" symbol');
    assert.strictEqual(sym.color, 7, 'Neutral altar should use CLR_GRAY (7)');
});

test('altar colors: chaotic altar uses black', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = ALTAR;
    map.at(x, y).altarAlign = A_CHAOTIC;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '_', 'Altar should use "_" symbol');
    assert.strictEqual(sym.color, 0, 'Chaotic altar should use CLR_BLACK (0)');
});

test('altar colors: unaligned altar defaults to gray', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = ALTAR;
    // No altarAlign set (undefined)

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '_', 'Altar should use "_" symbol');
    assert.strictEqual(sym.color, 7, 'Unaligned altar should default to CLR_GRAY (7)');
});

}); // describe
