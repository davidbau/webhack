# Menace Edition Supplement
#
# This file replaces sections 9.2 through 9.18 of the NetHack Guidebook
# for the Royal Jelly web edition.
#
# REPLACE_SECTION: 9.2-9.18

### 9.2. Browser Storage

Menace stores all game data in your browser's localStorage:

| Key | Contents |
|-----|----------|
| `menace-save` | Your current saved game |
| `menace-bones-N` | Bones files (ghosts of dead characters at depth N) |
| `menace-options` | Your option settings |
| `menace-topten` | High score list |

Data persists until you clear your browser data or use `?reset=1`.

### 9.3. URL Parameters

You can control game initialization via URL query parameters:

**Game Control**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `seed=N` | `?seed=12345` | Start with specific random seed |
| `wizard=1` | `?wizard=1` | Enable wizard (debug) mode |
| `reset=1` | `?reset=1` | Prompt to delete all saved data |
| `role=X` | `?role=Valkyrie` | Pre-select character role |

**Option Overrides**

Any option can be set via URL and will be saved to localStorage:

```
?pickup=1&showexp=1&time=1
?name=Gandalf&color=0
```

Boolean options accept `1`, `true`, or empty string for true; `0` or `false` for false.

### 9.4. Customization options

Here are the options available in the Menace edition.
Use the `O` command to view and change options during play.
Changes are saved to localStorage immediately.

`color`    Use colored display (default on).

`confirm`    Confirm before attacking peaceful creatures (default on).

`DECgraphics`    Use Unicode box-drawing characters for walls: ─│┌┐└┘ (default on).

`lit_corridor`    Show lit corridors differently from dark ones (default off).

`msg_window`    Show 3 message lines instead of 1 (default off).

`name`    Your character's name (prompted at start if empty).

`number_pad`    Use numpad 1-9 for movement instead of hjklyubn (default off).

`pickup`    Automatically pick up items when walking over them (default off).

`pickup_types`    Object types to auto-pickup when `pickup` is on.
Use symbol characters: `$` for gold, `!` for potions, `?` for scrolls,
`=` for rings, `+` for spellbooks. Empty means all types.

`rest_on_space`    Space bar waits a turn (default off).

`safe_pet`    Confirm before attacking your pet (default on).

`showexp`    Show experience points in status line (default off).

`time`    Show turn count in status line (default off).

`tombstone`    Show ASCII tombstone on death (default on).

`verbose`    More detailed game messages (default on).

### 9.5. Saving and restoring

**Saving (`S`)**

Press `S` to save your game and quit. The game state is written to
localStorage and you'll see confirmation before the page reloads.

The game also auto-saves periodically, so closing the browser tab
won't lose progress. However, `S` ensures a clean save point.

**Restoring**

When you return to the game, it automatically detects your save and
asks whether to restore. Your game resumes exactly where you left off,
including the random number generator state for full determinism.

**Bones Files**

When you die, your ghost and possessions may be saved as a "bones file."
Future characters exploring that dungeon depth may encounter your
remains — and your vengeful ghost.

### 9.6. Resetting the game

To clear all saved data and start fresh:

1. **Via URL**: Add `?reset=1` to the URL. You'll see a list of stored
   data and be asked to confirm deletion.

2. **Via Browser**: Open Developer Tools (F12), go to Application →
   Local Storage, and delete keys starting with `menace-`.

### 9.7. Display options

Menace uses a fixed 80×24 terminal display with:

- **DECgraphics**: Unicode box-drawing characters for walls (─│┌┐└┘)
- **16 ANSI colors**: Standard terminal color palette
- **Centered dot floors**: `·` instead of `.` for better visibility

**Font Size**: Use the `A+` and `A−` buttons to adjust. Saved to localStorage.

**Dark Mode**: Use the `◐` button to toggle. Saved to localStorage.

**Side Panels**: The keyboard reference and hover info panels can be
toggled with the `☰` button. On narrow screens they move below the game.

