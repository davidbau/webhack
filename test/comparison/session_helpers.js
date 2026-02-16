// test/comparison/session_helpers.js -- Legacy compatibility facade.
//
// Keep this file small so older tooling can keep importing the same paths.
// Replay behavior is now owned by core modules in js/.

export {
    compareRng,
    compareGrids,
    compareScreenLines,
} from './comparators.js';

export {
    stripAnsiSequences,
    getSessionScreenLines,
    normalizeSession,
    loadAllSessions,
} from './session_loader.js';

export {
    HeadlessDisplay,
    TYP_NAMES,
    typName,
    parseTypGrid,
    parseSessionTypGrid,
    formatDiffs,
    extractTypGrid,
    generateMapsSequential,
    hasStartupBurstInFirstStep,
    getSessionStartup,
    getSessionCharacter,
    getSessionGameplaySteps,
    replaySession,
    checkWallCompleteness,
    checkConnectivity,
    checkStairs,
    checkDimensions,
    checkValidTypValues,
} from '../../js/replay_core.js';

export {
    generateMapsWithCoreReplay as generateMapsWithRng,
    generateStartupWithCoreReplay as generateStartupWithRng,
} from '../../js/headless_runtime.js';
