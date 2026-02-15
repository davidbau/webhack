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
 * Dlvl 3-5 specific threats
 */
const MID_GAME_THREATS = new Set([
    's',  // giant spider - level 5, AC 4, speed 15, poisonous!
    'S',  // snake - poisonous
    'q',  // rothe - appears in herds (group threat)
    'o',  // hill orc - level 2, appears in groups
    'g',  // hobgoblin - level 1, but common on Dlvl 3-5
    'Z',  // dwarf zombie - level 2, undead
    'w',  // worm - can grow large
]);

/**
 * Assess the danger level of a monster.
 *
 * @param {string} monsterChar - The character representing the monster
 * @param {number} playerHP - Current player HP
 * @param {number} playerMaxHP - Player's maximum HP
 * @param {number} playerLevel - Player's experience level (XL)
 * @param {number} dungeonLevel - Current dungeon level (for context)
 * @returns {number} - DangerLevel constant
 */
export function assessMonsterDanger(monsterChar, playerHP, playerMaxHP, playerLevel = 1, dungeonLevel = 1) {
    // Never melee floating eyes or cockatrices
    if (NEVER_MELEE.has(monsterChar)) {
        return DangerLevel.INSTADEATH;
    }

    // Rats ('r') are always hostile and should be fought/fled, never ignored
    // Treat as MEDIUM danger to ensure we engage or flee (not ignore like LOW danger)
    if (monsterChar === 'r') {
        return DangerLevel.MEDIUM;
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

    // Dlvl 3-5 specific threats
    // These are more dangerous than basic monsters but manageable with good HP
    if (MID_GAME_THREATS.has(monsterChar)) {
        // Giant spiders are especially dangerous (poisonous, fast)
        if (monsterChar === 's' && dungeonLevel >= 3) {
            if (playerLevel < 4 || playerHP < playerMaxHP * 0.7) {
                return DangerLevel.HIGH;
            }
            return DangerLevel.MEDIUM;
        }
        // Other mid-game threats
        if (playerLevel < 3 || playerHP < playerMaxHP * 0.6) {
            return DangerLevel.MEDIUM;
        }
        return DangerLevel.LOW;
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
 * Count nearby hostile monsters.
 *
 * @param {Array} monsters - List of monster objects with {ch, x, y}
 * @param {number} playerX - Player X position
 * @param {number} playerY - Player Y position
 * @param {number} range - Maximum distance to count (default 3)
 * @returns {number} - Count of nearby hostile monsters
 */
export function countNearbyMonsters(monsters, playerX, playerY, range = 3) {
    let count = 0;
    for (const monster of monsters) {
        const dist = Math.max(Math.abs(monster.x - playerX), Math.abs(monster.y - playerY));
        if (dist <= range && dist > 0) {
            count++;
        }
    }
    return count;
}

/**
 * Decide whether to engage a monster in combat.
 *
 * @param {string} monsterChar - The monster character
 * @param {number} playerHP - Current HP
 * @param {number} playerMaxHP - Max HP
 * @param {number} playerLevel - Experience level
 * @param {boolean} isBlocking - Is monster blocking our path?
 * @param {number} dungeonLevel - Current dungeon level
 * @param {number} nearbyMonsterCount - Count of other nearby monsters
 * @param {boolean} inCorridor - Are we in a corridor (tactical advantage)?
 * @returns {Object} - { shouldEngage: boolean, shouldFlee: boolean, ignore: boolean, reason: string }
 */
export function shouldEngageMonster(
    monsterChar,
    playerHP,
    playerMaxHP,
    playerLevel = 1,
    isBlocking = false,
    dungeonLevel = 1,
    nearbyMonsterCount = 0,
    inCorridor = false
) {
    const danger = assessMonsterDanger(monsterChar, playerHP, playerMaxHP, playerLevel, dungeonLevel);
    const hpRatio = playerMaxHP > 0 ? (playerHP / playerMaxHP) : 0;

    // Early Dlvl-1 canine handling:
    // Lone hostile dogs are a common early death source if we keep yielding space.
    // Prefer decisive melee when reasonably healthy; flee only if already weak/outnumbered.
    if (monsterChar === 'd' && dungeonLevel <= 1 && nearbyMonsterCount === 0) {
        if (hpRatio >= 0.45) {
            return {
                shouldEngage: true,
                shouldFlee: false,
                ignore: false,
                reason: `engaging lone dog on Dlvl 1 (HP ${playerHP}/${playerMaxHP})`,
            };
        }
        return {
            shouldEngage: false,
            shouldFlee: true,
            ignore: false,
            reason: `avoiding lone dog on Dlvl 1 due to low HP (${playerHP}/${playerMaxHP})`,
        };
    }

    // Strategy: FLEE MORE, FIGHT LESS
    // Only fight when necessary (blocking path or already attacking)
    // Target: <20% of turns in combat (down from 53%)
    //
    // New tactical considerations:
    // 1. Multiple monsters = higher danger (risk of being surrounded)
    // 2. Corridors = tactical advantage (monsters can't surround us)
    // 3. Open rooms = tactical disadvantage (can be surrounded)

    // CRITICAL: Never engage when outnumbered unless in a corridor
    // Being surrounded is extremely dangerous even against weak monsters
    if (nearbyMonsterCount >= 2 && !inCorridor) {
        return {
            shouldEngage: false,
            shouldFlee: true,
            ignore: false,
            reason: `outnumbered (${nearbyMonsterCount + 1} monsters) in open space - flee to corridor`,
        };
    }

    // Even in corridor, don't engage multiple HIGH/CRITICAL threats
    if (nearbyMonsterCount >= 2 && danger >= DangerLevel.HIGH) {
        return {
            shouldEngage: false,
            shouldFlee: true,
            ignore: false,
            reason: `multiple dangerous monsters (${nearbyMonsterCount + 1} total) - too risky`,
        };
    }

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

    // LOW or SAFE danger
    // For weak/harmless monsters, IGNORE them - don't fight, don't flee, just walk through
    // When blocking, NetHack will auto-swap positions ("You swap places with your kitten.")
    // Note: Rats are upgraded to MEDIUM danger, so they won't be ignored
    if (danger === DangerLevel.LOW || danger === DangerLevel.SAFE) {
        return {
            shouldEngage: false,
            shouldFlee: false,
            ignore: true,
            reason: isBlocking ? `walking through harmless ${monsterChar} (blocking)` : `ignoring harmless ${monsterChar}`,
        };
    }

    // Unknown/default: engage cautiously
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
    's': 'giant spider',
    'S': 'snake',
    'q': 'rothe',
    'o': 'hill orc',
    'w': 'worm',
    'Z': 'dwarf zombie',
    'D': 'dragon',
    'F': 'fungi',
    'G': 'gnome lord',
    'H': 'giant',
    'L': 'lich',
    'N': 'nymph',
    'O': 'ogre',
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
