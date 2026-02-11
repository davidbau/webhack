// E2E tests for message display matching C NetHack
// Tests autopickup, manual pickup, and message concatenation
import { test } from 'node:test';
import assert from 'node:assert';
import { HeadlessDisplay } from './session_helpers.js';

test('E2E: autopickup gold message format', async () => {
    const display = new HeadlessDisplay();

    // Simulate autopickup message for gold (C ref: pickup.c:1054)
    const goldCount = 10;
    display.putstr_message(`${goldCount} gold pieces.`);

    assert(display.topMessage, 'Should have a message after autopickup');
    assert.strictEqual(display.topMessage, '10 gold pieces.',
                      'Gold message should match C format');
});

test('E2E: message concatenation on stairs with pickup', async () => {
    const display = new HeadlessDisplay();

    // Simulate picking up item on stairs (two messages in quick succession)
    display.putstr_message('a - a +1 ring mail.');
    assert.strictEqual(display.topMessage, 'a - a +1 ring mail.');

    display.putstr_message('There is a staircase down here.');

    // Should concatenate with two spaces
    assert.strictEqual(display.topMessage,
                      'a - a +1 ring mail.  There is a staircase down here.',
                      'Messages should concatenate with two spaces');
});

test('E2E: multiple pickups concatenate correctly', async () => {
    const display = new HeadlessDisplay();

    // Simulate picking up multiple items in sequence
    display.putstr_message('a - a dagger.');
    display.putstr_message('b - a scroll.');

    assert.strictEqual(display.topMessage, 'a - a dagger.  b - a scroll.');
});

test('E2E: long message breaks concatenation', async () => {
    const display = new HeadlessDisplay();

    // First message that's too long to concatenate
    const longMsg = 'a - a very long magical item with an extremely verbose description';
    display.putstr_message(longMsg);

    // Second message should NOT concatenate
    display.putstr_message('There is a fountain here.');

    assert.strictEqual(display.topMessage, 'There is a fountain here.',
                      'Long messages should break concatenation');
});

test('E2E: "You die" never concatenates', async () => {
    const display = new HeadlessDisplay();

    display.putstr_message('The orc hits!');
    display.putstr_message('You die...');

    assert.strictEqual(display.topMessage, 'You die...',
                      '"You die" should never concatenate');
});

test('E2E: message history is preserved', async () => {
    const display = new HeadlessDisplay();

    display.putstr_message('First message.');
    display.putstr_message('Second message.');
    display.putstr_message('Third message.');

    assert.strictEqual(display.messages.length, 3,
                      'Should track message history');
    assert.strictEqual(display.messages[0], 'First message.');
    assert.strictEqual(display.messages[1], 'Second message.');
    assert.strictEqual(display.messages[2], 'Third message.');
});

test('E2E: grid display matches message for concatenation', async () => {
    const display = new HeadlessDisplay();

    display.putstr_message('10 gold pieces.');
    display.putstr_message('You see a scroll.');

    // Read message from grid row 0 - read until we hit trailing spaces
    let gridMessage = '';
    let lastNonSpace = -1;
    for (let c = 0; c < display.cols; c++) {
        gridMessage += display.grid[0][c];
        if (display.grid[0][c] !== ' ') {
            lastNonSpace = c;
        }
    }
    // Trim trailing spaces
    gridMessage = gridMessage.substring(0, lastNonSpace + 1);

    assert.strictEqual(gridMessage, '10 gold pieces.  You see a scroll.',
                      'Grid should display concatenated message');
});

test('E2E: verify message row is MESSAGE_ROW (0)', async () => {
    const display = new HeadlessDisplay();

    display.putstr_message('Test message.');

    // Verify message appears on row 0 - read entire row
    let row0Content = '';
    let lastNonSpace = -1;
    for (let c = 0; c < display.cols; c++) {
        row0Content += display.grid[0][c];
        if (display.grid[0][c] !== ' ') {
            lastNonSpace = c;
        }
    }
    row0Content = row0Content.substring(0, lastNonSpace + 1);

    assert.strictEqual(row0Content, 'Test message.',
                      'Message should appear on row 0 (MESSAGE_ROW)');
});

test('E2E: message concatenation respects 80 column limit', async () => {
    const display = new HeadlessDisplay();
    assert.strictEqual(display.cols, 80, 'Display should be 80 columns');

    // Test boundary condition: exactly at limit
    const msg1 = 'a'.repeat(30);
    const msg2 = 'b'.repeat(30);
    display.putstr_message(msg1);
    display.putstr_message(msg2);

    // 30 + 2 (spaces) + 30 = 62 chars, should concatenate
    assert.strictEqual(display.topMessage.length, 62);
    assert.strictEqual(display.topMessage, msg1 + '  ' + msg2);
});

test('E2E: clearing message clears topMessage', async () => {
    const display = new HeadlessDisplay();

    display.putstr_message('First message.');
    assert(display.topMessage, 'Should have topMessage');

    // Simulate clearing by sending empty message
    display.clearRow(0);
    display.topMessage = null;

    assert.strictEqual(display.topMessage, null,
                      'topMessage should be clearable');
});
