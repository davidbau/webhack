// selfplay/brain/inventory.js -- Inventory tracking and management
//
// Parses inventory screen ('i' command) and tracks what items we have.
// Provides helpers to find food, healing potions, etc.

/**
 * Item class constants (matching NetHack's oclass)
 */
export const ItemClass = {
    WEAPON: 1,
    ARMOR: 2,
    RING: 3,
    AMULET: 4,
    TOOL: 5,
    FOOD: 6,
    POTION: 7,
    SCROLL: 8,
    SPELLBOOK: 9,
    WAND: 10,
    COIN: 11,
    GEM: 12,
};

/**
 * Inventory tracker
 */
export class InventoryTracker {
    constructor() {
        this.items = []; // Array of { letter, name, category }
        this.lastUpdate = 0; // Turn number when last updated
    }

    /**
     * Parse inventory from screen buffer.
     * Call this after sending 'i' and reading the resulting screen.
     *
     * @param {Object} screen - Screen buffer from screen_parser
     * @returns {boolean} - True if inventory was parsed successfully
     */
    parseFromScreen(screen) {
        if (!screen || !screen.map) return false;

        // Look for inventory display pattern
        // Format:
        //   Weapons
        //   a - a dagger
        //   b - a short sword
        //   Comestibles
        //   c - 3 food rations
        //   (end)

        this.items = [];
        let currentCategory = null;

        for (let y = 0; y < screen.map.length; y++) {
            const line = this._getLineText(screen.map[y]);

            // Category header (indented with single space, no dash)
            if (line.match(/^ [A-Z][a-z]+/)) {
                currentCategory = line.trim();
                continue;
            }

            // Item line: " <letter> - <description>"
            const itemMatch = line.match(/^ ([a-zA-Z]) - (.+)$/);
            if (itemMatch) {
                const letter = itemMatch[1];
                const name = itemMatch[2].trim();
                this.items.push({
                    letter,
                    name,
                    category: currentCategory || 'Unknown',
                });
                continue;
            }

            // End marker
            if (line.includes('(end)')) {
                return true;
            }
        }

        // If we found items but no (end) marker, still consider it successful
        return this.items.length > 0;
    }

    /**
     * Get text content from a screen row (array of cells)
     */
    _getLineText(row) {
        if (!row) return '';
        return row.map(cell => cell.ch || ' ').join('');
    }

    /**
     * Check if we have any food items
     */
    hasFood() {
        return this.items.some(item =>
            item.category === 'Comestibles' ||
            item.name.includes('food') ||
            item.name.includes('ration') ||
            item.name.includes('corpse')
        );
    }

    /**
     * Find food items
     * @returns {Array} - Array of food items with { letter, name }
     */
    findFood() {
        return this.items.filter(item =>
            item.category === 'Comestibles' ||
            item.name.includes('food') ||
            item.name.includes('ration')
        );
    }

    /**
     * Find healing potions
     * @returns {Array} - Array of healing potion items
     */
    findHealingPotions() {
        return this.items.filter(item =>
            item.category === 'Potions' &&
            (item.name.includes('healing') ||
             item.name.includes('extra healing') ||
             item.name.includes('full healing'))
        );
    }

    /**
     * Get all items in a specific category
     */
    getByCategory(category) {
        return this.items.filter(item => item.category === category);
    }

    /**
     * Find an item by its letter
     */
    findByLetter(letter) {
        return this.items.find(item => item.letter === letter);
    }

    /**
     * Get count of items
     */
    count() {
        return this.items.length;
    }

    /**
     * Clear inventory (use when starting new game or after death)
     */
    clear() {
        this.items = [];
        this.lastUpdate = 0;
    }
}
