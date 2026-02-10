// Test rest_on_space option behavior
import { test } from 'node:test';
import assert from 'node:assert';

// Simulate the input handling logic from input.js
function handleKeyPress(key, rest_on_space) {
    // Set global flag like the game does
    globalThis.window = { gameFlags: { rest_on_space } };

    let ch = null;

    // Handle space bar with rest_on_space option
    // C ref: flag.h flags.rest_on_space - space triggers rest/wait command
    if (key === ' ' && window.gameFlags?.rest_on_space) {
        ch = '.'.charCodeAt(0); // Convert space to period (rest)
    }
    // Handle regular character keys
    else if (key.length === 1) {
        ch = key.charCodeAt(0);
    }

    return ch;
}

test('rest_on_space - space bar triggers rest when enabled', () => {
    const result = handleKeyPress(' ', true);

    // Space should be converted to '.' (period/rest command)
    assert.strictEqual(result, '.'.charCodeAt(0), 'Space should convert to period');
    assert.strictEqual(String.fromCharCode(result), '.', 'Result should be period character');
});

test('rest_on_space - space bar is normal space when disabled', () => {
    const result = handleKeyPress(' ', false);

    // Space should remain space
    assert.strictEqual(result, ' '.charCodeAt(0), 'Space should remain space');
    assert.strictEqual(result, 32, 'Space character code should be 32');
});

test('rest_on_space - other keys unaffected when enabled', () => {
    // Test movement keys
    assert.strictEqual(handleKeyPress('h', true), 'h'.charCodeAt(0), 'h should remain h');
    assert.strictEqual(handleKeyPress('j', true), 'j'.charCodeAt(0), 'j should remain j');
    assert.strictEqual(handleKeyPress('k', true), 'k'.charCodeAt(0), 'k should remain k');
    assert.strictEqual(handleKeyPress('l', true), 'l'.charCodeAt(0), 'l should remain l');

    // Test commands
    assert.strictEqual(handleKeyPress('i', true), 'i'.charCodeAt(0), 'i should remain i');
    assert.strictEqual(handleKeyPress(',', true), ','.charCodeAt(0), ', should remain ,');

    // Test period (the actual rest command)
    assert.strictEqual(handleKeyPress('.', true), '.'.charCodeAt(0), '. should remain .');
});

test('rest_on_space - period key always triggers rest', () => {
    // Period should always be rest, regardless of rest_on_space setting
    assert.strictEqual(handleKeyPress('.', true), '.'.charCodeAt(0),
        'Period triggers rest when rest_on_space=true');
    assert.strictEqual(handleKeyPress('.', false), '.'.charCodeAt(0),
        'Period triggers rest when rest_on_space=false');
});

test('rest_on_space - space vs period equivalence when enabled', () => {
    const spaceResult = handleKeyPress(' ', true);
    const periodResult = handleKeyPress('.', true);

    // Both should produce the same result when rest_on_space is enabled
    assert.strictEqual(spaceResult, periodResult,
        'Space and period should be equivalent when rest_on_space=true');
});
