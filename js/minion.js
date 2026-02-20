// minion.js -- Minion summoning: demons, angels, guardian management
// cf. minion.c — newemin, free_emin, monster_census, msummon,
//                summon_minion, demon_talk, bribe,
//                dprince, dlord, llord, lminion, ndemon,
//                lose_guardian_angel, gain_guardian_angel
//
// minion.c handles:
//   - Minion extra data (newemin/free_emin): per-monster alignment tracking
//   - Monster summoning: msummon() for hostile summoners; summon_minion()
//     for deity-granted allies after prayer or sacrifice
//   - Demon negotiation: demon_talk() for dialog with demon lords/princes;
//     bribe() for gold-based bribery
//   - Monster type selection: dprince/dlord/llord/lminion/ndemon pick
//     appropriate demon/angel types by alignment
//   - Guardian angel management: gain/lose guardian angels
//
// JS implementations: none — all minion summoning is runtime gameplay.

// cf. minion.c:17 — newemin(mtmp): initialize emin (minion) extra data
// Allocates EMIN struct on monster for alignment and shrine level tracking.
// TODO: minion.c:17 — newemin(): minion extra data initialization

// cf. minion.c:28 — free_emin(mtmp): free emin extra data
// Frees EMIN struct from monster.
// TODO: minion.c:28 — free_emin(): minion extra data cleanup

// cf. minion.c:39 — monster_census(spotted): count monsters on level
// Returns count of monsters (spotted=TRUE for visible only, FALSE for all).
// Used by summoning logic to determine if level is overpopulated.
// TODO: minion.c:39 — monster_census(): level monster count

// cf. minion.c:58 — msummon(mtmp): monster summons allies
// Called for monsters with the MS_SUMMON sound or M_SUMMON flag.
// Selects and places 1-6 allies near mtmp based on monster type.
// Returns number of monsters created.
// TODO: minion.c:58 — msummon(): hostile monster summoning

// cf. minion.c:197 — summon_minion(alignment, peaceful): summon aligned minion for player
// Creates an aligned cleric or angel (llord/lminion/dprince/dlord/ndemon)
//   near the player. peaceful=TRUE: arrives as friendly.
// Called by pleased() after prayer/sacrifice reward.
// TODO: minion.c:197 — summon_minion(): player-ally minion summoning

// cf. minion.c:262 — demon_talk(mtmp): handle demon negotiation/bribery
// Prints demon dialog; offers bribe option; accepts gold or attacks.
// Returns 1 if demon accepts bribe and won't attack, 0 otherwise.
// TODO: minion.c:262 — demon_talk(): demon negotiation dialog

// cf. minion.c:359 — bribe(mtmp): get gold amount offered to demon
// Prompts player for gold amount to offer the demon.
// Returns amount given (may be 0 if declined).
// TODO: minion.c:359 — bribe(): demon bribery gold prompt

// cf. minion.c:389 — dprince(alignment): select demon prince by alignment
// Returns permonst* for a demon prince matching given alignment.
// TODO: minion.c:389 — dprince(): demon prince selection

// cf. minion.c:403 — dlord(alignment): select demon lord by alignment
// Returns permonst* for a demon lord matching given alignment.
// TODO: minion.c:403 — dlord(): demon lord selection

// cf. minion.c:418 — llord(): select lawful lord (Archon or lminion)
// Returns permonst* for a lawful-aligned lord (Archon preferred).
// TODO: minion.c:418 — llord(): lawful lord selection

// cf. minion.c:427 — lminion(): select lawful minion (random angel class)
// Returns permonst* for a random lawful minion (non-lord angel).
// TODO: minion.c:427 — lminion(): lawful minion selection

// cf. minion.c:442 — ndemon(alignment): select neutral or any-alignment demon
// Returns permonst* for a demon of given alignment for summoning.
// TODO: minion.c:442 — ndemon(): neutral/chaotic demon selection

// cf. minion.c:466 — lose_guardian_angel(mtmp): remove guardian angel
// Called when guardian angel becomes hostile (alignment conflict, attack on peacefuls).
// Removes tame status; spawns hostile replacement angels.
// TODO: minion.c:466 — lose_guardian_angel(): guardian angel removal

// cf. minion.c:496 — gain_guardian_angel(): summon tame guardian angel
// On Astral Plane when player is worthy (alignment record ≥ threshold):
//   creates tame angel with blessed silver saber and amulet of reflection.
// TODO: minion.c:496 — gain_guardian_angel(): guardian angel summoning
