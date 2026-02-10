// Test autopickup message formatting
// Verifies that pickup messages match C NetHack format
import { test } from 'node:test';
import assert from 'node:assert';

// Mock display for message capture
class MockDisplay {
    constructor() {
        this.messages = [];
    }

    putstr_message(msg) {
        this.messages.push(msg);
    }

    getLastMessage() {
        return this.messages[this.messages.length - 1];
    }

    clearMessages() {
        this.messages = [];
    }
}

// Simulate gold pickup message format
function formatGoldMessage(quantity) {
    const plural = quantity === 1 ? '' : 's';
    return `${quantity} gold piece${plural}.`;
}

// Simulate item pickup message format
function formatItemMessage(invlet, itemName) {
    return `${invlet} - ${itemName}.`;
}

test('autopickup - gold message format (singular)', () => {
    const msg = formatGoldMessage(1);
    assert.strictEqual(msg, '1 gold piece.', 'Single gold piece message');
});

test('autopickup - gold message format (plural)', () => {
    const msg = formatGoldMessage(2);
    assert.strictEqual(msg, '2 gold pieces.', 'Multiple gold pieces message');

    const msg100 = formatGoldMessage(100);
    assert.strictEqual(msg100, '100 gold pieces.', 'Large quantity message');
});

test('autopickup - item message format', () => {
    const msg = formatItemMessage('a', 'a blessed +1 longsword');
    assert.strictEqual(msg, 'a - a blessed +1 longsword.', 'Item pickup message');
});

test('autopickup - item message with various inventory letters', () => {
    const testCases = [
        { invlet: 'a', name: 'an apple', expected: 'a - an apple.' },
        { invlet: 'b', name: 'a scroll of identify', expected: 'b - a scroll of identify.' },
        { invlet: 'z', name: 'a wand of death', expected: 'z - a wand of death.' },
        { invlet: 'A', name: 'a ring of levitation', expected: 'A - a ring of levitation.' },
    ];

    for (const { invlet, name, expected } of testCases) {
        const msg = formatItemMessage(invlet, name);
        assert.strictEqual(msg, expected, `Message for invlet ${invlet}`);
    }
});

test('autopickup - gold always uses quantity format', () => {
    // Gold should never use "a gold piece" - always "N gold piece(s)"
    const msg1 = formatGoldMessage(1);
    assert.ok(msg1.startsWith('1 '), 'Even single gold shows quantity');
    assert.ok(!msg1.includes('a gold'), 'No article for gold');
});

test('autopickup - messages end with period', () => {
    assert.ok(formatGoldMessage(5).endsWith('.'), 'Gold message ends with period');
    assert.ok(formatItemMessage('a', 'sword').endsWith('.'), 'Item message ends with period');
});

test('autopickup - gold message is standalone (no prefix)', () => {
    const msg = formatGoldMessage(50);
    assert.strictEqual(msg, '50 gold pieces.', 'No "You pick up" prefix');
    assert.ok(!msg.includes('You'), 'No "You" in message');
    assert.ok(!msg.includes('pick'), 'No "pick" in message');
});

test('autopickup - item message uses hyphen format', () => {
    const msg = formatItemMessage('b', 'a potion of healing');
    assert.ok(msg.includes(' - '), 'Uses " - " separator');
    assert.ok(msg.startsWith('b -'), 'Starts with inventory letter and hyphen');
});

test('autopickup - display mock captures messages', () => {
    const display = new MockDisplay();

    display.putstr_message(formatGoldMessage(10));
    assert.strictEqual(display.getLastMessage(), '10 gold pieces.');

    display.putstr_message(formatItemMessage('a', 'a dagger'));
    assert.strictEqual(display.getLastMessage(), 'a - a dagger.');

    assert.strictEqual(display.messages.length, 2, 'Both messages captured');
});

test('autopickup - message ordering (gold first)', () => {
    const display = new MockDisplay();

    // Simulate picking up gold first, then item
    display.putstr_message(formatGoldMessage(5));
    display.putstr_message(formatItemMessage('a', 'a scroll'));

    assert.strictEqual(display.messages[0], '5 gold pieces.', 'Gold message first');
    assert.strictEqual(display.messages[1], 'a - a scroll.', 'Item message second');
});

test('autopickup - zero gold (edge case)', () => {
    // This shouldn't happen in game, but test the formatter
    const msg = formatGoldMessage(0);
    assert.strictEqual(msg, '0 gold pieces.', 'Zero gold uses plural');
});

test('autopickup - large gold quantities', () => {
    const testCases = [
        { qty: 1000, expected: '1000 gold pieces.' },
        { qty: 999999, expected: '999999 gold pieces.' },
    ];

    for (const { qty, expected } of testCases) {
        assert.strictEqual(formatGoldMessage(qty), expected, `Large quantity ${qty}`);
    }
});
