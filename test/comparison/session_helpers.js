// test/comparison/session_helpers.js -- Legacy compatibility facade.
//
// Phase 7 cleanup keeps runtime/gameplay logic in session_runtime.js and
// comparison/normalization helpers in dedicated modules. Keep this file small
// so older tooling can keep importing the same paths during migration.

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
    generateMapsWithRng,
    hasStartupBurstInFirstStep,
    getSessionStartup,
    getSessionCharacter,
    getSessionGameplaySteps,
    generateStartupWithRng,
    replaySession,
    checkWallCompleteness,
    checkConnectivity,
    checkStairs,
    checkDimensions,
    checkValidTypValues,
} from './session_runtime.js';
