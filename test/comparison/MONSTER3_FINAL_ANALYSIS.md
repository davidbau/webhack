# Monster 3 - Final Precise Analysis

## Definitive Proof of Third Entity

### Turn 5 vs Turn 6 Comparison
**Turn 5 (2 monsters, 4 distfleeck):**
```
distfleeck          # Monster 1 (pet) before
dog_move × 3        # Pet moves 3 times (high movement)
distfleeck          # Pet after
distfleeck          # Monster 2 (hostile) before
m_move              # Hostile moves
distfleeck          # Hostile after
mcalcmove × 2       # Both get movement allocation
```

**Turn 6 (3 entities, 6 distfleeck):**
```
distfleeck          # Monster 1 (pet) before
dog_move × 2        # Pet moves 2 times
distfleeck          # Pet after
distfleeck          # Monster 2 (hostile) before
m_move              # Hostile moves
distfleeck          # Hostile after
distfleeck          # Monster 3 before - NEW ENTITY!
dog_move            # Monster 3 moves using TAME AI
distfleeck          # Monster 3 after
mcalcmove × 2       # Only Monsters 1 & 2 get movement
```

## Key Finding: Monster 3's Characteristics

1. **Uses dog_move (tame AI)** - Can ONLY be called when mtmp->mtame is set
2. **Never receives mcalcmove** - Not a standard active monster
3. **First appears at turn 6** - Existed earlier but had 0 movement
4. **Not created via newmonhp** - Only 2 newmonhp calls in startup
5. **Processes intermittently** - Based on residual movement points

## The Mystery: How Is It Created?

### What We Know For Certain:
- **Only 2 newmonhp calls** in startup (lines 1393 and 2290)
- **Only 2 peace_minded calls** (for the pet only)
- **No makemon calls** in turns 0-6
- **No mon_arrive/migration** events
- **No statue/revive** mechanics triggered

### Possible Explanations:

#### 1. Monster Created Without newmonhp
Some monster types might skip newmonhp and have HP set differently:
- Shopkeepers/priests (but none created at depth 1)
- Vault guards (but none at depth 1)
- Quest NPCs (possible for Valkyrie?)
- Special role-specific companions

#### 2. The rnd(4)=3 Monster IS Monster 3
Timeline hypothesis:
- Startup: rnd(4)=3 monster created (Monster 2/3 hybrid)
- This monster is BOTH:
  - The hostile that attacks at turn 11-12
  - AND has a "tame" component that becomes Monster 3
- Turn 13: Hostile aspect killed, tame aspect remains
- Problem: This doesn't explain why both appear simultaneously at turns 6-12

#### 3. Monster Without HP (Special Entity Type)
A monster that:
- Exists in fmon list
- Has mtmp->mtame set (so uses dog_move)
- Never gets mcalcmove (parked/special status)
- Doesn't need HP allocation (mhp stays 0 or uninitialized)

Examples from C code:
- Vault guards at <0,0> (isgd flag)
- Migrating monsters not yet placed
- Quest allies/followers

## The Critical Clue: No mcalcmove

The fact that Monster 3 NEVER gets mcalcmove (even at turns 6-12 when the hostile is alive) proves it's a **special monster type** with different movement rules.

From mon.c:1215-1221, vault guards are parked at <0,0> and process via gd_move() without normal movement:
```c
if (mtmp->isgd && !mtmp->mx && !(mtmp->mstate & MON_MIGRATING)) {
    /* parked at <0,0>; eventually isgd should get set to false */
    if (svm.moves > mtmp->mlstmv) {
        (void) gd_move(mtmp);
        mtmp->mlstmv = svm.moves;
    }
    return FALSE;  // Skips normal processing
}
```

Monster 3 likely has similar special status - processes via tame AI (dog_move) but isn't a standard pet.

## Impact on JS Implementation

JS is missing this third entity, causing the RNG divergence at turn 22 when Monster 3 calls obj_resists.

To fix:
1. **Identify the entity type** - Decode rndmonst_adj or check C debugger
2. **Determine creation mechanism** - How does it get added to fmon without newmonhp?
3. **Implement in JS** - Create the entity with correct properties:
   - mtmp->mtame set (for dog_move)
   - Special status preventing mcalcmove
   - Initial movement = 0 (processes starting turn 6)

## Recommended Next Steps

1. **Run C debugger** on seed1 at turn 6 to list all monsters
2. **Decode rndmonst_adj sequence** to identify monster type
3. **Check Valkyrie role code** for special companions/NPCs
4. **Search for "mtame" assignments** outside of makemon/tamedog
5. **Examine monster initialization** in moveloop_preamble

## Conclusion

Monster 3 is definitively a separate tame entity that appears at turn 6, uses dog_move AI, never gets mcalcmove, and causes the turn 22 RNG divergence. It's created via a special mechanism outside the standard makemon/newmonhp flow, likely related to role-specific or level-specific special entities.
