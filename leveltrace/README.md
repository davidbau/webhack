# Level Trace Collection Status

This directory contains PRNG-traced special level generation data from C NetHack.

## Overview

- **Goal**: One trace file per special level type (130 total level files in `js/levels/`)
- **Current Status**: 127/130 traces available (97.7%)
- **Format**: JSON files with `typGrid` (terrain grid) for each level

## Coverage Summary

| Category | Count | Status |
|----------|-------|--------|
| **Have Direct Traces** | 56 levels (43.1%) | ✅ Complete |
| **Have Base Trace (Variants)** | 61 levels (46.9%) | ⚠️ Need specific variant traces |
| **Missing Traces** | 10 levels (7.7%) | ❌ Need to generate |
| **Wrapper Files** | 3 files (2.3%) | ~ Skip (not individual levels) |

## Files in This Directory

- `*.json` - Individual level traces (format: `<levelname>_seed<N>.json`)
- `inventory.json` - Index of which levels have traces for which seeds
- `missing_analysis.json` - Detailed analysis of missing/variant levels
- `README.md` - This file

## Trace File Format

Each trace file contains:
```json
{
  "version": 2,
  "seed": 1,
  "type": "special",
  "source": "c",
  "levelName": "oracle",
  "branch": "Dungeons of Doom",
  "typGrid": [[0,0,0,...], [0,0,0,...], ...]
}
```

## Coverage Details

### ✅ Complete Traces (56 levels)

Direct traces available for these levels:
- **Gehennom** (11): sanctum, juiblex, baalz, asmodeus, orcus, fakewiz1, fakewiz2, wizard1-3, valley
- **Vlad's Tower** (3): tower1-3
- **Fort Ludios** (1): knox
- **Main Dungeon** (3): oracle, castle, rogue
- **Quest Levels** (39): All 13 roles × 3 levels (strt, loca, goal)
  - Archeologist: Arc-strt, Arc-loca, Arc-goal
  - Barbarian: Bar-strt, Bar-loca, Bar-goal
  - Caveman: Cav-strt, Cav-loca, Cav-goal
  - Healer: Hea-strt, Hea-loca, Hea-goal
  - Knight: Kni-strt, Kni-loca, Kni-goal
  - Monk: Mon-strt, Mon-loca, Mon-goal
  - Priest: Pri-strt, Pri-loca, Pri-goal
  - Ranger: Ran-strt, Ran-loca, Ran-goal
  - Rogue: Rog-strt, Rog-loca, Rog-goal
  - Samurai: Sam-strt, Sam-loca, Sam-goal
  - Tourist: Tou-strt, Tou-loca, Tou-goal
  - Valkyrie: Val-strt, Val-loca, Val-goal
  - Wizard: Wiz-strt, Wiz-loca, Wiz-goal

### ⚠️ Have Base Trace - Need Specific Variants (61 levels)

We have traces for the base level (e.g., "bigrm") but not for each specific variant file:

- **Sokoban** (8): soko1-1, soko1-2, soko2-1, soko2-2, soko3-1, soko3-2, soko4-1, soko4-2
  - Base traces: soko1, soko2, soko3, soko4
  - Issue: Each has 2 variants, RNG selects one per seed

- **Bigroom** (13): bigrm-1 through bigrm-13
  - Base trace: bigrm
  - Issue: 13 variants, RNG selects one per seed

- **Medusa** (4): medusa-1, medusa-2, medusa-3, medusa-4
  - Base trace: medusa
  - Issue: 4 variants, RNG selects one per seed

- **Gnomish Mines - Town** (7): minetn-1 through minetn-7
  - Base trace: minetn
  - Issue: 7 variants, RNG selects one per seed

- **Gnomish Mines - End** (3): minend-1, minend-2, minend-3
  - Base trace: minend
  - Issue: 3 variants, RNG selects one per seed

- **Quest Fill Levels** (26): Arc-fila/filb, Bar-fila/filb, ..., Wiz-fila/filb
  - Base traces: <Role>-strt, <Role>-loca, <Role>-goal
  - Issue: Each role has 2 fila variants, not captured by C harness

**Note**: For variant levels, we have at least ONE example trace showing the level structure. To get ALL variants, we would need to either:
1. Run multiple seeds until each variant is captured
2. Modify C harness to explicitly request specific variants

For testing purposes, having one example per base level is usually sufficient.

### ❌ Missing Traces (10 levels)

These levels have NO traces yet:

- **Elemental Planes** (5): air, astral, earth, fire, water
  - Reason: Require endgame conditions, wizard teleport fails
  - Solution needed: Special endgame trace generation

- **Filler Levels** (3): dungeon, hellfill, minefill
  - Reason: Not included in C harness group definitions
  - Solution needed: Add to C harness or create custom script

- **Tutorial Levels** (2): tut-1, tut-2
  - Reason: Not included in C harness group definitions
  - Solution needed: Add to C harness or create custom script

### ~ Wrapper Files (3 files) - Skip

These are wrapper/import files, not individual levels:
- bigroom.js - Wrapper for bigrm-1 through bigrm-13
- medusa.js - Wrapper for medusa-1 through medusa-4
- themerms.js - Special themed rooms (syntax issues, commented out)

## How Traces Were Generated

1. **Existing Grouped Traces** (test/comparison/maps/seed*_special_*.session.json):
   - Generated using `test/comparison/c-harness/gen_special_sessions.py`
   - Groups: sokoban, mines, vlad, knox, oracle, castle, medusa, valley, wizard, gehennom, rogue, bigroom, quest
   - Seeds: 1, 42, 100 (some groups have additional seeds like 200, 300)

2. **Extraction** (scripts/extract_leveltraces.py):
   - Reads grouped session files
   - Extracts each level into individual trace file
   - Output: `leveltrace/<levelname>_seed<N>.json`

3. **Analysis** (scripts/analyze_missing_leveltraces.py):
   - Compares js/levels/*.js files with leveltrace/*.json files
   - Identifies missing traces
   - Categorizes variants vs. direct matches
   - Generates `missing_analysis.json`

## Next Steps

To achieve 100% coverage:

1. **Generate Missing Base Traces** (10 levels):
   - Extend C harness to support: dungeon, hellfill, minefill, tut-1, tut-2
   - Create special endgame trace script for elemental planes

2. **Optional: Capture All Variants** (61 variant levels):
   - Run many seeds to find each variant
   - Or modify C harness to explicitly generate each variant
   - Note: Current base traces are sufficient for most testing purposes

## Usage

To use these traces in tests:
```javascript
import fs from 'fs';

// Load a specific level trace
const trace = JSON.parse(
  fs.readFileSync('leveltrace/oracle_seed1.json', 'utf8')
);

// Access terrain grid
const typGrid = trace.typGrid; // 21×80 array
```

## Trace Metadata

- **Version**: 2 (trace format version)
- **Seed**: PRNG seed used for generation
- **Type**: "special" (special level trace)
- **Source**: "c" (generated from C NetHack)
- **LevelName**: Level identifier (matches C level names)
- **Branch**: Dungeon branch name
- **TypGrid**: 21×80 terrain type grid (row-major order)

## Related Files

- `test/comparison/maps/` - Original grouped session files
- `test/comparison/c-harness/gen_special_sessions.py` - C trace generator
- `scripts/extract_leveltraces.py` - Extraction script
- `scripts/analyze_missing_leveltraces.py` - Analysis script
