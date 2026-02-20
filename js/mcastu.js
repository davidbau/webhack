// mcastu.js -- Monster spellcasting: wizard and cleric spell dispatch
// cf. mcastu.c — castmu, buzzmu, choose_magic_spell, choose_clerical_spell,
//                cursetxt, m_cure_self, touch_of_death, death_inflicted_by,
//                cast_wizard_spell, cast_cleric_spell,
//                is_undirected_spell, spell_would_be_useless
//
// mcastu.c handles monster spellcasting:
//   castmu(mtmp, mattk, vis, thrown): monster casts a spell at the hero.
//     Selects spell type (wizard or cleric) based on mattk.aatyp;
//     calls cast_wizard_spell or cast_cleric_spell.
//   buzzmu(mtmp, mattk): monster uses a ranged spell attack (beam).
//
// Wizard spells (cast_wizard_spell): PSI bolt, death touch, clone wiz,
//   summon nasties, disappear, haste self, aggravate, drain energy,
//   curse items, cause fear.
// Cleric spells (cast_cleric_spell): geyser, fire pillar, lightning, insects,
//   cold, sleep, distress, curse items, blind, paralyze, confuse, cure self.
//
// JS implementations: none — all monster spellcasting is runtime gameplay.

// cf. mcastu.c:48 [static] — cursetxt(mtmp, vis): spell failure feedback
// Prints message when monster's spell is frustrated (e.g., anti-magic zone).
// TODO: mcastu.c:48 — cursetxt(): spell frustration message

// cf. mcastu.c:75 [static] — choose_magic_spell(n): map level to wizard spell enum
// Converts random roll n (1..max) into specific MS_WIZARD_* spell.
// TODO: mcastu.c:75 — choose_magic_spell(): wizard spell selection

// cf. mcastu.c:129 [static] — choose_clerical_spell(n): map level to cleric spell enum
// Converts random roll n (1..max) into specific MS_CLER_* spell.
// TODO: mcastu.c:129 — choose_clerical_spell(): cleric spell selection

// cf. mcastu.c:176 — castmu(mtmp, mattk, vis, thrown): monster casts spell at hero
// Selects wizard or cleric spell; calls cast_wizard_spell or cast_cleric_spell.
// Returns 1 if spell was cast, 0 if failed.
// TODO: mcastu.c:176 — castmu(): monster spell casting

// cf. mcastu.c:359 [static] — m_cure_self(mtmp, dmg): monster heals itself
// Restores monster HP; prints message if visible. Returns remaining damage.
// TODO: mcastu.c:359 — m_cure_self(): monster self-healing spell

// cf. mcastu.c:374 — touch_of_death(mtmp): touch of death spell
// Instant kill or massive damage; calls fry_by_god-style death or big HP loss.
// TODO: mcastu.c:374 — touch_of_death(): instant-kill spell

// cf. mcastu.c:409 — death_inflicted_by(buf, who, mtmp): format death message for spell
// Formats death cause string for spell-induced deaths.
// TODO: mcastu.c:409 — death_inflicted_by(): spell death message formatter

// cf. mcastu.c:448 [static] — cast_wizard_spell(mtmp, dmg, spellid): wizard spell effects
// Dispatches on spellid: PSI bolt, death touch, clone wiz, summon, disappear,
//   haste self, aggravate monsters, drain energy, curse items, cause fear.
// TODO: mcastu.c:448 — cast_wizard_spell(): wizard spell effect handler

// cf. mcastu.c:631 [static] — cast_cleric_spell(mtmp, dmg, spellid): cleric spell effects
// Dispatches on spellid: geyser, fire pillar, lightning, summon insects,
//   cold beam, sleep, distress, curse items, blind, paralyze, confuse, cure self.
// TODO: mcastu.c:631 — cast_cleric_spell(): cleric spell effect handler

// cf. mcastu.c:884 [static] — is_undirected_spell(aatyp, spellid): spell needs direction?
// Returns TRUE if spell does not require aiming (clone, summon, aggravate,
//   disappear, haste, cure self).
// TODO: mcastu.c:884 — is_undirected_spell(): undirected spell predicate

// cf. mcastu.c:912 [static] — spell_would_be_useless(mtmp, aatyp, spellid): useless?
// Returns TRUE if spell would have no effect (already hasted, anti-magic area, etc.).
// TODO: mcastu.c:912 — spell_would_be_useless(): spell uselessness check

// cf. mcastu.c:980 — buzzmu(mtmp, mattk): monster ranged spell attack
// Monster fires a directed beam (fire, cold, lightning, etc.) at hero.
// Calls buzz() for beam traversal.
// TODO: mcastu.c:980 — buzzmu(): monster ranged spell beam
