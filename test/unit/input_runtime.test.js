import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    createInputQueue,
    setInputRuntime,
    getInputRuntime,
    pushInput,
    nhgetch,
    clearInputQueue,
    ynFunction,
} from '../../js/input.js';
import { mapBrowserKeyToNhCode } from '../../js/browser_input.js';

describe('input runtime primitives', () => {
    beforeEach(() => {
        setInputRuntime(createInputQueue());
    });

    it('createInputQueue yields pushed input in order', async () => {
        const runtime = createInputQueue();
        runtime.pushInput('a'.charCodeAt(0));
        runtime.pushInput('b'.charCodeAt(0));
        assert.equal(await runtime.nhgetch(), 'a'.charCodeAt(0));
        assert.equal(await runtime.nhgetch(), 'b'.charCodeAt(0));
    });

    it('module wrappers use active input runtime', async () => {
        const runtime = createInputQueue();
        setInputRuntime(runtime);
        pushInput('x'.charCodeAt(0));
        assert.equal(await nhgetch(), 'x'.charCodeAt(0));
        assert.equal(getInputRuntime(), runtime);
    });

    it('clearInputQueue clears queued input on active runtime', async () => {
        const runtime = createInputQueue();
        setInputRuntime(runtime);
        pushInput('x'.charCodeAt(0));
        clearInputQueue();

        let settled = false;
        const p = nhgetch().then(() => {
            settled = true;
        });
        await new Promise((r) => setTimeout(r, 10));
        assert.equal(settled, false);

        pushInput('y'.charCodeAt(0));
        await p;
    });

    it('ynFunction uses runtime display when explicit display is omitted', async () => {
        const prompts = [];
        const runtime = createInputQueue();
        runtime.getDisplay = () => ({
            putstr_message(msg) {
                prompts.push(msg);
            },
        });
        setInputRuntime(runtime);
        pushInput('y'.charCodeAt(0));

        const result = await ynFunction('Proceed?', 'yn', 'n'.charCodeAt(0));
        assert.equal(result, 'y'.charCodeAt(0));
        assert.equal(prompts.length, 1);
        assert.match(prompts[0], /Proceed\?/);
    });
});

describe('browser key mapping', () => {
    it('maps numpad keys when number_pad is enabled', () => {
        const code = mapBrowserKeyToNhCode(
            { key: '8', location: 3, ctrlKey: false, altKey: false, metaKey: false },
            { number_pad: true }
        );
        assert.equal(code, 'k'.charCodeAt(0));
    });

    it('maps numpad keys when number_pad mode is numeric and > 0', () => {
        const code = mapBrowserKeyToNhCode(
            { key: '8', location: 3, ctrlKey: false, altKey: false, metaKey: false },
            { number_pad: 2 }
        );
        assert.equal(code, 'k'.charCodeAt(0));
    });

    it('does not map numpad keys when number_pad mode is 0 or -1', () => {
        const offCode = mapBrowserKeyToNhCode(
            { key: '8', location: 3, ctrlKey: false, altKey: false, metaKey: false },
            { number_pad: 0 }
        );
        const legacyOffCode = mapBrowserKeyToNhCode(
            { key: '8', location: 3, ctrlKey: false, altKey: false, metaKey: false },
            { number_pad: -1 }
        );
        assert.equal(offCode, '8'.charCodeAt(0));
        assert.equal(legacyOffCode, '8'.charCodeAt(0));
    });

    it('maps space to rest only when rest_on_space is enabled', () => {
        const enabled = mapBrowserKeyToNhCode(
            { key: ' ', location: 0, ctrlKey: false, altKey: false, metaKey: false },
            { rest_on_space: true }
        );
        const disabled = mapBrowserKeyToNhCode(
            { key: ' ', location: 0, ctrlKey: false, altKey: false, metaKey: false },
            { rest_on_space: false }
        );
        assert.equal(enabled, '.'.charCodeAt(0));
        assert.equal(disabled, ' '.charCodeAt(0));
    });

    it('maps arrow keys to vi movement', () => {
        const code = mapBrowserKeyToNhCode(
            { key: 'ArrowLeft', location: 0, ctrlKey: false, altKey: false, metaKey: false },
            {}
        );
        assert.equal(code, 'h'.charCodeAt(0));
    });

    it('maps ctrl-letter combinations to C() codes', () => {
        const code = mapBrowserKeyToNhCode(
            { key: 'a', location: 0, ctrlKey: true, altKey: false, metaKey: false },
            {}
        );
        assert.equal(code, 1);
    });
});
