# Selfplay Agent Design Notes

## The Grand Delusion

This is an AI that plays NetHack by staring at the screen, just like a human.
It reads 80x24 characters, figures out what they mean, and decides what to do.
No peeking at game internals, no machine learning, no training data. Just
vibes and spoilers.

The same agent plays both the C binary (via tmux) and the JS port (headless).
This is possible because the agent never touches game internals — it only
speaks the universal language of terminal characters.

## Architecture: See, Think, Do

```
  Screen (80x24 chars)
         │
    ┌────▼────┐
    │ Perceive │  screen_parser.js: classify each cell (wall, floor, monster...)
    │          │  status_parser.js: parse HP, AC, hunger from status lines
    └────┬────┘
         │
    ┌────▼────┐
    │ Remember │  map_tracker.js: persistent spatial memory across turns
    │          │  Tracks explored cells, features, monsters, items per level
    └────┬────┘
         │
    ┌────▼────┐
    │  Decide  │  agent.js: priority-based decision engine
    │          │  Emergency → Tactical → Strategic → Exploration
    └────┬────┘
         │
    ┌────▼────┐
    │   Act    │  Send keystroke through adapter (JS or tmux)
    └─────────┘
```

## The Perception Problem

NetHack uses single characters for everything. A lowercase `d` could be your
beloved pet dog or a feral jackal that wants to eat your face. The letter `h`
is both "move west" and a dwarf. The character `+` is both a closed door and
a spellbook.

**Without color, you're guessing.** The tmux adapter captures plain text —
no color information survives `tmux capture-pane`. This means:

- `d` = dog? jackal? Who knows! (Solved via displacement detection)
- `+` = door? spellbook? (Default to door — doors are everywhere, spellbooks are rare)
- `.` = floor? open door? (Need color to tell them apart)

### The DECGraphics Disaster

Our first C adapter attempt used `OPTIONS=symset:DECgraphics`. The VT100
alternate character set renders walls as `l`, `k`, `m`, `j`, `q`, `x` — all
of which are perfectly valid monster letters. The screen parser saw a room
full of "monsters" that were actually walls. IBMgraphics fared no better:
Unicode box-drawing characters vanish in plain tmux capture.

**Solution:** No symset. Use default ASCII: `|`, `-`, `.`, `#`. Ugly but
unambiguous.

### The Silent Keystroke Bug

The tmux adapter's `sendKey()` method checks `if (!this._running) return;`
as a safety guard. Unfortunately, `this._running` was set to `true` *after*
the character generation skip routine ran. Every keystroke during startup —
dismissing the intro story, answering prompts — was silently swallowed.
The agent stared at "It is written in the Book of Odin..." forever.

**Lesson:** Guard clauses that silently return are the worst kind of bug.
They don't throw errors, they don't log warnings, they just... don't.

## The Pet Problem

In NetHack, your starting pet follows you around. It looks like any other
monster on screen. When you bump into it, you don't attack — you *swap
positions*. This is called "displacement" and it's how the game tells you
something is tame without color.

The agent detects pets by observing displacement:
1. Agent at position A, tries to "attack" monster at position B
2. Next turn: agent is at B, monster is at A
3. Conclusion: that was a pet swap, not an attack

The `knownPetChars` set remembers which monster types have been confirmed
as pets via displacement. The `refusedAttackPositions` set tracks positions
where "Really attack?" was declined.

## The Exploration Problem (Current Challenge)

The agent explores using BFS from its position to find "frontier cells" —
explored walkable cells that border unexplored space. This works well in
open rooms but fails in corridors because:

1. Corridor walls create many frontier cells (unexplored stone adjacent to
   the corridor). These are unreachable dead ends.
2. The agent paths to these dead ends, searches, finds nothing, oscillates.
3. Meanwhile, actual room exits (gaps in walls) are further away by BFS
   distance and get deprioritized.

**Current mitigations:**
- Dead-end marking: after 3 searches, mark adjacent unexplored cells as stone
- Search-score sorting: heavily-searched frontiers are deprioritized
- Force-exploration: when stuck, path through unexplored territory
- Anti-oscillation: track recent positions, prefer non-visited targets

**What still needs work:**
- Door handling: the agent can open doors but timing with tmux is tricky
- Room traversal: the agent often doesn't cross through explored rooms to
  reach exits on the far side
- Multi-room navigation: connecting corridors between rooms

## The Staircase Registration Bug

Map features (stairs, fountains, altars) are registered by `_registerFeature()`
in the map tracker. The code had a bug:

```javascript
cell.type = screenCell.type;  // update type FIRST
// ...
if (cell.type !== screenCell.type) {  // always false!
    this._registerFeature(x, y, screenCell.type);
}
```

The comparison was always false because the type was already updated.
Features were only registered on first cell exploration. If the player
started on top of upstairs, the cell was first seen as `@` (player),
and when the player moved away revealing `<`, the stairs were never
registered because `oldExplored` was true and the type comparison failed.

**Fix:** Save `oldType` before updating, compare against that.

## Platform Adapters

### JS Adapter (headless_runner.js)
- Drives the JS game directly: `pushInput()` → `rhack()` → read grid
- Full color information available
- Synchronous turn execution (no timing issues)
- Good for: stress testing, fast iteration, demo mode

### Tmux Adapter (c_runner.js)
- Launches C NetHack in a tmux session
- Sends keys via `tmux send-keys`, reads via `tmux capture-pane`
- **No color** — all cells report color=7
- 60ms delay between keystrokes for game to process
- Requires: `OPTIONS=!tutorial`, no symset, `_running=true` before chargen
- Good for: ground truth traces, validating against the real game

## Design Principles

1. **Screen-only perception.** No game state peeking. If the agent can't
   see it on the 80x24 terminal, it doesn't know about it.

2. **Fail loud, not silent.** Guard clauses that `return` without logging
   are traps. The keystroke bug wasted hours.

3. **Stone is the default.** In NetHack, most of the map is solid rock.
   When in doubt about an unexplored cell, assume stone.

4. **Pets are friends.** If bumping a monster swaps your position instead
   of fighting, it's tame. Remember this.

5. **Doors are common, spellbooks are rare.** When `+` appears with no
   color info, it's almost always a door.
