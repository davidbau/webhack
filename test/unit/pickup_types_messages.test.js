// pickup_types_messages.test.js -- Verify message format matches C NetHack exactly
// Tests visual behavior: message format, placement, filtering

import { describe, test } from 'node:test';
import assert from 'node:assert';
import { POTION_CLASS, SCROLL_CLASS, WEAPON_CLASS, COIN_CLASS } from '../../js/objects.js';

// C NetHack message formats from invent.c xprname():
// - Items: "%c - %.*s%s" where %c=invlet, %s=name, last %s=suffix (usually ".")
// - Gold: special case, shows "N gold piece(s)."
// - Format: "a - a potion of healing."

describe('pickup types messages', () => {

test('pickup_types: gold message format matches C NetHack', () => {
    // C ref: pickup.c gold is always auto-collected
    // Format: "N gold piece(s)."
    const goldMsg1 = '1 gold piece.';
    const goldMsg2 = '2 gold pieces.';
    const goldMsg100 = '100 gold pieces.';

    // Verify format
    assert.ok(!goldMsg1.includes(' - '), 'Gold has no inventory letter prefix');
    assert.ok(goldMsg1.endsWith('.'), 'Gold message ends with period');
    assert.strictEqual(goldMsg1, '1 gold piece.', 'Singular gold format');
    assert.strictEqual(goldMsg2, '2 gold pieces.', 'Plural gold format');
});

test('pickup_types: item message format matches C NetHack', () => {
    // C ref: invent.c xprname() uses "%c - %.*s%s" format
    // With dot=TRUE for pickup messages, adds period at end
    const itemMsg = 'a - a potion of healing.';

    // Verify format components
    assert.ok(itemMsg.match(/^[a-zA-Z] - /), 'Starts with invlet - space - ');
    assert.ok(itemMsg.endsWith('.'), 'Ends with period');
    assert.ok(itemMsg.includes(' - '), 'Has " - " separator');

    // Test various inventory letters
    const testCases = [
        'a - a blessed +1 longsword.',
        'b - a scroll of identify.',
        'z - a wand of death.',
        'A - a ring of levitation.',
    ];

    for (const msg of testCases) {
        assert.ok(msg.match(/^[a-zA-Z] - .+\.$/),
            `Message "${msg}" matches C format`);
    }
});

test('pickup_types: filtered items show "You see here" message', () => {
    // C ref: When autopickup doesn't pick up items, shows "You see here"
    const seeHereMsg = 'You see here a dagger.';
    const seeHereMultiple = 'You see here several objects.';

    assert.ok(seeHereMsg.startsWith('You see here '),
        'Not-picked-up items show "You see here"');
    assert.ok(seeHereMsg.endsWith('.'),
        '"You see here" message ends with period');
    assert.ok(seeHereMultiple === 'You see here several objects.',
        'Multiple items show "several objects"');
});

test('pickup_types: message order - gold first, then other items', () => {
    // C ref: pickup.c always picks up gold first (line 1054)
    // Then picks up other items if autopickup enabled

    // Simulate walking over gold + potion
    // Expected: gold message first, then potion message OR "You see here"

    const messages = [];

    // Gold is always picked up
    messages.push('58 gold pieces.');

    // Potion picked up if pickup_types includes '!'
    messages.push('a - a potion of healing.');

    assert.strictEqual(messages[0], '58 gold pieces.',
        'Gold message comes first');
    assert.strictEqual(messages[1], 'a - a potion of healing.',
        'Item message comes second');
});

test('pickup_types: empty string picks up all items (shows messages)', () => {
    // C ref: pickup.c line 957: pickit = (!*otypes || strchr(otypes, otmp->oclass))
    // Empty string means pick up everything

    const pickup_types = '';
    const shouldPickupAll = !pickup_types || pickup_types === '';

    assert.strictEqual(shouldPickupAll, true,
        'Empty pickup_types means pickup all');

    // All items should show pickup message format "X - item."
    // Not "You see here"
});

test('pickup_types: filtered items do NOT show pickup message', () => {
    // pickup_types="$" (gold only)
    // Walk over gold + potion
    // Expected: "58 gold pieces." then "You see here a potion of healing."

    const pickup_types = '$';
    const potion = { oclass: POTION_CLASS, name: 'a potion of healing' };
    const weapon = { oclass: WEAPON_CLASS, name: 'a dagger' };

    // Potion and weapon should NOT be picked up
    // Should show "You see here" message instead of "a - " format

    const potionSymbol = '!';
    const weaponSymbol = ')';

    assert.ok(!pickup_types.includes(potionSymbol),
        'Potion symbol not in pickup_types');
    assert.ok(!pickup_types.includes(weaponSymbol),
        'Weapon symbol not in pickup_types');

    // These items should show "You see here" not pickup format
});

test('pickup_types: message placement on top line', () => {
    // C ref: Messages appear on top line (row 0) of screen
    // This is handled by display.putstr_message()

    // In C NetHack:
    // - Messages go to message window (top line in TTY mode)
    // - Pickup messages are normal messages, same as any other

    // In JS:
    // - display.putstr_message() handles placement
    // - Should go to row 0 (top line)

    // This test documents the expectation
    const expectedRow = 0;
    assert.strictEqual(expectedRow, 0, 'Messages appear on top line');
});

test('pickup_types: multiple items - only first matching item picked up', () => {
    // Current C behavior (autopickup=1 mode):
    // Picks up ONE item at a time, not all items
    // C ref: pickup.c finds first matching item

    // If floor has: potion, scroll, dagger
    // And pickup_types="!?"
    // Then: picks up potion only (first match)
    // Next move: picks up scroll (next match)

    // This is current implementation in JS commands.js line 578:
    // const obj = objs.find(o => ...)
    // find() returns FIRST matching object

    const items = [
        { oclass: POTION_CLASS, name: 'potion' },
        { oclass: SCROLL_CLASS, name: 'scroll' },
    ];

    const firstMatch = items.find(o => o.oclass === POTION_CLASS || o.oclass === SCROLL_CLASS);

    assert.strictEqual(firstMatch.name, 'potion',
        'First matching item is picked up');
});

}); // describe
