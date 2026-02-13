import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initRng } from '../../js/rng.js';
import { initLevelGeneration, makelevel, wallification } from '../../js/dungeon.js';
import { getArrivalPosition } from '../../js/level_transition.js';

describe('Level transition arrival placement', () => {
    it('returns to downstairs when going back up after descending', () => {
        initRng(42);
        initLevelGeneration();

        const level1 = makelevel(1);
        wallification(level1);
        const level2 = makelevel(2);
        wallification(level2);

        const descendArrival = getArrivalPosition(level2, 2, 'down');
        assert.equal(descendArrival.x, level2.upstair.x, 'descending should arrive on upstairs of destination');
        assert.equal(descendArrival.y, level2.upstair.y, 'descending should arrive on upstairs of destination');

        const ascendArrival = getArrivalPosition(level1, 1, 'up');
        assert.equal(ascendArrival.x, level1.dnstair.x, 'ascending should arrive on downstairs of destination');
        assert.equal(ascendArrival.y, level1.dnstair.y, 'ascending should arrive on downstairs of destination');
    });
});
