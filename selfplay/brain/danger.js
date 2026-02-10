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
 * Monster classes that are very dangerous (avoid when weak)
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
 * Early-game threats (risky but not instant death)
 */
const EARLY_THREATS = new Set([
    'N',  // nymphs - steal items and teleport (annoying, fight from range if possible)
    'b',  // blobs - acid blobs do passive acid damage
    'j',  // jellies - passive acid damage on melee
    'F',  // fungi - shriekers summon monsters
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

    // Early-game threats (nymphs, blobs, jellies, fungi)
    // These are annoying/risky but not instant death
    if (EARLY_THREATS.has(monsterChar)) {
        // At low levels or low HP, these are quite dangerous
        if (playerLevel < 3 || playerHP < playerMaxHP * 0.5) {
            return DangerLevel.HIGH;
        }
        return DangerLevel.MEDIUM;
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
export function shouldEngageMonster(monsterChar, playerHP, playerMaxHP, playerLevel = 1, isBlocking = false) {
    const danger = assessMonsterDanger(monsterChar, playerHP, playerMaxHP, playerLevel);

    // Strategy: FLEE MORE, FIGHT LESS
    // Only fight when necessary (blocking path or already attacking)
    // Target: <20% of turns in combat (down from 53%)

    if (danger === DangerLevel.INSTADEATH) {
        return {
            shouldEngage: false,
            shouldFlee: true,
            ignore: false,
            reason: `never melee ${monsterChar} (instadeath/paralysis risk)`,
        };
    }

    if (danger === DangerLevel.CRITICAL) {
        return {
            shouldEngage: false,
            shouldFlee: true,
            ignore: false,
            reason: `${monsterChar} is too dangerous (critical threat)`,
        };
    }

    if (danger === DangerLevel.HIGH) {
        // NEVER engage high-danger monsters unless absolutely forced
        if (!isBlocking) {
            return {
                shouldEngage: false,
                shouldFlee: true,
                ignore: false,
                reason: `avoiding ${monsterChar} (high danger, not worth the fight)`,
            };
        }
        // Even if blocking, need good HP
        if (playerHP < playerMaxHP * 0.7) {
            return {
                shouldEngage: false,
                shouldFlee: true,
                ignore: false,
                reason: `${monsterChar} blocks path but HP too low (${playerHP}/${playerMaxHP})`,
            };
        }
        return {
            shouldEngage: true,
            shouldFlee: false,
            ignore: false,
            reason: `forced to fight ${monsterChar} (blocking path, HP adequate)`,
        };
    }

    if (danger === DangerLevel.MEDIUM) {
        // Avoid medium-danger monsters unless they're blocking
        if (!isBlocking) {
            return {
                shouldEngage: false,
                shouldFlee: true,
                ignore: false,
                reason: `avoiding ${monsterChar} (medium danger, not worth the fight)`,
            };
        }
        // If blocking, need reasonable HP
        if (playerHP < playerMaxHP * 0.5) {
            return {
                shouldEngage: false,
                shouldFlee: true,
                ignore: false,
                reason: `${monsterChar} blocks path but HP low (${playerHP}/${playerMaxHP})`,
            };
        }
        return {
            shouldEngage: true,
            shouldFlee: false,
            ignore: false,
            reason: `fighting ${monsterChar} (blocking path)`,
        };
    }

    // LOW or SAFE
    // For harmless monsters, IGNORE them - don't fight, don't flee, just explore
    if (!isBlocking && danger === DangerLevel.LOW) {
        return {
            shouldEngage: false,
            shouldFlee: false,  // Don't flee from harmless monsters
            ignore: true,
            reason: `ignoring harmless ${monsterChar}`,
        };
    }

    // Safe monsters or blocking low-danger: OK to fight
    return {
        shouldEngage: true,
        shouldFlee: false,
        ignore: false,
        reason: `attacking ${monsterChar}${isBlocking ? ' (blocking)' : ''}`,
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
    'F': 'fungi',
    'H': 'giant',
    'L': 'lich',
    'N': 'nymph',
    'T': 'troll',
    'U': 'umber hulk',
    'V': 'vampire',
    '&': 'demon',
    '@': 'human',
};

/**
 * Get a friendly name for a monster character
 */
export function getMonsterName(monsterChar) {
    return MONSTER_NAMES[monsterChar] || `monster(${monsterChar})`;
}
