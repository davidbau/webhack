import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { DOOR, D_CLOSED, ROOM } from '../../js/config.js';
import { HeadlessDisplay } from '../../js/headless_runtime.js';
import { GameMap } from '../../js/map.js';

describe('headless remembered terrain color', () => {

test('headless renderMap keeps remembered terrain color', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 5;
    const y = 5;
    const row = y + 1; // map rows start at 1 when msg_window is disabled
    const col = x - 1; // tty map columns are x-1

    const loc = map.at(x, y);
    loc.typ = DOOR;
    loc.flags = D_CLOSED;
    loc.seenv = 0xff;

    const fov = { canSee: () => false };
    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: false, color: true });

    assert.equal(display.grid[row][col], '+');
    assert.equal(display.colors[row][col], 3);
});

test('headless remembered room floors use NO_COLOR tone', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 6;
    const y = 6;
    const row = y + 1;
    const col = x - 1;

    const loc = map.at(x, y);
    loc.typ = ROOM;
    loc.seenv = 0xff;

    const fov = { canSee: () => false };
    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: true, color: true });

    assert.equal(display.grid[row][col], '·');
    assert.equal(display.colors[row][col], 8);
    assert.match(display.getScreenAnsiLines()[row], /\u001b\[0;90;40m/);
});

test('headless remembered objects keep remembered object color', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 7;
    const y = 7;
    const row = y + 1;
    const col = x - 1;

    const loc = map.at(x, y);
    loc.seenv = 0xff;
    loc.mem_obj = '$';
    loc.mem_obj_color = 11;

    const fov = { canSee: () => false };
    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: false, color: true });

    assert.equal(display.grid[row][col], '$');
    assert.equal(display.colors[row][col], 11);
});

test('headless remembered invisible marker overrides remembered objects', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 8;
    const y = 8;
    const row = y + 1;
    const col = x - 1;

    const loc = map.at(x, y);
    loc.seenv = 0xff;
    loc.mem_invis = true;
    loc.mem_obj = '$';
    loc.mem_obj_color = 11;

    const fov = { canSee: () => false };
    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: false, color: true });

    assert.equal(display.grid[row][col], 'I');
});

test('headless visible monsters clear remembered invisible marker', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 9;
    const y = 9;
    const row = y + 1;
    const col = x - 1;

    const loc = map.at(x, y);
    loc.typ = ROOM;
    loc.seenv = 0xff;
    loc.mem_invis = true;

    map.monsters.push({
        mx: x,
        my: y,
        mhp: 1,
        displayChar: 'd',
        displayColor: 7,
        mndx: 0,
    });

    const fov = { canSee: (cx, cy) => cx === x && cy === y };
    display.renderMap(map, null, fov, { msg_window: false, DECgraphics: false, color: true });

    assert.notEqual(display.grid[row][col], 'I');
    assert.equal(loc.mem_invis, false);
});

test('headless keeps remembered engraving under visible monster in wizard mode', () => {
    const display = new HeadlessDisplay();
    const map = new GameMap();
    const x = 10;
    const y = 10;
    const row = y + 1;
    const col = x - 1;

    const loc = map.at(x, y);
    loc.typ = ROOM;
    loc.seenv = 0xff;
    map.engravings.push({ x, y, type: 'mark', text: 'Elbereth' });
    map.monsters.push({
        mx: x,
        my: y,
        mhp: 1,
        displayChar: 'f',
        displayColor: 15,
        mndx: 0,
    });

    const player = { x: 1, y: 1, wizard: true, hallucinating: false };
    let visible = true;
    const fov = { canSee: (cx, cy) => visible && cx === x && cy === y };

    display.renderMap(map, player, fov, { msg_window: false, DECgraphics: true, color: true });
    assert.equal(display.grid[row][col], 'f');
    assert.equal(loc.mem_obj, '`');
    assert.equal(loc.mem_obj_color, 12);

    visible = false;
    display.renderMap(map, player, fov, { msg_window: false, DECgraphics: true, color: true });
    assert.equal(display.grid[row][col], '`');
    assert.equal(display.colors[row][col], 12);
});

}); // describe
