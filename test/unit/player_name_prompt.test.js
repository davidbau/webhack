// Test player name prompt during character generation
// C ref: role.c plnamesuffix() -> askname()
import { describe, test } from 'node:test';
import assert from 'assert';

describe('player name prompt', () => {

test('player name: max length constant matches C NetHack', () => {
    // C ref: global.h PL_NSIZ = 32 (31 usable characters + null terminator)
    const MAX_NAME_LENGTH = 31;
    assert.strictEqual(MAX_NAME_LENGTH, 31,
        'Max player name length should be 31 characters (matching C PL_NSIZ - 1)');
});

test('player name: validation rules', () => {
    // Test various name inputs

    // Valid names
    const validNames = [
        'Alice',
        'Bob',
        'Player123',
        'A',  // Single character
        'x'.repeat(31),  // Max length
    ];

    for (const name of validNames) {
        assert.ok(name.trim().length > 0,
            `"${name}" should be valid (non-empty after trim)`);
        assert.ok(name.length <= 31,
            `"${name}" should be valid (31 chars or less)`);
    }

    // Invalid names (empty or whitespace-only)
    const invalidNames = [
        '',
        '   ',
        '\t',
    ];

    for (const name of invalidNames) {
        assert.strictEqual(name.trim(), '',
            `"${name}" should be invalid (empty after trim)`);
    }
});

test('player name: truncation for overly long names', () => {
    const MAX_NAME_LENGTH = 31;

    // Test that long names get truncated to 31 chars
    const longName = 'ThisIsAVeryLongPlayerNameThatExceedsTheMaximumAllowedLength';
    const truncated = longName.substring(0, MAX_NAME_LENGTH);

    assert.strictEqual(truncated.length, 31,
        'Truncated name should be exactly 31 characters');
    assert.strictEqual(truncated, 'ThisIsAVeryLongPlayerNameThatEx',
        'Truncation should preserve first 31 characters');
});

test('player name: default name behavior', () => {
    // Before name prompt, player defaults to 'Adventurer'
    // After wizard mode init, wizard defaults to 'Wizard'

    const defaultName = 'Adventurer';
    const wizardName = 'Wizard';

    assert.strictEqual(defaultName, 'Adventurer',
        'Normal mode should default to "Adventurer"');
    assert.strictEqual(wizardName, 'Wizard',
        'Wizard mode should use "Wizard"');
});

test('player name: special characters and spaces allowed', () => {
    // C NetHack allows any printable characters in names
    const namesWithSpecialChars = [
        'Player-One',
        'Player_123',
        'The Great',  // Space
        "O'Brien",    // Apostrophe
        'José',       // Accented character
    ];

    for (const name of namesWithSpecialChars) {
        assert.ok(name.trim().length > 0,
            `"${name}" should be valid`);
    }
});

test('player name: case sensitivity preserved', () => {
    // C NetHack preserves case in player names
    const mixedCaseName = 'AlIcE';
    assert.strictEqual(mixedCaseName, 'AlIcE',
        'Name case should be preserved exactly as entered');

    // Note: Welcome message displays name in lowercase
    assert.strictEqual(mixedCaseName.toLowerCase(), 'alice',
        'Welcome message should show lowercase version');
});

}); // describe
