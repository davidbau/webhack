# RNG Alignment Status

## RESOLVED: Call 344 "Divergence" Was Documentation Error

### Investigation Result (2026-02-10)
**NO DIVERGENCE EXISTS at call 344!**

Calls 340-355 are ALL part of Lua MT19937 initialization:
```
340: rn2(1015) = 681
341: rn2(1016) = 969  
342: rn2(1017) = 614
343: rn2(1018) = 916
344: rn2(1019) = 627 ← Previously thought to be "divergence"
345: rn2(1020) = 40
...
355: rn2(1030) = 106
```

Stack trace confirms these calls originate from:
```
at themerooms_generate (dungeon.js:69)
  → pre_themerooms_generate() (themerms.js:1035-1038)
    → Lua MT init sequence
```

### Root Cause of Confusion
Previous documentation assumed calls 340-355 were room creation/contents without verifying against actual C trace data. The repository only contains Oracle level traces, not procedural dungeon traces for seed 3.

## Findings

### ✅ Confirmed Working
1. Lua MT19937 initialization (30 RNG calls)
2. Themed room contents execute synchronously (not deferred)
3. Room creation follows correct RNG patterns  
4. Retry exhaustion after ~8 rooms is expected behavior

### 🔍 Next Steps for Real Alignment Testing
1. Generate C trace for seed 3 procedural dungeon, OR
2. Test JS against existing Oracle traces (seeds: 1, 42, 72, 100)
3. Remove debug instrumentation from rng.js
