// shknam.js -- Initialize a shop
// Faithful port of shknam.c from NetHack 3.7
// C ref: shknam.c — shop stocking, shopkeeper creation and naming

import { rn2, rnd } from './rng.js';
import {
    objectData, bases, NUM_OBJECTS,
    FOOD_CLASS, WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS,
    TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS,
    WAND_CLASS, GEM_CLASS,
    VEGGY,
    GOLD_PIECE, EGG, TOUCHSTONE, SCR_CHARGING, SPE_NOVEL,
    POT_FRUIT_JUICE, POT_BOOZE, POT_WATER, POT_HEALING, POT_FULL_HEALING,
    POT_OIL,
    ICE_BOX, LEATHER_GLOVES, ELVEN_CLOAK,
    WAX_CANDLE, TALLOW_CANDLE, BRASS_LANTERN, OIL_LAMP, MAGIC_LAMP,
    WAN_LIGHT, SCR_LIGHT, SPE_LIGHT,
    SCR_FOOD_DETECTION, LUMP_OF_ROYAL_JELLY,
} from './objects.js';
import { MAXOCLASSES, ROOM, SHOPBASE, SDOOR, DOOR, D_NODOOR, D_ISOPEN, D_TRAPPED, D_LOCKED } from './config.js';
import { makemon, mkclass, NO_MM_FLAGS } from './makemon.js';
import { mksobj, mkobj, RANDOM_CLASS } from './mkobj.js';
import { PM_SHOPKEEPER, S_MIMIC } from './monsters.js';

const VEGETARIAN_CLASS = MAXOCLASSES + 1; // 19

// ========================================================================
// Shopkeeper name lists — verbatim from C (shknam.c:32-188)
// ========================================================================

const shkliquors = [
    "Njezjin", "Tsjernigof", "Ossipewsk", "Gorlowka",
    "Gomel",
    "Konosja", "Weliki Oestjoeg", "Syktywkar", "Sablja", "Narodnaja", "Kyzyl",
    "Walbrzych", "Swidnica", "Klodzko", "Raciborz", "Gliwice", "Brzeg",
    "Krnov", "Hradec Kralove",
    "Leuk", "Brig", "Brienz", "Thun", "Sarnen", "Burglen", "Elm", "Flims",
    "Vals", "Schuls", "Zum Loch",
];

const shkbooks = [
    "Skibbereen", "Kanturk", "Rath Luirc", "Ennistymon",
    "Lahinch", "Kinnegad", "Lugnaquillia", "Enniscorthy",
    "Gweebarra", "Kittamagh", "Nenagh", "Sneem",
    "Ballingeary", "Kilgarvan", "Cahersiveen", "Glenbeigh",
    "Kilmihil", "Kiltamagh", "Droichead Atha", "Inniscrone",
    "Clonegal", "Lisnaskea", "Culdaff", "Dunfanaghy",
    "Inishbofin", "Kesh",
];

const shkarmors = [
    "Demirci", "Kalecik", "Boyabai", "Yildizeli", "Gaziantep",
    "Siirt", "Akhalataki", "Tirebolu", "Aksaray", "Ermenak",
    "Iskenderun", "Kadirli", "Siverek", "Pervari", "Malasgirt",
    "Bayburt", "Ayancik", "Zonguldak", "Balya", "Tefenni",
    "Artvin", "Kars", "Makharadze", "Malazgirt", "Midyat",
    "Birecik", "Kirikkale", "Alaca", "Polatli", "Nallihan",
];

const shkwands = [
    "Yr Wyddgrug", "Trallwng", "Mallwyd", "Pontarfynach", "Rhaeader",
    "Llandrindod", "Llanfair-ym-muallt", "Y-Fenni", "Maesteg", "Rhydaman",
    "Beddgelert", "Curig", "Llanrwst", "Llanerchymedd", "Caergybi",
    "Nairn", "Turriff", "Inverurie", "Braemar", "Lochnagar", "Kerloch",
    "Beinn a Ghlo", "Drumnadrochit", "Morven", "Uist", "Storr",
    "Sgurr na Ciche", "Cannich", "Gairloch", "Kyleakin", "Dunvegan",
];

const shkrings = [
    "Feyfer", "Flugi", "Gheel", "Havic", "Haynin",
    "Hoboken", "Imbyze", "Juyn", "Kinsky", "Massis",
    "Matray", "Moy", "Olycan", "Sadelin", "Svaving",
    "Tapper", "Terwen", "Wirix", "Ypey",
    "Rastegaisa", "Varjag Njarga", "Kautekeino", "Abisko", "Enontekis",
    "Rovaniemi", "Avasaksa", "Haparanda", "Lulea", "Gellivare",
    "Oeloe", "Kajaani", "Fauske",
];

const shkfoods = [
    "Djasinga", "Tjibarusa", "Tjiwidej", "Pengalengan",
    "Bandjar", "Parbalingga", "Bojolali", "Sarangan",
    "Ngebel", "Djombang", "Ardjawinangun", "Berbek",
    "Papar", "Baliga", "Tjisolok", "Siboga",
    "Banjoewangi", "Trenggalek", "Karangkobar", "Njalindoeng",
    "Pasawahan", "Pameunpeuk", "Patjitan", "Kediri",
    "Pemboeang", "Tringanoe", "Makin", "Tipor",
    "Semai", "Berhala", "Tegal", "Samoe",
];

const shkweapons = [
    "Voulgezac", "Rouffiac", "Lerignac", "Touverac", "Guizengeard",
    "Melac", "Neuvicq", "Vanzac", "Picq", "Urignac",
    "Corignac", "Fleac", "Lonzac", "Vergt", "Queyssac",
    "Liorac", "Echourgnac", "Cazelon", "Eypau", "Carignan",
    "Monbazillac", "Jonzac", "Pons", "Jumilhac", "Fenouilledes",
    "Laguiolet", "Saujon", "Eymoutiers", "Eygurande", "Eauze",
    "Labouheyre",
];

const shktools = [
    "Ymla", "Eed-morra", "Elan Lapinski", "Cubask", "Nieb", "Bnowr Falr",
    "Sperc", "Noskcirdneh", "Yawolloh", "Hyeghu", "Niskal", "Trahnil",
    "Htargcm", "Enrobwem", "Kachzi Rellim", "Regien", "Donmyar", "Yelpur",
    "Nosnehpets", "Stewe", "Renrut", "Senna Hut", "-Zlaw", "Nosalnef",
    "Rewuorb", "Rellenk", "Yad", "Cire Htims", "Y-crad", "Nenilukah",
    "Corsh", "Aned", "Dark Eery", "Niknar", "Lapu", "Lechaim",
    "Rebrol-nek", "AlliWar Wickson", "Oguhmk", "Telloc Cyaj",
];

const shklight = [
    "Zarnesti", "Slanic", "Nehoiasu", "Ludus", "Sighisoara", "Nisipitu",
    "Razboieni", "Bicaz", "Dorohoi", "Vaslui", "Fetesti", "Tirgu Neamt",
    "Babadag", "Zimnicea", "Zlatna", "Jiu", "Eforie", "Mamaia",
    "Silistra", "Tulovo", "Panagyuritshte", "Smolyan", "Kirklareli", "Pernik",
    "Lom", "Haskovo", "Dobrinishte", "Varvara", "Oryahovo", "Troyan",
    "Lovech", "Sliven",
];

const shkgeneral = [
    "Hebiwerie", "Possogroenoe", "Asidonhopo", "Manlobbi",
    "Adjama", "Pakka Pakka", "Kabalebo", "Wonotobo",
    "Akalapi", "Sipaliwini",
    "Annootok", "Upernavik", "Angmagssalik",
    "Aklavik", "Inuvik", "Tuktoyaktuk", "Chicoutimi",
    "Ouiatchouane", "Chibougamau", "Matagami", "Kipawa",
    "Kinojevis", "Abitibi", "Maganasipi",
    "Akureyri", "Kopasker", "Budereyri", "Akranes",
    "Bordeyri", "Holmavik",
];

const shkhealthfoods = [
    "Ga'er", "Zhangmu", "Rikaze", "Jiangji", "Changdu",
    "Linzhi", "Shigatse", "Gyantse", "Ganden", "Tsurphu",
    "Lhasa", "Tsedong", "Drepung",
    "=Azura", "=Blaze", "=Breanna", "=Breezy", "=Dharma",
    "=Feather", "=Jasmine", "=Luna", "=Melody", "=Moonjava",
    "=Petal", "=Rhiannon", "=Starla", "=Tranquilla", "=Windsong",
    "=Zennia", "=Zoe", "=Zora",
];

// ========================================================================
// shtypes[] — shop type probability table
// C ref: shknam.c:209-354
// ========================================================================

export const shtypes = [
    { // 0: general store
        name: "general store",
        symb: RANDOM_CLASS,
        prob: 42,
        iprobs: [
            { iprob: 100, itype: RANDOM_CLASS },
        ],
        shknms: shkgeneral,
    },
    { // 1: used armor dealership
        name: "used armor dealership",
        symb: ARMOR_CLASS,
        prob: 14,
        iprobs: [
            { iprob: 90, itype: ARMOR_CLASS },
            { iprob: 10, itype: WEAPON_CLASS },
        ],
        shknms: shkarmors,
    },
    { // 2: second-hand bookstore
        name: "second-hand bookstore",
        symb: SCROLL_CLASS,
        prob: 10,
        iprobs: [
            { iprob: 90, itype: SCROLL_CLASS },
            { iprob: 10, itype: SPBOOK_CLASS },
        ],
        shknms: shkbooks,
    },
    { // 3: liquor emporium
        name: "liquor emporium",
        symb: POTION_CLASS,
        prob: 10,
        iprobs: [
            { iprob: 100, itype: POTION_CLASS },
        ],
        shknms: shkliquors,
    },
    { // 4: antique weapons outlet
        name: "antique weapons outlet",
        symb: WEAPON_CLASS,
        prob: 5,
        iprobs: [
            { iprob: 90, itype: WEAPON_CLASS },
            { iprob: 10, itype: ARMOR_CLASS },
        ],
        shknms: shkweapons,
    },
    { // 5: delicatessen
        name: "delicatessen",
        symb: FOOD_CLASS,
        prob: 5,
        iprobs: [
            { iprob: 83, itype: FOOD_CLASS },
            { iprob: 5, itype: -POT_FRUIT_JUICE },
            { iprob: 4, itype: -POT_BOOZE },
            { iprob: 5, itype: -POT_WATER },
            { iprob: 3, itype: -ICE_BOX },
        ],
        shknms: shkfoods,
    },
    { // 6: jewelers
        name: "jewelers",
        symb: RING_CLASS,
        prob: 3,
        iprobs: [
            { iprob: 85, itype: RING_CLASS },
            { iprob: 10, itype: GEM_CLASS },
            { iprob: 5, itype: AMULET_CLASS },
        ],
        shknms: shkrings,
    },
    { // 7: quality apparel and accessories (wand shop)
        name: "quality apparel and accessories",
        symb: WAND_CLASS,
        prob: 3,
        iprobs: [
            { iprob: 90, itype: WAND_CLASS },
            { iprob: 5, itype: -LEATHER_GLOVES },
            { iprob: 5, itype: -ELVEN_CLOAK },
        ],
        shknms: shkwands,
    },
    { // 8: hardware store (tool shop)
        name: "hardware store",
        symb: TOOL_CLASS,
        prob: 3,
        iprobs: [
            { iprob: 100, itype: TOOL_CLASS },
        ],
        shknms: shktools,
    },
    { // 9: rare books (bookstore)
        name: "rare books",
        symb: SPBOOK_CLASS,
        prob: 3,
        iprobs: [
            { iprob: 90, itype: SPBOOK_CLASS },
            { iprob: 10, itype: SCROLL_CLASS },
        ],
        shknms: shkbooks,
    },
    { // 10: health food store
        name: "health food store",
        symb: FOOD_CLASS,
        prob: 2,
        iprobs: [
            { iprob: 70, itype: VEGETARIAN_CLASS },
            { iprob: 20, itype: -POT_FRUIT_JUICE },
            { iprob: 4, itype: -POT_HEALING },
            { iprob: 3, itype: -POT_FULL_HEALING },
            { iprob: 2, itype: -SCR_FOOD_DETECTION },
            { iprob: 1, itype: -LUMP_OF_ROYAL_JELLY },
        ],
        shknms: shkhealthfoods,
    },
    // Unique shops (prob=0) — only created via special level loader
    { // 11: lighting store
        name: "lighting store",
        symb: TOOL_CLASS,
        prob: 0,
        iprobs: [
            { iprob: 30, itype: -WAX_CANDLE },
            { iprob: 44, itype: -TALLOW_CANDLE },
            { iprob: 5, itype: -BRASS_LANTERN },
            { iprob: 9, itype: -OIL_LAMP },
            { iprob: 3, itype: -MAGIC_LAMP },
            { iprob: 5, itype: -POT_OIL },
            { iprob: 2, itype: -WAN_LIGHT },
            { iprob: 1, itype: -SCR_LIGHT },
            { iprob: 1, itype: -SPE_LIGHT },
        ],
        shknms: shklight,
    },
];

// ========================================================================
// get_shop_item(type) — C ref: shknam.c:829-839
// ========================================================================

function get_shop_item(type) {
    const shp = shtypes[type];
    let j = rnd(100);
    for (let i = 0; i < shp.iprobs.length; i++) {
        if ((j -= shp.iprobs[i].iprob) <= 0) return shp.iprobs[i].itype;
    }
    return RANDOM_CLASS;
}

// ========================================================================
// veggy_item / shkveg / mkveggy_at — C ref: shknam.c:379-450
// ========================================================================

// C ref: shknam.c:379-405 — check if object type is vegetarian
function veggy_item(otyp) {
    if (objectData[otyp].oc_class !== FOOD_CLASS) return false;
    return objectData[otyp].material === VEGGY || otyp === EGG;
}

// C ref: shknam.c:407-439 — pick a random vegetarian food item
function shkveg() {
    const ok = [];
    let maxprob = 0;
    for (let i = bases[FOOD_CLASS]; i < NUM_OBJECTS; i++) {
        if (objectData[i].oc_class !== FOOD_CLASS) break;
        if (veggy_item(i)) {
            ok.push(i);
            maxprob += objectData[i].prob || 0;
        }
    }
    let prob = rnd(maxprob);
    let j = 0;
    let i = ok[0];
    while ((prob -= (objectData[i].prob || 0)) > 0) {
        j++;
        i = ok[j];
    }
    return i;
}

// C ref: shknam.c:442-450 — make a random veggy item at position
function mkveggy_at(sx, sy) {
    mksobj(shkveg(), true, true);
}

// ========================================================================
// good_shopdoor — C ref: shknam.c:581-624
// ========================================================================

function good_shopdoor(sroom, map) {
    for (let i = 0; i < sroom.doorct; i++) {
        const di = sroom.fdoor + i;
        let sx = map.doors[di].x;
        let sy = map.doors[di].y;

        // Regular rooms only (no irregular support needed)
        if (sx === sroom.lx - 1) {
            sx++;
        } else if (sx === sroom.hx + 1) {
            sx--;
        } else if (sy === sroom.ly - 1) {
            sy++;
        } else if (sy === sroom.hy + 1) {
            sy--;
        } else {
            continue;
        }
        return { di, sx, sy };
    }
    return null;
}

// ========================================================================
// stock_room_goodpos — C ref: shknam.c:694-714
// ========================================================================

function stock_room_goodpos(sroom, sh, sx, sy, map) {
    const doorx = map.doors[sh].x;
    const doory = map.doors[sh].y;

    // Regular rooms: exclude row/column adjacent to door
    if (sx === sroom.lx && doorx === sx - 1) return false;
    if (sx === sroom.hx && doorx === sx + 1) return false;
    if (sy === sroom.ly && doory === sy - 1) return false;
    if (sy === sroom.hy && doory === sy + 1) return false;

    // Only generate items on solid floor squares
    const loc = map.at(sx, sy);
    if (!loc || loc.typ < ROOM) return false;

    return true;
}

// ========================================================================
// mkmonmoney — C ref: shk.c mkmonmoney()
// Creates gold for a monster: mksobj(GOLD_PIECE, false, false)
// ========================================================================

function mkmonmoney(amount) {
    // C ref: mksobj(GOLD_PIECE, FALSE, FALSE) → newobj → rnd(2) for o_id
    // Then sets quantity. We just call mksobj for RNG alignment.
    mksobj(GOLD_PIECE, false, false);
}

// ========================================================================
// nameshk — C ref: shknam.c:487-554
// ========================================================================

function nameshk(shk, nlp, seed, depth) {
    let name_wanted = shk.m_id;

    // C ref: shknam.c:505 — nseed = ubirthday / 257
    const nseed = Math.floor(seed / 257);

    // C ref: shknam.c:507 — ledger_no for main dungeon = depth
    name_wanted += depth + (nseed % 13) - (nseed % 5);
    if (name_wanted < 0) name_wanted += (13 + 5);

    // C ref: shknam.c:510 — gender from name_wanted
    shk.female = (name_wanted & 1) ? true : false;

    let names_avail = nlp.length;
    name_wanted = name_wanted % names_avail;

    let shname;
    // C ref: shknam.c:517-550 — name selection loop
    // First shopkeeper on a level: trycnt=0, no collision possible
    for (let trycnt = 0; trycnt < 50; trycnt++) {
        if (nlp === shktools) {
            shname = shktools[rn2(names_avail)];
            shk.female = false; // reversed below for '_' prefix
        } else if (name_wanted < names_avail) {
            shname = nlp[name_wanted];
        } else {
            const i = rn2(names_avail);
            if (i !== 0) {
                shname = nlp[i - 1];
            } else if (nlp !== shkgeneral) {
                nlp = shkgeneral;
                names_avail = nlp.length;
                continue;
            } else {
                shname = shk.female ? "-Lucrezia" : "+Dirk";
            }
        }

        // Gender prefix handling
        if (shname[0] === '_' || shname[0] === '-') {
            shk.female = true;
        } else if (shname[0] === '|' || shname[0] === '+') {
            shk.female = false;
        }

        // Check name collision with other shopkeepers on this level
        // During mklev, first shopkeeper won't collide, so break immediately
        // (No fmon list to check in our simplified model)
        break;
    }

    shk.shknam = shname;
}

// ========================================================================
// shkinit — C ref: shknam.c:628-692
// ========================================================================

function shkinit(shp, sroom, map, depth, seed) {
    // C ref: shknam.c:636 — find good door
    const door = good_shopdoor(sroom, map);
    if (!door) return -1;
    const { di: sh, sx, sy } = door;

    // C ref: shknam.c:663 — create shopkeeper
    // makemon(PM_SHOPKEEPER, sx, sy, MM_ESHK)
    // MM_ESHK = 0x08 in C, but in our JS makemon it's just NO_MM_FLAGS
    // The shopkeeper creation consumes: next_ident (rnd(2)), newmonhp,
    // gender rn2(2), m_initweap, m_initinv, saddle rn2(100)
    const shk = makemon(PM_SHOPKEEPER, sx, sy, NO_MM_FLAGS, depth, map);
    if (!shk) return -1;

    // C ref: shknam.c:666-681 — set shopkeeper flags
    shk.peaceful = true;
    shk.isshk = true;

    // C ref: shknam.c:682 — mkmonmoney(shk, 1000 + 30 * rnd(100))
    const capital = 1000 + 30 * rnd(100);
    mkmonmoney(capital);

    // C ref: shknam.c:683-688 — conditional mongets
    if (shp.shknms === shkrings) {
        mksobj(TOUCHSTONE, true, false);
    }
    if (shp.shknms === shktools || shp.shknms === shkwands
        || (shp.shknms === shkrings && rn2(2))
        || (shp.shknms === shkgeneral && rn2(5))) {
        // C: mongets(shk, SCR_CHARGING) = mksobj(SCR_CHARGING, TRUE, FALSE)
        mksobj(SCR_CHARGING, true, false);
    }

    // C ref: shknam.c:689 — name the shopkeeper
    nameshk(shk, shp.shknms, seed, depth);

    return sh;
}

// ========================================================================
// mkshobj_at — C ref: shknam.c:453-483
// ========================================================================

function mkshobj_at(shp, shpIndex, sx, sy, mkspecl, map, depth) {
    // C ref: shknam.c:461-468 — tribute novel for bookstores
    if (mkspecl && (shp.name === "rare books" || shp.name === "second-hand bookstore")) {
        mksobj(SPE_NOVEL, false, false);
        // C: context.tribute.bookstock = TRUE
        return;
    }

    // C ref: shknam.c:470-472 — mimic check
    // rn2(100) is ALWAYS consumed. Short-circuit && means mkclass/makemon
    // only called if mimic chance passes AND no monster at position.
    if (rn2(100) < depth && !mon_at(sx, sy, map)) {
        // C ref: mkclass(S_MIMIC, 0) → pick a mimic type
        const ptr = mkclass(S_MIMIC, 0, depth);
        if (ptr !== null && ptr >= 0) {
            // C ref: makemon(ptr, sx, sy, NO_MM_FLAGS)
            makemon(ptr, sx, sy, NO_MM_FLAGS, depth, map);
        }
    } else {
        // C ref: shknam.c:475-482 — create shop item
        const atype = get_shop_item(shpIndex);
        if (atype === VEGETARIAN_CLASS) {
            mkveggy_at(sx, sy);
        } else if (atype < 0) {
            mksobj(-atype, true, true);
        } else {
            mkobj(atype, true);
        }
    }
}

// Check if a monster is at position (sx, sy)
function mon_at(sx, sy, map) {
    if (!map || !map.monsters) return false;
    for (const m of map.monsters) {
        if (m.mx === sx && m.my === sy && !m.dead) return true;
    }
    return false;
}

// ========================================================================
// stock_room — C ref: shknam.c:718-801
// ========================================================================

export function stock_room(shp_indx, sroom, map, depth, seed) {
    const shp = shtypes[shp_indx];

    // C ref: shknam.c:733 — create shopkeeper
    const sh = shkinit(shp, sroom, map, depth, seed);
    if (sh < 0) return;

    // C ref: shknam.c:737-748 — fix door
    const doorx = map.doors[sroom.fdoor].x;
    const doory = map.doors[sroom.fdoor].y;
    const doorloc = map.at(doorx, doory);
    if (doorloc) {
        if (doorloc.flags === D_NODOOR) {
            doorloc.flags = D_ISOPEN;
        }
        if (doorloc.typ === SDOOR) {
            doorloc.typ = DOOR;
        }
        if (doorloc.flags & D_TRAPPED) {
            doorloc.flags = D_LOCKED;
        }
    }

    // C ref: shknam.c:768-779 — tribute spot selection
    // context.tribute.enabled is always TRUE in NetHack 3.7
    // context.tribute.bookstock starts FALSE for first shop on a level
    // So rnd(stockcount) IS consumed
    let stockcount = 0;
    let specialspot = 0;
    for (let sx = sroom.lx; sx <= sroom.hx; sx++) {
        for (let sy = sroom.ly; sy <= sroom.hy; sy++) {
            if (stock_room_goodpos(sroom, sh, sx, sy, map)) {
                stockcount++;
            }
        }
    }
    if (stockcount > 0) {
        specialspot = rnd(stockcount);
    }

    // C ref: shknam.c:781-787 — stock each valid position
    stockcount = 0;
    for (let sx = sroom.lx; sx <= sroom.hx; sx++) {
        for (let sy = sroom.ly; sy <= sroom.hy; sy++) {
            if (stock_room_goodpos(sroom, sh, sx, sy, map)) {
                stockcount++;
                mkshobj_at(shp, shp_indx, sx, sy,
                    (stockcount !== 0) && (stockcount === specialspot),
                    map, depth);
            }
        }
    }

    // C ref: shknam.c:800 — set level flag
    if (!map.flags) map.flags = {};
    map.flags.has_shop = true;
}
