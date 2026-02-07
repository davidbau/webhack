# Design Decision Log

## Decision 1: Async Game Loop via Promise Queue

**Context:** The C NetHack game loop calls `nhgetch()` which blocks the thread
until a key is pressed. JavaScript in the browser cannot block.

**Options considered:**
1. Web Workers with SharedArrayBuffer + Atomics.wait() (true blocking)
2. Async/await with a Promise-based input queue
3. State machine that returns control on each input request

**Choice:** Option 2 -- Async/await with Promise queue.

**Rationale:**
- Option 1 requires SharedArrayBuffer which needs special COOP/COEP headers
  and is complex to set up for a simple static page.
- Option 3 would require restructuring every function that reads input into
  a state machine, making the code unrecognizable vs the C.
- Option 2 preserves the sequential flow of the C code. `rhack()` and
  `getlin()` and `yn_function()` all become `async` functions, but their
  internal logic reads identically to the C.

**Tradeoff:** Every function in the call chain from `moveloop_core` to any
input function must be async. This is pervasive but mechanical.

---

## Decision 2: Single-Page HTML with Inline Terminal

**Context:** How to render the 80×24 character display.

**Options considered:**
1. Canvas-based rendering (draw each character as pixels)
2. `<pre>` element with `<span>` per character cell
3. CSS Grid of divs

**Choice:** Option 2 -- `<pre>` with `<span>` elements.

**Rationale:**
- Uses the browser's text rendering, which handles font metrics perfectly
- Trivially supports copy-paste of the terminal content
- Color is applied via CSS classes, matching NetHack's 16-color model
- Simplest to implement and debug
- DEC line-drawing characters render correctly in Unicode fonts

**Performance:** 80×24 = 1,920 spans is trivial for modern browsers. Even full
screen redraws at 60fps would be fine.

---

## Decision 3: ES6 Modules Without Build Step

**Context:** How to organize the JavaScript code.

**Options considered:**
1. Single monolithic file
2. ES6 modules with `<script type="module">`
3. CommonJS with a bundler (webpack/rollup)

**Choice:** Option 2 -- ES6 modules loaded natively.

**Rationale:**
- No build step required; just open index.html
- Clean separation matching the C file organization
- Modern browsers all support ES6 modules natively
- Import/export makes dependencies explicit

---

## Decision 4: Faithful DEC Symbols via Unicode

**Context:** Classic NetHack uses DEC Special Graphics characters for wall
drawing. These are box-drawing characters like ─│┌┐└┘├┤┬┴┼.

**Choice:** Use Unicode box-drawing characters (U+2500 block) which are the
standard modern representation of DEC Special Graphics. The "IBMgraphics"
symbol set uses similar characters.

NetHack's `symbols` config option supports both "DECgraphics" and "IBMgraphics".
We default to the IBM set since Unicode box-drawing maps directly to it.

When the user hasn't selected a symbol set, we use the plain ASCII defaults
from defsym.h (|, -, +, #, etc.) which is the most faithful to the default
TTY experience.

---

## Decision 5: Simplified Vision for Initial Port

**Context:** NetHack's vision.c implements a complex raycasting algorithm for
field of view.

**Choice:** For the initial port, implement a rule-based FOV:
- Lit rooms: player sees all squares in the room
- Dark rooms/corridors: player sees only adjacent 8 squares
- Remembered squares are shown in a different color

This produces correct results for the standard dungeon layout. The full
raycasting algorithm will be ported in a later pass.

**Justification:** The room/corridor FOV rules are what 99% of gameplay uses.
The raycasting is only needed for open areas, line-of-sight blocking by
boulders, etc. Getting the core game playable is more valuable than perfect
FOV initially.

---

## Decision 6: Monster & Object Data as Structured JS Arrays

**Context:** The C code defines monster data via C macros in monsters.h
(3927 lines) and object data in objects.h (1647 lines).

**Choice:** Port as JavaScript arrays of plain objects, preserving field
names from the C structures.

Example (C):
```c
MON(NAM("giant ant"), S_ANT,
    LVL(2, 18, 3, 0, 0), (G_GENO | G_SGROUP),
    A(ATTK(AT_BITE, AD_PHYS, 1, 4), ...),
    SIZ(10, 10, MS_SILENT, MZ_TINY), 0, 0,
    M1_ANIMAL | M1_NOHANDS | M1_OVIPAROUS | M1_CARNIVORE,
    M2_HOSTILE, 0, CLR_BROWN, GIANT_ANT)
```

Example (JS):
```javascript
{ // monsters.h:120
  name: "giant ant", symbol: S_ANT,
  level: 2, speed: 18, ac: 3, mr: 0, align: 0,
  geno: G_GENO | G_SGROUP,
  attacks: [{type: AT_BITE, damage: AD_PHYS, dice: 1, sides: 4}, ...],
  weight: 10, nutrition: 10, sound: MS_SILENT, size: MZ_TINY,
  flags1: M1_ANIMAL | M1_NOHANDS | M1_OVIPAROUS | M1_CARNIVORE,
  flags2: M2_HOSTILE, flags3: 0,
  color: CLR_BROWN
}
```

The C line reference in the comment allows cross-referencing.

---

## Decision 7: Global State Object Pattern

**Context:** The C code uses many global variables (decl.c has hundreds).
How to manage these in JS?

**Options:**
1. True global variables
2. Single namespace object (NH.u, NH.level, etc.)
3. Class instances with encapsulation

**Choice:** Option 2 -- Single `NH` namespace object.

**Rationale:**
- Mirrors the C's global access pattern (code reads similarly)
- Avoids polluting the JS global namespace
- Easy to serialize for save/restore
- No class ceremony for what is fundamentally global state

---

## Decision 8: RNG -- ISAAC64 for Exact C Compatibility

**Context:** NetHack uses a seeded RNG for reproducible games. The C code uses
ISAAC64 (isaac64.c) for the main game RNG and the system RNG for initial
seeding.

**Choice (updated):** Port ISAAC64 faithfully using JavaScript BigInt for
64-bit unsigned integer arithmetic. This gives bit-for-bit identical output
to the C version for any given seed, enabling deterministic comparison tests.

**Implementation notes:**
- `js/isaac64.js` is a direct port of `isaac64.c` (public domain, by
  Timothy B. Terriberry). It uses BigInt for all 64-bit arithmetic.
- `js/rng.js` wraps ISAAC64 with `rn2()`, `rnd()`, `d()` etc., matching
  the C `rnd.c` logic exactly: `RND(x) = isaac64_next_uint64() % x`.
- Seeding matches `init_isaac64()` from `rnd.c`: the seed is converted to
  8 little-endian bytes (matching `sizeof(unsigned long)` = 8 on 64-bit
  Linux) and passed to `isaac64_init()`.
- Golden reference tests verify 500 consecutive values for 4 different seeds
  against output from a compiled C reference program.
- Performance: BigInt operations are fast enough. ISAAC64 generates 256
  values per batch; the ~1024 BigInt operations per batch take microseconds.
  For a turn-based game this is negligible.

**Previous choice (initial port):** xoshiro128** was used temporarily for the
first prototype, but was replaced with ISAAC64 to enable exact C matching.

---

## Decision 9: Corridor Algorithm -- Faithful Port of join()

**Context:** mklev.c's `join()` function creates L-shaped corridors between
rooms. This is a signature visual element of NetHack's dungeon.

**Choice:** Port the exact algorithm from `join()` including:
- Choose random points in each room to connect
- Create an L-shaped corridor (horizontal then vertical, or vice versa)
- Handle corridor-corridor connections

This ensures the dungeon "looks like NetHack."

---

## Decision 10: Wizard Mode via URL Parameters

**Context:** NetHack's wizard mode (debug mode) is invaluable for testing. The C
version activates it via compile-time flags or special user names. We need a
browser-friendly equivalent.

**Choice:** Activate wizard mode via URL query parameters:
- `?wizard=1` -- enables wizard mode
- `?seed=N` -- sets the PRNG seed for deterministic play
- `?role=X` -- selects starting role

**Wizard commands implemented:**
- Ctrl+F: Magic mapping (reveal entire level)
- Ctrl+V: Level change (teleport to any dungeon level)
- Ctrl+T: Teleport to coordinates or random location
- Ctrl+G: Genesis (create any monster by name)
- Ctrl+W: Wish (stub)
- Ctrl+I: Identify all (stub)
- `#` extended command: text-based command dispatch

**Rationale:** URL parameters are the natural equivalent of command-line flags for
a browser application. They can be bookmarked, shared, and don't require any UI
for activation. The `?seed=N` parameter combined with wizard mode enables fully
deterministic, reproducible test scenarios.

**Testing:** Wizard commands that don't require user input (e.g., magic mapping)
are tested via unit tests with mock game objects. Input-requiring commands
(level change, teleport, genesis) are tested via E2E browser tests.
