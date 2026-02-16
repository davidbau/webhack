# Test Infrastructure Unification Plan (Best-of-Both)

## Purpose

This document merges:

1. The architectural rigor and governance of the unification plan.
2. The concrete API and migration details from cleanup planning.
3. Extensive tutorial background for contributors new to the codebase.

It is both a design doc and a practical implementation guide.

---

## Decision Record (2026-02-16)

These choices resolve design decisions and establish non-negotiable constraints.

### Executive Decisions

1. There are only **three official ways of running tests**:
   - `unit`
   - `e2e`
   - `session`
2. Session tests may have multiple logical subtypes (chargen, gameplay, map, special, interface, option), but they must run through **one session runner path**.
3. Session infrastructure must not re-implement game behavior.
4. NetHack behavior must live in game code; test code should drive and compare.

### Technical Decisions

1. **Core startup uses one init path.**
   - Decision: keep `async init(initOptions)` as the only startup entrypoint; no separate `initInteractive` vs `parityInit`.
   - Rationale: one startup codepath eliminates divergence risk between browser and replay boot.

2. **Hooks belong in dependencies, not gameplay options.**
   - Decision: keep hooks under `deps.hooks`.
   - Rationale: options represent game state/flags (seed, role, wizard); hooks are integration observers and should be runtime-injected.

3. **Use a single headless runtime module.**
   - Decision: `js/headless_runtime.js` is the shared location for headless display/runtime wiring.

4. **Standardize immediately on `test:session`.**
   - Decision: remove `test:sessions` alias from scripts and docs.

5. **No feature-flag rollout; use phased rollout with guardrails.**
   - Decision: use side-by-side runner diff checks during migration, then delete temporary scaffolding.

6. **Hard cleanup goals tied to baseline observations.**
   - Baseline observations (current files):
     - `test/comparison/session_helpers.js` is 2250 lines
     - `test/comparison/session_test_runner.js` is 1133 lines
     - `test/comparison/headless_game.js` is 615 lines
   - Decision: enforce measurable reduction targets in acceptance criteria.

7. **Use `session_loader.js` + `comparators.js` naming.**
   - Decision: canonical split is format normalization (`session_loader.js`) and pure comparison functions (`comparators.js`).
   - Rationale: simpler, role-specific naming than a broad `comparison_utils.js`.

---

## How To Use This Document

This is both:
1. **A design doc** for maintainers making architectural changes
2. **A tutorial** for contributors who need to understand why these changes are needed
3. **An execution guide** with code snippets and file references

If you are new to this codebase, read sections in order. If you are implementing, jump to the phased plan and file map sections.

---

## Background: How Session Testing Works

### The C Parity Testing Approach

This project ports NetHack from C to JavaScript. To ensure faithfulness, we use **session testing**: we record what the C NetHack does (keystrokes, RNG calls, screen output, map grids) and replay the same inputs in JS to verify identical behavior.

A **session file** captures a complete game interaction:
```json
{
  "seed": 12345,
  "options": { "role": "Valkyrie", "race": "human", ... },
  "steps": [
    { "key": null, "action": "startup", "rng": ["rn2(2)=1", ...] },
    { "key": "h", "action": "move", "rng": ["rn2(20)=5", ...] }
  ]
}
```

The session test runner:
1. Initializes a JS game with the same seed and options
2. Feeds each keystroke
3. Compares the JS RNG calls against the recorded C RNG calls
4. Reports any divergence (JS behaving differently than C)

### The Problem: Test Code That Pretends to Be Game Code

Over time, the test infrastructure grew a parallel implementation of the game. Instead of testing `NetHackGame` (the actual game users play), tests run a separate `HeadlessGame` class that duplicates 600+ lines of game logic.

**Why did this happen?** The original `NetHackGame` was designed for browser play:
- It reads configuration from URL parameters
- It creates a DOM-based Display for canvas rendering
- It prompts the user interactively for character selection
- It calls `window.location.reload()` directly

None of this works in a Node.js test environment. Rather than refactor `NetHackGame` to be testable, a parallel `HeadlessGame` was created.

**The consequence:** We now maintain two implementations of:
- Turn processing (`processTurnEnd()` vs `simulateTurnEnd()`)
- Monster movement (`mcalcmove()`)
- Sound effects (`dosounds()`)
- Level changes (`changeLevel()`)

When we fix a bug in one, we must remember to fix the other. When we forget, tests pass but the actual game is broken (or vice versa).

---

## Motivation: Why This Cleanup Matters

Right now, test infrastructure is carrying game behavior that should live in the game itself. That creates three recurring problems:

1. **Paradoxical failures**: A session test can fail because replay code is wrong even when game code is right.
2. **Slow iteration**: Fixes require touching test internals and game internals together.
3. **Drift risk**: Multiple headless implementations diverge over time.

For C parity work, this is especially expensive. We need session tests to be a trustworthy probe of core behavior, not a second game engine.

---

## Principles: Why Unify the Infrastructure

### Principle 1: Test What Users Play

The fundamental testing principle is violated when test code runs different code than production.

**Before (current):**
```
C NetHack ──records──> session.json
                           │
HeadlessGame ◄──replays────┘  (test code, not the real game)
     │
     └── compares ──> "Test passed!"

But users run NetHackGame, which might behave differently!
```

**After (this plan):**
```
C NetHack ──records──> session.json
                           │
NetHackGame ◄──replays─────┘  (the actual game!)
     │
     └── compares ──> "Test passed!"

If tests pass, the real game matches C.
```

### Principle 2: Single Source of Behavior Truth

When logic exists in one place, there's one place to understand it, one place to fix bugs, and one place to verify correctness.

**Current state (multiple sources):**
- Turn processing: `nethack.js` AND `session_helpers.js`
- Chargen menus: `nethack.js` AND `session_test_runner.js`
- Headless execution: `session_helpers.js` AND `headless_game.js` AND `selfplay/headless_runner.js`

**After cleanup (single source):**
- All game logic: `nethack.js`
- All headless execution: one shared runtime

### Principle 3: Adapters at the Edges

Browser and headless should be wrappers, not alternate engines. The core game should be environment-agnostic; browser-specific code (DOM, URL params, canvas) lives in adapter modules.

### Principle 4: The Game Owns Behavior; Tests Only Drive and Observe

Session runner becomes: load session → feed keys → collect hooks → compare. No gameplay simulation in test code.

### Principle 5: Deterministic Observability Hooks

Parity debugging needs first-class snapshots (RNG, screen, typ/flag/wall grids) emitted by the core, not reconstructed by test scaffolding.

---

## Clarification: Test Categories vs Test Entry Points

It is fine to keep many *logical* session categories (chargen, gameplay, map, special, interface, options).

But there must be only **three official ways of running tests**:

1. `npm run test:unit` - Pure JS logic tests
2. `npm run test:e2e` - Browser-based integration tests
3. `npm run test:session` - Fast headless replay against C reference sessions

That means one shared session runner path, even if it reports multiple logical session groups.

---

## Current State (Observed in Code)

### Symptoms

1. `js/nethack.js` mixes core game lifecycle with browser wiring (`window`, URL params, DOM boot)
2. `js/input.js` assumes browser globals and DOM listeners
3. `test/comparison/session_helpers.js` includes a large custom `HeadlessGame` with turn processing and level logic (~600 lines)
4. `test/comparison/session_test_runner.js` rebuilds chargen/menu behavior that already exists in game code (~150 lines)
5. Multiple headless implementations exist:
   - `test/comparison/session_helpers.js`
   - `selfplay/runner/headless_runner.js`
   - `test/comparison/headless_game.js`
   - `selfplay/interface/js_adapter.js`
6. Session execution fans out into pseudo-categories with category-specific behavior
7. Legacy runner paths remain (`session_runner.test.js`, interface runners)

### Why This Is Unstable

When replay logic has to implement command semantics, turn scheduling, and level transitions, the runner is no longer neutral. It becomes another behavior surface that can diverge from `NetHackGame`.

---

## Target State (Architecture)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     js/nethack.js (Core)                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  NetHackGame                                                      │  │
│  │  - constructor(options, dependencies)                             │  │
│  │  - init()              // start game from options                 │  │
│  │  - feedKey(key)        // inject keystroke, process command       │  │
│  │  - Hooks: onStartup, onStep, onLevelGenerated                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Exported Utilities                                               │  │
│  │  - buildRoleMenuLines(), buildRaceMenuLines(), etc.               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────────────────┐
│  Browser Adapter        │    │  Headless Runtime (shared)              │
│  - DOM Display          │    │  - HeadlessDisplay                      │
│  - DOM Input listeners  │    │  - Memory-based input queue             │
│  - URL params           │    │  - Used by: session tests, selfplay     │
│  - localStorage         │    │                                         │
└─────────────────────────┘    └─────────────────────────────────────────┘
                                             │
                                             ▼
                               ┌─────────────────────────────────────────┐
                               │  session_test_runner.js (simplified)    │
                               │  - Load session JSON                    │
                               │  - Normalize v1/v2/v3 format            │
                               │  - Create game with headless runtime    │
                               │  - Feed keys, collect hook outputs      │
                               │  - Compare against expected             │
                               │  (NO game logic - just orchestration)   │
                               └─────────────────────────────────────────┘
```

### What Changes

1. Core game engine is reusable and injectable
2. Browser concerns are adapter code
3. Headless execution uses the same core path as browser gameplay
4. Session runner becomes: load session → feed keys → collect hooks → compare
5. One shared headless runtime for session tests AND selfplay

### What Does Not Change

1. Logical session purposes can remain varied (chargen, map, gameplay, etc.)
2. Session corpus format is stable (v3)
3. Existing C harness tooling remains unchanged

---

## API Design

### Initialization Options (Command-Line Equivalent)

Options represent game state and configuration flags—the equivalent of command-line arguments or `.nethackrc` settings.

```javascript
const options = {
  // RNG
  seed: 42,
  enableRngLog: false,

  // Mode
  wizard: true,

  // Character (like .nethackrc)
  name: "Wizard",
  role: "Valkyrie",
  race: "human",
  gender: "female",
  align: "neutral",

  // Game flags
  flags: {
    DECgraphics: true,
    autopickup: false,
    time: false,
    verbose: true,
  },

  // Startup parameters
  startup: {
    startDepth: 1,
    startDnum: 0,
    startDlevel: 1,
    tutorialMode: false,
  }
};
```

### Dependency Injection Contract

Dependencies represent runtime integrations—I/O adapters, storage backends, and observability hooks. **Hooks belong here, not in options**, because they are runtime observers rather than game state.

```javascript
const deps = {
  // Display provider
  display: {
    putstr: (col, row, text, color, attr) => void,
    putstr_message: (msg) => void,
    clearRow: (row) => void,
    clearScreen: () => void,
    setCell: (col, row, ch, color, attr) => void,
    renderMap: (map, player, fov, flags) => void,
    renderStatus: (player) => void,
    renderChargenMenu: (lines, isFirstMenu) => void,
    getScreenLines: () => string[],  // For testing
  },

  // Input provider
  input: {
    nhgetch: async () => keyCode,
    getlin: async (prompt) => string,
    pushInput: (key) => void,  // For replay
  },

  // Storage provider (optional)
  storage: {
    loadSave: () => saveData,
    saveGame: (data) => void,
    deleteSave: () => void,
    loadFlags: () => flags,
    saveFlags: (flags) => void,
  },

  // Lifecycle callbacks (browser equivalents)
  lifecycle: {
    restart: () => void,              // Instead of window.location.reload()
    replaceUrlParams: (params) => void,  // Instead of window.history
  },

  // Observability hooks (runtime-injected, not game state)
  hooks: {
    onStartup: (snapshot) => void,
    onStep: ({ key, action, rng, screen, typGrid, turn, depth }) => void,
    onLevelGenerated: ({ depth, dnum, dlevel, typGrid, flagGrid, wallInfoGrid, checkpoints }) => void,
  }
};

// Construction
const game = new NetHackGame(options, deps);
await game.init();
```

### Hook Contract (Emitted by Core)

Hooks should be emitted by game code, not synthesized by tests.

```javascript
// onStartup(snapshot)
{ rng, screen, typGrid, turn, depth, checkpoints }

// onStep(snapshot)
{ key, action, rng, screen, typGrid, turn, depth }

// onLevelGenerated(snapshot)
{ depth, dnum, dlevel, typGrid, flagGrid, wallInfoGrid, checkpoints }
```

### Core Methods

```javascript
class NetHackGame {
  constructor(options = {}, deps = {}) {
    // options: seed, wizard, role/race/gender/align/name, flags, startup
    // deps: display, input, storage, lifecycle, hooks
  }

  // Single startup path for both interactive and parity modes
  async init(initOptions) { ... }

  // Inject keystroke and process (for replay)
  async feedKey(key) { ... }

  // State extraction
  getTypGrid() { ... }
  getRngLog() { ... }

  // Wizard commands
  async wizardLevelTeleport(targetDepth) { ... }

  // Screen capture from active display adapter
  snapshotScreen() { ... }
}
```

### `init(initOptions)` Expected Behavior

The single `init()` method handles both interactive and parity modes:

1. Set seed and initialize RNG.
2. Apply character options directly for parity mode (skip interactive chargen UI).
3. Apply wizard mode/flags.
4. Initialize level generation in C-faithful order.
5. Generate and place player on first level.
6. Run post-level initialization.
7. Emit `onStartup` hook snapshot.

### `feedKey(key)` Expected Behavior

1. Inject key via input adapter (`pushInput` or equivalent).
2. Process command through core command path.
3. Run any resulting turn effects through core turn logic.
4. Capture delta artifacts (RNG/screen/typGrid when relevant).
5. Emit `onStep` hook snapshot.

### State Extraction Methods

```javascript
// Read current terrain grid from core map state
getTypGrid() {
  const grid = [];
  for (let y = 0; y < ROWNO; y++) {
    const row = [];
    for (let x = 0; x < COLNO; x++) {
      row.push(this.map.levl[x][y].typ);
    }
    grid.push(row);
  }
  return grid;
}

// Return current RNG trace
getRngLog() {
  return getRngLog();
}

// Capture screen from active display adapter
snapshotScreen() {
  return this.deps.display.getScreenLines();
}
```

---

## Phased Execution Plan

### Phase 0: Baseline and Guardrails

**Motivation:** We need confidence that refactor failures are detected quickly.

**Tasks:**
1. Capture baseline pass/fail counts and runtime for unit/e2e/session
2. Add temporary side-by-side old/new session runner diff capability
3. Document current test counts in-repo (baseline snapshot)
   - Baseline snapshot (2026-02-16): unit `73/75`, e2e `0/3`, session `140/168`

**Exit Criteria:**
- Baseline metrics stored in repo (e.g., `test/baseline.json`)
- Can run old and new runner and diff results
- Commands are codified:
  - `bash scripts/phase0-capture-baseline.sh --output test/baseline.json`
  - `bash scripts/session-runner-diff.sh --old \"<old_cmd>\" --new \"<new_cmd>\"`
  - `bash scripts/session-baseline-capture.sh --output test/comparison/baseline_results.json`
  - `bash scripts/session-baseline-check.sh --strict`

---

### Phase 1: Extract Reusable Core from `js/nethack.js`

**Motivation:** Session runner cannot be simple until game core is constructible without browser boot.

**Current state (js/nethack.js lines 34-165):**
```javascript
class NetHackGame {
    constructor() {
        // Hardcoded initialization
    }

    async init() {
        const urlOpts = getUrlParams();        // Browser-coupled
        this.display = new Display('game');    // DOM-coupled
        initInput();                           // Browser-coupled
        // ...
    }
}
```

**Target state:**
```javascript
// js/core.js - Environment-agnostic core
export class NetHackGame {
    constructor(options = {}, dependencies = {}) {
        this.options = options;
        this.deps = dependencies;
        this.display = dependencies.display || null;
        // ...
    }

    async init() {
        // Use this.options instead of URL params
        // Use this.deps.display instead of new Display()
        // Use this.deps.input instead of global input
    }
}

// js/browser_bootstrap.js - Browser adapter
import { NetHackGame } from './core.js';
import { Display } from './display.js';
import { createBrowserInput } from './input.js';

document.addEventListener('DOMContentLoaded', async () => {
    const options = getUrlParams();
    const deps = {
        display: new Display('game'),
        input: createBrowserInput(),
        storage: createBrowserStorage(),
        lifecycle: {
            restart: () => window.location.reload(),
        }
    };
    const game = new NetHackGame(options, deps);
    await game.init();
    game.run();
});
```

**Tasks:**
1. Export core class/module from `js/nethack.js` split
2. Move `DOMContentLoaded` startup into browser bootstrap module
3. Move URL option parsing into adapter layer
4. Replace direct `window.location.reload()` calls with lifecycle callbacks

**Exit Criteria:**
- Browser behavior unchanged (e2e tests pass)
- Core can be imported in Node without DOM errors

**Files Changed:**
| File | Change |
|------|--------|
| `js/nethack.js` | Split into core + keep browser bootstrap |
| `js/browser_bootstrap.js` | NEW - Browser-specific startup |
| `js/core.js` | NEW (optional) - Or keep in nethack.js with exports |

---

### Phase 2: Introduce Injectable I/O Runtime

**Motivation:** Core should never depend directly on `document` or `window` for input flow.

**Current state (js/input.js):**
```javascript
// Hardcoded DOM dependencies
document.addEventListener('keydown', handler);
window.gameFlags = ...;
```

**Target state:**
```javascript
// js/input.js - Reusable input queue
export function createInputQueue() {
    const queue = [];
    return {
        pushKey: (key) => queue.push(key),
        async nhgetch() {
            while (queue.length === 0) {
                await new Promise(r => setTimeout(r, 10));
            }
            return queue.shift();
        },
        // ...
    };
}

// js/browser_input.js - Browser adapter
export function createBrowserInput() {
    const inputQueue = createInputQueue();
    document.addEventListener('keydown', (e) => {
        inputQueue.pushKey(e.keyCode);
    });
    return inputQueue;
}
```

**Tasks:**
1. Refactor `js/input.js` into reusable queue + browser listener adapter
2. Ensure core consumes injected `nhgetch`/`getlin` path
3. Formalize display interface (document required methods)

**Exit Criteria:**
- Core runs under in-memory input/display
- Browser adapter still passes e2e tests

**Files Changed:**
| File | Change |
|------|--------|
| `js/input.js` | Split into queue + browser adapter |
| `js/browser_input.js` | NEW - Browser-specific input |

---

### Phase 3: Build One Shared Headless Runtime

**Motivation:** Duplicated headless engines are the current drift source.

**Current headless implementations:**
- `test/comparison/session_helpers.js` - HeadlessGame class (~600 lines)
- `test/comparison/headless_game.js` - Interface-only HeadlessGame
- `selfplay/runner/headless_runner.js` - Selfplay headless
- `selfplay/interface/js_adapter.js` - Headless display path

**Target: One shared runtime**

```javascript
// js/headless_runtime.js
import { NetHackGame } from './core.js';

export class HeadlessDisplay {
    constructor() {
        this.screen = Array(24).fill(null).map(() => Array(80).fill(' '));
        this.messages = [];
    }

    putstr(row, col, text, color) {
        for (let i = 0; i < text.length && col + i < 80; i++) {
            this.screen[row][col + i] = text[i];
        }
    }

    renderMap(map, player, fov, flags) { /* ... */ }
    renderStatus(player) { /* ... */ }
    putstr_message(msg) { this.messages.push(msg); }
    clearScreen() { /* ... */ }

    getScreenLines() {
        return this.screen.map(row => row.join(''));
    }
}

export function createHeadlessInput() {
    const queue = [];
    return {
        pushKey: (key) => queue.push(key),
        async nhgetch() {
            if (queue.length === 0) {
                throw new Error('Input queue empty - test may be missing keystrokes');
            }
            return queue.shift();
        },
    };
}

export async function createHeadlessGame(options = {}) {
    const display = new HeadlessDisplay();
    const input = createHeadlessInput();

    const game = new NetHackGame(options, {
        display,
        input,
        storage: createNullStorage(),
        lifecycle: { restart: () => {} },
    });

    await game.init();

    return { game, display, input };
}
```

**Tasks:**
1. Create shared headless runtime package (`js/headless_runtime.js`)
2. Port session runner to use it
3. Port selfplay runner to use it
4. Remove local `HeadlessGame` duplicates

**Exit Criteria:**
- One headless game path in repository
- Session and selfplay use same runtime
- ~600 lines of duplicated code removed

**Files Changed:**
| File | Change |
|------|--------|
| `js/headless_runtime.js` | NEW - Shared headless runtime |
| `test/comparison/session_helpers.js` | Remove HeadlessGame class |
| `test/comparison/headless_game.js` | DELETE |
| `selfplay/runner/headless_runner.js` | Use shared runtime |
| `selfplay/interface/js_adapter.js` | Use shared runtime |

---

### Phase 4: Rewrite Session Runner Around Core Hooks

**Motivation:** Session infra should observe, not emulate.

**Current state:** Session runner has heuristics to emulate behavior, chargen menu reconstruction, turn processing logic.

**Target replay contract:**

```javascript
// test/comparison/session_test_runner.js
import { createHeadlessGame } from '../../js/headless_runtime.js';
import { normalizeSession } from './session_loader.js';
import { compareRng, compareGrids, compareScreen } from './comparators.js';

export async function runSession(sessionPath) {
    const raw = JSON.parse(fs.readFileSync(sessionPath));
    const session = normalizeSession(raw);  // Handle v1/v2/v3 differences

    const stepResults = [];
    const levelResults = [];

    const { game, display, input } = await createHeadlessGame(
        // Options (game state)
        {
            seed: session.seed,
            wizard: session.options.wizard,
            name: session.options.name,
            role: session.options.role,
            race: session.options.race,
            gender: session.options.gender,
            align: session.options.align,
            flags: session.options.flags,
        },
        // Deps (runtime observers) - hooks go here, not in options
        {
            hooks: {
                onStep: (data) => stepResults.push(data),
                onLevelGenerated: (data) => levelResults.push(data),
            }
        }
    );

    const results = { passed: true, steps: [] };

    for (const step of session.steps) {
        if (step.key !== null) {
            await game.feedKey(step.key);
        }

        // Compare using hook outputs
        if (step.rng) {
            const cmp = compareRng(game.getRngLog(), step.rng);
            if (cmp.index !== -1) {
                results.passed = false;
                results.firstDivergence = cmp;
                break;
            }
        }

        if (step.screen) {
            const cmp = compareScreen(display.getScreenLines(), step.screen);
            if (!cmp.match) {
                results.passed = false;
                results.screenDiff = cmp;
            }
        }

        if (step.typGrid) {
            const diffs = compareGrids(game.getTypGrid(), step.typGrid);
            if (diffs.length > 0) {
                results.passed = false;
                results.gridDiffs = diffs;
            }
        }
    }

    return results;
}
```

**Tasks:**
1. Build normalized session loader (handle v1/v2/v3 format differences)
2. Build single replay driver (feed keys, collect hook outputs)
3. Split pure comparators into helper modules
4. Remove replay heuristics that implement gameplay logic
5. Remove chargen menu reconstruction (use exports from core)

**Exit Criteria:**
- One session replay path for all session files
- No gameplay/turn logic in session helper modules
- Session runner reduced to ≤350 lines (from 1133 lines)
- Session helpers reduced to ≤500 lines (from 2250 lines)

**Files Changed:**
| File | Change |
|------|--------|
| `test/comparison/session_test_runner.js` | Rewrite to ~200 lines |
| `test/comparison/session_loader.js` | NEW - Format normalization |
| `test/comparison/comparators.js` | NEW - Pure comparison functions |
| `test/comparison/session_helpers.js` | Keep only utilities, remove game logic |

---

### Phase 5: Wizard Mode and Wizard-Only Action Fidelity

**Motivation:** Fast C parity work depends on wizard workflows, especially level teleport.

**C NetHack wizard mode capabilities:**
| Command | Purpose | Testing Use |
|---------|---------|-------------|
| Ctrl+V | Level teleport | Test map generation at any depth |
| #wish | Create any item | Test item interactions |
| Ctrl+F | Reveal map | Compare against C map |
| Ctrl+E | Detect | Verify monster placement |

**Implementation:**

```javascript
// In NetHackGame class
wizardLevelTeleport(targetDepth) {
    if (!this.wizard) {
        throw new Error('Level teleport requires wizard mode');
    }

    // Save current level to cache
    this.levels[this.player.dungeonLevel] = this.map;

    // Generate or retrieve target level
    if (!this.levels[targetDepth]) {
        // Generate new level
        this.player.dungeonLevel = targetDepth;
        this.map = new GameMap();
        makelevel(this.map, targetDepth);
        this.levels[targetDepth] = this.map;
    } else {
        // Load cached level
        this.map = this.levels[targetDepth];
        this.player.dungeonLevel = targetDepth;
    }

    // Place player at stairs
    this.placePlayerOnLevel();
    this.fov.compute(this.map, this.player.x, this.player.y);

    // Emit hook
    this.emitHook('onLevelGenerated', {
        depth: targetDepth,
        typGrid: this.getTypGrid(),
    });
}
```

**Tasks:**
1. Ensure wizard mode is option-driven in core init
2. Implement wizard commands:
   - Level teleport (Ctrl+V)
   - Map reveal (Ctrl+F)
3. Add targeted unit/session fixtures for wizard transitions

**Exit Criteria:**
- Wizard sessions run through unified runner without custom replay branches
- Can test map generation at depths 1-5 via level teleport

---

### Phase 6: Standardize Scripts and Docs on 3 Run Paths

**Motivation:** Tooling confusion remains unless scripts and docs are explicit.

**Target package.json:**
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:session",
    "test:all": "npm run test:unit && npm run test:session && npm run test:e2e",
    "test:unit": "node --test test/unit/*.test.js",
    "test:e2e": "node --test --test-concurrency=1 test/e2e/*.test.js",
    "test:session": "node --test test/comparison/sessions.test.js"
  }
}
```

**Tasks:**
1. Update `package.json` scripts to canonical three categories
2. Ensure session wrappers delegate to one session runner only
3. Update docs (`docs/TESTING.md`, `README.md`)
4. Remove references to deprecated runners

**Exit Criteria:**
- Repo docs and CI only advertise `unit`, `e2e`, `session` as primary paths

---

### Phase 7: Remove Legacy Runners and Duplicates

**Motivation:** Keeping old paths invites regression and confusion.

**Files to remove:**
- `test/comparison/headless_game.js`
- `test/comparison/session_runner.test.js`
- `test/comparison/interface_test_runner.test.js`
- Chargen menu reconstruction in `session_test_runner.js` (moved to core exports)

**Tasks:**
1. Remove deprecated runner files
2. Remove duplicated chargen/menu reconstruction in session runner
3. Remove stale interface runner variants
4. Final cleanup of `session_helpers.js`

**Exit Criteria:**
- No dead alternate session runner paths remain
- One headless implementation
- `test/comparison/headless_game.js` deleted
- `test/comparison/session_test_runner.js` ≤350 lines
- `test/comparison/session_helpers.js` ≤500 lines

---

## File-Level Refactor Map

### Core and Runtime

| File | Current State | Target State |
|------|---------------|--------------|
| `js/nethack.js` | Mixed core + browser | Split: core logic + exports |
| `js/browser_bootstrap.js` | N/A | NEW: Browser-specific startup |
| `js/input.js` | Browser-coupled | Split: queue + browser adapter |
| `js/headless_runtime.js` | N/A | NEW: Shared headless runtime |
| `js/storage.js` | Mixed | Adapter pattern for browser/null storage |

### Session Infrastructure

| File | Current State | Target State |
|------|---------------|--------------|
| `session_helpers.js` | HeadlessGame + utilities (2250 lines) | Parse/compare utilities only (≤500 lines) |
| `session_test_runner.js` | Complex with game logic (1133 lines) | Orchestrator only (≤350 lines) |
| `session_loader.js` | N/A | NEW: Format normalization layer |
| `comparators.js` | N/A | NEW: RNG/grid/screen comparators |
| `sessions.test.js` | Wrapper | Wrapper around unified runner output |

### Selfplay

| File | Current State | Target State |
|------|---------------|--------------|
| `selfplay/runner/headless_runner.js` | Custom headless | Use shared runtime |
| `selfplay/interface/js_adapter.js` | Headless display | Use shared HeadlessDisplay |

### Legacy Removals

| File | Action |
|------|--------|
| `test/comparison/headless_game.js` | DELETE |
| `test/comparison/session_runner.test.js` | DELETE |
| `test/comparison/interface_test_runner.test.js` | DELETE |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Behavior regressions from core extraction | Side-by-side old/new runner checks during migration |
| Hidden browser assumptions in core path | Lint/check policy for `window`/`document` usage in core modules |
| Legacy sparse captures rely on current replay heuristics | Move compatibility to schema normalizer; mark unsupported edge cases |
| Contributor confusion during transition | Docs and scripts updated in same PR series |
| Performance regression | Capture baseline timing; verify no slowdown |

---

## CI and Performance Targets

1. Session runtime should be at or below baseline after migration
2. Re-runs must be deterministic
3. Add timing metrics for:
   - Total session runtime
   - Per-session runtime
   - Startup/generation time

---

## Acceptance Criteria

Cleanup is complete when **all** are true:

### Architecture Criteria

- [ ] Official command contract is exactly three run categories: `unit`, `e2e`, `session`
- [ ] Session logical subtypes exist only as grouping/filtering, not separate execution paths
- [ ] Session infrastructure does not duplicate game turn or level logic
- [ ] Core game can run in both browser and headless via dependency injection
- [ ] Shared headless runtime is used by session and selfplay

### Implementation Criteria

- [ ] Wizard mode and level teleport workflows are covered in unified session replay
- [ ] `package.json` exposes `test:session` (singular) as the canonical session command
- [ ] `package.json` does not include `test:sessions` alias

### Measurable Reduction Targets (from Baseline)

- [ ] `test/comparison/headless_game.js` is deleted (current baseline: 615 lines)
- [ ] `test/comparison/session_helpers.js` is reduced from 2250 lines to utility-only scope (target: ≤500 lines, no game loop/turn/level emulation)
- [ ] `test/comparison/session_test_runner.js` is reduced from 1133 lines to orchestrator-only scope (target: ≤350 lines)

### Documentation Criteria

- [ ] Docs match implemented command contract
- [ ] No alternate session runner path remains documented

---

## Verification Checklist

After each migration phase:

1. `npm run test:unit` passes or expected diffs are explained.
2. `npm run test:e2e` passes or expected diffs are explained.
3. `npm run test:session` parity trend is stable or improved.
4. Runtime is not regressing materially for session runs.
5. Browser interactive gameplay still boots and accepts input.

---

## Recommended PR Sequence

| PR | Description | Risk Level |
|----|-------------|------------|
| PR 1 | Runtime boundary extraction (core vs browser) | Medium |
| PR 2 | Injected input/display/lifecycle contracts | Medium |
| PR 3 | Add concrete parity APIs (`init` parity mode, `feedKey`, helpers) | Medium |
| PR 4 | Shared headless display/runtime modules | Low |
| PR 5 | Session normalization loader (`session_loader.js`) + pure comparators (`comparators.js`) | Low |
| PR 6 | Replace session runner internals with unified orchestrator | High |
| PR 7 | Migrate selfplay to shared runtime | Low |
| PR 8 | Script/docs canonicalization and legacy cleanup | Low |

### Migration Safety

Each PR should include:
1. Side-by-side old/new runner diff checks where applicable
2. Baseline timing comparison
3. Verification that browser gameplay still boots and accepts input

At PR 8 completion, delete all temporary migration scaffolding.

---

## Appendix A: Headless Display Contract

`HeadlessDisplay` implementation lives in `js/headless_runtime.js` (shared by session tests and selfplay).

### Required Methods

```javascript
// Core rendering
putstr(col, row, text, color, attr?)     // Write text at position
putstr_message(msg)                       // Add to message line
clearRow(row)                             // Clear specific row
clearScreen()                             // Clear entire screen
setCell(col, row, ch, color, attr?)       // Set single character
renderMap(map, player, fov, flags)        // Render dungeon map
renderStatus(player)                      // Render status lines (bottom 2 rows)
renderChargenMenu(lines, isFirstMenu)     // Render chargen menu screen
```

### Test-Support Methods

```javascript
getScreenLines()                          // Return string[24] of screen content
getScreenAnsi()                           // (optional) ANSI parity workflows
setScreenLines(lines)                     // (optional) Compatibility/testing only
```

---

## Appendix B: Session Format Strategy

### Normalize First, Replay Second

Create a normalization module (`session_loader.js`) that maps v1/v2/v3 session files into one canonical internal schema.

Why:
1. Keeps format complexity out of gameplay execution.
2. Reduces runner conditionals.
3. Makes unsupported edge cases explicit.

### Canonical Internal Schema

After normalization, all sessions have this shape:

```javascript
{
  meta: {
    version,
    source,
    seed,
    type,       // chargen | gameplay | map | special | interface | options
    options,
  },
  startup: {
    rng,
    screen,
    screenAnsi,
    typGrid,
    checkpoints,
  },
  steps: [
    {
      key,
      action,
      rng,
      screen,
      screenAnsi,
      typGrid,
      checkpoints,
    }
  ]
}
```

### External v3 Format (from C harness)

```javascript
{
  "version": 3,
  "seed": 1,
  "source": "c",
  "type": "gameplay",
  "options": {
    "name": "Wizard",
    "role": "Valkyrie",
    "race": "human",
    "gender": "female",
    "align": "neutral",
    "wizard": true,
    "symset": "DECgraphics",
    "autopickup": false
  },
  "steps": [
    {
      "key": null,           // null for startup
      "action": "startup",
      "rng": ["rn2(2)=1 @ file.c:123", ...],
      "screen": ["line1", ...],
      "typGrid": [[1,2,3,...], ...]
    },
    {
      "key": 104,            // 'h' = move west
      "action": "move",
      "rng": [...]
    }
  ]
}
```

---

## Appendix C: RNG Integration

```javascript
// js/rng.js API
initRng(seed)           // Initialize PRNG
rn2(n)                  // Random 0..n-1
rnd(n)                  // Random 1..n
enableRngLog()          // Start recording
disableRngLog()         // Stop recording
getRngLog()             // Get array: ["rn2(12)=5 @ func(file.c:123)", ...]
clearRngLog()           // Clear log

// Comparison (in comparators.js)
function compareRng(jsRng, sessionRng) {
    const jsCompact = jsRng.map(e => e.split('@')[0].trim());
    const sessCompact = sessionRng.filter(e => !e.startsWith('>')).map(e => e.split('@')[0].trim());

    for (let i = 0; i < Math.max(jsCompact.length, sessCompact.length); i++) {
        if (jsCompact[i] !== sessCompact[i]) {
            return { index: i, js: jsCompact[i], session: sessCompact[i] };
        }
    }
    return { index: -1 };  // No divergence
}
```

---

## Appendix D: Existing Code References

### NetHackGame (js/nethack.js)

| Line | Current Code | Change Needed |
|------|--------------|---------------|
| 34 | `constructor()` | Add `options`, `dependencies` parameters |
| 71-165 | `async init()` | Use injected deps instead of globals |
| 77 | `this.display = new Display('game')` | Use `dependencies.display` |
| 80 | `initInput()` | Use `dependencies.input` |
| 126-135 | Wizard auto-select | Keep, but use options |

### session_helpers.js

| Line | Code | Action |
|------|------|--------|
| 578-800 | `class HeadlessGame` | DELETE - use shared runtime |
| 213-320 | RNG comparison | MOVE to comparators.js |
| 1790+ | `class HeadlessDisplay` | MOVE to headless_runtime.js |

### session_test_runner.js

| Line | Code | Action |
|------|------|--------|
| 282-501 | Chargen menu builders | DELETE - export from nethack.js |
| 629-662 | `deriveChargenState()` | DELETE - game tracks state |

---

## Appendix E: Test Commands After Cleanup

```bash
# Primary test commands
npm test                    # unit + session (fast, default)
npm run test:all            # unit + session + e2e (comprehensive)

# Individual categories
npm run test:unit           # Pure JS logic tests
npm run test:session        # Session replay tests
npm run test:e2e            # Browser integration tests

# Session runner CLI
node test/comparison/session_test_runner.js                    # All sessions
node test/comparison/session_test_runner.js --type=chargen     # Filter by type
node test/comparison/session_test_runner.js --verbose          # Verbose output
node test/comparison/session_test_runner.js path/to/file.json  # Single session
```
