// selfplay/test/prayer.test.js -- Tests for prayer timing

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PrayerTracker } from '../brain/prayer.js';

describe('Prayer Timing', () => {
    it('allows prayer when timeout has passed', () => {
        const tracker = new PrayerTracker();
        tracker.lastPrayerTurn = 100;

        // Before timeout
        assert.equal(tracker.canPray(350), false);

        // At timeout
        assert.equal(tracker.canPray(400), true);

        // After timeout
        assert.equal(tracker.canPray(500), true);
    });

    it('tracks turns until next prayer', () => {
        const tracker = new PrayerTracker();
        tracker.lastPrayerTurn = 100;

        assert.equal(tracker.turnsUntilPrayer(200), 200);
        assert.equal(tracker.turnsUntilPrayer(350), 50);
        assert.equal(tracker.turnsUntilPrayer(400), 0);
        assert.equal(tracker.turnsUntilPrayer(500), 0);
    });

    it('recommends prayer when HP critical and no options', () => {
        const tracker = new PrayerTracker();
        const status = { hp: 3, hpmax: 16 }; // 18.75% HP - critical

        const decision = tracker.shouldPray(status, 1000, {
            hasHealingPotions: false,
            canFlee: false,
        });

        assert.equal(decision.shouldPray, true);
        assert.ok(decision.reason.includes('critical'));
    });

    it('prefers healing potions over prayer', () => {
        const tracker = new PrayerTracker();
        const status = { hp: 3, hpmax: 16 };

        const decision = tracker.shouldPray(status, 1000, {
            hasHealingPotions: true,
            canFlee: false,
        });

        assert.equal(decision.shouldPray, false);
        assert.ok(decision.reason.includes('healing potions'));
    });

    it('prefers fleeing over prayer', () => {
        const tracker = new PrayerTracker();
        const status = { hp: 3, hpmax: 16 };

        const decision = tracker.shouldPray(status, 1000, {
            hasHealingPotions: false,
            canFlee: true,
        });

        assert.equal(decision.shouldPray, false);
        assert.ok(decision.reason.includes('flee'));
    });

    it('refuses prayer when HP not critical', () => {
        const tracker = new PrayerTracker();
        const status = { hp: 10, hpmax: 16 }; // 62.5% HP - not critical

        const decision = tracker.shouldPray(status, 1000, {
            hasHealingPotions: false,
            canFlee: false,
        });

        assert.equal(decision.shouldPray, false);
        assert.ok(decision.reason.includes('not critical'));
    });

    it('refuses prayer when god timeout active', () => {
        const tracker = new PrayerTracker();
        tracker.lastPrayerTurn = 900;
        const status = { hp: 3, hpmax: 16 };

        const decision = tracker.shouldPray(status, 1000, {
            hasHealingPotions: false,
            canFlee: false,
        });

        assert.equal(decision.shouldPray, false);
        assert.ok(decision.reason.includes('timeout'));
    });

    it('records prayer turn', () => {
        const tracker = new PrayerTracker();
        tracker.recordPrayer(500);

        assert.equal(tracker.lastPrayerTurn, 500);
        assert.equal(tracker.canPray(700), false);
        assert.equal(tracker.canPray(800), true);
    });

    it('resets prayer timer', () => {
        const tracker = new PrayerTracker();
        tracker.recordPrayer(500);
        tracker.reset();

        assert.equal(tracker.canPray(0), true);
    });
});
