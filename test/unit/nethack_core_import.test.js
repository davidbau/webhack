import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('nethack core module', () => {
    it('imports in Node and exposes NetHackGame', async () => {
        const mod = await import('../../js/nethack.js');
        assert.equal(typeof mod.NetHackGame, 'function');
    });

    it('requires an injected display when init is called', async () => {
        const { NetHackGame } = await import('../../js/nethack.js');
        const game = new NetHackGame();
        await assert.rejects(() => game.init(), /requires deps\.display/);
    });
});
