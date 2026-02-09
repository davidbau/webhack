// selfplay/brain/danger.js -- Monster danger assessment
//
// Basic threat evaluation based on spoiler knowledge.
// Helps the agent decide whether to attack, flee, or avoid monsters.

/**
 * Danger levels for different situations
 */
export const DangerLevel = {
    SAFE: 0,        // No real threat
    LOW: 1,         // Minor threat, safe to engage
    MEDIUM: 2,      // Moderate threat, engage with caution
    HIGH: 3,        // Serious threat, flee if low HP
    CRITICAL: 4,    // Extreme threat, always flee
    INSTADEATH: 5,  // Never melee (floating eyes, etc.)
};

/**
 * Monster classes that should NEVER be meleed (instadeath/paralysis risk)
 */
const NEVER_MELEE = new Set([
    'e',  // floating eyes - paralyze on melee hit
    'c',  // cockatrice - touch = petrification (unless wearing gloves)
]);

/**
 * Monster classes that are generally dangerous
 */
const DANGEROUS_CLASSES = new Set([
    'D',  // dragons - powerful breath weapons
    'L',  // liches - dangerous spellcasters
    'V',  // vampires - drain levels
    'h',  // mind flayers (lowercase h in humanoids) - drain intelligence
    '&',  // demons - major threats
    '@',  // hostile humans - includes Wizard of Yendor
    'H',  // giants - strong melee
    'T',  // trolls - regenerate
    'U',  // umber hulks - confuse on sight
]);

/**
 * Assess the danger level of a monster.
 *
 * @param {string} monsterChar - The character representing the monster
 * @param {number} playerHP - Current player HP
 * @param {number} playerMaxHP - Player's maximum HP
 * @param {number} playerLevel - Player's experience level (XL)
 * @returns {number} - DangerLevel constant
 */
export function assessMonsterDanger(monsterChar, playerHP, playerMaxHP, playerLevel = 1) {
    // Never melee floating eyes or cockatrices
    if (NEVER_MELEE.has(monsterChar)) {
        return DangerLevel.INSTADEATH;
    }

    // Uppercase = more dangerous (with some exceptions)
    const isUppercase = monsterChar === monsterChar.toUpperCase() && monsterChar.match(/[A-Z]/);

    // Check against known dangerous classes
    if (DANGEROUS_CLASSES.has(monsterChar)) {
        return DangerLevel.HIGH;
    }

    // Uppercase monsters are generally more threatening
    if (isUppercase) {
        // If we're low level or low HP, treat uppercase as high danger
        if (playerLevel < 5 || playerHP < playerMaxHP * 0.5) {
            return DangerLevel.HIGH;
        }
        return DangerLevel.MEDIUM;
    }

    // Lowercase monsters are generally safe for early game
    // But still dangerous if we're very weak
    if (playerHP < playerMaxHP * 0.3) {
        return DangerLevel.MEDIUM;
    }

    return DangerLevel.LOW;
}

/**
 * Decide whether to engage a monster in combat.
 *
 * @param {string} monsterChar - The monster character
 * @param {number} playerHP - Current HP
 * @param {number} playerMaxHP - Max HP
 * @param {number} playerLevel - Experience level
 * @returns {Object} - { shouldEngage: boolean, reason: string }
 */
export function shouldEngageMonster(monsterChar, playerHP, playerMaxHP, playerLevel = 1) {
    const danger = assessMonsterDanger(monsterChar, playerHP, playerMaxHP, playerLevel);

    if (danger === DangerLevel.INSTADEATH) {
        return {
            shouldEngage: false,
            reason: `never melee ${monsterChar} (instadeath/paralysis risk)`,
        };
    }

    if (danger === DangerLevel.CRITICAL) {
        return {
            shouldEngage: false,
            reason: `${monsterChar} is too dangerous (critical threat)`,
        };
    }

    if (danger === DangerLevel.HIGH) {
        // Only engage high-danger monsters if we're in good shape
        if (playerHP < playerMaxHP * 0.6) {
            return {
                shouldEngage: false,
                reason: `${monsterChar} is dangerous and HP is low (${playerHP}/${playerMaxHP})`,
            };
        }
        // Proceed with caution
        return {
            shouldEngage: true,
            reason: `engaging ${monsterChar} (high danger, but HP good)`,
        };
    }

    if (danger === DangerLevel.MEDIUM) {
        // Engage medium-danger monsters unless critically low HP
        if (playerHP < playerMaxHP * 0.4) {
            return {
                shouldEngage: false,
                reason: `${monsterChar} is risky and HP is low (${playerHP}/${playerMaxHP})`,
            };
        }
        return {
            shouldEngage: true,
            reason: `engaging ${monsterChar} (medium danger)`,
        };
    }

    // LOW or SAFE - always engage
    return {
        shouldEngage: true,
        reason: `attacking ${monsterChar}`,
    };
}

/**
 * Simple monster name lookup for common monsters (for better logging)
 */
export const MONSTER_NAMES = {
    'd': 'dog',
    'f': 'cat',
    'e': 'floating eye',
    'g': 'gnome',
    'k': 'kobold',
    'r': 'rat/rodent',
    'a': 'ant',
    'b': 'blob',
    'c': 'cockatrice',
    'i': 'imp',
    'j': 'jelly',
    ':': 'lizard',
    'D': 'dragon',
    'H': 'giant',
    'L': 'lich',
    'V': 'vampire',
    'T': 'troll',
    '&': 'demon',
    '@': 'human',
};

/**
 * Get a friendly name for a monster character
 */
export function getMonsterName(monsterChar) {
    return MONSTER_NAMES[monsterChar] || `monster(${monsterChar})`;
}
