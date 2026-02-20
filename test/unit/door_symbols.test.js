// Test door symbol rendering matching C NetHack
// C ref: defsym.h PCHAR definitions for S_vodoor, S_hodoor, S_vcdoor, S_hcdoor
import { describe, test } from 'node:test';
import assert from 'assert';
import { HeadlessDisplay } from '../comparison/session_helpers.js';
import { GameMap } from '../../js/map.js';
import {
    DOOR, VWALL, HWALL, ROOM, COLNO, ROWNO,
    D_ISOPEN, D_CLOSED, D_LOCKED, D_NODOOR
} from '../../js/config.js';

describe('door symbols', () => {

test('door symbols: vertical open door uses - (walls N/S)', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    // Create a vertical door (walls to north and south)
    //   #
    //   -   (door)
    //   #
    const x = 10, y = 10;
    map.at(x, y - 1).typ = VWALL;    // north
    map.at(x, y).typ = DOOR;
    map.at(x, y).flags = D_ISOPEN;
    map.at(x, y + 1).typ = VWALL;    // south

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '-', 'Vertical open door should use "-" symbol');
    assert.strictEqual(sym.color, 3, 'Open door should use CLR_BROWN (3)');
});

test('door symbols: horizontal open door uses | (walls E/W)', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    // Create a horizontal door (walls to east and west)
    //  #|#  (door between walls)
    const x = 10, y = 10;
    map.at(x - 1, y).typ = HWALL;    // west
    map.at(x, y).typ = DOOR;
    map.at(x, y).flags = D_ISOPEN;
    map.at(x + 1, y).typ = HWALL;    // east

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '|', 'Horizontal open door should use "|" symbol');
    assert.strictEqual(sym.color, 3, 'Open door should use CLR_BROWN (3)');
});

test('door symbols: closed door always uses +', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = DOOR;
    map.at(x, y).flags = D_CLOSED;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '+', 'Closed door should use "+" symbol');
    assert.strictEqual(sym.color, 3, 'Closed door should use CLR_BROWN (3)');
});

test('door symbols: locked door uses +', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = DOOR;
    map.at(x, y).flags = D_LOCKED;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '+', 'Locked door should use "+" symbol');
    assert.strictEqual(sym.color, 3, 'Locked door should use CLR_BROWN (3)');
});

test('door symbols: doorway (no door) uses .', () => {
    const display = new HeadlessDisplay(80, 24);
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = DOOR;
    map.at(x, y).flags = D_NODOOR;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '.', 'Doorway should use "." symbol');
    assert.strictEqual(sym.color, 7, 'Doorway should use CLR_GRAY (7)');
});

test('door symbols: DECgraphics uses checkerboard for open doors', () => {
    const display = new HeadlessDisplay(80, 24);
    display.flags = { DECgraphics: true };
    const map = new GameMap();

    const x = 10, y = 10;
    map.at(x, y).typ = DOOR;
    map.at(x, y).flags = D_ISOPEN;
    map.at(x - 1, y).typ = HWALL;  // horizontal door
    map.at(x + 1, y).typ = HWALL;

    const sym = display.terrainSymbol(map.at(x, y), map, x, y);
    assert.strictEqual(sym.ch, '\u2592', 'DECgraphics open door should use checkerboard');
    assert.strictEqual(sym.color, 3, 'Open door should use CLR_BROWN (3)');
});

}); // describe
