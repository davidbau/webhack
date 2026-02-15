// selfplay/test/danger.test.js -- Tests for monster danger assessment

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { assessMonsterDanger, shouldEngageMonster, DangerLevel, getMonsterName, countNearbyMonsters } from '../brain/danger.js';

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
        const danger = assessMonsterDanger('D', 16, 16, 1, 1);
        assert.equal(danger, DangerLevel.HIGH);

        // Should not engage when HP low
        const engagement1 = shouldEngageMonster('D', 5, 16, 1, false, 1, 0, false);
        assert.equal(engagement1.shouldEngage, false);

        // Should engage when HP good (75%), blocking, alone
        const engagement2 = shouldEngageMonster('D', 12, 16, 1, true, 1, 0, false);
        assert.equal(engagement2.shouldEngage, true); // HP >= 70%, blocking, forced to fight
    });

    it('treats demons as high danger', () => {
        const danger = assessMonsterDanger('&', 16, 16, 1);
        assert.equal(danger, DangerLevel.HIGH);
    });

    it('treats lowercase monsters as low danger when HP good', () => {
        const danger = assessMonsterDanger('d', 16, 16, 1, 1);
        assert.equal(danger, DangerLevel.LOW);

        // Dlvl 1 lone dogs are special-cased to engage when healthy.
        const engagement = shouldEngageMonster('d', 16, 16, 1, false, 1, 0, false);
        assert.equal(engagement.ignore, false);
        assert.equal(engagement.shouldEngage, true);
    });

    it('treats lowercase monsters as medium danger when HP low', () => {
        const danger = assessMonsterDanger('d', 4, 16, 1, 1);
        assert.equal(danger, DangerLevel.MEDIUM);

        const engagement = shouldEngageMonster('d', 4, 16, 1, false, 1, 0, false);
        assert.equal(engagement.shouldEngage, false);
    });

    it('treats uppercase monsters as more dangerous at low level', () => {
        const danger = assessMonsterDanger('H', 16, 16, 1, 1);
        assert.equal(danger, DangerLevel.HIGH);

        const engagement = shouldEngageMonster('H', 8, 16, 1, false, 1, 0, false);
        assert.equal(engagement.shouldEngage, false);
    });

    it('provides friendly monster names', () => {
        assert.equal(getMonsterName('d'), 'dog');
        assert.equal(getMonsterName('e'), 'floating eye');
        assert.equal(getMonsterName('D'), 'dragon');
        assert.equal(getMonsterName('x'), 'monster(x)');
    });

    it('recommends fleeing from liches at low HP', () => {
        const engagement = shouldEngageMonster('L', 5, 16, 3, false, 3, 0, false);
        assert.equal(engagement.shouldEngage, false);
        assert.ok(engagement.reason.includes('high danger') || engagement.reason.includes('avoiding'));
    });

    it('allows engaging vampires at good HP and high level when blocking', () => {
        // Vampires are HIGH danger, need to be blocking and have good HP
        const engagement = shouldEngageMonster('V', 14, 16, 8, true, 8, 0, false);
        assert.equal(engagement.shouldEngage, true);
    });
});

describe('Dlvl 3-5 Combat Tactics', () => {
    it('identifies giant spiders as dangerous on Dlvl 3+', () => {
        // Giant spider on Dlvl 3 with low HP should be HIGH danger
        const danger = assessMonsterDanger('s', 8, 16, 3, 3);
        assert.equal(danger, DangerLevel.HIGH);

        // Should not engage with low HP
        const engagement = shouldEngageMonster('s', 8, 16, 3, false, 3);
        assert.equal(engagement.shouldEngage, false);
    });

    it('treats giant spiders as medium danger with good HP', () => {
        // With good HP and level, giant spider is manageable
        const danger = assessMonsterDanger('s', 14, 16, 4, 3);
        assert.equal(danger, DangerLevel.MEDIUM);
    });

    it('treats rothes and orcs as mid-game threats', () => {
        // Rothe with low HP should be MEDIUM danger
        const rotheLowHP = assessMonsterDanger('q', 8, 16, 2, 3);
        assert.equal(rotheLowHP, DangerLevel.MEDIUM);

        // Hill orc with good HP should be LOW danger
        const orcGoodHP = assessMonsterDanger('o', 16, 16, 3, 3);
        assert.equal(orcGoodHP, DangerLevel.LOW);
    });

    it('counts nearby monsters correctly', () => {
        const monsters = [
            { ch: 'g', x: 5, y: 5 },   // at player position (distance 0) - NOT counted
            { ch: 'g', x: 6, y: 5 },   // nearby (distance 1) - counted
            { ch: 'o', x: 8, y: 5 },   // nearby (distance 3) - counted
            { ch: 's', x: 10, y: 5 },  // too far (distance 5) - NOT counted
        ];
        const count = countNearbyMonsters(monsters, 5, 5, 3);
        assert.equal(count, 2); // Should count 2 monsters within range 3 (excluding player position)
    });

    it('refuses to engage when outnumbered in open space', () => {
        // 2+ nearby monsters in open space = flee
        const engagement = shouldEngageMonster(
            'g',          // hobgoblin
            14, 16,       // good HP
            3,            // level 3
            false,        // not blocking
            3,            // dungeon level 3
            2,            // 2 other nearby monsters
            false         // NOT in corridor
        );
        assert.equal(engagement.shouldEngage, false);
        assert.ok(engagement.reason.includes('outnumbered'));
    });

    it('ignores weak monsters even when multiple present', () => {
        // Weak (LOW danger) monsters are ignored - we walk through them
        // Even when multiple are present, if they're LOW danger we ignore them
        // Note: Rats are special-cased to MEDIUM danger to prevent deaths
        const engagement = shouldEngageMonster(
            'g',          // hobgoblin (mid-game threat, but LOW danger with good HP)
            14, 16,       // good HP (87.5%)
            3,            // level 3
            true,         // blocking
            3,            // dungeon level 3
            1,            // 1 other nearby monster
            true          // in corridor
        );
        // Should ignore LOW danger monsters (they might be pets)
        assert.equal(engagement.ignore, true);
        assert.equal(engagement.shouldEngage, false);
    });

    it('refuses to engage multiple dangerous monsters even in corridor', () => {
        // Multiple HIGH danger monsters = flee even in corridor
        const engagement = shouldEngageMonster(
            's',          // giant spider (high danger on Dlvl 3)
            10, 16,       // medium HP
            3,            // level 3
            true,         // blocking
            3,            // dungeon level 3
            2,            // 2 other nearby monsters
            true          // in corridor
        );
        assert.equal(engagement.shouldEngage, false);
        assert.ok(engagement.reason.includes('multiple dangerous monsters'));
    });

    it('provides friendly names for Dlvl 3-5 monsters', () => {
        assert.equal(getMonsterName('s'), 'giant spider');
        assert.equal(getMonsterName('q'), 'rothe');
        assert.equal(getMonsterName('o'), 'hill orc');
        assert.equal(getMonsterName('Z'), 'dwarf zombie');
        assert.equal(getMonsterName('G'), 'gnome lord');
    });
});
