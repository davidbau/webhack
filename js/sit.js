// sit.js -- Sitting effects and related hero intrinsic/inventory curses
// cf. sit.c — #sit command, throne effects, rndcurse, attrcurse

// cf. sit.c:14 — take_gold(): remove all gold coins from hero inventory
// TODO: sit.c:14 — take_gold(): delete all COIN_CLASS items, print "no gold" or "notice"

// cf. sit.c:39 [static] — throne_sit_effect(): 13 random effects when hero sits on a throne
// (1=stat drain+hp loss, 2=stat gain, 3=electric shock, 4=full heal,
//  5=take_gold, 6=wish or luck change, 7=summon court monsters,
//  8=do_genocide, 9=blind+curse luck, 10=magic mapping or see_invis,
//  11=teleport or aggravate, 12=identify pack, 13=confusion)
// Throne may also vanish with 1/3 chance after effect rolls.
// TODO: sit.c:39 — throne_sit_effect(): full 13-effect throne sit roll

// cf. sit.c:238 [static] — special_throne_effect(): Vlad's tower throne effects (1–13)
// (1-4=wish+destroy throne, 5=level drain, 6=grease inventory,
//  7=attrcurse, 8=goto Vibrating Square level, 9=summon 3x demons,
//  10=confused blessed remove curse, 11=polyself, 12=acid damage,
//  13=scramble all abilities)
// TODO: sit.c:238 — special_throne_effect(): Vlad's tower special sit effects

// cf. sit.c:354 [static] — lay_an_egg(): female polymorph lays an egg on the floor
// TODO: sit.c:354 — lay_an_egg(): create egg object, drop at hero's feet, cost nutrition

// cf. sit.c:396 — dosit(): #sit command — sit on current tile, trigger context effects
// Handles: object piles (corpse/box/towel/cream pie), traps, water/fountain,
// sink, altar, grave, stairs, ladder, lava, ice, drawbridge, throne, egg-layer,
// generic floor message.
// TODO: sit.c:396 — dosit(): full #sit command handler

// cf. sit.c:565 — rndcurse(): curse rnd(6) random inventory items; skip COIN_CLASS
// Magicbane wielder and Antimagic may reduce/block; also curses steed's saddle rn2(4).
// TODO: sit.c:565 — rndcurse(): random inventory curse (needed for throne effect 9 + others)

// cf. sit.c:640 — attrcurse(): remove one random intrinsic from hero (rnd(11) cascade)
// Intrinsics checked in cascade: FIRE_RES, TELEPORTATION, POISON_RES, TELEPATHY,
// COLD_RES, INVIS, SEE_INVIS, FAST, STEALTH, PROTECTION, AGGRAVATE_MONSTER.
// Returns the property removed, or 0 if nothing removed.
// TODO: sit.c:640 — attrcurse(): intrinsic-removal cascade (needed for special throne effect 7)
