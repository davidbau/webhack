// topten.js -- High score list persistence and display
// C ref: topten.c — struct toptenentry, topten(), outentry()

const TOPTEN_KEY = 'menace-topten';
const MAX_ENTRIES = 100; // C ref: sysopt.entrymax

// Safe localStorage access
function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; }
    catch (e) { return null; }
}

// Load all high scores from localStorage.
// Returns sorted array (highest first), or [] if none.
export function loadScores() {
    const s = storage();
    if (!s) return [];
    try {
        const json = s.getItem(TOPTEN_KEY);
        if (!json) return [];
        const data = JSON.parse(json);
        if (!Array.isArray(data)) return [];
        return data;
    } catch (e) {
        return [];
    }
}

// Save a new score entry. Inserts in sorted order, trims to MAX_ENTRIES.
// Returns the rank (1-based) of the new entry, or -1 if it didn't make the list.
export function saveScore(entry) {
    const s = storage();
    if (!s) return -1;
    try {
        const scores = loadScores();
        // Find insertion point (sorted descending by points)
        let rank = scores.length;
        for (let i = 0; i < scores.length; i++) {
            if (entry.points > scores[i].points) {
                rank = i;
                break;
            }
        }
        scores.splice(rank, 0, entry);
        // Trim to max
        if (scores.length > MAX_ENTRIES) {
            scores.length = MAX_ENTRIES;
        }
        s.setItem(TOPTEN_KEY, JSON.stringify(scores));
        // Return rank if entry is still in list
        if (rank < scores.length) return rank + 1; // 1-based
        return -1;
    } catch (e) {
        return -1;
    }
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Build a TopTenEntry object from game state.
// C ref: topten.c topten() — populates struct toptenentry
// Takes roles/races arrays to avoid circular import.
export function buildEntry(player, gameOverReason, roles, races) {
    const now = new Date();
    const dateNum = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();

    const role = roles[player.roleIndex];
    const race = races[player.race];

    return {
        points: player.score,
        deathlev: player.dungeonLevel,
        maxlvl: player.maxDungeonLevel,
        hp: player.hp,
        maxhp: player.hpmax,
        name: player.name,
        death: player.deathCause || gameOverReason || 'died',
        plrole: role ? role.abbr : '???',
        plrace: race ? capitalize(race.name) : '???',
        plgend: player.gender === 1 ? 'Fem' : 'Mal',
        plalign: player.alignment > 0 ? 'Law' : player.alignment < 0 ? 'Cha' : 'Neu',
        deathdate: dateNum,
        birthdate: dateNum,
        turns: player.turns,
    };
}

// Format a single topten entry for display.
// C ref: topten.c outentry() lines 945-1107
// Returns an array of lines (name line + death cause + stats).
export function formatTopTenEntry(entry, rank) {
    const nameStr = `${entry.name}-${entry.plrole}-${entry.plrace}-${entry.plgend}-${entry.plalign}`;
    const hpStr = entry.hp > 0 ? String(entry.hp) : '-';
    const line1 = `${String(rank).padStart(3)}  ${String(entry.points).padStart(9)}  ${nameStr}`;
    const line2 = `                  ${entry.death}`;
    const line3 = `                  on dungeon level ${entry.deathlev} [max ${entry.maxlvl}].  HP: ${hpStr} [${entry.maxhp}].  T:${entry.turns}`;
    return [line1, line2, line3];
}

// Format the header line for the topten display.
export function formatTopTenHeader() {
    return ` No       Points  Name`;
}

// Find where a new entry ranks among existing scores.
// Returns 1-based rank, or scores.length+1 if it would be last.
export function getPlayerRank(scores, newEntry) {
    for (let i = 0; i < scores.length; i++) {
        if (newEntry.points > scores[i].points) {
            return i + 1;
        }
    }
    return scores.length + 1;
}

// Get the topten localStorage key (for storage.js integration)
export { TOPTEN_KEY };
