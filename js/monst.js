// monst.js -- Monster data tables (permonst array) and global initialization
// cf. monst.c — monst_globals_init, mons[], mons_init[], c_sa_yes[], c_sa_no[]
//
// monst.c is primarily a data file. It contains:
//   1. mons_init[]: large static const array of permonst structs, initialized
//      from monsters.h header. Each entry defines one monster species:
//      pmnames (M/F/N names), pchar (display char), cmove (movement speed),
//      cnutrit (nutrition), msize, mresists (resistances), mflags1/2/3,
//      mattk[] (attacks), mlevel, mmove, AC, MR, maligntyp, geno, and more.
//   2. mons[SIZE(mons_init)]: global mutable copy of mons_init (runtime array).
//   3. c_sa_yes[NATTK], c_sa_no[NATTK]: constant attack arrays for
//      seduction attack variants.
//   4. monst_globals_init(): copies mons_init into mons at startup.
//
// JS implementations:
//   mons[] data → monsters.js (JS monster data array, adapted structure)
//   monst_globals_init() → implicit in monsters.js module load
//   c_sa_yes/c_sa_no → not separately defined in JS (seduction attacks TODO)
//
// Note: In JS, monster data is in monsters.js with JS-native property names.
//   The monsters.js array corresponds to mons[] but uses JS object literals
//   rather than C struct initialization syntax.

// cf. monst.c:39 [data] — mons_init[NUMMONS + 1]: static monster initialization array
// Large const array of permonst structs from monsters.h.
// JS equiv: monsters.js — JS monster data array.
// PARTIAL: monst.c:39 — mons_init[] ↔ monsters.js monster array

// cf. monst.c:69 [data] — mons[SIZE(mons_init)]: global runtime monster array
// Mutable copy of mons_init; used throughout the game for monster data.
// JS equiv: monsters.js exports — imported as mons in JS files.
// PARTIAL: monst.c:69 — mons[] ↔ monsters.js

// cf. monst.c:72 — monst_globals_init(): initialize global mons array
// Copies mons_init into mons at program startup.
// JS equiv: implicit in monsters.js module initialization.
// PARTIAL: monst.c:72 — monst_globals_init() ↔ monsters.js module load

// cf. monst.c:78 [data] — c_sa_yes[NATTK]: seduction attacks (yes variant)
// Constant attack array for monsters that have seduction as attack type.
// TODO: monst.c:78 — c_sa_yes[]: seduction attack array (yes)

// cf. monst.c:79 [data] — c_sa_no[NATTK]: seduction attacks (no variant)
// Constant attack array for monsters that do not have seduction attacks.
// TODO: monst.c:79 — c_sa_no[]: seduction attack array (no)
