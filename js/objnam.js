// objnam.js -- Object naming: xname, doname, article handling, pluralization, wishing
// cf. objnam.c — xname, doname, doname_with_price, doname_vague_quan, cxname,
//                cxname_singular, killer_xname, singular, simple_typename,
//                safe_typename, obj_typename, obj_is_pname,
//                the_unique_obj, the_unique_pm, erosion_matters,
//                not_fully_identified, an, An, the, The, just_an,
//                aobjnam, yobjnam, Yobjnam2, Tobjnam, Doname2, paydoname,
//                yname, Yname2, ysimple_name, Ysimple_name2, simpleonames,
//                ansimpleoname, thesimpleoname, actualoname, bare_artifactname,
//                otense, vtense, makeplural, makesingular,
//                readobjnam (wishing parser), rnd_class, rnd_otyp_by_wpnskill,
//                shiny_obj, Japanese_item_name, short_oname, mshot_xname,
//                strprepend, nextobuf, releaseobuf, maybereleaseobuf,
//                fruit_from_indx, reorder_fruit, armor/suit/cloak/helm/
//                gloves/boots/shield/shirt_simple_name, mimic_obj_name,
//                and many static helpers
//
// objnam.c is a large file (~5700 lines) covering:
//   1. Basic naming: xname() → short object name; doname() → full name with
//      status (worn, cursed, enchanted, charges); cxname() adds corpse type.
//   2. Article logic: an/An/the/The for "a potion" vs "the Amulet".
//   3. Possessive/verb helpers: yname, aobjnam, Tobjnam, otense, vtense.
//   4. Plural/singular: makeplural/makesingular (large rule tables).
//   5. Wishing: readobjnam() parses user wish strings into object creation
//      parameters; readobjnam_init/preparse/parse_charges/postparse1/2/3.
//   6. Armor name specializations: armor_simple_name, suit_simple_name, etc.
//   7. Buffer management: nextobuf/releaseobuf for circular name buffers.
//   8. Fruit: fruit_from_indx, reorder_fruit for named fruits.
//
// JS implementations: mostly not implemented. Some fragments in mkobj.js.
//   xname/doname → not in JS (object naming TODO)
//   readobjnam → not in JS (wishing TODO)
//   makeplural/makesingular → hacklib.js has partial string utilities

// cf. objnam.c:123 [static] — strprepend(s, pref): prepend prefix to string
// Prepends pref to s in-place using buffer area before s pointer.
// TODO: objnam.c:123 — strprepend(): string prefix prepend

// cf. objnam.c:142 — nextobuf(): get next circular name buffer
// Returns next available buffer from the object name buffer pool.
// TODO: objnam.c:142 — nextobuf(): object name buffer allocation

// cf. objnam.c:150 — releaseobuf(bufp): return buffer to pool
// Returns bufp to pool if it was the most recently allocated.
// TODO: objnam.c:150 — releaseobuf(): object name buffer release

// cf. objnam.c:167 — maybereleaseobuf(obuffer): safely release name buffer
// Releases buffer if it's from the object name pool.
// TODO: objnam.c:167 — maybereleaseobuf(): safe buffer release

// cf. objnam.c:201 — obj_typename(otyp): full formal object type name
// Returns formal name with description (e.g., "potion of healing") for otyp.
// TODO: objnam.c:201 — obj_typename(): formal object type name

// cf. objnam.c:298 — simple_typename(otyp): concise object type name
// Returns brief name without description.
// TODO: objnam.c:298 — simple_typename(): simple type name

// cf. objnam.c:312 — safe_typename(otyp): object type name with sanity check
// Returns name for otyp; handles invalid otyp values gracefully.
// TODO: objnam.c:312 — safe_typename(): safe type name

// cf. objnam.c:333 — obj_is_pname(obj): object has a personal artifact name?
// Returns TRUE if obj->oartifact has a proper name (not "the X").
// TODO: objnam.c:333 — obj_is_pname(): artifact name check

// cf. objnam.c:431 — fruit_from_indx(indx): lookup custom fruit by index
// Returns fruit struct for the given fruit index.
// TODO: objnam.c:431 — fruit_from_indx(): fruit index lookup

// cf. objnam.c:523 — reorder_fruit(forward): sort named fruit list by index
// Sorts fruit linked list ascending or descending by index.
// TODO: objnam.c:523 — reorder_fruit(): fruit list sorting

// cf. objnam.c:575 — xname(obj): basic object name with identification
// Returns short name: quantity, appearance (if unidentified), known attributes.
// Core naming function used everywhere.
// TODO: objnam.c:575 — xname(): basic object name

// cf. objnam.c:1090 — mshot_xname(obj): object name with multishot info
// Formats name with "(5 of 20 missiles)" style annotation.
// TODO: objnam.c:1090 — mshot_xname(): multishot object name

// cf. objnam.c:1106 — the_unique_obj(obj): use "the" for this object?
// Returns TRUE for unique artifacts, the Amulet, quest artifacts.
// TODO: objnam.c:1106 — the_unique_obj(): unique object article check

// cf. objnam.c:1121 — the_unique_pm(ptr): use "the" for this monster?
// Returns TRUE for unique named monsters (Wizard of Yendor, Riders, etc.).
// TODO: objnam.c:1121 — the_unique_pm(): unique monster article check

// cf. objnam.c:1195 — erosion_matters(obj): does erosion affect this object?
// Returns TRUE if object type can be eroded (weapon, armor, not stone).
// TODO: objnam.c:1195 — erosion_matters(): erosion relevance check

// cf. objnam.c:1745 — doname(obj): complete detailed object name
// Full name with worn/wielded status, charges, enchantment, BUC status.
// TODO: objnam.c:1745 — doname(): full object name

// cf. objnam.c:1752 — doname_with_price(obj): object name with shop price
// Appends " (N zorkmids)" to doname() for shop display.
// TODO: objnam.c:1752 — doname_with_price(): priced object name

// cf. objnam.c:1759 — doname_vague_quan(obj): object with vague quantity
// Returns "some X" if exact quantity is unknown.
// TODO: objnam.c:1759 — doname_vague_quan(): vague quantity name

// cf. objnam.c:1778 — not_fully_identified(otmp): needs more identification?
// Returns TRUE if object has unidentified aspects (appearance, charges, etc.).
// TODO: objnam.c:1778 — not_fully_identified(): identification completeness

// cf. objnam.c:1915 — cxname(obj): object name with corpse monster type
// Appends monster type for corpse objects (e.g., "hill giant corpse").
// TODO: objnam.c:1915 — cxname(): corpse name with monster type

// cf. objnam.c:1924 — cxname_singular(obj): singular form of cxname
// Returns singular corpse name (not quantity-prefixed).
// TODO: objnam.c:1924 — cxname_singular(): singular corpse name

// cf. objnam.c:1933 — killer_xname(obj): object name for death reason
// Returns fully identified name for use in tombstone/death messages.
// TODO: objnam.c:1933 — killer_xname(): death cause object name

// cf. objnam.c:2082 — singular(otmp, func): singular form via naming function
// Returns singular result of applying naming function func to otmp.
// TODO: objnam.c:2082 — singular(): singular name form

// cf. objnam.c:2100 — just_an(outbuf, str): choose article ("", "a", or "an")
// Selects appropriate article and writes to outbuf. Handles "the", names, vowels.
// TODO: objnam.c:2100 — just_an(): article selection

// cf. objnam.c:2136 — an(str): "a/an" + string with proper article
// Returns new string with article prepended.
// TODO: objnam.c:2136 — an(): indefinite article prepend

// cf. objnam.c:2149 — An(str): capitalized "A/An" + string
// TODO: objnam.c:2149 — An(): capitalized indefinite article

// cf. objnam.c:2162 — the(str): "the" prefix as appropriate
// Returns "the X" or just "X" for proper nouns.
// TODO: objnam.c:2162 — the(): definite article prepend

// cf. objnam.c:2224 — The(str): capitalized "The" + string
// TODO: objnam.c:2224 — The(): capitalized definite article

// cf. objnam.c:2234 — aobjnam(otmp, verb): "N count + cxname + verb"
// Formats count + object name + verb for messages like "The 3 arrows miss".
// TODO: objnam.c:2234 — aobjnam(): count+name+verb format

// cf. objnam.c:2252 — yobjnam(obj, verb): "your X verb"
// Formats "your <object name> <verb>" for inventory messages.
// TODO: objnam.c:2252 — yobjnam(): your-object-verb format

// cf. objnam.c:2270 — Yobjnam2(obj, verb): capitalized "Your X verb"
// TODO: objnam.c:2270 — Yobjnam2(): capitalized your-object-verb

// cf. objnam.c:2280 — Tobjnam(otmp, verb): "The <xname> <verb>"
// TODO: objnam.c:2280 — Tobjnam(): The-object-verb format

// cf. objnam.c:2293 — Doname2(obj): capitalized doname
// TODO: objnam.c:2293 — Doname2(): capitalized full name

// cf. objnam.c:2303 — paydoname(obj): object name for shop payment menu
// Formats name for shop transaction display.
// TODO: objnam.c:2303 — paydoname(): shop payment name format

// cf. objnam.c:2349 — yname(obj): "your" + cxname
// TODO: objnam.c:2349 — yname(): your + object name

// cf. objnam.c:2368 — Yname2(obj): capitalized "Your" + cxname
// TODO: objnam.c:2368 — Yname2(): capitalized your name

// cf. objnam.c:2381 — ysimple_name(obj): "your" + minimal name
// TODO: objnam.c:2381 — ysimple_name(): your + simple name

// cf. objnam.c:2392 — Ysimple_name2(obj): capitalized "Your" + simple name
// TODO: objnam.c:2392 — Ysimple_name2(): capitalized your simple name

// cf. objnam.c:2418 — simpleonames(obj): plural simple name if quan > 1
// TODO: objnam.c:2418 — simpleonames(): plural-aware simple name

// cf. objnam.c:2436 — ansimpleoname(obj): "a/an/the" + simple name
// TODO: objnam.c:2436 — ansimpleoname(): articled simple name

// cf. objnam.c:2464 — thesimpleoname(obj): "the" + simple name
// TODO: objnam.c:2464 — thesimpleoname(): "the" simple name

// cf. objnam.c:2480 — actualoname(obj): object's actual discovered name
// Returns real name of object type as discovered/identified.
// TODO: objnam.c:2480 — actualoname(): actual discovered name

// cf. objnam.c:2492 — bare_artifactname(obj): artifact name without object type
// Returns just "Excalibur" not "long sword called Excalibur".
// TODO: objnam.c:2492 — bare_artifactname(): artifact name only

// cf. objnam.c:2521 — otense(otmp, verb): verb conjugated for object plurality
// Returns conjugated verb matching singular/plural count of otmp.
// TODO: objnam.c:2521 — otense(): object-plurality verb conjugation

// cf. objnam.c:2553 — vtense(subj, verb): conjugate verb for subject
// Returns "verb" or "verbs" based on subject (e.g., "it" → third-person).
// TODO: objnam.c:2553 — vtense(): subject-based verb conjugation

// cf. objnam.c:2826 — makeplural(oldstr): convert singular word to plural
// Large rule table + special cases for proper English pluralization.
// TODO: objnam.c:2826 — makeplural(): English pluralization

// cf. objnam.c:3027 — makesingular(oldstr): convert plural word to singular
// Reverse of makeplural; handles irregular plurals.
// TODO: objnam.c:3027 — makesingular(): English singularization

// cf. objnam.c:3422 — rnd_otyp_by_wpnskill(skill): random weapon type by skill
// Returns random weapon otyp that uses the given weapon skill.
// TODO: objnam.c:3422 — rnd_otyp_by_wpnskill(): skill-based weapon selection

// cf. objnam.c:3522 — shiny_obj(oclass): random shiny object of class
// Returns random object otyp from class that looks shiny (for mimics, etc.).
// TODO: objnam.c:3522 — shiny_obj(): random shiny object

// cf. objnam.c:4900 — readobjnam(bp, no_wish): parse wish string into object
// Main wishing parser: handles "blessed +3 long sword", "2 scrolls of ...", etc.
// Creates object matching the wish; validates against constraints.
// TODO: objnam.c:4900 — readobjnam(): wish string parser

// cf. objnam.c:5393 — rnd_class(first, last): random object type in range
// Returns random otyp in [first..last] range.
// TODO: objnam.c:5393 — rnd_class(): random type in range

// cf. objnam.c:5412 — Japanese_item_name(i, ordinaryname): Japanese name override
// Returns Japanese name for item (Samurai role replaces some weapon names).
// TODO: objnam.c:5412 — Japanese_item_name(): Samurai item name

// cf. objnam.c:5425 — armor_simple_name(armor): simple armor type name
// Returns generic armor type (e.g., "plate mail" → "armor").
// TODO: objnam.c:5425 — armor_simple_name(): generic armor name

// cf. objnam.c:5461 — suit_simple_name(suit): simple suit name
// TODO: objnam.c:5461 — suit_simple_name(): simple body armor name

// cf. objnam.c:5482 — cloak_simple_name(cloak): simple cloak name
// TODO: objnam.c:5482 — cloak_simple_name(): simple cloak name

// cf. objnam.c:5503 — helm_simple_name(helmet): simple helmet name
// TODO: objnam.c:5503 — helm_simple_name(): simple helmet name

// cf. objnam.c:5522 — gloves_simple_name(gloves): simple gloves name
// TODO: objnam.c:5522 — gloves_simple_name(): simple gloves name

// cf. objnam.c:5541 — boots_simple_name(boots): simple boots name
// TODO: objnam.c:5541 — boots_simple_name(): simple boots name

// cf. objnam.c:5560 — shield_simple_name(shield): simple shield name
// TODO: objnam.c:5560 — shield_simple_name(): simple shield name

// cf. objnam.c:5590 — shirt_simple_name(shirt): simple shirt/apron name
// TODO: objnam.c:5590 — shirt_simple_name(): simple shirt name

// cf. objnam.c:5596 — mimic_obj_name(mtmp): object name for mimicked form
// Returns the object name that a mimic is pretending to be.
// TODO: objnam.c:5596 — mimic_obj_name(): mimic disguise name
