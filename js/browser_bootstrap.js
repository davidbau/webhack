// browser_bootstrap.js -- Browser-only game startup wiring.
// Keeps DOM, URL, and window lifecycle logic out of the NetHackGame core.

import { Display } from './display.js';
import { initInput } from './input.js';
import { getUrlParams } from './storage.js';
import { NetHackGame } from './nethack.js';
import { getKeylog, saveKeylog, startReplay } from './keylog.js';

function createBrowserLifecycle() {
    return {
        restart: () => window.location.reload(),
        clearResetParam: () => {
            const url = new URL(window.location.href);
            url.searchParams.delete('reset');
            window.history.replaceState({}, '', url.toString());
        },
    };
}

function registerKeylogApis() {
    window.get_keylog = () => {
        const kl = getKeylog();
        console.log(JSON.stringify(kl, null, 2));
        return kl;
    };
    window.run_keylog = async (src) => {
        const data = typeof src === 'string' ? await (await fetch(src)).json() : src;
        startReplay(data);
    };
    window.save_keylog = saveKeylog;
}

window.addEventListener('DOMContentLoaded', async () => {
    registerKeylogApis();

    const game = new NetHackGame({
        display: new Display('game'),
        initInput,
        lifecycle: createBrowserLifecycle(),
        hooks: {
            onRuntimeBindings: ({ game: runningGame, flags, display }) => {
                window.gameInstance = runningGame;
                window.gameFlags = flags;
                window.gameDisplay = display;
            },
        },
    });

    await game.init(getUrlParams());
    await game.gameLoop();
});
