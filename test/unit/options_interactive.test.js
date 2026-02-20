// Test interactive options menu behavior
// C ref: options.c doset() - interactive menu with immediate toggle

// --- localStorage mock for Node.js ---
const store = new Map();
globalThis.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); },
    key(i) { return [...store.keys()][i] ?? null; },
    get length() { return store.size; },
};

import { describe, test } from 'node:test';
import assert from 'assert';
import { loadFlags, saveFlags, DEFAULT_FLAGS, OPTION_DEFS } from '../../js/storage.js';
import {
    getTotalPages,
    getOptionByKey,
    setOptionValue,
    renderOptionsMenu,
} from '../../js/options_menu.js';

describe('options interactive', () => {

test('options menu: flags structure matches OPTION_DEFS', () => {
    const flags = loadFlags();

    // Check that all boolean options in OPTION_DEFS exist in flags
    const booleanDefs = OPTION_DEFS.filter(d => d.type === 'boolean');

    for (const def of booleanDefs) {
        assert.ok(def.name in flags,
            `Option ${def.name} should exist in flags`);
        assert.strictEqual(typeof flags[def.name], 'boolean',
            `Option ${def.name} should be boolean`);
        assert.ok(def.menuChar,
            `Option ${def.name} should have menuChar`);
        assert.strictEqual(def.menuChar.length, 1,
            `menuChar for ${def.name} should be single character`);
    }
});

test('options menu: menu chars are unique', () => {
    const menuChars = OPTION_DEFS
        .filter(d => d.type === 'boolean')
        .map(d => d.menuChar);

    const uniqueChars = new Set(menuChars);

    assert.strictEqual(menuChars.length, uniqueChars.size,
        'All menu chars should be unique (no duplicates)');
});

test('options menu: all required options are present', () => {
    const requiredOptions = [
        'pickup', 'showexp', 'color', 'time', 'safe_pet',
        'confirm', 'verbose', 'tombstone', 'rest_on_space',
        'number_pad', 'lit_corridor', 'DECgraphics', 'msg_window'
    ];

    const definedOptions = OPTION_DEFS.map(d => d.name);

    for (const required of requiredOptions) {
        assert.ok(definedOptions.includes(required),
            `Required option ${required} should be in OPTION_DEFS`);
    }
});

test('options menu: default flags are valid', () => {
    const flags = loadFlags();

    // Check expected defaults (matching C NetHack + JS_OVERRIDES)
    assert.strictEqual(flags.pickup, false, 'pickup should default to false (C default)');
    assert.strictEqual(flags.showexp, false, 'showexp should default to false (C default)');
    assert.strictEqual(flags.color, true, 'color should default to true');
    assert.strictEqual(flags.safe_pet, true, 'safe_pet should default to true');
    assert.strictEqual(flags.confirm, true, 'confirm should default to true');
    assert.strictEqual(flags.verbose, true, 'verbose should default to true');
    assert.strictEqual(flags.tombstone, true, 'tombstone should default to true');

    // Check options that default to false
    assert.strictEqual(flags.time, false, 'time should default to false');
    assert.strictEqual(flags.rest_on_space, false, 'rest_on_space should default to false');
    assert.strictEqual(flags.number_pad, false, 'number_pad should default to false');
    assert.strictEqual(flags.lit_corridor, false, 'lit_corridor should default to false');
    assert.strictEqual(flags.DECgraphics, true, 'DECgraphics should default to true (JS override)');
    assert.strictEqual(flags.msg_window, false, 'msg_window should default to false');
});

test('options menu: toggle logic works correctly', () => {
    const flags = { ...DEFAULT_FLAGS };

    // Test toggle logic for each option
    const before = flags.pickup;
    flags.pickup = !flags.pickup;
    assert.strictEqual(flags.pickup, !before, 'Toggle should invert boolean');

    // Test multiple toggles return to original
    const original = flags.color;
    flags.color = !flags.color;
    flags.color = !flags.color;
    assert.strictEqual(flags.color, original, 'Double toggle should return to original');
});

test('options menu: all boolean options can be toggled', () => {
    const booleanOptions = [
        'pickup', 'showexp', 'color', 'time', 'safe_pet',
        'confirm', 'verbose', 'tombstone', 'rest_on_space',
        'number_pad', 'lit_corridor', 'DECgraphics', 'msg_window'
    ];

    const flags = { ...DEFAULT_FLAGS };

    // Verify each option is boolean and can be toggled
    for (const opt of booleanOptions) {
        assert.strictEqual(typeof flags[opt], 'boolean',
            `${opt} should be boolean type`);

        const before = flags[opt];
        flags[opt] = !flags[opt];
        assert.strictEqual(flags[opt], !before,
            `${opt} should toggle from ${before} to ${!before}`);
    }
});

test('options menu: string options are present', () => {
    const flags = loadFlags();

    assert.ok('pickup_types' in flags, 'pickup_types should exist');
    assert.strictEqual(typeof flags.pickup_types, 'string',
        'pickup_types should be string type');
    assert.strictEqual(flags.pickup_types, '',
        'pickup_types should default to empty string');
});

test('options menu: menu character coverage', () => {
    const booleanDefs = OPTION_DEFS.filter(d => d.type === 'boolean');
    const menuChars = booleanDefs.map(d => d.menuChar).sort();

    // Verify we have reasonable menu character assignments
    assert.ok(menuChars.length >= 13,
        `Should have at least 13 menu characters, got ${menuChars.length}`);

    // All chars should be lowercase letters
    for (const char of menuChars) {
        assert.ok(char >= 'a' && char <= 'z',
            `Menu char '${char}' should be lowercase letter`);
    }
});

test('options menu: categories are well-organized', () => {
    // This test documents the expected categorization
    const categories = {
        'Gameplay': ['pickup', 'safe_pet', 'confirm'],
        'Display': ['showexp', 'color', 'time', 'lit_corridor', 'DECgraphics'],
        'Interface': ['verbose', 'tombstone', 'rest_on_space', 'number_pad', 'msg_window'],
    };

    // Verify all categorized options exist in OPTION_DEFS
    for (const [category, optNames] of Object.entries(categories)) {
        for (const optName of optNames) {
            const def = OPTION_DEFS.find(d => d.name === optName);
            assert.ok(def, `Option ${optName} in category ${category} should exist in OPTION_DEFS`);
        }
    }

    // Verify all boolean options are categorized
    const categorized = Object.values(categories).flat();
    const booleanOptions = OPTION_DEFS
        .filter(d => d.type === 'boolean')
        .map(d => d.name);

    for (const optName of booleanOptions) {
        assert.ok(categorized.includes(optName),
            `Option ${optName} should be in a category`);
    }
});

// ========================================================================
// Persistence Tests (using localStorage mock)
// ========================================================================

test('options menu: toggle persists to localStorage', () => {
    localStorage.clear();

    // Load defaults
    const flags = loadFlags();
    const originalPickup = flags.pickup;

    // Toggle option
    flags.pickup = !flags.pickup;
    saveFlags(flags);

    // Reload from localStorage
    const reloaded = loadFlags();
    assert.strictEqual(reloaded.pickup, !originalPickup,
        'Toggled option should persist after save/reload');
});

test('options menu: multiple toggles persist correctly', () => {
    localStorage.clear();

    // Load defaults
    let flags = loadFlags();

    // Toggle multiple options
    flags.pickup = false;
    flags.time = true;
    flags.DECgraphics = true;
    saveFlags(flags);

    // Reload and verify
    flags = loadFlags();
    assert.strictEqual(flags.pickup, false, 'pickup should be false');
    assert.strictEqual(flags.time, true, 'time should be true');
    assert.strictEqual(flags.DECgraphics, true, 'DECgraphics should be true');

    // Toggle again
    flags.pickup = true;
    flags.time = false;
    saveFlags(flags);

    // Reload and verify second change
    flags = loadFlags();
    assert.strictEqual(flags.pickup, true, 'pickup should be true after second toggle');
    assert.strictEqual(flags.time, false, 'time should be false after second toggle');
    assert.strictEqual(flags.DECgraphics, true, 'DECgraphics should still be true');
});

test('options menu: all boolean options persist', () => {
    localStorage.clear();

    const booleanOptions = [
        'pickup', 'showexp', 'color', 'time', 'safe_pet',
        'confirm', 'verbose', 'tombstone', 'rest_on_space',
        'number_pad', 'lit_corridor', 'DECgraphics', 'msg_window'
    ];

    let flags = loadFlags();

    // Toggle all options to opposite of their defaults
    for (const opt of booleanOptions) {
        flags[opt] = !DEFAULT_FLAGS[opt];
    }
    saveFlags(flags);

    // Reload and verify all persisted
    flags = loadFlags();
    for (const opt of booleanOptions) {
        assert.strictEqual(flags[opt], !DEFAULT_FLAGS[opt],
            `${opt} should persist as ${!DEFAULT_FLAGS[opt]}`);
    }
});

test('options menu: string option persists', () => {
    localStorage.clear();

    let flags = loadFlags();
    assert.strictEqual(flags.pickup_types, '', 'pickup_types should default to empty');

    // Set pickup_types
    flags.pickup_types = '$"=/!?+';
    saveFlags(flags);

    // Reload and verify
    flags = loadFlags();
    assert.strictEqual(flags.pickup_types, '$"=/!?+',
        'pickup_types should persist custom value');
});

test('options menu: persistence works across multiple save/reload cycles', () => {
    localStorage.clear();

    // Cycle 1
    let flags = loadFlags();
    flags.pickup = false;
    saveFlags(flags);

    // Cycle 2
    flags = loadFlags();
    assert.strictEqual(flags.pickup, false, 'Cycle 2: pickup should be false');
    flags.time = true;
    saveFlags(flags);

    // Cycle 3
    flags = loadFlags();
    assert.strictEqual(flags.pickup, false, 'Cycle 3: pickup should still be false');
    assert.strictEqual(flags.time, true, 'Cycle 3: time should be true');
    flags.color = false;
    saveFlags(flags);

    // Final verification
    flags = loadFlags();
    assert.strictEqual(flags.pickup, false, 'Final: pickup should be false');
    assert.strictEqual(flags.time, true, 'Final: time should be true');
    assert.strictEqual(flags.color, false, 'Final: color should be false');
});

test('options menu: help mode uses multiple pages', () => {
    assert.strictEqual(getTotalPages(false), 2, 'compact options should have 2 pages');
    assert.strictEqual(getTotalPages(true), 5, 'help options should have 5 pages');
});

test('options menu: can resolve and set visible option values', () => {
    const flags = loadFlags();

    const compactOpt = getOptionByKey(1, false, 'a');
    assert.ok(compactOpt, 'compact page key should resolve');
    assert.strictEqual(compactOpt.name, 'fruit', 'compact page 1 a should be fruit');

    const helpOpt = getOptionByKey(5, true, 'p');
    assert.ok(helpOpt, 'help page key should resolve');
    assert.strictEqual(helpOpt.name, 'time', 'help page 5 should include time option');

    const beforeFruit = flags.fruit;
    const beforeStatusLines = flags.statuslines;
    setOptionValue(1, false, 'a', 'pear', flags);
    setOptionValue(2, false, 'o', '3', flags);

    assert.strictEqual(flags.fruit, 'pear', 'text option should update');
    assert.strictEqual(flags.statuslines, 3, 'number option should parse and update');

    flags.fruit = beforeFruit;
    flags.statuslines = beforeStatusLines;
    saveFlags(flags);
});

test('options menu: count options support array-backed values', () => {
    const flags = loadFlags();
    flags.menucolors = ['warn:yellow', 'critical:red'];
    flags.statushighlights = ['hp<30%/red'];
    flags.autopickup_exceptions = ['"cursed item"', 'name:dagger'];
    flags.statusconditions = ['blind', 'hallu', 'stunned'];

    const { screen } = renderOptionsMenu(2, false, flags);
    const pageText = screen.join('\n');

    assert.ok(pageText.includes('menu colors') && pageText.includes('(2 currently set)'),
        'menu colors count should reflect array length');
    assert.ok(pageText.includes('status highlight rules') && pageText.includes('(1 currently set)'),
        'status highlight rules count should reflect array length');
    assert.ok(pageText.includes('status condition fields') && pageText.includes('(3 currently set)'),
        'status condition fields count should reflect array length');
});

}); // describe
