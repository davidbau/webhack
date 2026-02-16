// browser_bootstrap.js -- Browser-specific entry point
//
// This module handles browser-specific concerns:
// - DOM initialization (DOMContentLoaded)
// - URL parameter parsing
// - Browser-specific lifecycle callbacks
// - Browser input initialization
// - Keylog console APIs
//
// The core game logic lives in nethack.js and can be used headlessly.

import { NetHackGame, getKeylog, saveKeylog, startReplay } from './nethack.js';
import { getUrlParams } from './storage.js';
import { createBrowserInput } from './browser_input.js';
import { setInputFlags, setInputDisplay } from './input.js';

// --- Browser Entry Point ---
// Start the game when the page loads
window.addEventListener('DOMContentLoaded', async () => {
    // Register keylog console APIs for debugging/replay
    window.get_keylog = () => {
        const kl = getKeylog();
        console.log(JSON.stringify(kl, null, 2));
        return kl;
    };
    window.run_keylog = async (src) => {
        let data = typeof src === 'string' ? await (await fetch(src)).json() : src;
        startReplay(data);
    };
    window.save_keylog = saveKeylog;

    // Initialize browser input (DOM keyboard listeners)
    const inputAdapter = createBrowserInput();

    // Parse URL parameters into game options
    const urlOpts = getUrlParams();
    const options = {
        seed: urlOpts.seed,
        wizard: urlOpts.wizard,
        reset: urlOpts.reset,
    };

    // Create browser-specific dependencies
    const deps = {
        // Display will be created by the game if not provided
        display: null,

        // Input adapter (browser-specific)
        input: inputAdapter,

        // Lifecycle callbacks for browser environment
        lifecycle: {
            restart: () => window.location.reload(),
            replaceUrlParams: (params) => {
                const url = new URL(window.location.href);
                for (const [key, value] of Object.entries(params)) {
                    if (value === null) {
                        url.searchParams.delete(key);
                    } else {
                        url.searchParams.set(key, value);
                    }
                }
                window.history.replaceState({}, '', url.toString());
            },
        },

        // Hooks for observability (can be extended for debugging)
        hooks: {
            // Called after flags and display are initialized
            onRuntimeBindings: ({ flags, display }) => {
                // Set up input module references for keyboard handler
                setInputFlags(flags);
                setInputDisplay(display);

                // Also expose globally for debugging
                window.gameFlags = flags;
                window.gameDisplay = display;
            },
        },
    };

    // Create and run the game
    const game = new NetHackGame(options, deps);

    // Expose game instance globally for debugging
    window.gameInstance = game;

    await game.init();
    await game.gameLoop();
});
