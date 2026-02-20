// Test secret door rendering with correct orientation
// C ref: display.c - secret doors appear as walls matching their orientation
import { describe, test } from 'node:test';
import assert from 'assert';
import { HeadlessDisplay } from '../comparison/session_helpers.js';
import { GameMap } from '../../js/map.js';
import { SDOOR, HWALL, VWALL } from '../../js/config.js';

describe('secret door symbols', () => {

test('secret door symbols: vertical secret door uses - (walls E/W)', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    // Create a vertical secret door (walls to east and west)
    //  #|#  (secret door between walls)
    const x = 10, y = 10;
    map.at(x - 1, y).typ = HWALL;    // west
    map.at(x, y).typ = SDOOR;
    map.at(x + 1, y).typ = HWALL;    // east

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '-', 'Horizontal secret door should use "-" (appears as horizontal wall)');
    assert.strictEqual(sym.color, 7, 'Secret door should use CLR_GRAY (7)');
});

test('secret door symbols: horizontal secret door uses | (walls N/S)', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    // Create a horizontal secret door (walls to north and south)
    //   #
    //   -   (secret door)
    //   #
    const x = 10, y = 10;
    map.at(x, y - 1).typ = VWALL;    // north
    map.at(x, y).typ = SDOOR;
    map.at(x, y + 1).typ = VWALL;    // south

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '|', 'Vertical secret door should use "|" (appears as vertical wall)');
    assert.strictEqual(sym.color, 7, 'Secret door should use CLR_GRAY (7)');
});

test('secret door symbols: DECgraphics uses Unicode box-drawing', () => {
    const display = new HeadlessDisplay(80, 24);
    display.flags = { DECgraphics: true };
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = SDOOR;
    map.at(x - 1, y).typ = HWALL;  // horizontal secret door
    map.at(x + 1, y).typ = HWALL;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '\u2500', 'DECgraphics secret door should use box horizontal character');
    assert.strictEqual(sym.color, 7, 'Secret door should use CLR_GRAY (7)');
});

}); // describe
