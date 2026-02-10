/**
 * Integration demo - shows animation system in action
 * This demonstrates how throw/zap commands would use animations
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { initAnimations, tmp_at, DISP_FLASH, DISP_BEAM, DISP_END } from '../../js/animations.js';
import { delay_output, skipAnimationDelays } from '../../js/delay.js';

// Mock display
class TestDisplay {
    constructor() {
        this.events = [];
    }

    showTempGlyph(x, y, glyph) {
        this.events.push({type: 'show', x, y, glyph});
    }

    redraw(x, y) {
        this.events.push({type: 'redraw', x, y});
    }

    flush() {
        this.events.push({type: 'flush'});
    }
}

describe('Animation Integration Examples', () => {
    let display;

    beforeEach(() => {
        display = new TestDisplay();
        initAnimations(display);
        skipAnimationDelays(true); // Fast tests
    });

    it('should animate thrown projectile (DISP_FLASH)', async () => {
        const glyph = 100;
        const path = [[1,1], [2,1], [3,1]];
        
        tmp_at(DISP_FLASH, glyph);
        
        for (const [x, y] of path) {
            tmp_at(x, y);
            await delay_output();
        }
        
        tmp_at(DISP_END, 0);
        
        // Should show projectile at each position
        const showEvents = display.events.filter(e => e.type === 'show');
        assert.strictEqual(showEvents.length, 3);
        assert.deepStrictEqual(showEvents[0], {type: 'show', x: 1, y: 1, glyph});
        assert.deepStrictEqual(showEvents[1], {type: 'show', x: 2, y: 1, glyph});
        assert.deepStrictEqual(showEvents[2], {type: 'show', x: 3, y: 1, glyph});
        
        // Should redraw intermediate positions (FLASH mode erases previous)
        const redrawEvents = display.events.filter(e => e.type === 'redraw');
        assert.ok(redrawEvents.length >= 2); // At least 2 redraws (previous positions)
    });

    it('should animate zapped ray (DISP_BEAM)', async () => {
        const glyph = 200;
        const path = [[1,1], [2,2], [3,3], [4,4]];
        
        tmp_at(DISP_BEAM, glyph);
        
        for (const [x, y] of path) {
            tmp_at(x, y);
            await delay_output();
        }
        
        tmp_at(DISP_END, 0);
        
        // Should show beam at all positions
        const showEvents = display.events.filter(e => e.type === 'show');
        assert.strictEqual(showEvents.length, 4);
        
        // Should redraw all positions at end (BEAM mode keeps trail)
        const redrawEvents = display.events.filter(e => e.type === 'redraw');
        assert.strictEqual(redrawEvents.length, 4);
    });

    it('should handle timing correctly', async () => {
        skipAnimationDelays(false); // Real timing
        
        const start = Date.now();
        
        tmp_at(DISP_FLASH, 100);
        tmp_at(1, 1);
        await delay_output();
        tmp_at(2, 1);
        await delay_output();
        tmp_at(DISP_END, 0);
        
        const elapsed = Date.now() - start;
        
        // Should take ~100ms (2 x 50ms delays)
        assert.ok(elapsed >= 90 && elapsed <= 120, 
                 `Expected ~100ms, got ${elapsed}ms`);
        
        skipAnimationDelays(true); // Back to fast mode
    });
});
