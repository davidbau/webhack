import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { init_objects, objdescr_is, obj_shuffle_range, setgemprobs } from '../../js/o_init.js';
import {
    initDiscoveryState, discoverObject, undiscoverObject,
    getDiscoveriesMenuLines, getDiscoveryState,
} from '../../js/discovery.js';
import { objectData, bases,
    AMULET_OF_ESP, AMULET_OF_FLYING,
    POT_GAIN_ABILITY, POT_OIL, POT_WATER, POT_HEALING,
    RING_CLASS, WAND_CLASS, AMULET_CLASS, POTION_CLASS, SCROLL_CLASS, ARMOR_CLASS, GEM_CLASS,
    TURQUOISE, AQUAMARINE, FLUORITE,
    WAN_NOTHING,
    HELMET, HELM_OF_TELEPATHY,
    LEATHER_GLOVES, GAUNTLETS_OF_DEXTERITY,
    CLOAK_OF_PROTECTION, CLOAK_OF_DISPLACEMENT,
    SPEED_BOOTS, LEVITATION_BOOTS,
    SPEAR, LAST_REAL_GEM, oclass_prob_totals,
    SCR_ENCHANT_ARMOR,
} from '../../js/objects.js';
import { initRng as seedRng } from '../../js/rng.js';

describe('o_init', () => {
    it('consumes exactly 198 RNG calls', async () => {
        const { enableRngLog, getRngLog } = await import('../../js/rng.js');
        seedRng(42n);
        enableRngLog();
        init_objects();
        const log = getRngLog();
        assert.equal(log.length, 198, `Expected 198 RNG calls, got ${log.length}`);
    });

    it('shuffles amulet descriptions', () => {
        // Canonical (unshuffled) amulet descriptions from objects.js
        const canonicalDescs = [
            'circular', 'spherical', 'oval', 'triangular', 'pyramidal',
            'square', 'concave', 'hexagonal', 'octagonal', 'perforated', 'cubical'
        ];

        seedRng(42n);
        init_objects();

        const newDescs = [];
        for (let i = AMULET_OF_ESP; i <= AMULET_OF_FLYING; i++) {
            newDescs.push(objectData[i].desc);
        }

        // After shuffling, descriptions should be a permutation of the originals
        assert.deepEqual([...newDescs].sort(), [...canonicalDescs].sort(),
            'Shuffled descriptions should be a permutation of originals');

        // With seed 42, at least one description should have moved
        const unchanged = newDescs.filter((d, i) => d === canonicalDescs[i]).length;
        assert.ok(unchanged < canonicalDescs.length,
            'At least one amulet description should change with seed 42');
    });

    it('shuffles potion descriptions', () => {
        seedRng(42n);
        init_objects();

        // POT_WATER should NOT be shuffled (it's outside the range)
        // All potions in range should have non-null descriptions
        for (let i = POT_GAIN_ABILITY; i <= POT_OIL; i++) {
            assert.ok(objectData[i].desc !== null,
                `Potion at index ${i} should have a description`);
        }
    });

    it('is deterministic for the same seed', () => {
        seedRng(42n);
        init_objects();
        const descs1 = [];
        for (let i = AMULET_OF_ESP; i <= AMULET_OF_FLYING; i++) {
            descs1.push(objectData[i].desc);
        }

        seedRng(42n);
        init_objects();
        const descs2 = [];
        for (let i = AMULET_OF_ESP; i <= AMULET_OF_FLYING; i++) {
            descs2.push(objectData[i].desc);
        }

        assert.deepEqual(descs1, descs2, 'Same seed should produce same shuffle');
    });

    it('produces different shuffles for different seeds', () => {
        seedRng(42n);
        init_objects();
        const descs42 = [];
        for (let i = AMULET_OF_ESP; i <= AMULET_OF_FLYING; i++) {
            descs42.push(objectData[i].desc);
        }

        seedRng(999n);
        init_objects();
        const descs999 = [];
        for (let i = AMULET_OF_ESP; i <= AMULET_OF_FLYING; i++) {
            descs999.push(objectData[i].desc);
        }

        // Very unlikely to be identical for different seeds
        assert.notDeepEqual(descs42, descs999,
            'Different seeds should (almost certainly) produce different shuffles');
    });

    it('computes bases[] correctly', () => {
        seedRng(42n);
        init_objects();

        // bases[RING_CLASS] should point to first ring
        assert.equal(objectData[bases[RING_CLASS]].oc_class, RING_CLASS,
            'bases[RING_CLASS] should point to a ring');
        assert.equal(objectData[bases[AMULET_CLASS]].oc_class, AMULET_CLASS,
            'bases[AMULET_CLASS] should point to an amulet');
        assert.equal(objectData[bases[POTION_CLASS]].oc_class, POTION_CLASS,
            'bases[POTION_CLASS] should point to a potion');
    });

    it('randomizes WAN_NOTHING direction', () => {
        // Run with multiple seeds and check the direction is set
        const dirs = new Set();
        for (let s = 1n; s <= 20n; s++) {
            seedRng(s);
            init_objects();
            dirs.add(objectData[WAN_NOTHING].dir);
        }
        // With 20 seeds, should see both NODIR(1) and IMMEDIATE(2)
        assert.ok(dirs.size >= 2,
            'WAN_NOTHING direction should vary across seeds');
    });
});

// ========================================================================
// objdescr_is
// ========================================================================

describe('objdescr_is', () => {
    it('returns true when obj description matches (POT_WATER always has desc "clear")', () => {
        seedRng(42n);
        init_objects();
        // POT_WATER is never shuffled and has fixed description "clear"
        const obj = { otyp: POT_WATER };
        assert.equal(objdescr_is(obj, 'clear'), true);
    });

    it('returns false when description does not match', () => {
        seedRng(42n);
        init_objects();
        const obj = { otyp: POT_WATER };
        assert.equal(objdescr_is(obj, 'murky'), false);
    });

    it('returns false for null object', () => {
        assert.equal(objdescr_is(null, 'anything'), false);
    });

    it('returns false for object whose type has no description (weapon)', () => {
        // SPEAR has desc: null (weapons don't have a separate description)
        const obj = { otyp: SPEAR };
        assert.equal(objdescr_is(obj, 'spear'), false);
    });
});

// ========================================================================
// obj_shuffle_range
// ========================================================================

describe('obj_shuffle_range', () => {
    it('returns correct range for helmet (armor sub-range)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(HELMET);
        assert.equal(lo, HELMET);
        assert.equal(hi, HELM_OF_TELEPATHY);
    });

    it('returns same range for any item in the helmet range', () => {
        seedRng(42n);
        init_objects();
        const { lo: lo1, hi: hi1 } = obj_shuffle_range(HELMET);
        const { lo: lo2, hi: hi2 } = obj_shuffle_range(HELM_OF_TELEPATHY);
        assert.equal(lo1, lo2);
        assert.equal(hi1, hi2);
    });

    it('returns correct range for gloves (armor sub-range)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(LEATHER_GLOVES);
        assert.equal(lo, LEATHER_GLOVES);
        assert.equal(hi, GAUNTLETS_OF_DEXTERITY);
    });

    it('returns correct range for cloaks (armor sub-range)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(CLOAK_OF_PROTECTION);
        assert.equal(lo, CLOAK_OF_PROTECTION);
        assert.equal(hi, CLOAK_OF_DISPLACEMENT);
    });

    it('returns correct range for boots (armor sub-range)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(SPEED_BOOTS);
        assert.equal(lo, SPEED_BOOTS);
        assert.equal(hi, LEVITATION_BOOTS);
    });

    it('returns correct range for potions (up to POT_WATER - 1)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(POT_GAIN_ABILITY);
        assert.equal(lo, bases[POTION_CLASS]);
        assert.equal(hi, POT_WATER - 1);
    });

    it('returns correct range for scrolls (up to first unique/non-magic)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(SCR_ENCHANT_ARMOR);
        assert.equal(lo, bases[SCROLL_CLASS]);
        assert.ok(hi >= SCR_ENCHANT_ARMOR, 'hi should be >= SCR_ENCHANT_ARMOR');
        assert.ok(hi < objectData.length);
    });

    it('returns correct range for wands (entire class)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(WAN_NOTHING);
        assert.equal(lo, bases[WAND_CLASS]);
        assert.equal(hi, bases[WAND_CLASS + 1] - 1);
    });

    it('returns {lo: otyp, hi: otyp} for spear (not in any shuffle range)', () => {
        seedRng(42n);
        init_objects();
        const { lo, hi } = obj_shuffle_range(SPEAR);
        assert.equal(lo, SPEAR);
        assert.equal(hi, SPEAR);
    });
});

// ========================================================================
// setgemprobs
// ========================================================================

describe('setgemprobs', () => {
    it('at depth 1: first 9 gems have prob=0 (inaccessible)', () => {
        seedRng(42n);
        init_objects();
        setgemprobs(1);
        const first = bases[GEM_CLASS];
        // floor(1/3) = 0, so 9 - 0 = 9 gems zeroed
        for (let j = 0; j < 9; j++)
            assert.equal(objectData[first + j].prob, 0,
                `gem at first+${j} should have prob=0 at depth 1`);
    });

    it('at depth 27: no gems are zeroed (all accessible)', () => {
        seedRng(42n);
        init_objects();
        setgemprobs(27);
        const first = bases[GEM_CLASS];
        // floor(27/3) = 9, so 9 - 9 = 0 gems zeroed
        // first gem (first+0) should now have a non-zero prob
        assert.ok(objectData[first].prob > 0,
            'at depth 27, first gem should be accessible (prob > 0)');
    });

    it('updates oclass_prob_totals[GEM_CLASS]', () => {
        seedRng(42n);
        init_objects();
        setgemprobs(10);
        assert.ok(oclass_prob_totals[GEM_CLASS] > 0,
            'GEM_CLASS total should be positive after setgemprobs');
    });

    it('deeper levels have more accessible gems than shallow ones', () => {
        seedRng(42n);
        init_objects();
        setgemprobs(3);
        const total3 = oclass_prob_totals[GEM_CLASS];

        seedRng(42n);
        init_objects();
        setgemprobs(15);
        const total15 = oclass_prob_totals[GEM_CLASS];

        assert.ok(total15 >= total3,
            `Deeper level (total=${total15}) should have >= gem prob total vs shallow (${total3})`);
    });
});

// ========================================================================
// undiscoverObject (C ref: o_init.c undiscover_object c:492)
// ========================================================================

describe('undiscoverObject', () => {
    it('no-op and no crash when object not in disco list (both flags false)', () => {
        initDiscoveryState();
        // POT_HEALING has not been discovered yet: both flags false, not in disco
        assert.doesNotThrow(() => undiscoverObject(POT_HEALING));
        // State should be unchanged — not in discoveries
        const lines = getDiscoveriesMenuLines();
        const found = lines.some(l => l.includes('healing'));
        assert.ok(!found, 'POT_HEALING should not appear in discoveries');
    });

    it('no-op when oc_name_known is true (guard condition prevents removal)', () => {
        initDiscoveryState();
        discoverObject(POT_HEALING, true, false);
        // name_known=true: undiscoverObject guard condition (!name_known && !encountered) is false
        undiscoverObject(POT_HEALING);
        // Flag should be untouched — undiscoverObject only removes from disco list, not flags
        const state = getDiscoveryState();
        assert.equal(state.ocNameKnown[POT_HEALING], true,
            'ocNameKnown should still be true after no-op undiscoverObject');
        assert.equal(state.ocEncountered[POT_HEALING], false,
            'ocEncountered should be unchanged (false) after undiscoverObject');
    });

    it('no-op when oc_encountered is true (guard condition prevents removal)', () => {
        initDiscoveryState();
        discoverObject(POT_HEALING, false, true);
        // encountered=true: undiscoverObject guard condition (!name_known && !encountered) is false
        undiscoverObject(POT_HEALING);
        // Flag should be untouched — undiscoverObject only removes from disco list, not flags
        const state = getDiscoveryState();
        assert.equal(state.ocEncountered[POT_HEALING], true,
            'ocEncountered should still be true after no-op undiscoverObject');
        assert.equal(state.ocNameKnown[POT_HEALING], false,
            'ocNameKnown should be unchanged (false) after undiscoverObject');
    });

    it('no crash on invalid or out-of-range index', () => {
        initDiscoveryState();
        assert.doesNotThrow(() => undiscoverObject(-1));
        assert.doesNotThrow(() => undiscoverObject(99999));
        assert.doesNotThrow(() => undiscoverObject(undefined));
    });

    it('idempotent: calling twice on absent object does not throw', () => {
        initDiscoveryState();
        assert.doesNotThrow(() => undiscoverObject(POT_HEALING));
        assert.doesNotThrow(() => undiscoverObject(POT_HEALING));
    });
});
