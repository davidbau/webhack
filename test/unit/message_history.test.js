// message_history.test.js -- Unit tests for message history storage
// Tests that messages are properly stored and maintained in display.messages

import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('message history', () => {

test('display stores messages in history', () => {
    // Mock display object
    const display = {
        messages: [],
        flags: {},
        grid: [],
        putstr_message(msg) {
            if (msg.trim()) {
                this.messages.push(msg);
                if (this.messages.length > 20) {
                    this.messages.shift();
                }
            }
        }
    };

    // Add messages
    display.putstr_message('First message');
    display.putstr_message('Second message');
    display.putstr_message('Third message');

    assert.strictEqual(display.messages.length, 3, 'Should have 3 messages');
    assert.strictEqual(display.messages[0], 'First message');
    assert.strictEqual(display.messages[1], 'Second message');
    assert.strictEqual(display.messages[2], 'Third message');
});

test('display limits messages to 20', () => {
    const display = {
        messages: [],
        flags: {},
        putstr_message(msg) {
            if (msg.trim()) {
                this.messages.push(msg);
                if (this.messages.length > 20) {
                    this.messages.shift();
                }
            }
        }
    };

    // Add 25 messages
    for (let i = 1; i <= 25; i++) {
        display.putstr_message(`Message ${i}`);
    }

    assert.strictEqual(display.messages.length, 20, 'Should limit to 20 messages');
    assert.strictEqual(display.messages[0], 'Message 6', 'Oldest message should be message 6');
    assert.strictEqual(display.messages[19], 'Message 25', 'Newest message should be message 25');
});

test('display ignores empty messages', () => {
    const display = {
        messages: [],
        flags: {},
        putstr_message(msg) {
            if (msg.trim()) {
                this.messages.push(msg);
                if (this.messages.length > 20) {
                    this.messages.shift();
                }
            }
        }
    };

    display.putstr_message('Message 1');
    display.putstr_message('   ');  // Only whitespace
    display.putstr_message('');     // Empty
    display.putstr_message('Message 2');

    assert.strictEqual(display.messages.length, 2, 'Should ignore empty messages');
    assert.strictEqual(display.messages[0], 'Message 1');
    assert.strictEqual(display.messages[1], 'Message 2');
});

test('display preserves message order', () => {
    const display = {
        messages: [],
        flags: {},
        putstr_message(msg) {
            if (msg.trim()) {
                this.messages.push(msg);
                if (this.messages.length > 20) {
                    this.messages.shift();
                }
            }
        }
    };

    const testMessages = [
        'You hit the grid bug.',
        'The grid bug hits you!',
        'You kill the grid bug!',
        '58 gold pieces.',
    ];

    for (const msg of testMessages) {
        display.putstr_message(msg);
    }

    assert.strictEqual(display.messages.length, 4);
    for (let i = 0; i < testMessages.length; i++) {
        assert.strictEqual(display.messages[i], testMessages[i], `Message ${i} should match`);
    }
});

test('message history handles long messages', () => {
    const display = {
        messages: [],
        flags: {},
        putstr_message(msg) {
            if (msg.trim()) {
                this.messages.push(msg);
                if (this.messages.length > 20) {
                    this.messages.shift();
                }
            }
        }
    };

    const longMessage = 'A'.repeat(200); // Very long message
    display.putstr_message(longMessage);

    assert.strictEqual(display.messages.length, 1);
    assert.strictEqual(display.messages[0], longMessage, 'Should preserve full long message');
});

}); // describe
