# Selfplay C Strategy Notes (2026-02-13)

## Goal
Improve progression on C NetHack using held-out aggregate metrics, not JS-only signals.

## Held-Out Baseline (C, 600 turns)
Seeds: `2,5,10,50,200,1000,2000,3000,5000,7000`

- Mean depth: `1.4`
- Median depth: `1.0`
- Dlvl 2+: `4/10`
- Dlvl 3+: `0/10`
- Deaths: `1/10`

## What Failed (Reverted)
- Earlier/lower-threshold door-priority adjustments.
- Frontier-loop-only tuning without fixing root stall cause.

These changed behavior but did not improve held-out aggregate.

## Root Cause Found
On C, some Dlvl 1 seeds were spending hundreds of turns in secret-search candidate navigation (`heading to search candidate`) even though secret-door searching is intended for deeper levels.

Example symptom (seed 42):
- Turn ~200 to 600: repeatedly navigating search candidates on Dlvl 1.
- No downstairs found, no depth progress.

## Fix Kept
In `selfplay/agent.js`, gate secret-search candidate flows to Dlvl 3+:
- Opportunistic wall-search candidate routing now requires `currentDepth > 2`.
- Systematic search-candidate mode now requires `currentDepth > 2`.

## Result (Held-Out, C, 600 turns, confirmed twice)
- Mean depth: `1.5` (up from `1.4`)
- Median depth: `1.5` (up from `1.0`)
- Dlvl 2+: `5/10` (up from `4/10`)
- Dlvl 3+: `0/10` (unchanged)
- Deaths: `0/10` (improved from `1/10`)

## Next Strategy
1. Keep C-first validation loop: dev seeds -> held-out aggregate.
2. Focus next on early Dlvl 1 survival/escape against canine/reptile threats.
3. Improve downstairs discovery on shallow levels without triggering secret-search behavior.
