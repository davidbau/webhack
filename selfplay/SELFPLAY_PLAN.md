# NetHack AI Selfplay Agent -- Project Plan

> Plan hierarchy: This is a subordinate subplan to root [`PROJECT_PLAN.md`](../PROJECT_PLAN.md).  
> If scope, priority, or milestone details conflict, `PROJECT_PLAN.md` is authoritative.
> Numbering note: stage numbering in this document is local to the selfplay track and does not override the main project phase numbering in `PROJECT_PLAN.md`.

## Vision

A JavaScript NetHack-playing agent that can competently play the full game
and ascend. The agent operates through a platform-agnostic interface,
enabling three use cases:

1. **Ground truth collection** -- Short games against the instrumented C
   NetHack binary (via tmux) to capture gameplay traces for testing.
2. **Stress testing** -- Long games against the JS port to find bugs
   through exhaustive automated play.
3. **Demo animation** -- Background "teaser" play when no human is active,
   showcasing autonomous NetHack gameplay until a key is pressed.

## Primary Selfplay Objective

Selfplay is optimized for broad, interesting, humanlike gameplay behavior and
depth of play, not just for score maximization. Success includes diversity of
actions and situations (exploration, combat, item use, survival decisions),
because that improves both trace quality for parity testing and demo quality
for player-facing autoplay.

## Architecture

```
selfplay/
├── SELFPLAY_PLAN.md        This file
├── agent.js                Top-level agent: perceive → decide → act loop
├── brain/
│   ├── strategy.js         High-level strategy (what phase of the game?)
│   ├── tactics.js          Tactical decisions (fight, flee, explore?)
│   ├── pathing.js          A* / Dijkstra pathfinding on the known map
│   ├── combat.js           Combat evaluation (should I fight this?)
│   └── inventory.js        Item management (what to use, eat, wear, wield)
├── perception/
│   ├── parser.js           Screen parser: reads 80x24 terminal output
│   ├── map_tracker.js      Persistent map memory across levels
│   ├── monster_tracker.js  Monster identification and threat assessment
│   └── status_parser.js    HP, AC, hunger, conditions from status line
├── knowledge/
│   ├── spoilers.js         Compiled spoiler data (monsters, items, dangers)
│   ├── identify.js         Item identification engine (price-ID, use-ID)
│   └── dungeon_layout.js   Branch/level knowledge (Mines, Sokoban, etc.)
├── interface/
│   ├── adapter.js          Abstract game interface (send key, read screen)
│   ├── js_adapter.js       Direct JS port interface (programmatic)
│   ├── tmux_adapter.js     C binary interface (via tmux screen capture)
│   └── demo_adapter.js     Browser demo mode (with display + key interrupt)
├── runner/
│   ├── trace_runner.js     Run short C games, capture traces
│   ├── stress_runner.js    Run long JS games, report bugs
│   └── demo_runner.js      Browser demo mode controller
└── test/
    └── agent.test.js       Agent unit tests
```

## Key Design Decisions

### Platform-agnostic perception

The agent reads the game through a **screen buffer** (80x24 grid of
characters with colors), not through internal game state. This makes it
work identically against the C binary (via tmux capture) and the JS port
(via display buffer inspection).

### Spoiler-based knowledge

The agent is not a learning system. It uses compiled spoiler data from
`spoilers/guide.md` and the game's data files (`monsters.js`, `objects.js`)
to make informed decisions. It knows what monsters are dangerous, what
items to prioritize, and how to navigate the dungeon branches.

### Hierarchical decision-making

```
Strategy Layer  → "I need to get to Minetown for a shop"
Tactics Layer   → "There's a monster blocking the corridor, fight it"
Action Layer    → "Move east (press 'l')"
```

## Development Stages (Selfplay-Local Numbering)

### Stage 1: Foundation (Issues 1-4)
- Screen parser that reads the 80x24 terminal grid
- Map memory that persists explored areas
- Status line parser (HP, AC, hunger, XL, etc.)
- Basic pathfinding (A* on known map)
- Platform adapters (JS direct + tmux)

### Stage 2: Survival Agent (Issues 5-8)
- Movement and exploration (explore unknown areas)
- Combat evaluation (fight vs. flee decisions)
- Basic inventory management (wield best weapon, wear armor)
- Eating and hunger management
- Door handling, stair navigation

### Stage 3: Competent Play (Issues 9-12)
- Item identification (price-ID, use-testing)
- Shopping (buy/sell in shops)
- Prayer and divine relations
- Pet management
- Multi-level dungeon navigation with branch awareness

### Stage 4: Mid-game (Issues 13-16)
- Mine Town and Sokoban navigation
- Altar use and sacrifice
- Resistance management
- Spellcasting basics
- Wish strategy

### Stage 5: Late-game (Issues 17-20)
- Castle approach and wand of wishing
- Gehennom navigation
- Quest completion
- Ascension kit preparation
- Elemental Planes and ascension run

### Stage 6: Polish and Integration (Issues 21-23)
- Trace collection runner (C binary)
- Stress test runner (JS port)
- Demo mode (browser animation)

## Immediate Next Steps

1. Build the screen parser and status parser
2. Build the JS adapter (direct programmatic interface)
3. Build basic map tracking
4. Implement explore-and-survive loop
5. Test against the JS port in headless mode

## Parity Burndown Note (RNG)

- As part of current parity burndown, fully flesh out `DISP` RNG infrastructure
  and callsite parity:
  - Keep `CORE` vs `DISP` stream separation in JS aligned with C `rnd.c`.
  - Port remaining display-only callsites to `rn2_on_display_rng` (hallucination
    and temporary glyph paths such as display/detect/throw/zap/pickup/inventory naming).
  - Ensure save/restore and replay diagnostics can preserve and inspect both RNG streams.
  - Keep this non-regressive: no gameplay RNG drift from display-only changes.
