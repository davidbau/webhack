# Monster 3 - Conclusive Proof and Summary

## Definitive Evidence

### JS Monster Count (Verified)
After full initialization (makelevel + simulatePostLevelInit):
```
[0] kitten (pet)
    Position: (1, 0), HP: 6/6
    Tame: true, Movement: 0

[1] fox (hostile)
    Position: (56, 2), HP: 3/3
    Tame: false, Movement: 0
```
**Total: 2 monsters**

### C RNG Trace Analysis

**Turn 6 - First appearance of 3 entities:**
```
0: rn2(5) distfleeck        # Entity 1 before
1: rn2(12) dog_move         # Entity 1 moves (tame AI)
2: rn2(12) dog_move         # Entity 1 double move
3: rn2(5) distfleeck        # Entity 1 after

4: rn2(5) distfleeck        # Entity 2 before
5: rn2(16) m_move           # Entity 2 moves (hostile AI)
6: rn2(5) distfleeck        # Entity 2 after

7: rn2(5) distfleeck        # Entity 3 before ← MISSING IN JS!
8: rn2(12) dog_move         # Entity 3 moves (tame AI) ← MISSING IN JS!
9: rn2(5) distfleeck        # Entity 3 after ← MISSING IN JS!

10: rn2(12) mcalcmove       # Entities 1&2 get movement
11: rn2(12) mcalcmove       # (Entity 3 gets NONE!)
```

**Turn 22 - The failing turn:**
```
0: rn2(5) distfleeck         # Entity A before
1: rn2(100)=15 obj_resists   # ← THE MISSING CALL! (via dog_goal)
2: rn2(4) dog_goal           # Entity A goal-seeking
3-4: rn2(12) dog_move ×2     # Entity A moves
5: rn2(5) distfleeck         # Entity A after

6: rn2(5) distfleeck         # Entity B before
7: rn2(4) dog_goal           # Entity B goal-seeking
8-9: rn2(12) dog_move ×2     # Entity B moves
10: rn2(5) distfleeck        # Entity B after

11: rn2(12) mcalcmove        # Only Entity B gets movement
```

Entity A at turn 22 = **Monster 3** (processes first, never gets mcalcmove)
Entity B at turn 22 = **Kitten** (the pet, gets mcalcmove)

### Monster Creation Analysis

**C Startup RNG Trace:**
- Call 1392: `rnd(4)=3 @ newmonhp` → Fox (hostile)
- Call 2289: `d(1,8)=1 @ newmonhp` → Kitten (pet)
- **No third newmonhp call exists**

**Checked for alternative creation:**
- ✗ No makemon calls during turns 1-22
- ✗ No bones file monsters loaded (getbones returned empty)
- ✗ No statue revivals
- ✗ No migration/arrival events

## The Mystery

C processes **3 distinct entities** starting at turn 6:
1. **Kitten** (pet): Created at startup call 2289, uses dog_move, gets mcalcmove
2. **Fox** (hostile): Created at startup call 1392, uses m_move (killed at turn 13)
3. **Monster 3**: ??? - Uses dog_move (tame!), NEVER gets mcalcmove, processes BEFORE pet

**Monster 3 Characteristics:**
- Uses tame AI (dog_move, dog_goal)
- Never receives mcalcmove allocation
- Processes in monster loop (calls distfleeck)
- NOT created via makemon/newmonhp
- Exists from early in game (first processes turn 6)
- Processes BEFORE pet in iteration order (LIFO → added AFTER pet)

## The Impact

**Turn 22 RNG Divergence:**
- C call 1: `rn2(100)=15 @ obj_resists` (Monster 3 checking objects)
- JS call 1: `rn2(5)=0 @ distfleeck` (no Monster 3, goes straight to pet)

JS is missing Monster 3 entirely, causing:
- Steps 0-21: PASS (Monster 3 doesn't affect early RNG enough)
- Step 22+: FAIL (Monster 3 calls obj_resists, JS doesn't)

## Questions Remaining

1. **How is Monster 3 created in C?**
   - Not via makemon (only 2 calls)
   - Not from bones/restore
   - Not from statue/revive
   - Special initialization path?

2. **What type of monster is Monster 3?**
   - Has mtmp->mtame set (uses dog_move)
   - Doesn't get standard movement allocation
   - Could be: quest ally, guardian, special NPC, vault guard?

3. **Why is it specific to Valkyrie/seed1?**
   - Role-specific companion?
   - Quest-related entity?
   - Or universal but only visible with this seed/role combo?

## Next Steps

1. **Run C debugger** at turn 6 to dump full monster list (gdb nethack, break at turn 6)
2. **Check Valkyrie role code** for special companions/NPCs
3. **Search for fmon manipulation** outside makemon
4. **Decode rndmonst_adj** sequence at startup to identify monster type
5. **Check moveloop_preamble** for special monster creation

## Files

- `/tmp/check_after_full_init.mjs` - Diagnostic showing JS has only 2 monsters
- `seed1_gameplay.session.json` - C golden traces showing 3 entities
- This document - Complete analysis and evidence
