# Session Harness Simplification Plan

> *"The less the test harness knows about the game, the more faithful the test."*

## Goal

Eliminate game-awareness from the session test harness by pushing behavior into
the core game. The harness should become a **dumb replay engine** that:

1. Sends keys to the game
2. Captures output (screen, typGrid, RNG trace)
3. Compares against expected values

All game-specific logic—startup, level generation, character creation,
wizard mode—should live in the core game, not the test harness.

## Current State (Codex Branch)

The codex branch has begun this separation:

| File | Lines | Role |
|------|-------|------|
| `js/headless_runtime.js` | 977 | Core game: HeadlessGame, HeadlessDisplay |
| `test/comparison/session_runtime.js` | 1457 | **Game-aware test code (target for elimination)** |
| `test/comparison/session_helpers.js` | 41 | Re-exports (game-unaware) |
| `test/comparison/comparators.js` | ~150 | Pure comparison functions (game-unaware) |
| `test/comparison/session_loader.js` | ~200 | Session file loading (game-unaware) |

**Target**: Delete `session_runtime.js` entirely by pushing its functionality
into either `js/headless_runtime.js` (game behavior) or keeping only pure
comparison logic in test utilities.

## Game-Aware Code Categories

Analysis of `session_runtime.js` reveals these categories:

### 1. Map Generation Functions (lines ~195-440)

```javascript
generateMapsSequential(seed, maxDepth)
generateMapsWithRng(seed, maxDepth)
```

**Current behavior**: Custom map generation loop that manually calls
`initLevelGeneration()`, `makelevel()`, etc.

**Target behavior**: Use `HeadlessGame.teleportToLevel(depth)` (wizard mode
Ctrl+V equivalent) to generate levels on demand. The game already has level
generation—don't duplicate it in tests.

### 2. Startup Generation (lines ~480-565)

```javascript
generateStartupWithRng(seed, session)
```

**Current behavior**: Manually constructs Player, Map, HeadlessGame with
specific options, handles chargen RNG, tutorial prompts.

**Target behavior**: `HeadlessGame.start(seed, options)` should handle all
startup logic. The test just passes seed + options and gets a ready game.

### 3. Session Replay (lines ~566-1312)

```javascript
async replaySession(seed, session, opts = {})
```

**Current behavior**: 750+ lines of code that:
- Parses session options
- Creates game with correct character
- Handles pre-startup RNG (chargen menus)
- Sends keys via `rhack()`
- Captures RNG per step
- Handles turn simulation, monster movement, FOV

**Target behavior**: `HeadlessGame.replay(session)` or simply:
```javascript
for (const step of session.steps) {
    await game.sendKey(step.key);
    const result = game.captureState();
    compare(result, step);
}
```

### 4. Structural Validators (lines ~1313-1457)

```javascript
checkWallCompleteness(map)
checkConnectivity(map)
checkStairs(map, depth)
checkDimensions(grid)
checkValidTypValues(grid)
```

**These are appropriate for the test harness**—they validate invariants about
generated maps. Keep them in test utilities but ensure they operate on
game-provided data, not manually extracted data.

### 5. Grid/Screen Extraction

```javascript
extractTypGrid(map)
parseTypGrid(text)
parseSessionTypGrid(grid)
```

**Target behavior**: `game.getTypGrid()` returns the current level's typGrid.
The test harness shouldn't know about `map.at(x,y).typ`.

## Maintaining Fidelity Checking

### PRNG Alignment

**Current**: Test harness enables RNG logging, captures traces, compares.

**Target**: Core game provides RNG instrumentation:
```javascript
game.enableRngLogging();
const trace = game.getRngLog();
game.clearRngLog();
```

The test harness remains responsible for comparison (`compareRng()`), but
the game handles instrumentation.

### typGrid Comparison

**Current**: Test harness manually extracts `map.at(x,y).typ` into a grid.

**Target**: Core game provides accessor:
```javascript
const grid = game.getTypGrid();  // Returns 21x80 array of typ values
```

The test harness compares grids (`compareGrids()`), but the game provides them.

### Screen Comparison

**Current**: `HeadlessDisplay` captures screen as 24x80 grid.

**Target**: Same—this is already in the core game. Ensure:
```javascript
const screen = game.getScreen();  // Returns 24x80 array of cells
const ansiScreen = game.getAnsiScreen();  // Returns ANSI-encoded string
```

## Debuggability

The current harness provides good debugging via:
1. Per-step RNG traces with source locations
2. Midlog markers (function entry/exit)
3. typGrid snapshots at checkpoints
4. Detailed diff output

**Preserve these capabilities** by:

1. **RNG logging in core**: Move `enableRngLog()`, `getRngLog()` into `rng.js`
   exports accessible to HeadlessGame

2. **Checkpoint API**: `game.checkpoint(phase)` captures current state
   (typGrid, monsters, objects) for debugging

3. **Step-by-step replay**: `game.step(key)` returns `{ rng, screen, typGrid }`
   after processing one key

4. **Divergence context**: When RNG diverges, provide surrounding context:
   ```javascript
   {
     divergenceIndex: 2808,
     jsCall: "rn2(10)=3 @ sp_lev.js:382",
     expectedCall: "rn2(10)=7 @ sp_lev.c:450",
     recentCalls: [...last 10 calls...],
     midlogContext: ">wallify_map >set_wall_type"
   }
   ```

## Implementation Phases

### Phase 1: HeadlessGame API Consolidation

Ensure `js/headless_runtime.js` exposes a clean API:

```javascript
class HeadlessGame {
    static async start(seed, options);  // Full startup

    async sendKey(key);        // Process one keystroke
    async sendKeys(keys);      // Process multiple keystrokes

    getTypGrid();              // Current level typGrid
    getScreen();               // Current terminal screen
    getAnsiScreen();           // ANSI-encoded screen

    enableRngLogging();
    getRngLog();
    clearRngLog();

    teleportToLevel(depth);    // Wizard mode level teleport
    revealMap();               // Wizard mode map reveal

    checkpoint(phase);         // Capture full state snapshot
}
```

**Acceptance**: HeadlessGame can be used without importing `session_runtime.js`.

### Phase 2: Migrate Map Generation

Replace:
```javascript
// session_runtime.js
const result = generateMapsWithRng(seed, maxDepth);
```

With:
```javascript
// test code
const game = await HeadlessGame.start(seed, { wizard: true });
for (let depth = 1; depth <= maxDepth; depth++) {
    game.teleportToLevel(depth);
    grids[depth] = game.getTypGrid();
    rngLogs[depth] = game.getRngLog();
    game.clearRngLog();
}
```

**Acceptance**: Map session tests pass using wizard teleport instead of
custom generation functions.

### Phase 3: Migrate Startup Generation

Replace:
```javascript
// session_runtime.js
const startup = generateStartupWithRng(seed, session);
```

With:
```javascript
// test code
const game = await HeadlessGame.start(seed, session.options);
const startup = {
    typGrid: game.getTypGrid(),
    rng: game.getRngLog(),
    screen: game.getScreen(),
};
```

**Acceptance**: Gameplay session startup tests pass using HeadlessGame.start().

### Phase 4: Simplify Session Replay

Replace 750+ lines of `replaySession()` with:
```javascript
async function replaySession(session) {
    const game = await HeadlessGame.start(session.seed, session.options);
    const results = { startup: captureState(game), steps: [] };

    for (const step of session.steps.slice(1)) {  // Skip startup step
        game.clearRngLog();
        await game.sendKey(step.key);
        results.steps.push(captureState(game));
    }

    return results;
}

function captureState(game) {
    return {
        rng: game.getRngLog(),
        screen: game.getScreen(),
        typGrid: game.getTypGrid(),
    };
}
```

**Acceptance**: All gameplay session tests pass with simplified replay.

### Phase 5: Delete session_runtime.js

After phases 1-4, `session_runtime.js` should contain only:
- Re-exports from `js/headless_runtime.js`
- Possibly structural validators (`checkWallCompleteness`, etc.)

Either:
- Delete file entirely, moving validators to `test/comparison/validators.js`
- Or keep as thin re-export layer

**Acceptance**: No game-specific imports in test comparison code except
from `js/` directory.

## Migration Strategy

### Parallel Testing

During migration, run both old and new implementations:
```javascript
it('startup matches (legacy)', () => {
    const legacy = generateStartupWithRng(seed, session);
    assert.equal(legacy.rngCalls, expected);
});

it('startup matches (new)', () => {
    const game = await HeadlessGame.start(seed, session.options);
    assert.equal(game.getRngLog().length, expected);
});
```

Remove legacy tests once new implementation is verified.

### Incremental Commits

1. Add HeadlessGame API methods (non-breaking)
2. Add parallel tests using new API
3. Verify RNG alignment with legacy
4. Remove legacy tests
5. Delete legacy functions
6. Final cleanup

## Success Criteria

1. **session_runtime.js deleted** or reduced to <100 lines of pure utilities
2. **All session tests pass** with same RNG precision
3. **HeadlessGame is self-contained** for session replay
4. **Debuggability preserved**: RNG traces, midlog markers, checkpoints
5. **Test harness is game-unaware**: Only sends keys, compares outputs

## Performance

Keep it simple:

1. **Parallel execution**: Run sessions concurrently via worker threads
2. **Report failures immediately**: Don't wait for entire suite to finish

That's it. Avoid clever optimizations that obscure what the harness is doing.

## Non-Goals

- Changing session file format (v3 is stable)
- Removing structural validators
- Changing the comparison algorithms

## References

- Codex branch: `origin/codex`
- `js/headless_runtime.js` (977 lines) - Current core game headless support
- `test/comparison/session_runtime.js` (1457 lines) - Target for elimination
- `docs/SESSION_FORMAT_V3.md` - Session file format specification
