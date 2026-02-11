// Test player name persistence across sessions
// C ref: options.c — name can be set via OPTIONS=name:playername
import { test } from 'node:test';
import assert from 'assert';
import { loadFlags, saveFlags, DEFAULT_FLAGS } from '../../js/storage.js';

// localStorage mock
const store = new Map();
globalThis.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
    key(i) { return [...store.keys()][i] ?? null; },
    get length() { return store.size; },
};

test('player name: saves to flags and persists across sessions', () => {
    localStorage.clear();

    // First session: set name
    let flags = loadFlags();
    assert.strictEqual(flags.name, '', 'Name should default to empty string');

    flags.name = 'Alice';
    saveFlags(flags);

    // Second session: load name
    flags = loadFlags();
    assert.strictEqual(flags.name, 'Alice',
        'Name should persist across loadFlags calls');
});

test('player name: empty string is valid default', () => {
    localStorage.clear();

    const flags = loadFlags();
    assert.strictEqual(flags.name, '',
        'Name should default to empty string (not null/undefined)');
    assert.strictEqual(typeof flags.name, 'string',
        'Name should be a string');
});

test('player name: can be changed and re-saved', () => {
    localStorage.clear();

    // Save first name
    let flags = loadFlags();
    flags.name = 'Alice';
    saveFlags(flags);

    // Change to second name
    flags = loadFlags();
    assert.strictEqual(flags.name, 'Alice');
    flags.name = 'Bob';
    saveFlags(flags);

    // Verify change persisted
    flags = loadFlags();
    assert.strictEqual(flags.name, 'Bob',
        'Changed name should persist');
});

test('player name: can be cleared to force re-prompt', () => {
    localStorage.clear();

    // Save name
    let flags = loadFlags();
    flags.name = 'Alice';
    saveFlags(flags);

    // Clear name (user wants to be prompted again)
    flags = loadFlags();
    flags.name = '';
    saveFlags(flags);

    // Verify cleared
    flags = loadFlags();
    assert.strictEqual(flags.name, '',
        'Cleared name should allow re-prompting');
});

test('player name: respects max length in storage', () => {
    localStorage.clear();

    const MAX_NAME_LENGTH = 31;
    const longName = 'ThisIsAVeryLongPlayerNameThatExceedsTheMaximumAllowedLength';

    const flags = loadFlags();
    // Application code should truncate before saving
    flags.name = longName.substring(0, MAX_NAME_LENGTH);
    saveFlags(flags);

    const reloaded = loadFlags();
    assert.strictEqual(reloaded.name.length, MAX_NAME_LENGTH,
        'Saved name should be truncated to max length');
});

test('player name: preserves case when saved', () => {
    localStorage.clear();

    const flags = loadFlags();
    flags.name = 'AlIcE';
    saveFlags(flags);

    const reloaded = loadFlags();
    assert.strictEqual(reloaded.name, 'AlIcE',
        'Case should be preserved in saved name');
});
