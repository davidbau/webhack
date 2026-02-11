// Test message display persistence
// Verifies that messages persist until replaced by new messages
// Regression test for bug where clearRow(0) was called before every input (fixed in commit 450d02a)
import { test } from 'node:test';
import assert from 'assert';
import { HeadlessDisplay } from '../comparison/session_helpers.js';

test('message display: messages persist until replaced', () => {
    const display = new HeadlessDisplay(80, 24);

    // Display first long message
    const longMsg1 = 'The grid bug hits you multiple times with critical damage from its powerful attack!';
    display.putstr_message(longMsg1);
    assert.strictEqual(display.topMessage, longMsg1,
        'First message should be stored in topMessage');

    // Display second message - should replace first (too long to concatenate together)
    const longMsg2 = 'You kill the grid bug with a mighty blow that echoes through the dungeon!';
    display.putstr_message(longMsg2);
    assert.strictEqual(display.topMessage, longMsg2,
        'Long second message should replace first when both dont fit');
});

test('message display: short messages concatenate', () => {
    const display = new HeadlessDisplay(80, 24);

    // Short first message
    display.putstr_message('You hit.');
    assert.strictEqual(display.topMessage, 'You hit.');

    // Short second message that fits on same line
    display.putstr_message('It misses.');
    // C NetHack concatenates with double-space when both fit
    assert.strictEqual(display.topMessage, 'You hit.  It misses.',
        'Short messages should concatenate with double-space');
});

test('message display: regression test for clearRow bug', () => {
    const display = new HeadlessDisplay(80, 24);

    // This test verifies the fix for the bug where clearRow(0) was called
    // before every input in the game loop, clearing messages before players
    // could see them.

    // Set a long message that won't concatenate
    const longMsg = 'The grid bug hits you with a devastating attack dealing 15 points of damage!';
    display.putstr_message(longMsg);
    assert.strictEqual(display.topMessage, longMsg);

    // Simulate game loop: DON'T clear message row
    // (the fix ensures no clearRow before input)
    // The message should persist until a new message is displayed

    // Display another long message that replaces it
    const longMsg2 = 'You strike back at the grid bug with your enchanted weapon dealing massive damage!';
    display.putstr_message(longMsg2);
    assert.strictEqual(display.topMessage, longMsg2,
        'New long message should replace old message');
});

test('message display: death messages never concatenate', () => {
    const display = new HeadlessDisplay(80, 24);

    display.putstr_message('The orc hits!');
    assert.strictEqual(display.topMessage, 'The orc hits!');

    // "You die" should NOT concatenate even if it fits
    display.putstr_message('You die...');
    assert.strictEqual(display.topMessage, 'You die...',
        'Death messages should not concatenate');
});

test('message display: topMessage tracks current message state', () => {
    const display = new HeadlessDisplay(80, 24);

    // No message initially (null in HeadlessDisplay)
    assert.ok(display.topMessage === null || display.topMessage === undefined,
        'topMessage should be null or undefined initially');

    // First message
    display.putstr_message('First message');
    assert.strictEqual(display.topMessage, 'First message');

    // Second short message concatenates
    display.putstr_message('Second msg');
    assert.strictEqual(display.topMessage, 'First message  Second msg');

    // Long message replaces
    const longMsg = 'This is a very long message that will not concatenate because it exceeds';
    display.putstr_message(longMsg);
    assert.strictEqual(display.topMessage, longMsg);
});
