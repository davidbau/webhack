// selfplay/brain/prayer.js -- Prayer timing and divine intervention
//
// Prayer is a critical survival mechanism in NetHack. When the player prays,
// their god may help them (heal HP, cure sickness, etc.) if conditions are right.
//
// Key rules:
// - Can only pray safely once every ~300-400 turns (god's timeout)
// - Praying too often angers your god (dangerous)
// - Best used when in mortal danger with no other options
// - God will help if: HP low, stuck, etc. and you've been pious

/**
 * Prayer timer tracker
 */
export class PrayerTracker {
    constructor() {
        this.lastPrayerTurn = -1000; // Last turn we prayed (start far in past)
        this.prayerTimeout = 300; // Minimum turns between prayers (conservative)
    }

    /**
     * Check if it's safe to pray (god's timeout has passed)
     * @param {number} currentTurn - Current game turn
     * @returns {boolean} - True if prayer is available
     */
    canPray(currentTurn) {
        return (currentTurn - this.lastPrayerTurn) >= this.prayerTimeout;
    }

    /**
     * Get turns until next safe prayer
     * @param {number} currentTurn - Current game turn
     * @returns {number} - Turns remaining until can pray safely
     */
    turnsUntilPrayer(currentTurn) {
        const turnsSince = currentTurn - this.lastPrayerTurn;
        return Math.max(0, this.prayerTimeout - turnsSince);
    }

    /**
     * Record that we just prayed
     * @param {number} currentTurn - Current game turn
     */
    recordPrayer(currentTurn) {
        this.lastPrayerTurn = currentTurn;
    }

    /**
     * Decide whether to pray based on current situation
     *
     * @param {Object} status - Parsed status line
     * @param {number} currentTurn - Current game turn
     * @param {Object} options - Additional context
     * @param {boolean} options.hasHealingPotions - Whether we have healing items
     * @param {boolean} options.canFlee - Whether we can flee from danger
     * @returns {Object} - { shouldPray: boolean, reason: string }
     */
    shouldPray(status, currentTurn, options = {}) {
        if (!status) {
            return { shouldPray: false, reason: 'no status info' };
        }

        // Check if prayer is available
        if (!this.canPray(currentTurn)) {
            const turns = this.turnsUntilPrayer(currentTurn);
            return { shouldPray: false, reason: `god timeout (${turns} turns left)` };
        }

        // Only pray when in SERIOUS danger (< 20% HP) and no other options
        const hpPercent = status.hp / status.hpmax;
        const criticalHP = hpPercent < 0.2;

        if (!criticalHP) {
            return { shouldPray: false, reason: `HP not critical (${status.hp}/${status.hpmax})` };
        }

        // If we have healing potions, use those first (don't waste prayer)
        if (options.hasHealingPotions) {
            return { shouldPray: false, reason: 'have healing potions (use those first)' };
        }

        // If we can flee, try that first (prayer is last resort)
        if (options.canFlee) {
            return { shouldPray: false, reason: 'can flee (try that first)' };
        }

        // Critical situation: HP very low, no items, can't flee
        return {
            shouldPray: true,
            reason: `HP critical (${status.hp}/${status.hpmax}), no other options`,
        };
    }

    /**
     * Reset prayer timer (use after death or game restart)
     */
    reset() {
        this.lastPrayerTurn = -1000;
    }
}
