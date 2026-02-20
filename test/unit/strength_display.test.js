// Test strength display formatting (18/xx notation)
// C ref: attrib.c str_string()
import { describe, test } from 'node:test';
import assert from 'assert';
import { Player } from '../../js/player.js';
import { A_STR } from '../../js/config.js';

describe('strength display', () => {

test('strength display: normal values 3-18 show as plain numbers', () => {
    const player = new Player();

    player.attributes[A_STR] = 3;
    assert.strictEqual(player.strDisplay, '3', 'Strength 3 should display as "3"');

    player.attributes[A_STR] = 10;
    assert.strictEqual(player.strDisplay, '10', 'Strength 10 should display as "10"');

    player.attributes[A_STR] = 18;
    assert.strictEqual(player.strDisplay, '18', 'Strength 18 should display as "18"');
});

test('strength display: exceptional strength uses 18/xx format', () => {
    const player = new Player();

    // 18/01 through 18/75 (values 19-21)
    player.attributes[A_STR] = 19;
    assert.strictEqual(player.strDisplay, '18/25', 'Strength 19 should display as "18/25"');

    player.attributes[A_STR] = 20;
    assert.strictEqual(player.strDisplay, '18/50', 'Strength 20 should display as "18/50"');

    player.attributes[A_STR] = 21;
    assert.strictEqual(player.strDisplay, '18/75', 'Strength 21 should display as "18/75"');
});

test('strength display: maximum exceptional strength uses 18/**', () => {
    const player = new Player();

    player.attributes[A_STR] = 22;
    assert.strictEqual(player.strDisplay, '18/**', 'Strength 22 should display as "18/**"');

    player.attributes[A_STR] = 24;
    assert.strictEqual(player.strDisplay, '18/**', 'Strength 24 should display as "18/**"');
});

test('strength display: superhuman strength (25+) shows as plain number', () => {
    const player = new Player();

    player.attributes[A_STR] = 25;
    assert.strictEqual(player.strDisplay, '25', 'Strength 25 should display as "25"');
});

}); // describe
