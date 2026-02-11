// Test message concatenation behavior matching C NetHack
// C ref: win/tty/topl.c:264-267
import { test } from 'node:test';
import assert from 'node:assert';
import { HeadlessDisplay } from '../comparison/session_helpers.js';

test('message concatenation: short messages combine with two spaces', () => {
    const display = new HeadlessDisplay(80, 24);

    // First message
    display.putstr_message('a - a +1 ring mail.');
    assert.strictEqual(display.topMessage, 'a - a +1 ring mail.');

    // Second message should concatenate
    display.putstr_message('There is a staircase down here.');
    assert.strictEqual(display.topMessage, 'a - a +1 ring mail.  There is a staircase down here.');
});

test('message concatenation: long combined message does not concatenate', () => {
    const display = new HeadlessDisplay(80, 24);

    // First long message
    const longMsg = 'a - a very long description of some magical item that takes up lots of space';
    display.putstr_message(longMsg);

    // Second message should NOT concatenate (would exceed cols - 8)
    display.putstr_message('There is a fountain here.');
    assert.strictEqual(display.topMessage, 'There is a fountain here.');
});

test('message concatenation: "You die" never concatenates', () => {
    const display = new HeadlessDisplay(80, 24);

    display.putstr_message('The orc hits!');
    assert.strictEqual(display.topMessage, 'The orc hits!');

    // "You die" should NOT concatenate even if it fits
    display.putstr_message('You die...');
    assert.strictEqual(display.topMessage, 'You die...');
});

test('message concatenation: matches C NetHack spacing', () => {
    const display = new HeadlessDisplay(80, 24);

    display.putstr_message('10 gold pieces.');
    display.putstr_message('You see here a scroll.');

    // Should have exactly two spaces between messages
    assert.strictEqual(display.topMessage, '10 gold pieces.  You see here a scroll.');
});

test('message concatenation: triple message combination', () => {
    const display = new HeadlessDisplay(80, 24);

    display.putstr_message('a - a dagger.');
    display.putstr_message('b - a key.');
    display.putstr_message('c - an apple.');

    // All three should combine if they fit
    const expected = 'a - a dagger.  b - a key.  c - an apple.';
    if (expected.length + 3 < 80 - 8) {
        assert.strictEqual(display.topMessage, expected);
    }
});
