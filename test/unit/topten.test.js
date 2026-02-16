// test/unit/topten.test.js -- Tests for high score persistence and display
// C ref: topten.c -- verifies score saving, loading, ranking, and formatting

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Player, roles, races } from '../../js/player.js';
import { FEMALE, MALE, A_LAWFUL, A_NEUTRAL, A_CHAOTIC,
         RACE_HUMAN, RACE_ELF } from '../../js/config.js';
import {
    loadScores, saveScore, buildEntry,
    formatTopTenEntry, formatTopTenHeader, getPlayerRank,
    TOPTEN_KEY,
} from '../../js/topten.js';

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

// Helper: make a player with known state for testing
function makeTestPlayer(opts = {}) {
    const p = new Player();
    p.name = opts.name || 'Tester';
    p.roleIndex = opts.roleIndex !== undefined ? opts.roleIndex : 12; // Wizard
    p.race = opts.race !== undefined ? opts.race : RACE_HUMAN;
    p.gender = opts.gender !== undefined ? opts.gender : MALE;
    p.alignment = opts.alignment !== undefined ? opts.alignment : A_NEUTRAL;
    p.score = opts.score || 100;
    p.hp = opts.hp !== undefined ? opts.hp : 0;
    p.hpmax = opts.hpmax || 15;
    p.dungeonLevel = opts.dungeonLevel || 3;
    p.maxDungeonLevel = opts.maxDungeonLevel || 5;
    p.gold = opts.gold || 42;
    p.turns = opts.turns || 200;
    p.deathCause = opts.deathCause !== undefined ? opts.deathCause : 'killed by a newt';
    p.exp = opts.exp || 50;
    return p;
}

// ========================================================================
// loadScores / saveScore
// ========================================================================
describe('Top ten: loadScores / saveScore', () => {
    beforeEach(() => {
        store.clear();
    });

    it('loadScores returns empty array when nothing saved', () => {
        const scores = loadScores();
        assert.ok(Array.isArray(scores));
        assert.equal(scores.length, 0);
    });

    it('loadScores returns empty array for corrupt data', () => {
        store.set(TOPTEN_KEY, 'not-json');
        const scores = loadScores();
        assert.ok(Array.isArray(scores));
        assert.equal(scores.length, 0);
    });

    it('loadScores returns empty array for non-array JSON', () => {
        store.set(TOPTEN_KEY, '{"foo":1}');
        const scores = loadScores();
        assert.equal(scores.length, 0);
    });

    it('saveScore inserts entry and returns rank', () => {
        const entry = { points: 500, name: 'Hero', death: 'killed by a newt' };
        const rank = saveScore(entry);
        assert.equal(rank, 1);

        const scores = loadScores();
        assert.equal(scores.length, 1);
        assert.equal(scores[0].points, 500);
    });

    it('saveScore maintains descending order by points', () => {
        saveScore({ points: 100, name: 'Low' });
        saveScore({ points: 500, name: 'High' });
        saveScore({ points: 300, name: 'Mid' });

        const scores = loadScores();
        assert.equal(scores.length, 3);
        assert.equal(scores[0].name, 'High');
        assert.equal(scores[1].name, 'Mid');
        assert.equal(scores[2].name, 'Low');
    });

    it('saveScore returns correct rank for each position', () => {
        saveScore({ points: 500, name: 'First' });
        const rank2 = saveScore({ points: 300, name: 'Second' });
        assert.equal(rank2, 2);

        const rank1 = saveScore({ points: 1000, name: 'New Top' });
        assert.equal(rank1, 1);

        const rank3 = saveScore({ points: 400, name: 'Middle' });
        assert.equal(rank3, 3); // between 500 and 300
    });

    it('saveScore trims to MAX_ENTRIES (100)', () => {
        // Insert 100 entries
        for (let i = 0; i < 100; i++) {
            saveScore({ points: 1000 - i, name: `Player${i}` });
        }
        assert.equal(loadScores().length, 100);

        // Insert one more at the top
        saveScore({ points: 2000, name: 'TopPlayer' });
        const scores = loadScores();
        assert.equal(scores.length, 100);
        assert.equal(scores[0].name, 'TopPlayer');
    });

    it('saveScore returns -1 when entry does not make the list', () => {
        // Fill with 100 entries all with score 1000
        for (let i = 0; i < 100; i++) {
            saveScore({ points: 1000, name: `Player${i}` });
        }
        // Try to insert with score 0 — should not make the list
        const rank = saveScore({ points: 0, name: 'Loser' });
        assert.equal(rank, -1);
    });

    it('saveScore handles equal scores (appends after existing)', () => {
        saveScore({ points: 100, name: 'First' });
        const rank = saveScore({ points: 100, name: 'Second' });
        // Second entry with equal points goes after first
        assert.equal(rank, 2);
        const scores = loadScores();
        assert.equal(scores[0].name, 'First');
        assert.equal(scores[1].name, 'Second');
    });
});

// ========================================================================
// buildEntry
// ========================================================================
describe('Top ten: buildEntry', () => {
    it('builds entry with correct fields from player state', () => {
        const p = makeTestPlayer({
            name: 'Hero', score: 500, dungeonLevel: 3, maxDungeonLevel: 5,
            hp: 0, hpmax: 15, turns: 200, deathCause: 'killed by a newt',
            roleIndex: 12, race: RACE_HUMAN, gender: MALE, alignment: A_NEUTRAL,
        });

        const entry = buildEntry(p, 'killed', roles, races);

        assert.equal(entry.points, 500);
        assert.equal(entry.deathlev, 3);
        assert.equal(entry.maxlvl, 5);
        assert.equal(entry.hp, 0);
        assert.equal(entry.maxhp, 15);
        assert.equal(entry.name, 'Hero');
        assert.equal(entry.death, 'killed by a newt');
        assert.equal(entry.plrole, 'Wiz');
        assert.equal(entry.plrace, 'Human');
        assert.equal(entry.plgend, 'Mal');
        assert.equal(entry.plalign, 'Neu');
        assert.equal(entry.turns, 200);
        assert.ok(entry.deathdate > 20000000, 'deathdate should be YYYYMMDD');
    });

    it('uses gameOverReason as fallback when deathCause is empty', () => {
        const p = makeTestPlayer({ deathCause: '' });
        const entry = buildEntry(p, 'quit', roles, races);
        assert.equal(entry.death, 'quit');
    });

    it('uses "died" as final fallback', () => {
        const p = makeTestPlayer({ deathCause: '' });
        const entry = buildEntry(p, '', roles, races);
        assert.equal(entry.death, 'died');
    });

    it('handles female gender', () => {
        const p = makeTestPlayer({ gender: FEMALE });
        const entry = buildEntry(p, 'killed', roles, races);
        assert.equal(entry.plgend, 'Fem');
    });

    it('handles lawful alignment', () => {
        const p = makeTestPlayer({ alignment: A_LAWFUL });
        const entry = buildEntry(p, 'killed', roles, races);
        assert.equal(entry.plalign, 'Law');
    });

    it('handles chaotic alignment', () => {
        const p = makeTestPlayer({ alignment: A_CHAOTIC });
        const entry = buildEntry(p, 'killed', roles, races);
        assert.equal(entry.plalign, 'Cha');
    });

    it('handles elf race', () => {
        const p = makeTestPlayer({ race: RACE_ELF });
        const entry = buildEntry(p, 'killed', roles, races);
        assert.equal(entry.plrace, 'Elf');
    });

    it('builds correct role abbreviation for each role', () => {
        const expectedAbbrs = ['Arc', 'Bar', 'Cav', 'Hea', 'Kni', 'Mon',
            'Pri', 'Rog', 'Ran', 'Sam', 'Tou', 'Val', 'Wiz'];
        for (let i = 0; i < roles.length; i++) {
            const p = makeTestPlayer({ roleIndex: i });
            const entry = buildEntry(p, 'killed', roles, races);
            assert.equal(entry.plrole, expectedAbbrs[i],
                `Role ${roles[i].name} should have abbreviation ${expectedAbbrs[i]}`);
        }
    });
});

// ========================================================================
// formatTopTenEntry / formatTopTenHeader
// ========================================================================
describe('Top ten: formatTopTenEntry', () => {
    it('returns array of 3 lines', () => {
        const entry = {
            points: 5000, name: 'Hero', plrole: 'Wiz', plrace: 'Human',
            plgend: 'Mal', plalign: 'Neu', death: 'killed by a newt',
            deathlev: 3, maxlvl: 5, hp: 0, maxhp: 15, turns: 200,
        };
        const lines = formatTopTenEntry(entry, 1);
        assert.equal(lines.length, 3);
    });

    it('first line contains rank, points, and name-role-race-gend-align', () => {
        const entry = {
            points: 5000, name: 'Hero', plrole: 'Wiz', plrace: 'Human',
            plgend: 'Mal', plalign: 'Neu', death: 'killed by a newt',
            deathlev: 3, maxlvl: 5, hp: 0, maxhp: 15, turns: 200,
        };
        const lines = formatTopTenEntry(entry, 1);
        assert.ok(lines[0].includes('1'), 'Should include rank');
        assert.ok(lines[0].includes('5000'), 'Should include points');
        assert.ok(lines[0].includes('Hero-Wiz-Human-Mal-Neu'), 'Should include name chain');
    });

    it('second line contains death cause', () => {
        const entry = {
            points: 100, name: 'Foo', plrole: 'Bar', plrace: 'Orc',
            plgend: 'Mal', plalign: 'Cha', death: 'killed by a dragon',
            deathlev: 10, maxlvl: 12, hp: -5, maxhp: 30, turns: 500,
        };
        const lines = formatTopTenEntry(entry, 42);
        assert.ok(lines[1].includes('killed by a dragon'));
    });

    it('third line contains dungeon level, max level, HP, and turns', () => {
        const entry = {
            points: 100, name: 'Foo', plrole: 'Bar', plrace: 'Orc',
            plgend: 'Mal', plalign: 'Cha', death: 'died',
            deathlev: 10, maxlvl: 12, hp: 0, maxhp: 30, turns: 500,
        };
        const lines = formatTopTenEntry(entry, 1);
        assert.ok(lines[2].includes('dungeon level 10'));
        assert.ok(lines[2].includes('max 12'));
        assert.ok(lines[2].includes('30'));  // maxhp
        assert.ok(lines[2].includes('T:500'));
    });

    it('shows dash for hp when hp is 0 or negative', () => {
        const entry = {
            points: 100, name: 'Foo', plrole: 'Bar', plrace: 'Orc',
            plgend: 'Mal', plalign: 'Cha', death: 'died',
            deathlev: 1, maxlvl: 1, hp: 0, maxhp: 10, turns: 1,
        };
        const lines = formatTopTenEntry(entry, 1);
        assert.ok(lines[2].includes('HP: -'), 'HP 0 should show as dash');
    });

    it('shows actual hp when positive', () => {
        const entry = {
            points: 100, name: 'Foo', plrole: 'Bar', plrace: 'Orc',
            plgend: 'Mal', plalign: 'Cha', death: 'escaped',
            deathlev: 1, maxlvl: 5, hp: 12, maxhp: 20, turns: 100,
        };
        const lines = formatTopTenEntry(entry, 1);
        assert.ok(lines[2].includes('HP: 12'));
    });

    it('rank is right-padded with spaces', () => {
        const entry = {
            points: 100, name: 'X', plrole: 'Wiz', plrace: 'Elf',
            plgend: 'Fem', plalign: 'Cha', death: 'quit',
            deathlev: 1, maxlvl: 1, hp: 5, maxhp: 10, turns: 10,
        };
        const lines1 = formatTopTenEntry(entry, 1);
        const lines99 = formatTopTenEntry(entry, 99);
        // Rank 1 should be padded: "  1"
        assert.ok(lines1[0].startsWith('  1'));
        // Rank 99 should be: " 99"
        assert.ok(lines99[0].startsWith(' 99'));
    });
});

describe('Top ten: formatTopTenHeader', () => {
    it('returns a non-empty string', () => {
        const header = formatTopTenHeader();
        assert.ok(header.length > 0);
        assert.ok(header.includes('No'));
        assert.ok(header.includes('Points'));
        assert.ok(header.includes('Name'));
    });
});

// ========================================================================
// getPlayerRank
// ========================================================================
describe('Top ten: getPlayerRank', () => {
    it('returns 1 for highest score in empty list', () => {
        assert.equal(getPlayerRank([], { points: 100 }), 1);
    });

    it('returns 1 when new score is highest', () => {
        const scores = [{ points: 500 }, { points: 300 }, { points: 100 }];
        assert.equal(getPlayerRank(scores, { points: 1000 }), 1);
    });

    it('returns correct position in the middle', () => {
        const scores = [{ points: 500 }, { points: 300 }, { points: 100 }];
        assert.equal(getPlayerRank(scores, { points: 400 }), 2);
    });

    it('returns last+1 for lowest score', () => {
        const scores = [{ points: 500 }, { points: 300 }, { points: 100 }];
        assert.equal(getPlayerRank(scores, { points: 50 }), 4);
    });

    it('returns position after equal scores', () => {
        const scores = [{ points: 500 }, { points: 500 }, { points: 100 }];
        assert.equal(getPlayerRank(scores, { points: 500 }), 3);
    });
});

// ========================================================================
// TOPTEN_KEY export
// ========================================================================
describe('Top ten: TOPTEN_KEY', () => {
    it('is the expected localStorage key', () => {
        assert.equal(TOPTEN_KEY, 'menace-topten');
    });
});

// ========================================================================
// Integration: buildEntry -> saveScore -> loadScores round-trip
// ========================================================================
describe('Top ten: full round-trip', () => {
    beforeEach(() => {
        store.clear();
    });

    it('builds entry from player, saves it, and loads it back', () => {
        const p = makeTestPlayer({
            name: 'RoundTrip', score: 999, dungeonLevel: 7, maxDungeonLevel: 10,
            hp: 0, hpmax: 25, turns: 500, deathCause: 'killed by a dragon',
        });

        const entry = buildEntry(p, 'killed', roles, races);
        const rank = saveScore(entry);
        assert.equal(rank, 1);

        const scores = loadScores();
        assert.equal(scores.length, 1);
        assert.equal(scores[0].name, 'RoundTrip');
        assert.equal(scores[0].points, 999);
        assert.equal(scores[0].death, 'killed by a dragon');
        assert.equal(scores[0].plrole, 'Wiz');
        assert.equal(scores[0].turns, 500);
    });

    it('accumulates multiple games in order', () => {
        const p1 = makeTestPlayer({ name: 'First', score: 100 });
        const p2 = makeTestPlayer({ name: 'Second', score: 500 });
        const p3 = makeTestPlayer({ name: 'Third', score: 300 });

        saveScore(buildEntry(p1, 'killed', roles, races));
        saveScore(buildEntry(p2, 'killed', roles, races));
        saveScore(buildEntry(p3, 'killed', roles, races));

        const scores = loadScores();
        assert.equal(scores.length, 3);
        assert.equal(scores[0].name, 'Second');  // 500
        assert.equal(scores[1].name, 'Third');   // 300
        assert.equal(scores[2].name, 'First');   // 100
    });
});
