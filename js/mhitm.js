// mhitm.js -- Monster-vs-monster combat: attacks, damage, special effects
// cf. mhitm.c — fightm, mdisplacem, mattackm, failed_grab,
//               hitmm, gazemm, engulf_target, gulpmm, explmm, mdamagem,
//               mon_poly, paralyze_monst, sleep_monst, slept_monst, rustm,
//               mswingsm, passivemm, xdrainenergym, attk_protection,
//               and static helpers noises, pre_mm_attack, missmm
//
// mhitm.c handles all monster-vs-monster combat resolution:
//   fightm(mtmp): find adjacent enemies and call mattackm().
//   mattackm(magr, mdef): full attack sequence for magr against mdef.
//     Returns bitmask: MM_MISS/MM_HIT/MM_DEF_DIED/MM_AGR_DIED/MM_EXPELLED.
//   mattackm dispatches per attack: hitmm (physical), gazemm (gaze),
//     gulpmm (engulf), explmm (explosion).
//   mdamagem(): apply actual damage and special effects (AT_CLNC, AT_STNG, etc.)
//
// JS implementations (partial — RNG parity in dogmove.js):
//   dogmove.js:829 — to-hit roll RNG parity (mhitm.c mattackm to-hit roll)
//   dogmove.js:1192-1344 — pet combat vs monsters (partial mattackm paths)
//   mon.js:450 — passivemm() RNG-only probe for pet melee path
//   monutil.js:78 — hitmm() generic "hits" for AT_KICK
// Full mattackm/mdamagem/all special effects → not fully implemented in JS.

// cf. mhitm.c:26 [static] — noises(mtmp, mattk): output unseen combat noise
// Prints distant/near fight noise for monsters the hero can't see directly.
// TODO: mhitm.c:26 — noises(): combat noise output

// cf. mhitm.c:40 [static] — pre_mm_attack(magr, mdef): prepare for mm attack
// Unmimics/unhides monsters before they participate in combat.
// TODO: mhitm.c:40 — pre_mm_attack(): combat preparation

// cf. mhitm.c:75 [static] — missmm(magr, mdef, mattk): miss message for mm attack
// Prints "X misses Y" for monster-vs-monster miss.
// TODO: mhitm.c:75 — missmm(): monster-vs-monster miss message

// cf. mhitm.c:105 — fightm(mtmp): monster fights other monsters
// Scans adjacent monsters; calls mattackm() for appropriate targets.
// Returns 1 if an attack was made, 0 otherwise.
// TODO: mhitm.c:105 — fightm(): monster combat initiation

// cf. mhitm.c:178 — mdisplacem(magr, mdef, vis): attacker displaces defender
// Swaps positions of magr and mdef; handles leash and ball-chain constraints.
// TODO: mhitm.c:178 — mdisplacem(): monster position displacement

// cf. mhitm.c:292 — mattackm(magr, mdef): monster attacks another monster
// Full attack resolution: checks adjacency, peace, attack types;
//   dispatches to hitmm/gazemm/gulpmm/explmm per attack slot.
// Returns bitmask: MM_MISS, MM_HIT, MM_DEF_DIED, MM_AGR_DIED, MM_EXPELLED.
// JS equiv: dogmove.js:1192 — partial RNG-parity pet combat path.
// PARTIAL: mhitm.c:292 — mattackm() ↔ dogmove.js:1192

// cf. mhitm.c:596 [static] — failed_grab(magr, mdef, mattk): grab attack fails?
// Returns TRUE if grab/hug/swallow attack fails on non-solid target.
// TODO: mhitm.c:596 — failed_grab(): grab attack feasibility

// cf. mhitm.c:643 [static] — hitmm(magr, mdef, mattk, obj, hf): process mm hit
// Resolves a successful physical hit: weapon damage, messages, special effects.
// Returns hit/miss result.
// TODO: mhitm.c:643 — hitmm(): monster-vs-monster hit resolution

// cf. mhitm.c:735 [static] — gazemm(magr, mdef, mattk): gaze attack on monster
// Applies gaze effects (reflection, paralysis, death) between monsters.
// TODO: mhitm.c:735 — gazemm(): monster gaze attack

// cf. mhitm.c:807 — engulf_target(magr, mdef): can monster swallow another?
// Checks if mdef can be engulfed by magr based on sizes and types.
// TODO: mhitm.c:807 — engulf_target(): engulf feasibility check

// cf. mhitm.c:848 [static] — gulpmm(magr, mdef, mattk): engulf/swallow attack
// Handles swallowing one monster by another; adjusts positions.
// TODO: mhitm.c:848 — gulpmm(): monster engulf attack

// cf. mhitm.c:969 [static] — explmm(magr, mdef, mattk): explosion attack
// Self-destruct attack that always kills attacker; damages defender and surroundings.
// TODO: mhitm.c:969 — explmm(): monster explosion attack

// cf. mhitm.c:1015 [static] — mdamagem(magr, mdef, mattk, obj, hf): apply mm damage
// Applies damage and special effects (poison, paralysis, level drain, etc.)
//   for each attack type in monster-vs-monster combat.
// TODO: mhitm.c:1015 — mdamagem(): monster-vs-monster damage application

// cf. mhitm.c:1121 — mon_poly(magr, mdef, dmg): polymorph attack on monster
// Applies polymorph effect to mdef; handles large/small monster constraints.
// Returns actual damage dealt.
// TODO: mhitm.c:1121 — mon_poly(): monster polymorph attack

// cf. mhitm.c:1209 — paralyze_monst(mtmp, amt): paralyze monster
// Sets monster paralyzed for amt turns; wakes sleeping hero if adjacent.
// TODO: mhitm.c:1209 — paralyze_monst(): monster paralysis

// cf. mhitm.c:1222 — sleep_monst(mtmp, amt, how): put monster to sleep
// Sets monster sleeping for amt turns; handles sleep resistance.
// Returns 1 if affected, 0 if resisted.
// TODO: mhitm.c:1222 — sleep_monst(): monster sleep effect

// cf. mhitm.c:1249 — slept_monst(mtmp): monster wakes up
// Releases grab on hero if monster was grabbing while asleep.
// TODO: mhitm.c:1249 — slept_monst(): monster wake-up handling

// cf. mhitm.c:1259 — rustm(mtmp, obj): rust/corrode monster's weapon
// Applies erosion to monster's wielded weapon (for AT_RUST, AT_CORR, etc.).
// TODO: mhitm.c:1259 — rustm(): monster weapon erosion

// cf. mhitm.c:1282 [static] — mswingsm(magr, mdef, obj): display weapon swing message
// Prints "X swings weapon at Y" for monster weapon attacks.
// TODO: mhitm.c:1282 — mswingsm(): weapon swing message

// cf. mhitm.c:1303 [static] — passivemm(mdef, magr, mhit, dmg, obj): passive counterattack
// Handles passive defenses (acid splash, cold stun, etc.) from hit monster.
// JS equiv: mon.js:450 — RNG-only probe.
// PARTIAL: mhitm.c:1303 — passivemm() ↔ mon.js:450

// cf. mhitm.c:1460 — xdrainenergym(mtmp, vis): drain energy from monster
// Applies energy drain effect to monster's spell pool.
// TODO: mhitm.c:1460 — xdrainenergym(): monster energy drain

// cf. mhitm.c:1474 — attk_protection(attyp): armor slot for attack protection
// Returns equipment slot (helmet, gloves, etc.) that protects against attack type.
// TODO: mhitm.c:1474 — attk_protection(): attack protection slot
