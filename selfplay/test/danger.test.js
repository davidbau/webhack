// selfplay/test/danger.test.js -- Tests for monster danger assessment

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { assessMonsterDanger, shouldEngageMonster, DangerLevel, getMonsterName } from '../brain/danger.js';

describe('Monster Danger Assessment', () => {
    it('identifies floating eyes as instadeath threat', () => {
        const danger = assessMonsterDanger('e', 16, 16, 1);
        assert.equal(danger, DangerLevel.INSTADEATH);

        const engagement = shouldEngageMonster('e', 16, 16, 1);
        assert.equal(engagement.shouldEngage, false);
        assert.ok(engagement.reason.includes('never melee'));
    });

    it('identifies cockatrices as instadeath threat', () => {
        const danger = assessMonsterDanger('c', 16, 16, 1);
        assert.equal(danger, DangerLevel.INSTADEATH);

        const engagement = shouldEngageMonster('c', 16, 16, 1);
        assert.equal(engagement.shouldEngage, false);
    });

    it('treats dragons as high danger', () => {
        const danger = assessMonsterDanger('D', 16, 16, 1);
        assert.equal(danger, DangerLevel.HIGH);

        // Should not engage when HP low
        const engagement1 = shouldEngageMonster('D', 5, 16, 1);
        assert.equal(engagement1.shouldEngage, false);

        // Should engage when HP good
        const engagement2 = shouldEngageMonster('D', 12, 16, 1);
        assert.equal(engagement2.shouldEngage, true);
    });

    it('treats demons as high danger', () => {
        const danger = assessMonsterDanger('&', 16, 16, 1);
        assert.equal(danger, DangerLevel.HIGH);
    });

    it('treats lowercase monsters as low danger when HP good', () => {
        const danger = assessMonsterDanger('d', 16, 16, 1);
        assert.equal(danger, DangerLevel.LOW);

        const engagement = shouldEngageMonster('d', 16, 16, 1);
        assert.equal(engagement.shouldEngage, true);
    });

    it('treats lowercase monsters as medium danger when HP low', () => {
        const danger = assessMonsterDanger('d', 4, 16, 1);
        assert.equal(danger, DangerLevel.MEDIUM);

        const engagement = shouldEngageMonster('d', 4, 16, 1);
        assert.equal(engagement.shouldEngage, false);
    });

    it('treats uppercase monsters as more dangerous at low level', () => {
        const danger = assessMonsterDanger('H', 16, 16, 1);
        assert.equal(danger, DangerLevel.HIGH);

        const engagement = shouldEngageMonster('H', 8, 16, 1);
        assert.equal(engagement.shouldEngage, false);
    });

    it('provides friendly monster names', () => {
        assert.equal(getMonsterName('d'), 'dog');
        assert.equal(getMonsterName('e'), 'floating eye');
        assert.equal(getMonsterName('D'), 'dragon');
        assert.equal(getMonsterName('x'), 'monster(x)');
    });

    it('recommends fleeing from liches at low HP', () => {
        const engagement = shouldEngageMonster('L', 5, 16, 3);
        assert.equal(engagement.shouldEngage, false);
        assert.ok(engagement.reason.includes('dangerous'));
    });

    it('allows engaging vampires at good HP and high level', () => {
        const engagement = shouldEngageMonster('V', 14, 16, 8);
        assert.equal(engagement.shouldEngage, true);
    });
});
