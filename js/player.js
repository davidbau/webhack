// player.js -- Player state and actions
// Mirrors struct you from you.h and player-related globals from decl.h

import { A_STR, A_INT, A_WIS, A_DEX, A_CON, A_CHA, NUM_ATTRS,
         NORMAL_SPEED, A_NEUTRAL, A_LAWFUL, A_CHAOTIC,
         RACE_HUMAN, RACE_ELF, RACE_DWARF, RACE_GNOME, RACE_ORC,
         FEMALE, MALE } from './config.js';
import { M2_HUMAN, M2_ELF, M2_DWARF, M2_GNOME, M2_ORC } from './monsters.js';

// Roles table -- from role.c
// C ref: src/role.c roles[] array
// Gods: names starting with '_' indicate a goddess (strip underscore for display)
export const roles = [
    { name: 'Archeologist', abbr: 'Arc', str: 7, int: 10, wis: 10, dex: 7, con: 7, cha: 7,
      startingHP: 11, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null,
      namef: null,
      validRaces: [RACE_HUMAN, RACE_DWARF, RACE_GNOME],
      validAligns: [A_LAWFUL, A_NEUTRAL],
      forceGender: null,
      gods: ['Quetzalcoatl', 'Camaxtli', 'Huhetotl'],
      ranks: [
        {m:'Digger',f:'Digger'}, {m:'Field Worker',f:'Field Worker'},
        {m:'Investigator',f:'Investigator'}, {m:'Exhumer',f:'Exhumer'},
        {m:'Excavator',f:'Excavator'}, {m:'Spelunker',f:'Spelunker'},
        {m:'Speleologist',f:'Speleologist'}, {m:'Collector',f:'Collector'},
        {m:'Curator',f:'Curator'}
      ],
      greeting: 'Hello',
      menuChar: 'a', menuArticle: 'an' },
    { name: 'Barbarian', abbr: 'Bar', str: 16, int: 7, wis: 7, dex: 15, con: 16, cha: 6,
      startingHP: 14, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null,
      namef: null,
      validRaces: [RACE_HUMAN, RACE_ORC],
      validAligns: [A_NEUTRAL, A_CHAOTIC],
      forceGender: null,
      gods: ['Mitra', 'Crom', 'Set'],
      ranks: [
        {m:'Plunderer',f:'Plunderess'}, {m:'Pillager',f:'Pillager'},
        {m:'Bandit',f:'Bandit'}, {m:'Brigand',f:'Brigand'},
        {m:'Raider',f:'Raider'}, {m:'Reaver',f:'Reaver'},
        {m:'Slayer',f:'Slayer'}, {m:'Chieftain',f:'Chieftainess'},
        {m:'Conqueror',f:'Conqueress'}
      ],
      greeting: 'Hello',
      menuChar: 'b', menuArticle: 'a' },
    { name: 'Caveman', abbr: 'Cav', str: 10, int: 7, wis: 7, dex: 7, con: 8, cha: 6,
      startingHP: 14, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: 'dog',
      namef: 'Cavewoman',
      validRaces: [RACE_HUMAN, RACE_DWARF, RACE_GNOME],
      validAligns: [A_LAWFUL, A_NEUTRAL],
      forceGender: null,
      gods: ['Anu', '_Ishtar', 'Anshar'],
      ranks: [
        {m:'Troglodyte',f:'Troglodyte'}, {m:'Aborigine',f:'Aborigine'},
        {m:'Wanderer',f:'Wanderer'}, {m:'Vagrant',f:'Vagrant'},
        {m:'Wayfarer',f:'Wayfarer'}, {m:'Roamer',f:'Roamer'},
        {m:'Nomad',f:'Nomad'}, {m:'Rover',f:'Rover'},
        {m:'Pioneer',f:'Pioneer'}
      ],
      greeting: 'Hello',
      menuChar: 'c', menuArticle: 'a' },
    { name: 'Healer', abbr: 'Hea', str: 7, int: 7, wis: 13, dex: 7, con: 11, cha: 16,
      startingHP: 11, startingPW: 1, enadv: 4, align: A_NEUTRAL, petType: null,
      namef: null,
      validRaces: [RACE_HUMAN, RACE_GNOME],
      validAligns: [A_NEUTRAL],
      forceGender: null,
      gods: ['_Athena', 'Hermes', 'Poseidon'],
      ranks: [
        {m:'Rhizotomist',f:'Rhizotomist'}, {m:'Empiric',f:'Empiric'},
        {m:'Embalmer',f:'Embalmer'}, {m:'Dresser',f:'Dresser'},
        {m:'Medicus ossium',f:'Medica ossium'}, {m:'Herbalist',f:'Herbalist'},
        {m:'Magister',f:'Magistra'}, {m:'Physician',f:'Physician'},
        {m:'Chirurgeon',f:'Chirurgeon'}
      ],
      greeting: 'Hello',
      menuChar: 'h', menuArticle: 'a' },
    { name: 'Knight', abbr: 'Kni', str: 13, int: 7, wis: 14, dex: 8, con: 10, cha: 17,
      startingHP: 14, startingPW: 1, enadv: 4, align: A_LAWFUL, petType: 'pony',
      namef: null,
      validRaces: [RACE_HUMAN],
      validAligns: [A_LAWFUL],
      forceGender: null,
      gods: ['Lugh', '_Brigit', 'Manannan Mac Lir'],
      ranks: [
        {m:'Gallant',f:'Gallant'}, {m:'Esquire',f:'Esquire'},
        {m:'Bachelor',f:'Bachelor'}, {m:'Sergeant',f:'Sergeant'},
        {m:'Knight',f:'Dame'}, {m:'Banneret',f:'Banneret'},
        {m:'Chevalier',f:'Chevaliere'}, {m:'Seignieur',f:'Dame'},
        {m:'Paladin',f:'Paladin'}
      ],
      greeting: 'Salutations',
      menuChar: 'k', menuArticle: 'a' },
    { name: 'Monk', abbr: 'Mon', str: 10, int: 7, wis: 8, dex: 8, con: 7, cha: 7,
      startingHP: 12, startingPW: 2, enadv: 2, align: A_NEUTRAL, petType: null,
      namef: null,
      validRaces: [RACE_HUMAN],
      validAligns: [A_LAWFUL, A_NEUTRAL, A_CHAOTIC],
      forceGender: null,
      gods: ['Shan Lai Ching', 'Chih Sung-tzu', 'Huan Ti'],
      ranks: [
        {m:'Bonze',f:'Bonze'}, {m:'Mendicant',f:'Mendicant'},
        {m:'Acolyte',f:'Acolyte'}, {m:'Monk',f:'Nun'},
        {m:'Lama',f:'Lama'}, {m:'Abbot',f:'Abbess'},
        {m:'Guru',f:'Guru'}, {m:'Swami',f:'Swami'},
        {m:'Grand Master',f:'Grand Master'}
      ],
      greeting: 'Hello',
      menuChar: 'm', menuArticle: 'a' },
    { name: 'Priest', abbr: 'Pri', str: 7, int: 7, wis: 10, dex: 7, con: 7, cha: 7,
      startingHP: 12, startingPW: 4, enadv: 3, align: A_NEUTRAL, petType: null,
      namef: 'Priestess',
      validRaces: [RACE_HUMAN, RACE_ELF],
      validAligns: [A_LAWFUL, A_NEUTRAL, A_CHAOTIC],
      forceGender: null,
      gods: [null, null, null],  // Priest has no fixed gods; assigned at role_init from random role's pantheon
      ranks: [
        {m:'Aspirant',f:'Aspirant'}, {m:'Acolyte',f:'Acolyte'},
        {m:'Adept',f:'Adept'}, {m:'Priest',f:'Priestess'},
        {m:'Curate',f:'Curate'}, {m:'Canon',f:'Canoness'},
        {m:'Lama',f:'Lama'}, {m:'Patriarch',f:'Matriarch'},
        {m:'High Priest',f:'High Priestess'}
      ],
      greeting: 'Hello',
      menuChar: 'p', menuArticle: 'a' },
    { name: 'Rogue', abbr: 'Rog', str: 7, int: 7, wis: 7, dex: 10, con: 7, cha: 6,
      startingHP: 10, startingPW: 1, enadv: 0, align: A_CHAOTIC, petType: null,
      namef: null,
      validRaces: [RACE_HUMAN, RACE_ORC],
      validAligns: [A_CHAOTIC],
      forceGender: null,
      gods: ['Issek', 'Mog', 'Kos'],
      ranks: [
        {m:'Footpad',f:'Footpad'}, {m:'Cutpurse',f:'Cutpurse'},
        {m:'Rogue',f:'Rogue'}, {m:'Pilferer',f:'Pilferer'},
        {m:'Robber',f:'Robber'}, {m:'Burglar',f:'Burglar'},
        {m:'Filcher',f:'Filcher'}, {m:'Magsman',f:'Magswoman'},
        {m:'Thief',f:'Thief'}
      ],
      greeting: 'Hello',
      menuChar: 'r', menuArticle: 'a' },
    { name: 'Ranger', abbr: 'Ran', str: 13, int: 13, wis: 13, dex: 9, con: 13, cha: 7,
      startingHP: 13, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: 'dog',
      namef: null,
      validRaces: [RACE_HUMAN, RACE_ELF, RACE_GNOME, RACE_ORC],
      validAligns: [A_NEUTRAL, A_CHAOTIC],
      forceGender: null,
      gods: ['Mercury', '_Venus', 'Mars'],
      ranks: [
        {m:'Tenderfoot',f:'Tenderfoot'}, {m:'Lookout',f:'Lookout'},
        {m:'Trailblazer',f:'Trailblazer'}, {m:'Reconnoiterer',f:'Reconnoiteress'},
        {m:'Scout',f:'Scout'}, {m:'Arbalester',f:'Arbalester'},
        {m:'Archer',f:'Archer'}, {m:'Sharpshooter',f:'Sharpshooter'},
        {m:'Ranger',f:'Ranger'}
      ],
      greeting: 'Hello',
      menuChar: 'R', menuArticle: 'a' },
    { name: 'Samurai', abbr: 'Sam', str: 10, int: 8, wis: 7, dex: 10, con: 17, cha: 6,
      startingHP: 13, startingPW: 1, enadv: 0, align: A_LAWFUL, petType: 'dog',
      namef: null,
      validRaces: [RACE_HUMAN],
      validAligns: [A_LAWFUL],
      forceGender: null,
      gods: ['_Amaterasu Omikami', 'Raijin', 'Susanowo'],
      ranks: [
        {m:'Hatamoto',f:'Hatamoto'}, {m:'Ronin',f:'Ronin'},
        {m:'Ninja',f:'Kunoichi'}, {m:'Joshu',f:'Joshu'},
        {m:'Ryoshu',f:'Ryoshu'}, {m:'Kokushu',f:'Kokushu'},
        {m:'Daimyo',f:'Daimyo'}, {m:'Kuge',f:'Kuge'},
        {m:'Shogun',f:'Shogun'}
      ],
      greeting: 'Konnichi wa',
      menuChar: 's', menuArticle: 'a' },
    { name: 'Tourist', abbr: 'Tou', str: 7, int: 10, wis: 6, dex: 7, con: 7, cha: 10,
      startingHP: 8, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null,
      namef: null,
      validRaces: [RACE_HUMAN],
      validAligns: [A_NEUTRAL],
      forceGender: null,
      gods: ['Blind Io', '_The Lady', 'Offler'],
      ranks: [
        {m:'Rambler',f:'Rambler'}, {m:'Sightseer',f:'Sightseer'},
        {m:'Excursionist',f:'Excursionist'}, {m:'Peregrinator',f:'Peregrinatrix'},
        {m:'Traveler',f:'Traveler'}, {m:'Journeyer',f:'Journeyer'},
        {m:'Voyager',f:'Voyager'}, {m:'Explorer',f:'Explorer'},
        {m:'Adventurer',f:'Adventurer'}
      ],
      greeting: 'Hello',
      menuChar: 't', menuArticle: 'a' },
    { name: 'Valkyrie', abbr: 'Val', str: 10, int: 7, wis: 7, dex: 7, con: 10, cha: 7,
      startingHP: 14, startingPW: 1, enadv: 0, align: A_NEUTRAL, petType: null,
      namef: null,
      validRaces: [RACE_HUMAN, RACE_DWARF],
      validAligns: [A_LAWFUL, A_NEUTRAL],
      forceGender: 'female',
      gods: ['Tyr', 'Odin', 'Loki'],
      ranks: [
        {m:'Stripling',f:'Stripling'}, {m:'Skirmisher',f:'Skirmisher'},
        {m:'Fighter',f:'Fighter'}, {m:'Man-at-arms',f:'Woman-at-arms'},
        {m:'Warrior',f:'Warrior'}, {m:'Swashbuckler',f:'Swashbuckler'},
        {m:'Hero',f:'Heroine'}, {m:'Champion',f:'Champion'},
        {m:'Lord',f:'Lady'}
      ],
      greeting: 'Velkommen',
      menuChar: 'v', menuArticle: 'a' },
    { name: 'Wizard', abbr: 'Wiz', str: 7, int: 10, wis: 7, dex: 7, con: 7, cha: 7,
      startingHP: 10, startingPW: 4, enadv: 3, align: A_NEUTRAL, petType: 'cat',
      namef: null,
      validRaces: [RACE_HUMAN, RACE_ELF, RACE_GNOME, RACE_ORC],
      validAligns: [A_NEUTRAL, A_CHAOTIC],
      forceGender: null,
      gods: ['Ptah', 'Thoth', 'Anhur'],
      ranks: [
        {m:'Evoker',f:'Evoker'}, {m:'Conjurer',f:'Conjurer'},
        {m:'Thaumaturge',f:'Thaumaturge'}, {m:'Magician',f:'Magician'},
        {m:'Enchanter',f:'Enchantress'}, {m:'Sorcerer',f:'Sorceress'},
        {m:'Necromancer',f:'Necromancer'}, {m:'Wizard',f:'Wizard'},
        {m:'Mage',f:'Mage'}
      ],
      greeting: 'Hello',
      menuChar: 'w', menuArticle: 'a' },
];

// Races table -- from role.c
// C ref: src/role.c races[] array
export const races = [
    { name: 'human', adj: 'human', validAligns: [A_LAWFUL, A_NEUTRAL, A_CHAOTIC],
      menuChar: 'h', hpBonus: 2, pwBonus: 1,
      selfmask: M2_HUMAN, lovemask: 0, hatemask: M2_GNOME | M2_ORC,
      attrmin: [3,3,3,3,3,3], attrmax: [18,18,18,18,18,18] },
    { name: 'elf', adj: 'elven', validAligns: [A_CHAOTIC],
      menuChar: 'e', hpBonus: 1, pwBonus: 2,
      selfmask: M2_ELF, lovemask: M2_ELF, hatemask: M2_ORC,
      attrmin: [3,3,3,3,3,3], attrmax: [18,18,18,18,16,18] },
    { name: 'dwarf', adj: 'dwarven', validAligns: [A_LAWFUL],
      menuChar: 'd', hpBonus: 4, pwBonus: 0,
      selfmask: M2_DWARF, lovemask: M2_DWARF | M2_GNOME, hatemask: M2_ORC,
      attrmin: [3,3,3,3,3,3], attrmax: [18,16,18,18,20,16] },
    { name: 'gnome', adj: 'gnomish', validAligns: [A_NEUTRAL],
      menuChar: 'g', hpBonus: 1, pwBonus: 2,
      selfmask: M2_GNOME, lovemask: M2_DWARF | M2_GNOME, hatemask: M2_HUMAN,
      attrmin: [3,3,3,3,3,3], attrmax: [18,19,18,18,18,18] },
    { name: 'orc', adj: 'orcish', validAligns: [A_CHAOTIC],
      menuChar: 'o', hpBonus: 1, pwBonus: 1,
      selfmask: M2_ORC, lovemask: 0, hatemask: M2_HUMAN | M2_ELF | M2_DWARF,
      attrmin: [3,3,3,3,3,3], attrmax: [18,16,16,18,18,16] },
];

// --- Chargen Helper Functions ---

// Returns indices of races valid for a given role
export function validRacesForRole(roleIdx) {
    const role = roles[roleIdx];
    if (!role) return [];
    return role.validRaces.slice();
}

// Returns valid alignment values for a given role+race combination (intersection)
export function validAlignsForRoleRace(roleIdx, raceIdx) {
    const role = roles[roleIdx];
    const race = races[raceIdx];
    if (!role || !race) return [];
    return role.validAligns.filter(a => race.validAligns.includes(a));
}

// Returns true if gender menu is needed (i.e. gender is not forced)
export function needsGenderMenu(roleIdx) {
    const role = roles[roleIdx];
    return !role || !role.forceGender;
}

// Returns the rank title for a given level, role, and gender
// C ref: role.c rank_of(level, role, female)
// Level 1 = rank 0, levels 2-5 = rank 1, etc.
export function rankOf(level, roleIdx, female) {
    const role = roles[roleIdx];
    if (!role) return 'Adventurer';
    // C ref: role.c rank_of() — rank thresholds: 0,3,6,10,14,18,22,26,30
    const thresholds = [0, 3, 6, 10, 14, 18, 22, 26, 30];
    let rankIdx = 0;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (level >= thresholds[i]) {
            rankIdx = i;
            break;
        }
    }
    const rank = role.ranks[rankIdx];
    return female ? rank.f : rank.m;
}

// Returns the deity name for a role+alignment
// C ref: role.c — gods[0]=lawful, gods[1]=neutral, gods[2]=chaotic
// Names starting with '_' are goddesses (strip the underscore)
export function godForRoleAlign(roleIdx, alignValue) {
    const role = roles[roleIdx];
    if (!role) return 'Unknown';
    let godIdx;
    if (alignValue > 0) godIdx = 0;       // lawful
    else if (alignValue === 0) godIdx = 1; // neutral
    else godIdx = 2;                        // chaotic
    const raw = role.gods[godIdx];
    if (!raw) return null; // Priest with no gods
    return raw.startsWith('_') ? raw.substring(1) : raw;
}

// Returns whether the deity is a goddess (name starts with '_' in the data)
export function isGoddess(roleIdx, alignValue) {
    const role = roles[roleIdx];
    if (!role) return false;
    let godIdx;
    if (alignValue > 0) godIdx = 0;
    else if (alignValue === 0) godIdx = 1;
    else godIdx = 2;
    const raw = role.gods[godIdx];
    if (!raw) return false;
    return raw.startsWith('_');
}

// Returns the greeting string for a role
export function greetingForRole(roleIdx) {
    const role = roles[roleIdx];
    return role ? role.greeting : 'Hello';
}

// Returns the role name, using female variant if applicable
export function roleNameForGender(roleIdx, female) {
    const role = roles[roleIdx];
    if (!role) return 'Adventurer';
    if (female && role.namef) return role.namef;
    return role.name;
}

// Returns the alignment name string
export function alignName(alignValue) {
    if (alignValue > 0) return 'lawful';
    if (alignValue < 0) return 'chaotic';
    return 'neutral';
}

// C ref: role.c roles[].initrecord
export function initialAlignmentRecordForRole(roleIndex) {
    switch (roleIndex) {
        case 0:  // Archeologist
        case 1:  // Barbarian
        case 3:  // Healer
        case 4:  // Knight
        case 5:  // Monk
        case 7:  // Rogue
        case 8:  // Ranger
        case 9:  // Samurai
            return 10;
        default:
            return 0;
    }
}

// Lore text template -- from quest.lua
// Substitutions: %d=deity name, %G=god/goddess, %r=rank title
export const LORE_TEXT_TEMPLATE = `It is written in the Book of %d:

    After the Creation, the cruel god Moloch rebelled
    against the authority of Marduk the Creator.
    Moloch stole from Marduk the most powerful of all
    the artifacts of the gods, the Amulet of Yendor,
    and he hid it in the dark cavities of Gehennom, the
    Under World, where he now lurks, and bides his time.

Your %G %d seeks to possess the Amulet, and with it
to gain deserved ascendance over the other gods.

You, a newly trained %r, have been heralded
from birth as the instrument of %d.  You are destined
to recover the Amulet for your deity, or die in the
attempt.  Your hour of destiny has come.  For the sake
of us all:  Go bravely with %d!`;

// Format lore text with specific values
export function formatLoreText(deityName, godOrGoddess, rankTitle) {
    return LORE_TEXT_TEMPLATE
        .replace(/%d/g, deityName)
        .replace(/%G/g, godOrGoddess)
        .replace(/%r/g, rankTitle);
}

export class Player {
    constructor() {
        // Position
        // C ref: you.h u.ux, u.uy
        this.x = 0;
        this.y = 0;

        // Identity
        this.name = 'Adventurer';
        this.roleIndex = 0;
        this.race = RACE_HUMAN;
        this.gender = 0;
        this.alignment = A_NEUTRAL;
        this.alignmentRecord = 0; // C ref: u.ualign.record
        this.alignmentAbuse = 0;  // C ref: u.ualign.abuse

        // Vital stats
        // C ref: you.h u.uhp, u.uhpmax, u.uen, u.uenmax
        this.hp = 12;
        this.hpmax = 12;
        this.pw = 1;     // power (mana)
        this.pwmax = 1;
        this.ac = 10;    // armor class (lower is better)
        this.level = 1;  // experience level
        this.exp = 0;    // experience points
        this.score = 0;

        // Attributes [STR, INT, WIS, DEX, CON, CHA]
        // C ref: attrib.h, you.h acurr/abon/amax/atemp etc.
        this.attributes = [10, 10, 10, 10, 10, 10];

        // Dungeon position
        this.dungeonLevel = 1;
        this.maxDungeonLevel = 1;

        // Resources
        this.gold = 0;

        // Hunger: 900 = normal starting value
        // C ref: you.h u.uhunger (starts at 900)
        this.hunger = 900;
        this.nutrition = 900;

        // Movement
        this.movement = NORMAL_SPEED;
        this.speed = NORMAL_SPEED;
        this.moved = false;

        // Luck
        // C ref: you.h u.uluck, u.moreluck
        this.luck = 0;
        this.moreluck = 0;

        // Status effects
        this.blind = false;
        this.confused = false;
        this.stunned = false;
        this.hallucinating = false;
        this.sick = false;
        this.foodpoisoned = false;

        // Inventory
        // C ref: decl.h invent (linked list in C, array in JS)
        this.inventory = [];

        // Equipment slots
        // C ref: decl.h uarm, uarmc, uarmh, etc.
        this.weapon = null;
        this.armor = null;
        this.shield = null;
        this.helmet = null;
        this.gloves = null;
        this.boots = null;
        this.cloak = null;
        this.amulet = null;
        this.leftRing = null;
        this.rightRing = null;

        // Turns
        this.turns = 0;

        // Death cause -- C ref: killer.name from end.c
        this.deathCause = '';

        // Display options
        this.showExp = true;
        this.showTime = false;
    }

    // Initialize player for a new game with a given role
    // C ref: u_init.c u_init()
    initRole(roleIndex) {
        this.roleIndex = roleIndex;
        const role = roles[roleIndex];
        if (!role) return;

        this.attributes[A_STR] = role.str;
        this.attributes[A_INT] = role.int;
        this.attributes[A_WIS] = role.wis;
        this.attributes[A_DEX] = role.dex;
        this.attributes[A_CON] = role.con;
        this.attributes[A_CHA] = role.cha;

        this.hp = role.startingHP;
        this.hpmax = role.startingHP;
        this.pw = role.startingPW;
        this.pwmax = role.startingPW;
        this.alignment = role.align;
        this.alignmentRecord = initialAlignmentRecordForRole(roleIndex);
        this.alignmentAbuse = 0;

        // Starting AC depends on role; default 10 = unarmored
        this.ac = 10;
    }

    // Get the role name
    get roleName() {
        return roles[this.roleIndex]?.name || 'Adventurer';
    }

    // Get strength display string (handles 18/xx notation)
    // C ref: attrib.c str_string()
    get strDisplay() {
        const s = this.attributes[A_STR];
        if (s <= 18) return String(s);
        if (s <= 21) return `18/${String((s - 18) * 25).padStart(2, '0')}`;
        if (s < 25) return '18/**';
        return String(s);
    }

    // Get to-hit bonus from strength
    // C ref: attrib.c abon()
    get strToHit() {
        const s = this.attributes[A_STR];
        if (s < 6) return -2;
        if (s < 8) return -1;
        if (s < 17) return 0;
        if (s <= 18) return 1;
        if (s <= 20) return 2;
        return 3;
    }

    // Get damage bonus from strength
    // C ref: attrib.c dbon()
    get strDamage() {
        const s = this.attributes[A_STR];
        if (s < 6) return -1;
        if (s < 16) return 0;
        if (s < 18) return 1;
        if (s === 18) return 2;
        if (s <= 20) return 3;
        if (s <= 22) return 4;
        return 6;
    }

    // Get AC bonus from dexterity
    get dexAC() {
        const d = this.attributes[A_DEX];
        if (d < 4) return 3;
        if (d < 6) return 2;
        if (d < 8) return 1;
        if (d < 14) return 0;
        if (d < 18) return -1;
        if (d <= 20) return -2;
        return -3;
    }

    // Add an item to inventory, assigning an inventory letter
    // C ref: invent.c addinv()
    addToInventory(obj) {
        // Find first unused inventory letter
        const usedLetters = new Set(this.inventory.map(o => o.invlet));
        const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const letter of letters) {
            if (!usedLetters.has(letter)) {
                obj.invlet = letter;
                break;
            }
        }
        this.inventory.push(obj);
        return obj;
    }

    // Remove item from inventory
    removeFromInventory(obj) {
        const idx = this.inventory.indexOf(obj);
        if (idx >= 0) {
            this.inventory.splice(idx, 1);
        }
    }

    // Get the effective AC (including dexterity bonus)
    get effectiveAC() {
        return this.ac + this.dexAC;
    }

    // Check if player is dead
    get isDead() {
        return this.hp <= 0;
    }

    // Take damage
    takeDamage(amount, source) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
        return this.hp <= 0;
    }

    // Heal
    heal(amount) {
        this.hp = Math.min(this.hp + amount, this.hpmax);
    }

}
