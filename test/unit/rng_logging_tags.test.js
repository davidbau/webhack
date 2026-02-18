import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { initRng, enableRngLog, getRngLog, disableRngLog, rn2 } from '../../js/rng.js';

function withRngEnv(overrides, fn) {
    const prevTags = process.env.RNG_LOG_TAGS;
    const prevParent = process.env.RNG_LOG_PARENT;
    try {
        if (Object.prototype.hasOwnProperty.call(overrides, 'RNG_LOG_TAGS')) {
            const v = overrides.RNG_LOG_TAGS;
            if (v === undefined) delete process.env.RNG_LOG_TAGS;
            else process.env.RNG_LOG_TAGS = v;
        }
        if (Object.prototype.hasOwnProperty.call(overrides, 'RNG_LOG_PARENT')) {
            const v = overrides.RNG_LOG_PARENT;
            if (v === undefined) delete process.env.RNG_LOG_PARENT;
            else process.env.RNG_LOG_PARENT = v;
        }
        return fn();
    } finally {
        if (prevTags === undefined) delete process.env.RNG_LOG_TAGS;
        else process.env.RNG_LOG_TAGS = prevTags;
        if (prevParent === undefined) delete process.env.RNG_LOG_PARENT;
        else process.env.RNG_LOG_PARENT = prevParent;
        disableRngLog();
    }
}

function runTaggedSample() {
    initRng(123);
    function leaf() { rn2(10); }
    function parent() { leaf(); }
    parent();
    const log = getRngLog() || [];
    assert.ok(log.length > 0, 'expected at least one RNG log entry');
    return String(log[0]);
}

describe('RNG log caller tags', () => {
    it('includes parent chain by default when tags are enabled via env', () => {
        const first = withRngEnv({ RNG_LOG_TAGS: '1', RNG_LOG_PARENT: undefined }, () => {
            enableRngLog();
            return runTaggedSample();
        });
        assert.match(first, / @ /, `missing caller tag in "${first}"`);
        assert.match(first, / <= /, `missing parent chain in "${first}"`);
    });

    it('allows opting out of parent chain with RNG_LOG_PARENT=0', () => {
        const first = withRngEnv({ RNG_LOG_TAGS: '1', RNG_LOG_PARENT: '0' }, () => {
            enableRngLog();
            return runTaggedSample();
        });
        assert.match(first, / @ /, `missing caller tag in "${first}"`);
        assert.doesNotMatch(first, / <= /, `unexpected parent chain in "${first}"`);
    });
});
