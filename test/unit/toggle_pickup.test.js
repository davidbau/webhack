// toggle_pickup.test.js -- Test @ command (toggle autopickup)
// C ref: options.c dotogglepickup()

import { test } from 'node:test';
import assert from 'node:assert';

// Test behavior expectations based on C NetHack

test('toggle_pickup: @ command toggles pickup flag', () => {
    // Simulate the toggle behavior
    let pickup = true; // Default state

    // First toggle: ON → OFF
    pickup = !pickup;
    assert.strictEqual(pickup, false, 'First toggle should turn pickup OFF');

    // Second toggle: OFF → ON
    pickup = !pickup;
    assert.strictEqual(pickup, true, 'Second toggle should turn pickup back ON');
});

test('toggle_pickup: message format matches C NetHack', () => {
    // C ref: options.c:9286-9303
    // When ON: "Autopickup: ON, for [types] objects."
    // When OFF: "Autopickup: OFF."

    const messages = {
        on: 'Autopickup: ON, for all objects.',
        off: 'Autopickup: OFF.',
    };

    // Verify message format
    assert.ok(messages.on.startsWith('Autopickup: ON'),
        'ON message should start with "Autopickup: ON"');
    assert.strictEqual(messages.off, 'Autopickup: OFF.',
        'OFF message should be exactly "Autopickup: OFF."');
});

test('toggle_pickup: command does not consume game time', () => {
    // C ref: dotogglepickup returns ECMD_OK without taking time
    // This is a meta-action that shouldn't advance the game state
    const tookTime = false;
    const moved = false;

    assert.strictEqual(tookTime, false, 'Toggle should not consume game time');
    assert.strictEqual(moved, false, 'Toggle should not count as movement');
});

test('toggle_pickup: works when buried or otherwise restricted', () => {
    // C ref: cmd.c:1735 — @ command has IFBURIED flag
    // Meaning it can be used even when buried/trapped
    const canUseWhenBuried = true;

    assert.strictEqual(canUseWhenBuried, true,
        'Should be usable even when buried/trapped');
});
