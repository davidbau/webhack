// mplayer.js -- Player-character monsters (endgame and ghost-level rivals)
// cf. mplayer.c — mk_mplayer, create_mplayers, mplayer_talk
//
// "mplayers" are monsters of types PM_ARCHEOLOGIST through PM_WIZARD —
// one for each player role. They appear in two contexts:
//   special=TRUE  — endgame (Planes of ...) mplayers; named after NetHack
//                   developers, carry a fake Amulet, high level (15-31),
//                   heavily equipped with role-appropriate gear + artifacts.
//   special=FALSE — ghost-level mplayers; no name, lower level (1-16),
//                   basic weapon only, fewer items.
//
// is_mplayer() predicate: mondata.js:1071 (implemented).
// rnd_offensive/defensive/misc_item(): makemon.js:904,939,991 (from muse.c; used
//   by mk_mplayer but implemented in makemon.js for general monster use).
// None of mk_mplayer / create_mplayers / mplayer_talk are implemented in JS.
// Endgame is not yet modeled in JS (makemon.js:604 notes In_endgame() path).

// cf. mplayer.c:17 [data] — developers[]: NetHack developer first names
// ~50 entries covering devteam, PC, Amiga, Mac, Atari, NT, OS/2, VMS teams.
// Used by dev_name() to pick a unique developer name for endgame mplayers.
// Same developer name won't appear twice on a level (up to 100 retry attempts).

// cf. mplayer.c:43 [static] — dev_name(): pick an unused developer name
// Randomly selects from developers[]; retries up to 100× if that name is
//   already in use by an existing mplayer on the level.
// Returns NULL if all 100 tries matched (all names taken) → caller uses "Adam"/"Eve".
// TODO: mplayer.c:43 — dev_name(): unique developer name selection

// cf. mplayer.c:71 [static] — get_mplname(mtmp, nam): assign name to mplayer
// Calls dev_name(); if no name available uses "Eve" (female) or "Adam" (male).
// Female monsters: only "Janet" from dev list is kept; others get "Maud" or "Eve".
// Appends " the <rank>" via rank_of(m_lev, monsndx, female).
// Sets mtmp->female based on final name.
// TODO: mplayer.c:71 — get_mplname(): developer-named mplayer naming

// cf. mplayer.c:94 [static] — mk_mplayer_armor(mon, typ): give mplayer one armor piece
// Skips if typ==STRANGE_OBJECT. Creates mksobj(typ); clears erosion;
//   1/3 chance oerodeproof; 1/3 chance cursed; 1/3 chance blessed.
// spe: 9/10 chance of rn2(3)?rn2(5):rn1(4,4); 1/10 chance of -rnd(3).
// Calls mpickobj(mon, obj) to add to monster inventory.
// TODO: mplayer.c:94 — mk_mplayer_armor(): mplayer armor creation

// cf. mplayer.c:117 — mk_mplayer(ptr, x, y, special): create one mplayer monster
// Validates ptr is mplayer type; relocates any existing monster at (x,y).
// Forces special=FALSE if not In_endgame().
// Calls makemon(ptr, x, y, MM_NOMSG if special else NO_MM_FLAGS).
// m_lev: special → rn1(16,15) [15..30]; else → rnd(16) [1..16].
// mhp: d(m_lev, 10) + (special ? 30+rnd(30) : 30).
// special: get_mplname + christen_monst; mongets FAKE_AMULET_OF_YENDOR.
// Sets mpeaceful=0; calls set_malign().
//
// Default equipment (overridden per-role below):
//   weapon: 1/2 LONG_SWORD else rnd_class(SPEAR, BULLWHIP)
//   armor:  rnd_class(GRAY_DRAGON_SCALE_MAIL, YELLOW_DRAGON_SCALE_MAIL)
//   cloak:  1/8 STRANGE_OBJECT else rnd_class(OILSKIN_CLOAK, CLOAK_OF_DISPLACEMENT)
//   helm:   1/8 STRANGE_OBJECT else rnd_class(ELVEN_LEATHER_HELM, HELM_OF_TELEPATHY)
//   shield: 1/8 STRANGE_OBJECT else rnd_class(ELVEN_SHIELD, SHIELD_OF_REFLECTION)
//
// Role-specific weapon overrides:
//   ARCHEOLOGIST: 1/2 BULLWHIP
//   BARBARIAN:    1/2 TWO_HANDED_SWORD or BATTLE_AXE (no shield); 1/2 plate/chain
//   CAVE_DWELLER: 3/4 MACE, 1/8 CLUB; no HELM_OF_BRILLIANCE
//   HEALER:       3/4 QUARTERSTAFF or UNICORN_HORN/SCALPEL; helm bias; 1/2 no shield
//   KNIGHT:       3/4 LONG_SWORD; 1/2 plate/chain
//   MONK:         1/3 SHURIKEN else no weapon; no armor; ROBE cloak; 1/2 no shield
//   CLERIC:       1/2 MACE; 1/2 plate/chain; 1/4 ROBE; 1/4 helm; 1/2 no shield
//   RANGER:       1/2 ELVEN_DAGGER
//   ROGUE:        1/2 SHORT_SWORD or ORCISH_DAGGER
//   SAMURAI:      1/2 KATANA
//   TOURIST:      default
//   VALKYRIE:     1/2 WAR_HAMMER; 1/2 plate/chain
//   WIZARD:       1/4 QUARTERSTAFF or ATHAME; 1/2 BLACK/SILVER_DRAGON_SCALE + CMR cloak;
//                 1/4 HELM_OF_BRILLIANCE; no shield
//
// Weapon (if not STRANGE_OBJECT): spe=special?rn1(5,4):rn2(4); 1/3 erosionproof;
//   1/2 greased; special+1/2: mk_artifact(A_NONE); stackable+throwable: +rn2(4 or 8) quan.
//   Magicbane spe capped at rnd(4).
//
// special equipment: 1/10 LUCKSTONE/LOADSTONE; mk_mplayer_armor for all slots;
//   valkyrie gets GAUNTLETS_OF_POWER or 7/8 rnd gloves; 7/8 rnd boots;
//   m_dowear(TRUE); rn2(3)?rn2(3):rn2(16) gems; mkmonmoney rn2(1000) gold;
//   rn2(10) random items via mkobj(RANDOM_CLASS).
// All mplayers: rnd(3) each of rnd_offensive/defensive/misc items.
// TODO: mplayer.c:117 — mk_mplayer(): player-character monster creation

// cf. mplayer.c:326 — create_mplayers(num, special): create N mplayers on level
// Rolls pm = rn1(PM_WIZARD-PM_ARCHEOLOGIST+1, PM_ARCHEOLOGIST) for each.
// Finds random position with goodpos() (up to 50 tries); returns early if not found.
// Calls mk_mplayer() for each.
// Used by endgame level generation to populate Planes with rival adventurers.
// TODO: mplayer.c:326 — create_mplayers(): populate level with mplayer monsters

// cf. mplayer.c:355 — mplayer_talk(mtmp): mplayer chat message
// Returns if mtmp->mpeaceful (falls through to generic humanoid talk).
// Same class as hero: "I can't win, and neither will you!" / "You don't deserve to win!"
//   / "Mine should be the honor, not yours!"
// Other class: "The low-life wants to talk, eh?" / "Fight, scum!" / "Here is what I have to say!"
// Uses SetVoice(mtmp, 0, 80, 0) + verbalize().
// TODO: mplayer.c:355 — mplayer_talk(): rival adventurer chat
