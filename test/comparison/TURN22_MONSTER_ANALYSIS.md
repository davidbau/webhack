# Turn 22 Monster Mystery - Detailed Analysis

## Executive Summary
C has 2 entities using tame monster AI at turn 22, JS has only 1 (the pet). The second entity is NOT receiving mcalcmove allocation, suggesting it's not a standard living monster.

## Key Evidence

### Monster Count Over Time (based on RNG patterns)
```
Startup: 2 monsters created (rnd(4)=3 HP, d(1,8)=1 HP)
  - Monster 1: Level-generated, HP=3
  - Monster 2: Pet (kitten), HP=1

Turns 9-12: 2 monsters active
  - Pet (tame) - uses dog_goal/dog_move
  - Hostile monster - attacks player, uses distfleeck

Turn 13: Hostile monster killed in combat
  - 4 distfleeck (2 entities processed)
  - 2 dog_goal calls (both use tame AI!)
  - Only 1 mcalcmove (only pet gets movement)

Turn 14: Only pet processes
  - 2 distfleeck, 1 dog_goal, 1 mcalcmove

Turns 15-17: Variable (1-2 entities)
  - Sometimes 4 distfleeck (2 entities)
  - Sometimes 2 distfleeck (1 entity)
  - Always 1 mcalcmove (only pet)

Turns 18-21: 2 entities process but NO tame AI!
  - 4 distfleeck on turns 18, 20, 21
  - 2 distfleeck on turn 19
  - ZERO dog_goal or dog_move calls
  - Still only 1 mcalcmove

Turn 22: 2 entities using tame AI
  - 4 distfleeck
  - 3 dog_goal calls
  - 4 dog_move calls
  - 1 obj_resists call (THE MISSING RNG CALL IN JS!)
  - Only 1 mcalcmove
```

### Critical Observations

1. **Only 1 mcalcmove from turn 13 onwards**
   - Only the pet receives fresh movement point allocation
   - The second entity never gets mcalcmove
   - This rules out standard living monsters

2. **Intermittent Processing Pattern**
   - Second entity appears/disappears based on movement points
   - When it has residual movement, it gets processed (distfleeck)
   - When movement runs out, it stops being processed

3. **AI Behavior Changes**
   - Turns 9-17: Uses dog_goal/dog_move (tame AI)
   - Turns 18-21: Processes but NO tame AI calls
   - Turn 22+: Resumes using tame AI

4. **Both Entities Call dog_goal at Turn 22**
   - Entity 1: rn2(100)=15 obj_resists, rn2(4)=3 dog_goal → THIS IS THE MISSING CALL
   - Entity 2: rn2(4)=1 dog_goal (no obj_resists, objects not in range)

## Hypotheses

### Hypothesis 1: Corpse with Residual State
The killed monster at turn 13 leaves a corpse that retains some monster properties:
- Still in monster list but marked as dead
- Occasionally processes when it has residual movement points
- Uses tame AI when the original monster was tame (or became tame before death)

Evidence:
- Pattern starts exactly at turn 13 (when hostile is killed)
- Never gets mcalcmove (dead monsters don't get movement allocation)
- Intermittent processing matches decreasing movement points

Problems:
- C's movemon() explicitly skips DEADMONSTER (mhp < 1) - see mon.c:1223
- Hostile monster attacked player at turn 11, so it wasn't tame

### Hypothesis 2: Second Tame Monster from Startup
There were actually 3 monsters created at startup, not 2:
- Two newmonhp calls visible in RNG trace
- But a third monster created without newmonhp? (loaded from special level/bones?)

Evidence:
- Would explain why entity uses tame AI (was tame from start)
- Would explain sporadic processing (low movement, stuck position)

Problems:
- Only 2 newmonhp calls in entire startup RNG
- No other monster creation markers visible

### Hypothesis 3: Figurine/Statue Activation
A figurine or statue gets partially activated:
- Creates a monster entry in the list
- Monster gets some movement but not mcalcmove allocation
- Uses tame AI because figurines create tame monsters

Evidence:
- Figurines create tame monsters without combat
- Would explain no mcalcmove (not fully "alive")
- Could explain intermittent behavior

Problems:
- No figurine activation RNG pattern visible
- Figurine activation usually has clear RNG signature

### **Hypothesis 4: Quest Ally or Special NPC (MOST LIKELY)**
A quest-related NPC or special monster type that:
- Uses tame AI (dog_goal/dog_move) but isn't a pet
- Created during level generation as part of room setup
- Only gets movement when player is nearby or certain conditions met
- Doesn't get mcalcmove because it's stationary/special

Evidence:
- Valkyrie role might spawn quest-related allies early
- Would explain tame AI but no pet status
- Would explain sporadic processing (position-dependent)
- First monster creation (rnd(4)=3) might be quest ally, not hostile

**NEW INSIGHT**: The hostile monster that attacks at turn 11 might be a DIFFERENT monster than the rnd(4)=3 creation! There could be:
- rnd(4)=3: Quest ally/special NPC (uses tame AI)
- d(1,8)=1: Pet (uses tame AI)
- A third monster created later that attacks player

## Next Steps

1. **Check JS Monster List at Turn 22**
   - How many monsters exist in JS vs C?
   - What are their types and tame status?

2. **Verify Quest Ally Spawn for Valkyrie**
   - Check if Valkyries get quest allies at depth 1
   - Verify C's makemon sequence for quest NPCs

3. **Trace First Monster's Fate**
   - Is rnd(4)=3 monster the one that attacks at turn 11?
   - Or does it remain passive (quest ally)?
   - Check if it survives turn 13 combat

4. **Implement Missing Monster in JS**
   - Identify what type it should be
   - Ensure it gets created during level gen
   - Verify it uses correct AI (dog_goal/dog_move)
