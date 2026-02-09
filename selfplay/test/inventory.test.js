// selfplay/test/inventory.test.js -- Tests for inventory tracking

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InventoryTracker } from '../brain/inventory.js';

describe('Inventory Tracking', () => {
    it('parses basic inventory screen', () => {
        const screen = createInventoryScreen([
            ' Weapons',
            ' a - a dagger',
            ' b - a short sword',
            ' Comestibles',
            ' c - 3 food rations',
            ' (end)',
        ]);

        const tracker = new InventoryTracker();
        const success = tracker.parseFromScreen(screen);

        assert.equal(success, true);
        assert.equal(tracker.count(), 3);
        assert.equal(tracker.items[0].letter, 'a');
        assert.equal(tracker.items[0].name, 'a dagger');
        assert.equal(tracker.items[0].category, 'Weapons');
        assert.equal(tracker.items[2].letter, 'c');
        assert.equal(tracker.items[2].category, 'Comestibles');
    });

    it('finds food items', () => {
        const screen = createInventoryScreen([
            ' Comestibles',
            ' a - 3 food rations',
            ' b - a tripe ration',
            ' Potions',
            ' c - a potion of healing',
            ' (end)',
        ]);

        const tracker = new InventoryTracker();
        tracker.parseFromScreen(screen);

        assert.equal(tracker.hasFood(), true);
        const food = tracker.findFood();
        assert.equal(food.length, 2);
        assert.equal(food[0].letter, 'a');
    });

    it('finds healing potions', () => {
        const screen = createInventoryScreen([
            ' Potions',
            ' a - a potion of healing',
            ' b - a potion of extra healing',
            ' c - a potion of water',
            ' (end)',
        ]);

        const tracker = new InventoryTracker();
        tracker.parseFromScreen(screen);

        const healing = tracker.findHealingPotions();
        assert.equal(healing.length, 2);
        assert.equal(healing[0].name, 'a potion of healing');
        assert.equal(healing[1].name, 'a potion of extra healing');
    });

    it('handles empty inventory', () => {
        const screen = createInventoryScreen([
            ' (end)',
        ]);

        const tracker = new InventoryTracker();
        const success = tracker.parseFromScreen(screen);

        // Empty inventory with (end) marker is still successful parse
        assert.equal(success, true);
        assert.equal(tracker.count(), 0);
        assert.equal(tracker.hasFood(), false);
    });

    it('finds items by letter', () => {
        const screen = createInventoryScreen([
            ' Weapons',
            ' a - a dagger',
            ' b - a short sword',
            ' (end)',
        ]);

        const tracker = new InventoryTracker();
        tracker.parseFromScreen(screen);

        const itemA = tracker.findByLetter('a');
        assert.equal(itemA.name, 'a dagger');

        const itemB = tracker.findByLetter('b');
        assert.equal(itemB.name, 'a short sword');

        const itemC = tracker.findByLetter('c');
        assert.equal(itemC, undefined);
    });

    it('gets items by category', () => {
        const screen = createInventoryScreen([
            ' Weapons',
            ' a - a dagger',
            ' b - a short sword',
            ' Armor',
            ' c - a leather armor',
            ' (end)',
        ]);

        const tracker = new InventoryTracker();
        tracker.parseFromScreen(screen);

        const weapons = tracker.getByCategory('Weapons');
        assert.equal(weapons.length, 2);

        const armor = tracker.getByCategory('Armor');
        assert.equal(armor.length, 1);
    });
});

/**
 * Helper: Create a mock screen buffer with inventory text
 */
function createInventoryScreen(lines) {
    const map = [];

    // Pad to 21 rows (standard map height)
    while (lines.length < 21) {
        lines.push('');
    }

    for (const line of lines) {
        const row = [];
        // Pad each line to 80 columns
        const paddedLine = line.padEnd(80, ' ');
        for (let i = 0; i < 80; i++) {
            row.push({ ch: paddedLine[i], color: 7, type: 'floor' });
        }
        map.push(row);
    }

    return { map };
}
