// wizard.js -- Wizard of Yendor AI and covetous monster behavior
// cf. wizard.c — amulet, mon_has_amulet, mon_has_special, tactics, strategy,
//                choose_stairs, nasty, pick_nasty, clonewiz, resurrect,
//                intervene, wizdeadorgone, cuss, aggravate, has_aggravatables
//
// This module encodes the Wizard of Yendor's AI: artifact covetousness,
// multi-stage strategy (flee to heal, harass, pursuit), monster summoning
// (nasty[]), disguise forms (wizapp[]), cloning, immortal resurrection,
// and thematic dialog (cuss()).
//
// Covetous monster system covers Wizard + other M3_COVETOUS monsters
// (Riders, Vlad, quest nemeses) that pursue specific artifacts.
//
// JS implementations: none. All functions are runtime gameplay AI.
// is_nasty() predicate → makemon.js:108 (M2_NASTY flag check only).

// cf. wizard.c:30 [data] — nasties[]: array of 44 powerful summoned monsters
// Used by nasty() and pick_nasty() to select creatures to summon.
// Includes demon lords, liches, master liches, arch-liches, dragons, etc.
// Grouped as neutral_nasties, chaotic_nasties, lawful_nasties (all merged).
// TODO: wizard.c:30 — nasties[]: nasty monster type roster

// cf. wizard.c:51 [data] — wizapp[]: 12 disguise forms for the Wizard
// Monster types the Wizard can polymorph into via M_AP_MONSTER.
// Used by amulet() to suppress Wizard alerts when disguised.
// TODO: wizard.c:51 — wizapp[]: Wizard disguise form list

// cf. wizard.c:59 — amulet(): detect Amulet; alert Wizard; show portal heat
// If player wears or wields real Amulet of Yendor: awakens nearby Wizard
//   (within 10 tiles) if he doesn't already have the Amulet.
// Gives proximity hints: "you feel ... close to a magical portal" based on
//   dungeon depth relative to portal level.
// TODO: wizard.c:59 — amulet(): Amulet detection and Wizard alerting

// cf. wizard.c:104 — mon_has_amulet(mon): does monster carry Amulet of Yendor?
// Searches mon's inventory for AMULET_OF_YENDOR object.
// TODO: wizard.c:104 — mon_has_amulet(): monster Amulet check

// cf. wizard.c:115 — mon_has_special(mon): does monster carry a quest artifact?
// Returns TRUE if mon has Amulet, Bell of Opening, Candelabrum, Book of Dead,
//   or the role-specific quest artifact.
// TODO: wizard.c:115 — mon_has_special(): monster quest-artifact check

// cf. wizard.c:138 [macro] — M_Wants(mask): does monster want this artifact?
// Checks mon->data->mflags3 & mask (M3_WANTSAMUL, M3_WANTSBELL, etc.).
// TODO: wizard.c:138 — M_Wants(): covetous artifact desire predicate

// cf. wizard.c:140 [static] — which_arti(mask): convert M3_WANTS* to object type
// Maps M3_WANTSAMUL → AMULET_OF_YENDOR, M3_WANTSBELL → BELL_OF_OPENING, etc.
// Returns 0 for unrecognized masks.
// TODO: wizard.c:140 — which_arti(): M3_WANTS flag to object type

// cf. wizard.c:163 [static] — mon_has_arti(mon, otyp): monster carries artifact?
// If otyp=0: checks all M3_WANTS artifacts. Else: checks specific artifact.
// TODO: wizard.c:163 — mon_has_arti(): monster artifact possession check

// cf. wizard.c:182 [static] — other_mon_has_arti(mon, mask): another monster has artifact?
// Finds a monster OTHER than mon that carries the artifact specified by mask.
// Returns that monster or NULL.
// TODO: wizard.c:182 — other_mon_has_arti(): find rival monster with artifact

// cf. wizard.c:200 [static] — on_ground(mask): artifact on the ground?
// Returns the object matching M3_WANTS* mask if found on any floor tile.
// TODO: wizard.c:200 — on_ground(): artifact floor search

// cf. wizard.c:214 [static] — you_have(mask): does player possess this artifact?
// Checks player inventory and equipped items for artifact matching mask.
// TODO: wizard.c:214 — you_have(): player artifact possession check

// cf. wizard.c:234 [static] — target_on(mask): find goal position for covetous monster
// Prioritizes: player has it → target player; another monster has it → target that monster;
//   on floor → target that location; else player's position.
// Sets dest for monster pathfinding.
// TODO: wizard.c:234 — target_on(): covetous monster goal selection

// cf. wizard.c:268 [static] — strategy(mon): decide monster's high-level strategy
// Considers: HP level (flee to heal if below threshold), artifact inventory
//   (whether mon wants to heal/harass/pursue), level difference to target.
// Sets mon->mstrategy to STRAT_HEAL, STRAT_HARASS, or STRAT_PURSUE.
// TODO: wizard.c:268 — strategy(): covetous monster AI strategy selection

// cf. wizard.c:330 — choose_stairs(mon, up): find stairs for fleeing covetous monster
// Finds nearest up or down stairs; returns position for monster movement.
// Used by tactics() when strategy is STRAT_HEAL (flee to another level).
// TODO: wizard.c:330 — choose_stairs(): stair selection for fleeing

// cf. wizard.c:367 — tactics(mon): execute monster's strategy
// Dispatches on mstrategy: STRAT_HEAL → move toward stairs then level-change;
//   STRAT_HARASS → aggravate + nasty summon + cuss;
//   STRAT_PURSUE → target_on + pathfind toward artifact.
// Called from monmove() for covetous monsters.
// TODO: wizard.c:367 — tactics(): covetous monster action execution

// cf. wizard.c:466 — has_aggravatables(mon): any monsters to wake nearby?
// Returns TRUE if there's a sleeping or passive monster within range that can
//   be aggravated (used to decide if STRAT_HARASS is worthwhile).
// TODO: wizard.c:466 — has_aggravatables(): check for wakeable monsters

// cf. wizard.c:486 — aggravate(mon): wake all nearby monsters
// Sets mflee=0, mwait=0 for all monsters within aggravation radius.
// Removes meditation status.
// TODO: wizard.c:486 — aggravate(): wake nearby monsters

// cf. wizard.c:510 — clonewiz(): create a Wizard of Yendor clone
// Spawns a duplicate Wizard near the original; optionally gives fake Amulet;
//   prints "Double Trouble!" message.
// TODO: wizard.c:510 — clonewiz(): Wizard cloning ("Double Trouble")

// cf. wizard.c:531 — pick_nasty(): select a random nasty monster type
// Validates from nasties[]: not genocided, not too weak (level filter),
//   not in Astral Plane unless deity-appropriate.
// Returns chosen permonst* or NULL.
// TODO: wizard.c:531 — pick_nasty(): random nasty monster selection

// cf. wizard.c:584 — nasty(mon): summon 1-MAXNASTIES (10) powerful monsters
// For each summoning slot: calls pick_nasty(); places via enexto/makemon.
// Respects caster alignment: filters chaotic/neutral/lawful nasties appropriately.
// Anti-summoning chain filter: spellcasters only summon from restricted subset.
// Used by tactics() STRAT_HARASS and by monster spell SG_NASTY.
// TODO: wizard.c:584 — nasty(): summon wave of powerful monsters

// cf. wizard.c:708 — resurrect(): bring back the Wizard of Yendor
// Checks migrating_mons for the Wizard; if found, returns him to level.
// Else spawns fresh Wizard with threats ("I'm baack!"); picks a new wizapp disguise.
// Adjusts mhp; calls cuss().
// TODO: wizard.c:708 — resurrect(): Wizard immortal respawn

// cf. wizard.c:778 — intervene(): retaliate after Wizard is killed
// Called on Wizard death: randomly curses items / aggravates monsters /
//   calls nasty() / calls resurrect(); intensity scales with kill count.
// TODO: wizard.c:778 — intervene(): Wizard death retaliation

// cf. wizard.c:808 — wizdeadorgone(wiz): bookkeeping when Wizard leaves play
// Clears wizard-tracking state; may trigger demigod status if player has Amulet.
// Called when Wizard is killed or banished.
// TODO: wizard.c:808 — wizdeadorgone(): Wizard removal bookkeeping

// cf. wizard.c:839 — cuss(mon): Wizard/minion taunts and threats
// Random selection from themed insult tables based on situation:
//   Wizard has Amulet / player has Amulet / Wizard is hurt / generic threats.
// Uses verbalize() to output lines.
// TODO: wizard.c:839 — cuss(): Wizard taunt dialog generation
