// selfplay/test/stair_strategy.test.js -- Tests for stair descent strategy

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { Agent } from '../agent.js';
import { DangerLevel } from '../brain/danger.js';

/**
 * Helper to create a minimal mock adapter
 */
function createMockAdapter() {
    return {
        start: async () => {},
        stop: async () => {},
        sendKey: async () => {},
        readScreen: async () => null,
        isRunning: async () => true,
    };
}

/**
 * Helper to create a minimal agent with test state
 */
function createTestAgent() {
    const adapter = createMockAdapter();
    const agent = new Agent(adapter, { verbose: false });

    // Initialize minimal state
    agent.status = {
        hp: 16,
        hpmax: 16,
        dungeonLevel: 1,
        strength: 18,
        dexterity: 18,
        constitution: 18,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
        ac: 6,
        level: 1,
        experienceLevel: 1,
        gold: 0,
        alignment: 'neutral',
    };

    agent.levels = new Map();
    agent.currentLevel = {
        monsters: [],
        stairsUp: [],
        stairsDown: [{ x: 40, y: 12 }],
    };

    // Mock screen - required for findMonsters
    // findMonsters expects screen.map (a 2D grid with .type property)
    agent.screen = {
        map: [],
    };
    for (let r = 0; r < 24; r++) {
        agent.screen.map[r] = [];
        for (let c = 0; c < 80; c++) {
            agent.screen.map[r][c] = { ch: ' ', color: 7, type: 'floor' };
        }
    }

    // Track player position
    agent.px = 40;
    agent.py = 12;

    // Mock inventory with findHealingPotions method
    agent._testHealingPotions = [];
    agent.inventory = {
        findHealingPotions: () => agent._testHealingPotions,
    };

    return agent;
}

describe('Stair Descent Strategy', () => {
    it('allows descent with full HP and no monsters', () => {
        const agent = createTestAgent();
        agent.status.hp = 16;
        agent.status.hpmax = 16;
        agent.currentLevel.monsters = [];

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, true);
        assert.ok(decision.reason.includes('descending'));
    });

    it('refuses descent with critical HP', () => {
        const agent = createTestAgent();
        agent.status.hp = 5;
        agent.status.hpmax = 16;
        agent.status.dungeonLevel = 2; // Must be > 1 for the critical HP check to apply

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, false);
        assert.ok(decision.reason.includes('HP critical') || decision.reason.includes('31%'));
    });

    it('refuses descent with nearby monsters and low HP', () => {
        const agent = createTestAgent();
        agent.status.hp = 7;
        agent.status.hpmax = 16;
        agent.px = 40;
        agent.py = 12;

        // Add monster to screen (not just currentLevel)
        agent.screen.map[12][41] = { ch: 'g', color: 7, type: 'monster' };

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, false);
        assert.ok(decision.reason.includes('43%') || decision.reason.includes('monsters'));
    });

    it('refuses descent with dangerous nearby monsters', () => {
        const agent = createTestAgent();
        agent.status.hp = 14;
        agent.status.hpmax = 16;
        agent.px = 40;
        agent.py = 12;

        // Add dragon to screen
        agent.screen.map[12][41] = { ch: 'D', color: 7, type: 'monster' };

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, false);
        assert.ok(decision.reason.includes('HIGH danger'));
    });

    it('allows descent with good HP and harmless nearby monsters', () => {
        const agent = createTestAgent();
        agent.status.hp = 14;
        agent.status.hpmax = 16;
        agent.status.experienceLevel = 2;
        agent.status.level = 2;
        agent.px = 40;
        agent.py = 12;

        // Add kobold to screen (LOW danger)
        agent.screen.map[12][41] = { ch: 'k', color: 7, type: 'monster' };

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, true);
    });

    it('prefers staying to heal when low on potions', () => {
        const agent = createTestAgent();
        agent.status.hp = 7;
        agent.status.hpmax = 16;
        agent.status.dungeonLevel = 3;
        agent._testHealingPotions = [];
        agent.currentLevel.monsters = [];

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, false);
        assert.ok(decision.reason.includes('heal') || decision.reason.includes('HP'));
    });

    it('allows descent with healing potions available', () => {
        const agent = createTestAgent();
        agent.status.hp = 10;
        agent.status.hpmax = 16;
        agent.status.dungeonLevel = 2;
        agent._testHealingPotions = [
            { letter: 'a', type: 'potion', name: 'healing' },
            { letter: 'b', type: 'potion', name: 'healing' },
        ];
        agent.currentLevel.monsters = [];

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, true);
    });

    it('considers exploration progress in decision', () => {
        const agent = createTestAgent();
        agent.status.hp = 12;
        agent.status.hpmax = 16;
        agent.currentLevel.monsters = [];

        // Mock a partially explored level
        agent.currentLevel.exploredPercent = 0.4;  // Only 40% explored

        const decision = agent._shouldDescendStairs();
        // Should still allow descent if HP is adequate
        assert.equal(decision.shouldDescend, true);
    });

    it('refuses descent when surrounded by multiple monsters', () => {
        const agent = createTestAgent();
        agent.status.hp = 14;
        agent.status.hpmax = 16;
        agent.status.experienceLevel = 2;
        agent.status.level = 2;
        agent.px = 40;
        agent.py = 12;

        // Add multiple monsters to screen
        agent.screen.map[12][41] = { ch: 'g', color: 7, type: 'monster' };
        agent.screen.map[12][39] = { ch: 'o', color: 7, type: 'monster' };
        agent.screen.map[13][40] = { ch: 'k', color: 7, type: 'monster' };

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, false);
        assert.ok(decision.reason.includes('HP too low') || decision.reason.includes('monsters'));
    });

    it('allows descent at deeper levels with adequate HP', () => {
        const agent = createTestAgent();
        agent.status.hp = 12;
        agent.status.hpmax = 16;
        agent.status.dungeonLevel = 5;
        agent.status.experienceLevel = 5;
        agent.status.level = 5;

        // Need potions at deep levels when HP < 80%
        agent._testHealingPotions = [
            { letter: 'a', type: 'potion', name: 'healing' },
        ];

        const decision = agent._shouldDescendStairs();
        assert.equal(decision.shouldDescend, true);
    });
});
