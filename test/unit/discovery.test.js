// test/unit/discovery.test.js -- Tests for C-faithful object discovery state
// C ref: o_init.c discover_object(), undiscover_object()

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
    initDiscoveryState,
    discoverObject,
    undiscoverObject,
    isObjectNameKnown,
    isObjectEncountered,
    getDiscoveryState,
    setDiscoveryState,
} from '../../js/discovery.js';
import { POT_HEALING, POT_SICKNESS, POT_EXTRA_HEALING } from '../../js/objects.js';

// ========================================================================
// undiscoverObject
// ========================================================================

describe('undiscoverObject', () => {
    beforeEach(() => {
        initDiscoveryState();
    });

    it('is a no-op when ocNameKnown is true', () => {
        discoverObject(POT_HEALING, true, false); // sets name_known = true
        undiscoverObject(POT_HEALING);
        assert.equal(isObjectNameKnown(POT_HEALING), true);
        assert.ok(getDiscoveryState().disco.includes(POT_HEALING),
            'item should remain in disco when name_known is true');
    });

    it('is a no-op when ocEncountered is true', () => {
        discoverObject(POT_HEALING, false, true); // sets encountered = true
        undiscoverObject(POT_HEALING);
        assert.equal(isObjectEncountered(POT_HEALING), true);
        assert.ok(getDiscoveryState().disco.includes(POT_HEALING),
            'item should remain in disco when encountered is true');
    });

    it('removes from disco when both flags are false (simulating oc_uname scenario)', () => {
        // Simulate an item that got into disco via oc_uname (not yet in JS)
        // by using the extended setDiscoveryState disco field.
        const base = getDiscoveryState();
        setDiscoveryState({ ...base, disco: [POT_HEALING] });

        assert.ok(getDiscoveryState().disco.includes(POT_HEALING),
            'item should be in disco before undiscoverObject');
        assert.equal(isObjectNameKnown(POT_HEALING), false);
        assert.equal(isObjectEncountered(POT_HEALING), false);

        undiscoverObject(POT_HEALING);

        assert.ok(!getDiscoveryState().disco.includes(POT_HEALING),
            'item should be removed from disco after undiscoverObject');
    });

    it('only removes the specified item, leaving others in disco', () => {
        const base = getDiscoveryState();
        setDiscoveryState({ ...base, disco: [POT_HEALING, POT_SICKNESS] });

        undiscoverObject(POT_HEALING);

        const disco = getDiscoveryState().disco;
        assert.ok(!disco.includes(POT_HEALING), 'POT_HEALING should be removed');
        assert.ok(disco.includes(POT_SICKNESS), 'POT_SICKNESS should remain');
    });

    it('does not throw when item is not in disco', () => {
        // POT_EXTRA_HEALING was never discovered — not in disco
        assert.doesNotThrow(() => undiscoverObject(POT_EXTRA_HEALING));
    });

    it('does not throw for invalid indices', () => {
        assert.doesNotThrow(() => undiscoverObject(-1));
        assert.doesNotThrow(() => undiscoverObject(999999));
        assert.doesNotThrow(() => undiscoverObject(0)); // placeholder index
        assert.doesNotThrow(() => undiscoverObject(null));
        assert.doesNotThrow(() => undiscoverObject(undefined));
    });
});

// ========================================================================
// getDiscoveryState / setDiscoveryState round-trip with disco field
// ========================================================================

describe('getDiscoveryState / setDiscoveryState', () => {
    beforeEach(() => {
        initDiscoveryState();
    });

    it('round-trips ocNameKnown and ocEncountered', () => {
        discoverObject(POT_HEALING, true, true);
        const state = getDiscoveryState();
        initDiscoveryState();
        assert.equal(isObjectNameKnown(POT_HEALING), false);
        setDiscoveryState(state);
        assert.equal(isObjectNameKnown(POT_HEALING), true);
        assert.equal(isObjectEncountered(POT_HEALING), true);
    });

    it('round-trips extra disco entries with both flags false', () => {
        const base = getDiscoveryState();
        setDiscoveryState({ ...base, disco: [POT_HEALING] });
        const state = getDiscoveryState();
        assert.ok(state.disco.includes(POT_HEALING),
            'getDiscoveryState should include the extra disco entry');

        initDiscoveryState();
        setDiscoveryState(state);
        assert.ok(getDiscoveryState().disco.includes(POT_HEALING),
            'extra disco entry should survive round-trip');
        assert.equal(isObjectNameKnown(POT_HEALING), false,
            'flags should still be false after round-trip');
    });

    it('disco in getDiscoveryState includes items added by discoverObject', () => {
        discoverObject(POT_HEALING, true, false);
        discoverObject(POT_SICKNESS, false, true);
        const { disco } = getDiscoveryState();
        assert.ok(disco.includes(POT_HEALING));
        assert.ok(disco.includes(POT_SICKNESS));
    });
});
