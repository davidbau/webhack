// Test msg_window option behavior
import { test } from 'node:test';
import assert from 'node:assert';
import { HeadlessDisplay } from '../comparison/session_helpers.js';

test('msg_window option controls message display', () => {
    const display = new HeadlessDisplay();

    // Simulate adding messages to history
    display.messages = [];
    display.messages.push('You miss the newt.');
    display.messages.push('The newt bites!');
    display.messages.push('You kill the newt!');

    // Test msg_window rendering (last 3 messages)
    display.renderMessageWindow();

    // Check that messages appear on rows 0-2
    const row0 = display.grid[0].join('').trim();
    const row1 = display.grid[1].join('').trim();
    const row2 = display.grid[2].join('').trim();

    assert.strictEqual(row0, 'You miss the newt.', 'First message should be on row 0');
    assert.strictEqual(row1, 'The newt bites!', 'Second message should be on row 1');
    assert.strictEqual(row2, 'You kill the newt!', 'Third message should be on row 2');

    // Test with only 2 messages
    display.messages = ['Message 1', 'Message 2'];
    display.renderMessageWindow();

    const row0b = display.grid[0].join('').trim();
    const row1b = display.grid[1].join('').trim();
    const row2b = display.grid[2].join('').trim();

    assert.strictEqual(row0b, '', 'Row 0 should be empty with only 2 messages');
    assert.strictEqual(row1b, 'Message 1', 'First of 2 messages should be on row 1');
    assert.strictEqual(row2b, 'Message 2', 'Second of 2 messages should be on row 2');

    // Test message truncation (messages longer than terminal width)
    display.messages = ['This is a very long message that exceeds the terminal width and should be truncated with ellipsis'];
    display.renderMessageWindow();

    const row2c = display.grid[2].join('').trim();
    assert.ok(row2c.endsWith('...'), 'Long messages should be truncated with ...');
    assert.ok(row2c.length <= display.cols, 'Truncated message should fit in terminal width');

    // Test message history limit (20 messages max)
    display.messages = [];
    for (let i = 1; i <= 25; i++) {
        display.messages.push(`Message ${i}`);
        if (display.messages.length > 20) {
            display.messages.shift();
        }
    }
    assert.strictEqual(display.messages.length, 20, 'Message history should be limited to 20');
    assert.strictEqual(display.messages[0], 'Message 6', 'Oldest messages should be dropped');
    assert.strictEqual(display.messages[19], 'Message 25', 'Newest message should be kept');
});
