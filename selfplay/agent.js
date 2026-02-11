// selfplay/agent.js -- Top-level NetHack AI agent
//
// The agent's main perceive → decide → act loop. Uses the screen parser
// and map tracker for perception, the strategy/tactics modules for
// decisions, and sends commands through the platform adapter interface.

import { parseScreen, findMonsters, findStairs } from './perception/screen_parser.js';
import { parseStatus } from './perception/status_parser.js';
import { DungeonTracker } from './perception/map_tracker.js';
import { findPath, findExplorationTarget, findNearest, directionKey, directionDelta } from './brain/pathing.js';
import { shouldEngageMonster, getMonsterName, countNearbyMonsters, assessMonsterDanger, DangerLevel } from './brain/danger.js';
import { InventoryTracker } from './brain/inventory.js';
import { PrayerTracker } from './brain/prayer.js';
import { EquipmentManager } from './brain/equipment.js';

// Direction keys for movement toward a target
const DIR_KEYS = {
    '-1,-1': 'y', '0,-1': 'k', '1,-1': 'u',
    '-1,0':  'h',              '1,0':  'l',
    '-1,1':  'b', '0,1':  'j', '1,1':  'n',
};

/**
 * The NetHack AI agent.
 */
export class Agent {
    /**
     * @param {GameAdapter} adapter - Platform adapter for game I/O
     * @param {Object} [options]
     * @param {number} [options.maxTurns=10000] - Maximum turns before giving up
     * @param {number} [options.moveDelay=0] - Delay between moves in ms (for demo mode)
     * @param {function} [options.onTurn] - Callback after each turn: (turnInfo) => void
     * @param {function} [options.onPerceive] - Callback after screen parse: (info) => void
     * @param {function} [options.shouldStop] - Check if agent should stop: () => boolean
     */
    constructor(adapter, options = {}) {
        this.adapter = adapter;
        this.maxTurns = options.maxTurns || 10000;
        this.moveDelay = options.moveDelay || 0;
        this.onTurn = options.onTurn || null;
        this.onPerceive = options.onPerceive || null;
        this.shouldStop = options.shouldStop || (() => false);

        // Perception
        this.dungeon = new DungeonTracker();
        this.screen = null;
        this.status = null;
        this.inventory = new InventoryTracker();
        this.prayer = new PrayerTracker();
        this.equipment = new EquipmentManager();

        // State
        this.turnNumber = 0;
        this.lastAction = '';
        this.consecutiveWaits = 0;
        this.stuckCounter = 0;      // detect when agent is stuck (resets on real progress)
        this.levelStuckCounter = 0; // total stuck turns on this level (never resets)
        this.lastFrontierSize = null; // track frontier for progress detection
        this.lastPosition = null;
        this.searchesAtPosition = 0; // how many times we've searched at current pos
        this.currentPath = null;     // current navigation path
        this.recentPositions = new Set(); // recent positions to avoid oscillation
        this.recentPositionsList = []; // ordered list for LRU eviction
        this.petPositions = new Set(); // known pet positions (updated each turn)
        this.refusedAttackPositions = new Set(); // positions where we declined "Really attack?"
        this.lastAttemptedAttackPos = null; // position of last attempted attack target
        this.knownPetChars = new Set(); // monster chars confirmed as pets via displacement
        this.pendingDoorDir = null; // direction key for "In what direction?" prompt after 'o'
        this.pendingQuaffLetter = null; // potion letter for "What do you want to quaff?" prompt
        this.pendingWieldLetter = null; // weapon letter for "Wield what?" prompt
        this.pendingWearLetter = null; // armor letter for "Wear what?" prompt
        this.pendingEatLetter = null; // food letter for "What do you want to eat?" prompt
        this.justOpenedDoor = null; // {x, y} of door that just opened (needs manual fix after map update)
        this.committedTarget = null; // {x, y} of committed exploration target
        this.committedPath = null; // PathResult we're currently following
        this.targetStuckCount = 0; // how many turns we've been stuck on committed path
        this.lastCommittedDistance = null; // track distance for progress detection
        this.failedTargets = new Set(); // targets we've failed to reach (blacklisted)
        this.abandonedLevels = new Map(); // depth → turn when abandoned (to prevent immediate re-descent)
        this.consecutiveFailedMoves = 0; // consecutive turns where movement failed
        this.restTurns = 0; // consecutive turns spent resting
        this.lastHP = null; // track HP to detect healing progress
        this.pendingLockedDoor = null; // {x, y, attempts} for locked door we're trying to kick
        this.secretDoorSearch = null; // {position: {x,y}, searchesNeeded: 20, searchesDone: 0, wallCandidates: []}

        // Corridor following state
        // Combat oscillation detection
        this.combatPositions = []; // last 8 positions during combat: [{x, y, turn}, ...]
        this.oscillationHoldTurns = 0; // remaining turns to hold position when oscillation detected
        this.oscillationHoldAttempted = false; // track if we already tried holding (next step: flee)
        this.inCombat = false; // track if we're currently in combat

        // Statistics
        this.stats = {
            turns: 0,
            kills: 0,
            levelsExplored: 0,
            maxDepth: 0,
            died: false,
            deathCause: '',
        };
    }

    /**
     * Run the agent's main loop until the game ends or maxTurns is reached.
     * @returns {Object} - Final stats
     */
    async run() {
        while (this.turnNumber < this.maxTurns) {
            if (this.shouldStop()) break;

            // Perceive
            const grid = await this.adapter.readScreen();
            if (!grid) break;

            this.screen = parseScreen(grid);
            this.status = parseStatus(this.screen.statusLine1, this.screen.statusLine2);
            if (this.onPerceive) {
                this.onPerceive({
                    turn: this.turnNumber + 1,
                    screen: this.screen,
                    status: this.status,
                });
            }

            // Check for death (HP <= 0)
            if (this.status && this.status.hp <= 0) {
                this.stats.died = true;

                // Track what killed us for learning
                const nearbyMonsters = findMonsters(this.screen);
                const adjacentMonster = this._findAdjacentMonster(px, py);
                const dungeonLevel = this.status.dungeonLevel || 1;

                if (adjacentMonster) {
                    const monsterName = getMonsterName(adjacentMonster.ch);
                    this.stats.deathCause = `killed by ${monsterName} (${adjacentMonster.ch}) on Dlvl ${dungeonLevel}`;
                    this.stats.killedBy = adjacentMonster.ch;
                    this.stats.deathLevel = dungeonLevel;
                } else if (nearbyMonsters.length > 0) {
                    const monster = nearbyMonsters[0];
                    const monsterName = getMonsterName(monster.ch);
                    this.stats.deathCause = `died near ${monsterName} (${monster.ch}) on Dlvl ${dungeonLevel}`;
                    this.stats.killedBy = monster.ch;
                    this.stats.deathLevel = dungeonLevel;
                } else {
                    this.stats.deathCause = `died on Dlvl ${dungeonLevel} (HP reached 0, no visible monster)`;
                    this.stats.deathLevel = dungeonLevel;
                }

                console.log(`[DEATH] ${this.stats.deathCause}`);
                console.log(`[DEATH] Final stats: XL${this.status.experienceLevel}, HP 0/${this.status.hpmax}, Turn ${this.turnNumber}`);
                break;
            }

            // Check for other game over conditions
            if (!(await this.adapter.isRunning())) {
                this.stats.deathCause = 'game over';
                break;
            }

            // Handle UI states first (prompts, menus, --More--)
            const uiHandled = await this._handleUIState();
            if (uiHandled) {
                continue; // UI interaction consumed a turn's worth of input
            }

            // Detect movement failures from last turn
            this._checkLastMoveFailed();

            // Detect pet displacement: if we "attacked" and swapped positions
            this._detectPetDisplacement();

            // Update map knowledge
            this.dungeon.update(this.screen, this.status);

            // Fix door that just opened (screen might show it as wall due to rendering lag)
            if (this.justOpenedDoor) {
                const { x, y } = this.justOpenedDoor;
                const cell = this.dungeon.currentLevel.at(x, y);
                if (cell) {
                    console.log(`[DOOR-FIX] Manually fixing opened door at (${x},${y}): was type='${cell.type}', setting to door_open`);
                    cell.type = 'door_open';
                    cell.walkable = true;
                    cell.explored = true;
                    cell.ch = '.';
                }
                this.justOpenedDoor = null;
            }

            // Update pet tracking
            this._updatePets();

            // Decide and act
            const action = await this._decide();
            const prePos = { x: this.screen.playerX, y: this.screen.playerY };
            await this._act(action);

            // Save action for stuck detection (don't count resting as stuck)
            this.lastAction = action;

            // Detect movement failure: if we sent a movement/explore key and didn't move,
            // mark the target cell as not walkable (wall, closed door, etc.)
            this._detectMovementFailure(action, prePos);

            // Post-action bookkeeping
            this.turnNumber++;
            this.stats.turns = this.turnNumber;
            if (this.status) {
                const newDepth = this.status.dungeonLevel;
                if (newDepth > this.stats.maxDepth) {
                    this.stats.maxDepth = newDepth;
                    // Reset level stuck counter on level change
                    this.levelStuckCounter = 0;
                    this.stuckCounter = 0;
                    this.lastFrontierSize = null;
                    this.committedTarget = null;
                    this.committedPath = null;
                    this.failedTargets.clear();
                    this.consecutiveFailedMoves = 0;
                }
            }

            // Callback
            if (this.onTurn) {
                this.onTurn({
                    turn: this.turnNumber,
                    action: action,
                    hp: this.status?.hp,
                    hpmax: this.status?.hpmax,
                    dlvl: this.status?.dungeonLevel,
                    position: this.screen ? { x: this.screen.playerX, y: this.screen.playerY } : null,
                });
            }

            // Delay for demo mode
            if (this.moveDelay > 0) {
                await sleep(this.moveDelay);
            }
        }

        return this.stats;
    }

    /**
     * Handle UI states: --More-- prompts, yn prompts, menus.
     * Returns true if a UI action was taken (caller should re-read screen).
     */
    async _handleUIState() {
        if (!this.screen) return false;

        // Handle --More-- prompts (check message line and scan full screen for C game)
        if (this.screen.hasMore || this._screenHasMore()) {
            await this.adapter.sendKey(' ');
            return true;
        }

        // Handle menus (dismiss with escape or space)
        if (this.screen.inMenu) {
            await this.adapter.sendKey('\x1b'); // ESC
            return true;
        }

        // Handle yn prompts
        if (this.screen.inPrompt) {
            const response = this._handlePrompt(this.screen.promptText);
            await this.adapter.sendKey(response);
            return true;
        }

        // Handle "This door is closed" — open it (C binary only; JS auto-opens)
        if (this.screen.message.includes('This door is closed')) {
            // Clear pending movement failure check — bouncing off a door is expected
            this._lastMoveAction = null;
            this._lastMovePrePos = null;
            this.consecutiveFailedMoves = 0;
            const adjDoor = this._findAdjacentDoor(this.screen.playerX, this.screen.playerY);
            if (adjDoor) {
                await this.adapter.sendKey('o');
                await this.adapter.sendKey(adjDoor.key);
                return true;
            }
        }

        // Handle locked doors — mark as impassable and reroute
        if (this.screen.message.includes('This door is locked') ||
            this.screen.message.includes('The door resists!')) {
            // Clear pending movement failure check
            this._lastMoveAction = null;
            this._lastMovePrePos = null;
            this.consecutiveFailedMoves = 0;
            const adjDoor = this._findAdjacentDoor(this.screen.playerX, this.screen.playerY);
            if (adjDoor) {
                const cell = this.dungeon.currentLevel.at(adjDoor.x, adjDoor.y);
                if (cell) {
                    cell.walkable = false; // treat as impassable
                }
            }
            // Abandon committed path through this door
            this.committedTarget = null;
            this.committedPath = null;
            return false; // let _decide pick a new path
        }

        // Detect secret door/corridor discoveries and prioritize exploring them
        if (this.screen.message.includes('You find a hidden door!') ||
            this.screen.message.includes('You find a hidden passage!')) {
            // A secret was just revealed adjacent to our position
            // Find all adjacent doors (newly revealed secrets)
            const px = this.screen.playerX;
            const py = this.screen.playerY;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = px + dx;
                    const ny = py + dy;
                    const cell = this.dungeon.currentLevel.at(nx, ny);
                    if (cell && (cell.type === 'door_closed' || cell.type === 'corridor')) {
                        // Mark as a high-priority target
                        if (!this.newlyRevealedDoors) this.newlyRevealedDoors = [];
                        this.newlyRevealedDoors.push({ x: nx, y: ny, turn: this.turnNumber });
                    }
                }
            }

            // Clear failedTargets near the secret (they might now be reachable)
            if (this.failedTargets) {
                const newFailedTargets = new Set();
                for (const key of this.failedTargets) {
                    const tx = key % 80;
                    const ty = (key - tx) / 80;
                    const dist = Math.max(Math.abs(tx - px), Math.abs(ty - py));
                    if (dist > 8) {
                        newFailedTargets.add(key); // Keep targets far from the secret
                    }
                }
                this.failedTargets = newFailedTargets;
            }

            // Mark that we should re-search in this area after exploring
            this.lastSecretLocation = { x: px, y: py, turn: this.turnNumber };

            // Reset stuck counters since we made progress
            this.stuckCounter = 0;
            this.levelStuckCounter = Math.max(0, this.levelStuckCounter - 30);
        }

        return false;
    }

    /**
     * Check all screen rows for --More-- (C game puts it mid-screen during intro).
     */
    _screenHasMore() {
        if (!this.screen || !this.screen.map) return false;
        // Check map rows for --More--
        for (let y = 0; y < this.screen.map.length; y++) {
            const row = this.screen.map[y];
            let text = '';
            for (let x = 0; x < row.length; x++) text += row[x].ch;
            if (text.includes('--More--')) return true;
        }
        return false;
    }

    /**
     * Decide what to do based on the prompt text.
     */
    _handlePrompt(promptText) {
        const lower = promptText.toLowerCase();

        // "Really attack X?" -- no! The game only asks this for peacefuls/pets
        if (lower.includes('really attack')) {
            // Mark last attempted attack position as a pet/peaceful
            if (this.lastAttemptedAttackPos) {
                this.refusedAttackPositions.add(
                    this.lastAttemptedAttackPos.y * 80 + this.lastAttemptedAttackPos.x
                );
            }
            return 'n';
        }

        // "There is X here; pick it up?" -- yes for useful items
        if (lower.includes('pick it up')) return 'y';

        // "What do you want to eat?" -- select first item (a)
        // "What do you want to eat?" -- use saved food letter
        if (lower.includes('want to eat')) {
            if (this.pendingEatLetter) {
                const letter = this.pendingEatLetter;
                this.pendingEatLetter = null;
                return letter;
            }
            return '\x1b'; // ESC to cancel if no food selected
        }

        // "What do you want to quaff?" -- use saved potion letter
        if (lower.includes('want to quaff') || lower.includes('want to drink')) {
            if (this.pendingQuaffLetter) {
                const letter = this.pendingQuaffLetter;
                this.pendingQuaffLetter = null;
                return letter;
            }
            return '\x1b'; // ESC to cancel if no potion selected
        }

        // "Wield what?" or "What do you want to wield?" -- use saved weapon letter
        if (lower.includes('wield')) {
            if (this.pendingWieldLetter) {
                const letter = this.pendingWieldLetter;
                this.pendingWieldLetter = null;
                return letter;
            }
            return '\x1b'; // ESC to cancel
        }

        // "Wear what?" or "What do you want to wear?" -- use saved armor letter
        if (lower.includes('wear')) {
            if (this.pendingWearLetter) {
                const letter = this.pendingWearLetter;
                this.pendingWearLetter = null;
                return letter;
            }
            return '\x1b'; // ESC to cancel
        }

        // "In what direction?" -- provide saved direction (from door-open, etc.)
        if (lower.includes('direction')) {
            if (this.pendingDoorDir) {
                const dir = this.pendingDoorDir;
                this.pendingDoorDir = null;
                return dir;
            }
            return '.'; // self for search as fallback
        }

        // "Shall I pick up ..." -- yes
        if (lower.includes('shall i pick')) return 'y';

        // Generic -- dismiss with space or escape
        if (lower.includes('[yn]')) return 'n'; // default no for safety
        return '\x1b'; // ESC to dismiss
    }

    /**
     * Core decision engine: choose the next action.
     * Returns an action object: { type, key, reason }
     */
    async _decide() {
        const level = this.dungeon.currentLevel;
        const px = this.screen.playerX;
        const py = this.screen.playerY;

        // Track recent positions for anti-oscillation (always, even when moving)
        const posKey = py * 80 + px;
        this.recentPositions.add(posKey);
        this.recentPositionsList.push(posKey);
        if (this.recentPositionsList.length > 30) {
            this.recentPositions.delete(this.recentPositionsList.shift());
        }

        // Detect and blacklist permanently stuck targets
        // If we've been at the same position for 20+ turns, blacklist nearby unreachable targets
        if (this.lastPosition && this.lastPosition.x === px && this.lastPosition.y === py) {
            if (!this.turnsAtSamePosition) this.turnsAtSamePosition = 1;
            else this.turnsAtSamePosition++;

            if (this.turnsAtSamePosition >= 20) {
                // Blacklist only the CLOSEST frontier/search targets (within 3 cells)
                // Being more conservative to avoid breaking normal exploration
                if (!this.failedTargets) this.failedTargets = new Set();

                let blacklisted = 0;
                const frontier = level.getExplorationFrontier();
                for (const target of frontier) {
                    const dist = Math.max(Math.abs(target.x - px), Math.abs(target.y - py));
                    if (dist <= 3) {
                        const tKey = target.y * 80 + target.x;
                        this.failedTargets.add(tKey);
                        blacklisted++;
                    }
                }

                const searchCandidates = level.getSearchCandidates();
                for (const cand of searchCandidates) {
                    const dist = Math.max(Math.abs(cand.x - px), Math.abs(cand.y - py));
                    if (dist <= 3) {
                        const cKey = cand.y * 80 + cand.x;
                        this.failedTargets.add(cKey);
                        blacklisted++;
                    }
                }

                // Reset counter to try different targets
                this.turnsAtSamePosition = 0;
                this.stuckCounter = 0;
                if (blacklisted > 0) {
                    console.log(`  [UNSTUCK] Blacklisted ${blacklisted} close targets near (${px},${py})`);
                }
            }
        } else {
            this.turnsAtSamePosition = 0;
        }

        // Track frontier progress
        const currentFrontier = level?.getExplorationFrontier ? level.getExplorationFrontier().length : 0;
        if (!this.lastFrontierSize) this.lastFrontierSize = currentFrontier;

        // Track if we're stuck (same position OR oscillating between nearby positions)
        // But don't count resting as stuck - resting is intentional healing
        const wasResting = this.lastAction && this.lastAction.type === 'rest';
        const frontierProgress = this.lastFrontierSize - currentFrontier;
        const makingFrontierProgress = frontierProgress > 0;

        if (this.lastPosition && this.lastPosition.x === px && this.lastPosition.y === py) {
            if (!wasResting && !makingFrontierProgress) {
                this.stuckCounter++;
                this.levelStuckCounter++;
            }
        } else {
            // Detect short-term oscillation: if we've been in this position in the last 6 turns
            const recentCount = this.recentPositionsList.slice(-6).filter(k => k === posKey).length;
            if (recentCount >= 2 && !wasResting && !makingFrontierProgress) {
                this.stuckCounter++;
                this.levelStuckCounter++;
            } else {
                // Check for longer-term stuck pattern: if we've barely moved in the last 30 turns
                if (this.recentPositionsList.length >= 30) {
                    const uniquePositions = new Set(this.recentPositionsList.slice(-30));
                    // If we've only been in 3 or fewer positions in last 30 turns, we're stuck
                    // (unless we were intentionally resting)
                    if (uniquePositions.size <= 3 && !wasResting && !makingFrontierProgress) {
                        this.stuckCounter++;
                        this.levelStuckCounter++;
                    } else {
                        this.stuckCounter = 0;
                        this.searchesAtPosition = 0;
                    }
                } else {
                    this.stuckCounter = 0;
                    this.searchesAtPosition = 0;
                }
            }
        }
        this.lastPosition = { x: px, y: py };

        // Update frontier tracking
        this.lastFrontierSize = currentFrontier;

        // --- Emergency checks (highest priority) ---

        // 0. Improved healing potion management
        // Strategy: Use potions proactively on Dlvl 3+ where monsters hit harder
        // - Critical (< 30%): Always use if available
        // - Moderate (30-50%): Use if we have 2+ potions (conserve for emergencies)
        // - Preventive (50-60%): Use if we have 3+ potions and on Dlvl 4+
        let hasHealingPotions = false;
        const dungeonLevel = this.status?.dungeonLevel || 1;

        if (this.status && this.status.hp < this.status.hpmax) {
            // Refresh inventory if needed
            if (this.turnNumber - this.inventory.lastUpdate > 100 || this.inventory.lastUpdate === 0) {
                await this._refreshInventory();
            }

            const healingPotions = this.inventory.findHealingPotions();
            hasHealingPotions = healingPotions.length > 0;
            const hpPercent = this.status.hp / this.status.hpmax;

            if (hasHealingPotions) {
                const potionCount = healingPotions.length;
                let shouldDrink = false;
                let reason = '';

                // Critical: Always drink at < 30% HP
                if (hpPercent < 0.3) {
                    shouldDrink = true;
                    reason = 'critical HP';
                }
                // Moderate: Drink at < 50% if we have 2+ potions
                else if (hpPercent < 0.5 && potionCount >= 2) {
                    shouldDrink = true;
                    reason = `moderate HP (${potionCount} potions available)`;
                }
                // Preventive: On deep levels (Dlvl 4+), drink at < 60% if we have 3+ potions
                else if (hpPercent < 0.6 && dungeonLevel >= 4 && potionCount >= 3) {
                    shouldDrink = true;
                    reason = `preventive healing on Dlvl ${dungeonLevel} (${potionCount} potions)`;
                }

                if (shouldDrink) {
                    const potion = healingPotions[0];
                    this.pendingQuaffLetter = potion.letter;
                    return { type: 'quaff', key: 'q', reason: `${reason}: drinking ${potion.name} (${this.status.hp}/${this.status.hpmax})` };
                }
            }
        }

        // 0c. Food consumption: eat when hungry to avoid starvation
        if (this.status && this.status.needsFood) {
            // Refresh inventory if needed
            if (this.turnNumber - this.inventory.lastUpdate > 100 || this.inventory.lastUpdate === 0) {
                await this._refreshInventory();
            }

            const food = this.inventory.findFood();
            if (food.length > 0) {
                // Prioritize food rations over corpses
                const foodRation = food.find(item => item.name.includes('food ration'));
                const selectedFood = foodRation || food[0];

                const hungerStatus = this.status.fainting ? 'fainting' :
                                   this.status.weak ? 'weak' :
                                   this.status.hungry ? 'hungry' : 'low nutrition';

                this.pendingEatLetter = selectedFood.letter;
                return { type: 'eat', key: 'e', reason: `eating ${selectedFood.name} (${hungerStatus})` };
            }
        }

        // 0b. If HP is critically low, consider prayer as last resort
        if (this.status && this.status.hp < this.status.hpmax * 0.2) {
            const nearbyMonsters = findMonsters(this.screen);
            const canFlee = nearbyMonsters.length > 0 && this._fleeFrom(px, py, nearbyMonsters, level) !== null;

            const prayerDecision = this.prayer.shouldPray(this.status, this.turnNumber, {
                hasHealingPotions,
                canFlee,
            });

            if (prayerDecision.shouldPray) {
                this.prayer.recordPrayer(this.turnNumber);
                return { type: 'pray', key: '#pray\n', reason: prayerDecision.reason };
            }
        }

        // 1. Danger-aware retreat: flee earlier if facing dangerous monsters
        // Base threshold: <= 50% HP
        // Adjust based on monster danger and dungeon level
        const hpPercent = this.status ? this.status.hp / this.status.hpmax : 1;
        const nearbyMonsters = findMonsters(this.screen);
        const adjacentMonster = this._findAdjacentMonster(px, py);
        const hasHostileMonsters = nearbyMonsters.length > 0 || adjacentMonster !== null;

        // Calculate retreat threshold based on threats
        let retreatThreshold = 0.5; // Base: 50% HP
        if (this.status && hasHostileMonsters) {
            const playerLevel = this.status.experienceLevel || 1;
            const dungeonLevel = this.status.dungeonLevel || 1;

            // Check danger of nearby monsters
            let maxDanger = DangerLevel.LOW;

            // Check adjacent monster first (most immediate threat)
            if (adjacentMonster) {
                const danger = assessMonsterDanger(
                    adjacentMonster.ch,
                    this.status.hp,
                    this.status.hpmax,
                    playerLevel,
                    dungeonLevel
                );
                maxDanger = Math.max(maxDanger, danger);
            }

            // Check nearby monsters
            for (const monster of nearbyMonsters.slice(0, 3)) { // Check up to 3 nearby
                const danger = assessMonsterDanger(
                    monster.ch,
                    this.status.hp,
                    this.status.hpmax,
                    playerLevel,
                    dungeonLevel
                );
                maxDanger = Math.max(maxDanger, danger);
            }

            // Adjust retreat threshold based on maximum danger
            if (maxDanger >= DangerLevel.HIGH) {
                retreatThreshold = 0.7; // Retreat at 70% HP for HIGH danger
            } else if (maxDanger >= DangerLevel.MEDIUM) {
                retreatThreshold = 0.6; // Retreat at 60% HP for MEDIUM danger
            }

            // On deeper levels, be more cautious
            if (dungeonLevel >= 4) {
                retreatThreshold = Math.min(0.75, retreatThreshold + 0.1);
            }
        }

        if (this.status && hpPercent <= retreatThreshold && hasHostileMonsters) {
                // Try to flee to upstairs if available and not too far
                if (level.stairsUp.length > 0) {
                    const stairs = level.stairsUp[0];
                    // If we're already at the stairs, ascend immediately
                    if (px === stairs.x && py === stairs.y) {
                        return { type: 'ascend', key: '<', reason: `ascending to escape (HP ${this.status.hp}/${this.status.hpmax})` };
                    }
                    const dist = Math.abs(stairs.x - px) + Math.abs(stairs.y - py);
                    // If stairs are close (within 10 steps), path to them
                    if (dist <= 10) {
                        const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: false });
                        if (path.found && path.path.length <= 10) {
                            return this._followPath(path, 'flee', `fleeing to upstairs (HP ${this.status.hp}/${this.status.hpmax})`);
                        }
                    }
                }

                // Otherwise just move away from monsters
                const fleeDir = this._fleeFrom(px, py, nearbyMonsters, level);
                if (fleeDir) {
                    return { type: 'flee', key: fleeDir, reason: 'HP critical, fleeing' };
                }
        }

        // 1b. Smarter rest strategy with location awareness
        // NetHack HP regen: (XL + CON)% chance per turn to heal 1 HP
        // At XL1 with CON~10, only 11% chance per turn!
        if (this.status && this.status.hp < this.status.hpmax) {
            // hpPercent, nearbyMonsters, adjacentMonster already declared above
            const monstersNearby = nearbyMonsters.length > 0 || adjacentMonster !== null;

            // Check if HP increased since last check (natural regen occurred)
            if (this.lastHP !== null && this.status.hp > this.lastHP) {
                this.restTurns = 0; // HP increased, reset rest counter
            }
            this.lastHP = this.status.hp;

            // Assess location safety for resting
            const onStairs = level.stairsUp.some(s => s.x === px && s.y === py) ||
                           level.stairsDown.some(s => s.x === px && s.y === py);
            const inCorridor = false; // Corridor following removed due to exploration regression

            // Safe locations get extended rest time:
            // - On stairs: safest (can escape quickly)
            // - In corridor: good (monsters can't surround)
            // - Dead-end: moderate (trapped but monsters can't surround)
            // - Open room: risky (can be surrounded)
            let maxRestTurns = 100;
            let safetyBonus = '';
            if (onStairs) {
                maxRestTurns = 150; // Extra time on stairs
                safetyBonus = ' (on stairs - safe)';
            } else if (inCorridor) {
                maxRestTurns = 120; // Good safety in corridors
                safetyBonus = ' (in corridor)';
            }

            // Rest thresholds
            // Critical HP <= 50%: rest for extended time
            // Moderate HP < 70%: rest for shorter time
            // Note: These thresholds MUST be higher than combat engagement thresholds
            // to prevent flee-loops where agent can't rest but won't fight
            if (hpPercent <= 0.5 && !monstersNearby && this.restTurns < maxRestTurns) {
                this.restTurns++;
                return { type: 'rest', key: '.', reason: `HP low, resting (${this.status.hp}/${this.status.hpmax}, ${this.restTurns}/${maxRestTurns})${safetyBonus}` };
            } else if (hpPercent < 0.7 && !monstersNearby && this.restTurns < Math.min(50, maxRestTurns)) {
                this.restTurns++;
                return { type: 'rest', key: '.', reason: `resting to heal (${this.status.hp}/${this.status.hpmax}, ${this.restTurns}/50)${safetyBonus}` };
            }

            // If we've rested enough, give up and continue (HP will heal while exploring)
            if (this.restTurns >= 50) {
                this.restTurns = 0; // Reset for next time
            }
        } else {
            // HP is full, reset rest counter
            this.restTurns = 0;
        }

        // If we reached here without returning a rest action, reset rest counter
        // (will be set back to 0 at the end of _decide if we take any other action)

        // 2. If there's a locked door blocking our path, try to kick it open
        if (this.pendingLockedDoor) {
            const door = this.pendingLockedDoor;
            const doorCell = level.at(door.x, door.y);

            // Check if we're adjacent to the door
            const dist = Math.abs(door.x - px) + Math.abs(door.y - py);
            const isAdjacent = dist === 1;

            // If door is now open/gone, clear pending door
            if (!doorCell || doorCell.type !== 'door_locked') {
                this.pendingLockedDoor = null;
            }
            // If adjacent and haven't tried too many times, kick it
            else if (isAdjacent && door.attempts < 10) {
                this.pendingLockedDoor.attempts++;
                // NetHack kick: Ctrl+D, then direction
                const dx = door.x - px;
                const dy = door.y - py;
                const dir = DIR_KEYS[`${dx},${dy}`];
                if (dir) {
                    this.pendingDoorDir = dir;
                    return { type: 'kick', key: '\x04', reason: `kicking locked door at (${door.x},${door.y}) [attempt ${door.attempts}/10]` };
                }
            }
            // If tried too many times or not adjacent, give up and mark as unwalkable
            else if (door.attempts >= 10 || !isAdjacent) {
                console.log(`[DOOR KICK] Giving up on door at (${door.x},${door.y}) after ${door.attempts} attempts`);
                if (doorCell) doorCell.walkable = false;
                this.pendingLockedDoor = null;
            }
        }

        // 3. If hungry, check inventory and eat if we have food
        if (this.status && this.status.needsFood) {
            // Refresh inventory every 100 turns or if never checked
            if (this.turnNumber - this.inventory.lastUpdate > 100 || this.inventory.lastUpdate === 0) {
                await this._refreshInventory();
            }

            // If we have food, eat it
            if (this.inventory.hasFood()) {
                return { type: 'eat', key: 'e', reason: 'hungry and have food' };
            }
            // No food available - continue exploring (might find food)
        }

        // 2b. Check equipment at game start and after picking up items
        // Wield best weapon and wear armor for better combat survival
        if (!this.equipment.hasCheckedStarting && this.turnNumber >= 5 && this.turnNumber <= 20) {
            // Check starting equipment early in game
            if (this.inventory.lastUpdate === 0) {
                await this._refreshInventory();
            }

            const weapon = this.equipment.shouldWieldWeapon(this.inventory);
            if (weapon) {
                this.equipment.hasCheckedStarting = true;
                this.equipment.recordWield(weapon.name);
                this.pendingWieldLetter = weapon.letter;
                return { type: 'wield', key: 'w', reason: `wielding ${weapon.name}` };
            }

            const armor = this.equipment.shouldWearArmor(this.inventory);
            if (armor) {
                this.equipment.hasCheckedStarting = true;
                this.equipment.recordWear(armor.name);
                this.pendingWearLetter = armor.letter;
                return { type: 'wear', key: 'W', reason: `wearing ${armor.name}` };
            }

            this.equipment.hasCheckedStarting = true;
        }

        // --- Tactical checks ---

        // 3. If there's a monster adjacent, decide whether to fight it
        // adjacentMonster already declared above
        if (adjacentMonster) {
            this.inCombat = true;

            // Detect oscillation: are we bouncing between same 2-3 positions?
            const oscillating = this._detectCombatOscillation(px, py);

            if (oscillating && this.oscillationHoldTurns === 0) {
                if (!this.oscillationHoldAttempted) {
                    // First response: hold position and wait for monster
                    this.oscillationHoldTurns = 3;
                    this.oscillationHoldAttempted = true;
                    console.log(`[OSCILLATION] Detected at (${px},${py}), holding position for 3 turns`);
                } else {
                    // Holding didn't work - flee instead
                    const nearbyMonsters = findMonsters(this.screen);
                    const fleeDir = this._fleeFrom(px, py, nearbyMonsters, level);
                    if (fleeDir) {
                        // Clear oscillation state and flee
                        this.combatPositions = [];
                        this.oscillationHoldAttempted = false;
                        console.log(`[OSCILLATION] Holding failed, fleeing from (${px},${py})`);
                        return { type: 'flee', key: fleeDir, reason: 'fleeing to break oscillation' };
                    }
                }
            }

            // If holding position due to oscillation, stay still and wait for monster
            if (this.oscillationHoldTurns > 0) {
                this.oscillationHoldTurns--;
                if (this.oscillationHoldTurns === 0) {
                    // Done holding - clear combat history to reset oscillation detection
                    this.combatPositions = [];
                }
                // Stay in place and wait (let monster approach us)
                return { type: 'wait', key: '.', reason: `holding position (oscillation prevention, ${this.oscillationHoldTurns + 1} turns left)` };
            }

            // Determine if monster is blocking our path
            // A monster is "blocking" if:
            // 1. We have a committed target/path (actively exploring)
            // 2. The monster is on or adjacent to our intended next move
            let isBlocking = false;
            if (this.committedPath && this.committedPath.path && this.committedPath.path.length > 0) {
                const nextStep = this.committedPath.path[0]; // Next position we want to move to
                const distToPath = Math.max(
                    Math.abs(nextStep.x - adjacentMonster.x),
                    Math.abs(nextStep.y - adjacentMonster.y)
                );
                // Monster is blocking if it's on the next step or very close to it
                isBlocking = distToPath <= 1;
            } else if (this.committedTarget) {
                // Or if monster is directly between us and our target
                const dx = this.committedTarget.x - px;
                const dy = this.committedTarget.y - py;
                const mdx = adjacentMonster.x - px;
                const mdy = adjacentMonster.y - py;
                // Monster is blocking if it's in the general direction of our target
                isBlocking = (Math.sign(mdx) === Math.sign(dx) || dx === 0) &&
                             (Math.sign(mdy) === Math.sign(dy) || dy === 0);
            }

            // Assess danger and decide whether to engage
            const playerLevel = this.status?.experienceLevel || 1;
            const dungeonLevel = this.status?.dungeonLevel || 1;

            // Count nearby monsters (excluding the adjacent one)
            const nearbyMonsters = findMonsters(this.screen);
            const nearbyCount = countNearbyMonsters(nearbyMonsters, px, py, 3) - 1; // -1 to exclude adjacent monster

            // Check if we're in a corridor (tactical advantage)
            const inCorridor = false; // Corridor following removed due to exploration regression

            const engagement = shouldEngageMonster(
                adjacentMonster.ch,
                this.status?.hp || 16,
                this.status?.hpmax || 16,
                playerLevel,
                isBlocking,
                dungeonLevel,
                nearbyCount,
                inCorridor
            );

            // If we should ignore this monster (harmless), just continue exploring
            if (engagement.ignore) {
                // Don't fight, don't flee - just let normal exploration handle it
                // Fall through to exploration logic
            } else if (!engagement.shouldEngage && engagement.shouldFlee) {
                // Dangerous monster - try to flee
                const nearbyMonsters = findMonsters(this.screen);
                const fleeDir = this._fleeFrom(px, py, nearbyMonsters, level);
                if (fleeDir) {
                    const monsterName = getMonsterName(adjacentMonster.ch);
                    return { type: 'flee', key: fleeDir, reason: `fleeing ${monsterName}: ${engagement.reason}` };
                }
                // Can't flee - might as well fight
                const dx = adjacentMonster.x - px;
                const dy = adjacentMonster.y - py;
                const key = DIR_KEYS[`${dx},${dy}`];
                if (key) {
                    return { type: 'attack', key, reason: `forced to fight ${adjacentMonster.ch} (cornered)` };
                }
            } else if (engagement.shouldEngage) {
                // Engage the monster
                const dx = adjacentMonster.x - px;
                const dy = adjacentMonster.y - py;
                const key = DIR_KEYS[`${dx},${dy}`];
                if (key) {
                    return { type: 'attack', key, reason: engagement.reason };
                }
            }
        } else {
            // No adjacent monster - clear combat state
            if (this.inCombat) {
                this.inCombat = false;
                this.combatPositions = [];
                this.oscillationHoldTurns = 0;
                this.oscillationHoldAttempted = false;
            }
        }

        // 4. Pick up items at current position
        const currentCell = level.at(px, py);
        if (currentCell && currentCell.items.length > 0) {
            return { type: 'pickup', key: ',', reason: 'picking up items' };
        }

        // 4b. Corridor following - commit to following corridors to completion
        // --- Strategic movement ---

        // 5. If on downstairs, evaluate whether it's safe to descend
        //    Check both cell type and registered features (player '@' overrides '>' on screen)
        const onDownstairs = (currentCell && currentCell.type === 'stairs_down') ||
            level.stairsDown.some(s => s.x === px && s.y === py);
        if (onDownstairs) {
            // Evaluate if it's safe/wise to descend
            const descendDecision = this._shouldDescendStairs();

            if (descendDecision.shouldDescend) {
                console.log(`[DEBUG] At downstairs, descending: ${descendDecision.reason}`);
                return { type: 'descend', key: '>', reason: descendDecision.reason };
            } else {
                // Not safe to descend - move away from stairs and heal/prepare
                console.log(`[DEBUG] At downstairs but not safe to descend: ${descendDecision.reason}`);
                // Move in a random direction away from stairs to avoid descending accidentally
                const directions = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                return { type: 'avoid_descend', key: randomDir, reason: `not safe to descend: ${descendDecision.reason}` };
            }
        }

        // 5b. Check for obvious dead-end situations needing secret door search
        // Do this BEFORE normal exploration to avoid wasting time wandering
        // BUT: Don't trigger this when coverage is very low (< 15%) - we probably just need to explore more
        const exploredPercentDeadEnd = level.exploredCount / (80 * 21);
        if (level.isDeadEnd(px, py) && level.stairsDown.length === 0 && exploredPercentDeadEnd > 0.15) {
            const candidates = level.getSecretDoorCandidates(px, py);
            if (candidates.length > 0 && candidates[0].searchCount < 10) {
                // We're adjacent to unsearched walls in a dead-end - search now!
                const candidate = candidates[0];
                const cell = level.at(candidate.x, candidate.y);
                if (cell) {
                    cell.searchCount++;
                    cell.lastSearchTurn = this.turnNumber;
                }
                const currentCell = level.at(px, py);
                if (currentCell) {
                    currentCell.searchCount++;
                    currentCell.lastSearchTurn = this.turnNumber;
                }
                return { type: 'search', key: 's', reason: `dead-end detected, searching wall at (${candidate.x},${candidate.y}) [${cell?.searchCount || 0}/20]` };
            }
        }

        // 5c. Proactive descent: if we've found stairs and explored enough, head down
        // This encourages forward progress instead of exhaustive exploration
        if (level.stairsDown.length > 0 && this.turnNumber > 30) {
            const targetDepth = this.dungeon.currentDepth + 1;
            let shouldConsiderDescent = true;

            // Don't descend to recently abandoned levels (wait at least 500 turns)
            if (this.abandonedLevels.has(targetDepth)) {
                const abandonedTurn = this.abandonedLevels.get(targetDepth);
                const turnsSinceAbandoned = this.turnNumber - abandonedTurn;
                if (turnsSinceAbandoned < 500) {
                    console.log(`[ABANDON] Skipping descent to Dlvl ${targetDepth} (abandoned ${turnsSinceAbandoned} turns ago)`);
                    shouldConsiderDescent = false;
                } else {
                    console.log(`[ABANDON] Allowing retry of Dlvl ${targetDepth} (abandoned ${turnsSinceAbandoned} turns ago)`);
                    this.abandonedLevels.delete(targetDepth); // Remove from abandoned list
                }
            }

            if (shouldConsiderDescent) {
                const exploredPercent = level.exploredCount / (80 * 21); // rough estimate
                const frontierCells = level.getExplorationFrontier().length;

                // Head to stairs if:
                // - HP is above 50%, AND
                // - EITHER:
                //   a) We've explored 15%+ AND (frontier small OR been here 100+ turns OR path cheap)
                //   b) We've been here 500+ turns (give up on full exploration)
                const hpGood = this.status && (this.status.hp / this.status.hpmax) > 0.5;
                const exploredEnough = exploredPercent > 0.15;
                const frontierSmall = frontierCells < 30;
                const beenHereLong = this.turnNumber > 100;
                const veryLongTime = this.turnNumber > 500;  // Give up after 500 turns

                // Check if path to stairs is short (if so, worth going even with more frontier)
                const stairs = level.stairsDown[0];
                if (px === stairs.x && py === stairs.y) {
                    console.log(`[DEBUG] At downstairs, descending`); return { type: 'descend', key: '>', reason: `descending (explored ${Math.round(exploredPercent*100)}%)` };
                }

                const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: false });
                const pathIsCheap = path.found && path.cost < 30;  // Stairs are nearby

                // Descend if: HP good AND (explored enough to be safe OR been here too long)
                const shouldDescend = hpGood && (
                    (exploredEnough && (frontierSmall || beenHereLong || pathIsCheap)) ||
                    veryLongTime  // After 500 turns, just go down regardless
                );

                if (shouldDescend && path.found) {
                    return this._followPath(path, 'navigate', `heading to downstairs (explored ${Math.round(exploredPercent*100)}%, frontier ${frontierCells}, turn ${this.turnNumber}, cost ${Math.round(path.cost)})`);
                }
            }
        }

        // 6. If we've spent too long stuck on this level, head for stairs
        if (this.levelStuckCounter > 20) {
            // If EXTREMELY stuck (>100 turns on same level), give up and retreat upstairs
            // This handles cases where downstairs exist but are unreachable (secret doors)
            if (this.levelStuckCounter > 100 && this.dungeon.currentDepth > 1 && level.stairsUp.length > 0) {
                const stairs = level.stairsUp[0];
                // Mark this level as abandoned to prevent immediate re-descent
                const currentDepth = this.dungeon.currentDepth;
                this.abandonedLevels.set(currentDepth, this.turnNumber);
                console.log(`[ABANDON] Marking Dlvl ${currentDepth} as abandoned (stuck ${this.levelStuckCounter} turns)`);

                // If we're already at the stairs, ascend immediately
                if (px === stairs.x && py === stairs.y) {
                    return { type: 'ascend', key: '<', reason: `extremely stuck, giving up on level (${this.levelStuckCounter} turns)` };
                }
                const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
                if (path.found) {
                    return this._followPath(path, 'navigate', `extremely stuck, retreating upstairs (${this.levelStuckCounter} turns)`);
                }
            }

            // Only try to path to downstairs if not TOO stuck (≤30 turns)
            // If stuck >30, let systematic searching (section 6.5) run first
            if (level.stairsDown.length > 0 && this.levelStuckCounter <= 30) {
                const stairs = level.stairsDown[0];
                // If we're already at the downstairs, descend immediately
                if (px === stairs.x && py === stairs.y) {
                    console.log(`[DEBUG] At downstairs, descending`); return { type: 'descend', key: '>', reason: `descending (stuck ${this.levelStuckCounter})` };
                }
                const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
                if (path.found) {
                    return this._followPath(path, 'navigate', `heading to downstairs (level stuck ${this.levelStuckCounter}) at (${stairs.x},${stairs.y})`);
                }
            }

            // No downstairs found - try systematic secret door searching
            // Coverage-based strategy: comprehensive search at high coverage
            const coverageForSearch = level.exploredCount / (80 * 21);
            const frontierForSearch = level.getExplorationFrontier();
            const genuinelyTrapped = frontierForSearch.length === 0 && this.levelStuckCounter > 50;

            // High coverage mode: explored decent amount but very stuck
            // If 15%+ explored and 500+ turns OR 25%+ explored and 300+ turns,
            // switch to comprehensive search (downstairs likely behind non-frontier-adjacent secret door)
            const highCoverageMode = (
                (coverageForSearch > 0.15 && this.turnNumber > 500) ||
                (coverageForSearch > 0.25 && this.turnNumber > 300)
            );

            const shouldSearchDoors = highCoverageMode || (
                (frontierForSearch.length < 40 && coverageForSearch > 0.10) ||
                genuinelyTrapped ||
                this.levelStuckCounter > 100
            );

            // Occupancy map secret door search (Campbell & Verbrugge 2017 approach)
            // Trigger when stuck and no downstairs found
            const shouldSearchSecretDoors =
                this.levelStuckCounter > 20 &&           // Stuck for 20+ turns
                level.stairsDown.length === 0 &&         // No downstairs found yet
                coverageForSearch < 0.90;                // Not almost fully explored

            if (shouldSearchSecretDoors) {
                if (!this.secretDoorSearch) {
                    // Use occupancy map approach: identify large hidden components
                    const targets = level.getSecretDoorSearchTargets({x: px, y: py}, 5);

                    if (targets.length > 0) {
                        const componentIds = new Set(targets.map(t => t.componentId));
                        console.log(`[SECRET DOOR] OCCUPANCY search: ${targets.length} high-value walls from ${componentIds.size} hidden components`);
                        console.log(`[SECRET DOOR] Coverage: ${(coverageForSearch*100).toFixed(1)}%, Frontier: ${frontierForSearch.length} cells`);

                        this.secretDoorSearch = {
                            targets: targets,           // Prioritized wall list from occupancy map
                            currentIndex: 0,            // Which target we're on
                            searchesNeeded: 20,         // 20 searches = 94% success for SDOOR
                            searchesDone: 0,            // Searches at current target
                        };
                    } else {
                        console.log(`[SECRET DOOR] No hidden components found (map fully explored or no large components)`);
                    }
                }

                // If we have an active secret door search, continue it
                if (this.secretDoorSearch) {
                    const search = this.secretDoorSearch;
                    const target = search.targets[search.currentIndex];

                    if (target) {
                        // Navigate to wall if not adjacent
                        const dist = Math.max(Math.abs(px - target.x), Math.abs(py - target.y));
                        if (dist > 1) {
                            console.log(`[SECRET DOOR] Moving to search target ${search.currentIndex+1}/${search.targets.length} at (${target.x},${target.y}) [component ${target.componentId}]`);
                            const path = findPath(level, px, py, target.x, target.y, { allowUnexplored: false });
                            if (path.found) {
                                return this._followPath(path, 'navigate', `heading to secret door search target (${target.x},${target.y})`);
                            } else {
                                // Can't reach this target - skip to next
                                console.log(`[SECRET DOOR] Target (${target.x},${target.y}) unreachable, skipping to next`);
                                search.currentIndex++;
                                if (search.currentIndex >= search.targets.length) {
                                    console.log(`[SECRET DOOR] All occupancy targets exhausted, no secret door found`);
                                    this.secretDoorSearch = null;
                                }
                                // Fall through to try other exploration strategies
                            }
                        }

                        // Only search if we're adjacent (dist check passed above)
                        if (dist <= 1) {
                            // We're adjacent to the wall - search it!
                            search.searchesDone++;

                            // Track search count in the wall cell
                            const wallCell = level.at(target.x, target.y);
                            if (wallCell) {
                                wallCell.searchCount = (wallCell.searchCount || 0) + 1;
                                wallCell.lastSearchTurn = this.turnNumber;
                            }

                            // Track search count in the player's current position too
                            if (currentCell) {
                                currentCell.searchCount = (currentCell.searchCount || 0) + 1;
                                currentCell.lastSearchTurn = this.turnNumber;
                            }

                            console.log(`[SECRET DOOR] Searching target ${search.currentIndex+1}/${search.targets.length} at (${target.x},${target.y}) [${search.searchesDone}/${search.searchesNeeded}]`);

                            if (search.searchesDone >= search.searchesNeeded) {
                                // Done with this target - move to next
                                console.log(`[SECRET DOOR] Completed ${search.searchesNeeded} searches at (${target.x},${target.y}), moving to next`);
                                search.currentIndex++;
                                search.searchesDone = 0;

                                if (search.currentIndex >= search.targets.length) {
                                    console.log(`[SECRET DOOR] All occupancy targets searched (${search.targets.length} walls), no secret door found`);
                                    this.secretDoorSearch = null;
                                }
                            }

                            return {type: 'search', key: 's', reason: `occupancy-based secret door search at (${target.x},${target.y})`};
                        }
                    } else {
                        // No more targets
                        this.secretDoorSearch = null;
                    }
                }
            }

            // No downstairs found and very stuck - go back up or random movement
            if (this.levelStuckCounter > 50) {
                // If we're deep in the dungeon and truly stuck, try going back upstairs
                if (this.dungeon.currentDepth > 1 && level.stairsUp.length > 0) {
                    const stairs = level.stairsUp[0];
                    // If we're already at the stairs, ascend immediately
                    if (px === stairs.x && py === stairs.y) {
                        return { type: 'ascend', key: '<', reason: `giving up on level, ascending (stuck ${this.levelStuckCounter})` };
                    }
                    const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
                    if (path.found) {
                        return this._followPath(path, 'navigate', `giving up on level, going back up (stuck ${this.levelStuckCounter})`);
                    }
                    // If can't path to upstairs and VERY stuck (>150 turns), do random movement
                    // to try to find a way out or discover new areas
                    if (this.levelStuckCounter > 150) {
                        const directions = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
                        const randomDir = directions[Math.floor(Math.random() * directions.length)];
                        return { type: 'random_move', key: randomDir, reason: `can't reach upstairs, random walk (stuck ${this.levelStuckCounter})` };
                    }
                }

                // Only search aggressively if we've explored most reachable areas
                // If there are still frontier cells, we should explore them first
                const frontier = level.getExplorationFrontier();
                if (frontier.length < 10 && this.searchesAtPosition < 30) {
                    // Very few unexplored cells - search for secrets
                    this.searchesAtPosition++;
                    if (currentCell) currentCell.searched++;
                    return { type: 'search', key: 's', reason: `aggressive search for hidden stairs (stuck ${this.levelStuckCounter})` };
                }

                // After extensive searching, if still stuck, try different strategies
                if (this.levelStuckCounter > 100) {
                    const frontier = level.getExplorationFrontier();

                    // If there are many frontier cells (> 30), we're not exploring efficiently
                    // Clear blacklist and try random movement to get unstuck
                    if (frontier.length > 30) {
                        // Every 30 turns of being stuck, clear the blacklist and do random moves
                        if (this.levelStuckCounter % 30 === 0) {
                            this.failedTargets.clear();
                            const directions = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
                            const randomDir = directions[Math.floor(Math.random() * directions.length)];
                            return { type: 'random_move', key: randomDir, reason: `stuck with ${frontier.length} frontier cells, clearing blacklist and random move` };
                        }
                    }

                    // Blacklist nearby frontier cells only if frontier is small (they're probably unreachable)
                    if (frontier.length <= 30) {
                        let blacklistedCount = 0;
                        for (const target of frontier) {
                            const dist = Math.max(Math.abs(target.x - px), Math.abs(target.y - py));
                            if (dist <= 5) {
                                const tKey = target.y * 80 + target.x;
                                this.failedTargets.add(tKey);
                                blacklistedCount++;
                            }
                        }
                        // Also blacklist search candidates that we're stuck near
                        const searchCandidates = level.getSearchCandidates();
                        for (const cand of searchCandidates) {
                            const dist = Math.max(Math.abs(cand.x - px), Math.abs(cand.y - py));
                            if (dist <= 3) {
                                const cKey = cand.y * 80 + cand.x;
                                this.failedTargets.add(cKey);
                                blacklistedCount++;
                            }
                        }

                        // Only do this blacklisting once per stuck period
                        // DON'T reset levelStuckCounter - let it keep growing to trigger other escapes
                        if (blacklistedCount > 0) {
                            this.stuckCounter = 0;
                            // Reduce levelStuckCounter slightly but don't reset to 0
                            this.levelStuckCounter = Math.max(50, this.levelStuckCounter - 30);
                        }

                        // On Dlvl 1 with small frontier, if very stuck (>200 turns), force random exploration
                        // since we can't retreat upstairs and have probably exhausted reachable areas
                        if (this.dungeon.currentDepth === 1 && this.levelStuckCounter > 200) {
                            const directions = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
                            const randomDir = directions[Math.floor(Math.random() * directions.length)];
                            return { type: 'random_move', key: randomDir, reason: `Dlvl 1 stuck >200 turns, random exploration` };
                        }
                    }
                }
            }
        }

        // 6.3. Prioritize exploring newly revealed secret doors/corridors
        // When we find a secret, immediately path to it and explore beyond
        if (this.newlyRevealedDoors && this.newlyRevealedDoors.length > 0) {
            // Remove stale entries (older than 80 turns to allow thorough exploration)
            this.newlyRevealedDoors = this.newlyRevealedDoors.filter(d => this.turnNumber - d.turn < 80);

            // Try to path to the nearest revealed door
            for (const door of this.newlyRevealedDoors) {
                const path = findPath(level, px, py, door.x, door.y, { allowUnexplored: false });
                if (path.found) {
                    // If we're at or very close to the door, explore beyond
                    const atDoor = (px === door.x && py === door.y);
                    const nearDoor = Math.max(Math.abs(px - door.x), Math.abs(py - door.y)) <= 1;

                    if (atDoor || nearDoor) {
                        // Find ALL frontier cells near the door (within 15 cells)
                        const frontier = level.getExplorationFrontier();
                        const nearbyFrontier = frontier.filter(f => {
                            const dist = Math.max(Math.abs(f.x - door.x), Math.abs(f.y - door.y));
                            return dist < 15;
                        });

                        if (nearbyFrontier.length > 0) {
                            // Try to path to the nearest nearby frontier
                            for (const target of nearbyFrontier.slice(0, 10)) {
                                const path2 = findPath(level, px, py, target.x, target.y, { allowUnexplored: true });
                                if (path2.found) {
                                    return this._followPath(path2, 'explore', `exploring near revealed door at (${door.x},${door.y})`);
                                }
                            }
                        }

                        // If no nearby frontier, remove this door and continue
                        if (atDoor) {
                            this.newlyRevealedDoors = this.newlyRevealedDoors.filter(d => d.x !== door.x || d.y !== door.y);
                        }
                    } else {
                        // Path to the door
                        return this._followPath(path, 'navigate', `heading to newly revealed door at (${door.x},${door.y})`);
                    }
                }
            }
        }

        // 6.4. Re-search near recently found secrets
        // After finding a secret and exploring for a bit, search nearby walls again
        // to find additional secrets that may lead further
        if (this.lastSecretLocation && level.stairsDown.length === 0) {
            const timeSinceSecret = this.turnNumber - this.lastSecretLocation.turn;
            // After 30-100 turns of exploring the revealed area, search nearby walls
            if (timeSinceSecret > 30 && timeSinceSecret < 100) {
                const sx = this.lastSecretLocation.x;
                const sy = this.lastSecretLocation.y;
                const dist = Math.max(Math.abs(px - sx), Math.abs(py - sy));

                // If we're within 10 cells of the last secret, look for search candidates nearby
                if (dist < 10) {
                    const searchCandidates = level.getSearchCandidates();
                    const nearbyCandidates = searchCandidates.filter(c => {
                        const cdist = Math.max(Math.abs(c.x - sx), Math.abs(c.y - sy));
                        return cdist < 12 && c.searched < 30;
                    });

                    if (nearbyCandidates.length > 0) {
                        for (const candidate of nearbyCandidates.slice(0, 5)) {
                            const candKey = candidate.y * 80 + candidate.x;
                            if (this.failedTargets && this.failedTargets.has(candKey)) continue;

                            const path = findPath(level, px, py, candidate.x, candidate.y, { allowUnexplored: false });
                            if (path.found) {
                                if (px === candidate.x && py === candidate.y) {
                                    const cell = level.at(px, py);
                                    if (cell) cell.searched++;
                                    return { type: 'search', key: 's', reason: `searching near last secret for more hidden doors [${cell ? cell.searched : 0}/20]` };
                                }
                                return this._followPath(path, 'navigate', `searching near last secret location (${sx},${sy})`);
                            }
                        }
                    }
                }
            }

            // Clear the lastSecretLocation after 100 turns
            if (timeSinceSecret > 100) {
                this.lastSecretLocation = null;
            }
        }

        // 6.5. Systematic wall searching when no stairs found
        // If we've explored available areas but haven't found stairs, systematically
        // search walls to reveal secret doors/corridors
        // Search probability is 1/7, so search each location up to 30 times for ~99.5% success rate

        // Opportunistic wall searching: search when at positions with adjacent walls
        // BUT: Only if we've explored enough to avoid excessive searching
        // Require BOTH low frontier AND reasonable exploration to prevent premature searching
        const opportunisticFrontier = level.getExplorationFrontier();
        const opportunisticExploredPct = level.exploredCount / (80 * 21);
        const shouldSearchOpportunistically = (
            opportunisticFrontier.length < 15 &&  // Low frontier
            opportunisticExploredPct > 0.05       // Explored at least 5% of map (~84 cells)
        );

        if (level.stairsDown.length === 0 && currentCell && currentCell.walkable && shouldSearchOpportunistically) {
            const hasAdjacentWall = level._hasAdjacentWall(px, py);
            if (hasAdjacentWall && currentCell.searched < 30) {
                // Search adjacent walls
                const directions = [
                    [-1, -1], [0, -1], [1, -1],
                    [-1,  0],          [1,  0],
                    [-1,  1], [0,  1], [1,  1],
                ];

                for (const [dx, dy] of directions) {
                    const nx = px + dx, ny = py + dy;
                    if (nx < 0 || nx >= 80 || ny < 0 || ny >= 21) continue;

                    const adjCell = level.at(nx, ny);
                    if (adjCell && adjCell.explored && adjCell.type === 'wall' && adjCell.searched < 10) {
                        adjCell.searched++;
                        currentCell.searched++;
                        return { type: 'search', key: 's', reason: `opportunistic wall search at (${px},${py}) checking (${nx},${ny})` };
                    }
                }

                // No unsearched walls, but mark position as searched
                if (currentCell.searched < 10) {
                    currentCell.searched++;
                    return { type: 'search', key: 's', reason: `opportunistic search at candidate (${px},${py})` };
                }
            }
        }

        const frontier = level.getExplorationFrontier();
        const frontierSmall = frontier.length < 10;  // Very few unexplored cells
        const exploredPercent = level.exploredCount / (80 * 21);

        // CRITICAL: Only search for secrets if we've thoroughly explored reachable areas
        // Don't waste time searching when there are still many unexplored frontier cells
        const thoroughlyExplored = frontierSmall || exploredPercent > 0.50;  // Explored 50%+ of map

        // Also consider stuck: high frontier but very low exploration progress
        // This indicates frontier cells are unreachable without finding secrets
        // Trigger at turn 150 to allow searching before far exploration dominates
        const stuckExploring = (
            this.turnNumber > 150 &&
            frontier.length > 50 &&   // Many frontier cells
            exploredPercent < 0.20    // But low overall coverage
        );

        // Trigger searching if: no downstairs found AND (explored most reachable areas OR stuck)
        const shouldSearch = level.stairsDown.length === 0 && this.turnNumber > 60 && (thoroughlyExplored || stuckExploring);
        if (shouldSearch) {
            const searchCandidates = level.getSearchCandidates();
            // Filter to candidates that haven't been heavily searched yet
            const unsearchedCandidates = searchCandidates.filter(c => c.searched < 30);

            if (unsearchedCandidates.length > 0) {
                // Filter to REACHABLE candidates first to avoid wasting turns
                const reachableCandidates = unsearchedCandidates.filter(c => {
                    const candKey = c.y * 80 + c.x;
                    if (this.failedTargets && this.failedTargets.has(candKey)) return false;
                    const path = findPath(level, px, py, c.x, c.y, { allowUnexplored: false });
                    return path.found;
                });

                // Try to path to the nearest reachable candidate
                // Increased from 10 to 50 to ensure we find secret doors at lower priority
                for (const candidate of reachableCandidates.slice(0, 50)) {
                    const candKey = candidate.y * 80 + candidate.x;
                    const path = findPath(level, px, py, candidate.x, candidate.y, { allowUnexplored: false });
                    if (path.found) {
                        // Track search candidate progress to avoid infinite loops
                        // If we've been trying to reach this candidate for 5+ turns, blacklist it
                        if (this.lastSearchCandidate &&
                            this.lastSearchCandidate.x === candidate.x &&
                            this.lastSearchCandidate.y === candidate.y) {
                            const dist = Math.max(Math.abs(px - candidate.x), Math.abs(py - candidate.y));
                            if (dist >= (this.lastSearchCandidateDistance || 999)) {
                                this.searchCandidateStuckCount = (this.searchCandidateStuckCount || 0) + 1;
                                if (this.searchCandidateStuckCount >= 5) {
                                    console.log(`[SEARCH] Abandoning search candidate (${candidate.x},${candidate.y}) - no progress in 5 turns`);
                                    this.failedTargets.add(candKey);
                                    this.lastSearchCandidate = null;
                                    this.searchCandidateStuckCount = 0;
                                    this.lastSearchCandidateDistance = null;
                                    continue; // Try next candidate
                                }
                            } else {
                                // Making progress
                                this.searchCandidateStuckCount = 0;
                            }
                            this.lastSearchCandidateDistance = dist;
                        } else {
                            // New search candidate
                            this.lastSearchCandidate = { x: candidate.x, y: candidate.y };
                            this.lastSearchCandidateDistance = Math.max(Math.abs(px - candidate.x), Math.abs(py - candidate.y));
                            this.searchCandidateStuckCount = 0;
                        }

                        // If we're at the candidate, use breadth-first searching
                        // Search ALL adjacent walls before moving to the next candidate
                        if (px === candidate.x && py === candidate.y) {
                            // Clear tracking when we reach the candidate
                            this.lastSearchCandidate = null;
                            this.searchCandidateStuckCount = 0;
                            this.lastSearchCandidateDistance = null;
                            // Check all 8 directions for unsearched walls
                            const directions = [
                                [-1, -1], [0, -1], [1, -1],
                                [-1,  0],          [1,  0],
                                [-1,  1], [0,  1], [1,  1],
                            ];

                            for (const [dx, dy] of directions) {
                                const nx = px + dx, ny = py + dy;
                                if (nx < 0 || nx >= 80 || ny < 0 || ny >= 21) continue;

                                const adjCell = level.at(nx, ny);
                                // Search adjacent walls that haven't been thoroughly searched
                                if (adjCell && adjCell.explored && adjCell.type === 'wall' && adjCell.searched < 10) {
                                    adjCell.searched++;
                                    const cell = level.at(px, py);
                                    if (cell) cell.searched++;
                                    return { type: 'search', key: 's', reason: `breadth-first wall search from (${px},${py}) checking (${nx},${ny}) [${adjCell.searched}/10]` };
                                }
                            }

                            // All adjacent walls searched, mark this position as done
                            const cell = level.at(px, py);
                            if (cell && cell.searched < 30) {
                                cell.searched++;
                                return { type: 'search', key: 's', reason: `systematic wall search at (${px},${py}) [searched=${cell.searched}]` };
                            }
                        }
                        // Otherwise path to it
                        return this._followPath(path, 'navigate', `heading to search candidate (${candidate.x},${candidate.y})`);
                    }
                }
            }

            // If no reachable search candidates, or all are heavily searched,
            // just search from current position (might help in edge cases)
            if (this.levelStuckCounter > 40 && currentCell && currentCell.searched < 30) {
                currentCell.searched++;
                return { type: 'search', key: 's', reason: `exhaustive search from current position (stuck ${this.levelStuckCounter})` };
            }
        }

        // 7. If oscillating / stuck, try different strategies
        // Also trigger if we're totally immobile (same position for 5+ turns)
        const totallyStuck = this.lastPosition &&
            this.lastPosition.x === px && this.lastPosition.y === py &&
            this.stuckCounter >= 5;

        if (this.stuckCounter > 3 || totallyStuck) {
            // Abandon committed path since we're stuck
            this.committedTarget = null;
            this.committedPath = null;

            // If we're totally stuck (immobile), skip searching and try moving
            if (totallyStuck && this.searchesAtPosition >= 1) {
                this.searchesAtPosition = 3; // Skip further searches
            }

            // Try searching briefly for secret doors
            if (this.searchesAtPosition < 3) {
                this.searchesAtPosition++;
                if (currentCell) currentCell.searched++;
                return { type: 'search', key: 's', reason: 'searching for secret passages (stuck)' };
            }

            // Mark well-searched adjacent unexplored cells as stone
            // (if we searched 3+ times and nothing was revealed, it's likely solid rock)
            if (currentCell && currentCell.searched >= 3) {
                this._markDeadEndFrontier(px, py, level);
            }

            // If we're VERY stuck (levelStuckCounter > 80), skip pathfinding and just
            // do random movement - pathfinding is clearly not working
            const veryStuck = this.levelStuckCounter > 80;

            // Check if we need exhaustive exploration (no stairs found after long time)
            const needsExhaustiveSearch = (this.turnNumber > 150 && level.stairsDown.length === 0);

            if (!veryStuck) {
                // Head for downstairs if known
                if (level.stairsDown.length > 0) {
                    const stairs = level.stairsDown[0];
                    // If we're already at the downstairs, descend immediately
                    if (px === stairs.x && py === stairs.y) {
                        console.log(`[DEBUG] At downstairs, descending`); return { type: 'descend', key: '>', reason: 'descending (stuck)' };
                    }
                    const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
                    if (path.found) {
                        return this._followPath(path, 'navigate', `heading to downstairs (stuck) at (${stairs.x},${stairs.y})`);
                    }
                }

                // Force explore with allowUnexplored to reach frontier through unexplored territory
                const frontier = level.getExplorationFrontier();
                if (frontier.length > 0) {
                    // If we need exhaustive search, try ALL frontier cells, not just first 20
                    const targetsToTry = needsExhaustiveSearch ? frontier : frontier.slice(0, 20);

                    for (const target of targetsToTry) {
                        // Skip if we're already at this target
                        if (px === target.x && py === target.y) continue;

                        const tKey = target.y * 80 + target.x;
                        if (this.failedTargets.has(tKey)) continue;
                        const path = findPath(level, px, py, target.x, target.y, { allowUnexplored: true });
                        if (path.found) {
                            this.committedTarget = { x: target.x, y: target.y };
                            // Reset stuckCounter to give the agent a chance to reach this target
                            // before abandoning it on the next turn
                            this.stuckCounter = 0;
                            const reason = needsExhaustiveSearch ?
                                `exhaustive search (no stairs found, turn ${this.turnNumber})` :
                                `force-exploring toward (${target.x},${target.y})`;
                            return this._followPath(path, 'explore', reason);
                        }
                    }
                }

                // If frontier empty but coverage is low, we need to EXPAND VISION
                // Move toward unexplored areas to reveal more of the map
                const exploredPercent = level.exploredCount / (80 * 21);
                if (frontier.length === 0 && exploredPercent < 0.30) {
                    console.log(`[EXPAND] Frontier empty, coverage ${Math.round(exploredPercent*100)}% - expanding vision`);
                    // Find the nearest unexplored cell and move toward it
                    let nearestUnexplored = null;
                    let minDist = Infinity;

                    for (let y = 0; y < 21; y++) {
                        for (let x = 0; x < 80; x++) {
                            const cell = level.at(x, y);
                            if (!cell || !cell.explored) {
                                const dist = Math.abs(x - px) + Math.abs(y - py);
                                if (dist < minDist) {
                                    minDist = dist;
                                    nearestUnexplored = { x, y };
                                }
                            }
                        }
                    }

                    if (nearestUnexplored) {
                        console.log(`[EXPAND] Found nearest unexplored: (${nearestUnexplored.x},${nearestUnexplored.y}), dist=${minDist}`);
                        // Try to path there with allowUnexplored=true
                        const path = findPath(level, px, py, nearestUnexplored.x, nearestUnexplored.y, { allowUnexplored: true });
                        console.log(`[EXPAND] Path to unexplored: found=${path.found}, cost=${path.cost}`);
                        if (path.found) {
                            return this._followPath(path, 'explore', `expanding vision toward (${nearestUnexplored.x},${nearestUnexplored.y}) - low coverage ${Math.round(exploredPercent*100)}%`);
                        }
                    } else {
                        console.log(`[EXPAND] No unexplored cells found!`);
                    }
                }

                // If exhaustive search needed and frontier empty, search for secret doors
                if (needsExhaustiveSearch && frontier.length === 0) {
                    const dirs = [
                        { dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 },
                        { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
                    ];

                    for (const dir of dirs) {
                        const nx = px + dir.dx, ny = py + dir.dy;
                        const cell = level.at(nx, ny);
                        if (cell && cell.type === 'wall' && cell.searched < 5) {
                            if (currentCell) currentCell.searched++;
                            return { type: 'search', key: 's', reason: 'searching walls for secret doors (no stairs found)' };
                        }
                    }
                }
            }

            // If we're totally stuck (same position for many turns), be more aggressive
            if (totallyStuck) {
                // Try multiple random directions until we find a walkable one
                const level = this.dungeon.currentLevel;
                const dirs = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
                // Shuffle directions for variety
                for (let i = dirs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
                }
                // Try each direction and pick first that looks walkable
                for (const dir of dirs) {
                    const delta = directionDelta(dir);
                    if (delta) {
                        const nx = px + delta.dx, ny = py + delta.dy;
                        const cell = level.at(nx, ny);
                        if (cell && cell.walkable !== false) {
                            return { type: 'random_move', key: dir, reason: `totally stuck, trying ${dir}` };
                        }
                    }
                }
            }

            // Try a random direction to unstick
            const dirs = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
            const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
            return { type: 'random_move', key: randomDir, reason: 'stuck, trying random direction' };
        }

        // 8. Explore: move toward nearest unexplored area
        //    Use path commitment: stick with a target until we reach it or can't progress
        const exploreAction = this._commitToExploration(level, px, py);
        if (exploreAction) return exploreAction;

        // 9. No unexplored areas -- head for downstairs
        if (level.stairsDown.length > 0) {
            const stairs = level.stairsDown[0];
            // If we're already at the downstairs, descend immediately
            if (px === stairs.x && py === stairs.y) {
                console.log(`[DEBUG] At downstairs (${px},${py}), attempting descent with '>'`);
                console.log(`[DEBUG] At downstairs, descending`); return { type: 'descend', key: '>', reason: 'descending (exploration complete)' };
            }
            const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
            if (path.found) {
                return this._followPath(path, 'navigate', `heading to downstairs at (${stairs.x},${stairs.y})`);
            }
        }

        // 10. Search for secret doors (only if thoroughly explored)
        // IMPORTANT: Only search if we've exhausted reachable areas
        // Don't waste time searching when frontier cells remain
        const frontierForSearch = level.getExplorationFrontier();
        const exploredPercentForSearch = level.exploredCount / (80 * 21);
        const thoroughlyExploredForSearch = frontierForSearch.length < 10 || exploredPercentForSearch > 0.50;

        if (thoroughlyExploredForSearch && this.searchesAtPosition < 20) {
            this.searchesAtPosition++;
            if (currentCell) currentCell.searched++;
            return { type: 'search', key: 's', reason: 'searching for secret passages' };
        }

        // 11. Last resort: random walk
        this.consecutiveWaits++;
        const dirs = ['h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'];
        const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
        return { type: 'random_move', key: randomDir, reason: 'fully explored, random walk' };
    }

    /**
     * Execute the chosen action.
     */
    async _act(action) {
        this.lastAction = action.type;
        // Reset rest counter when taking non-rest actions
        if (action.type !== 'rest') {
            this.restTurns = 0;
        }
        if (this.adapter.queueInput) {
            if (action.type === 'wield' && this.pendingWieldLetter) {
                const letter = this.pendingWieldLetter;
                this.pendingWieldLetter = null;
                this.adapter.queueInput(letter);
            } else if (action.type === 'wear' && this.pendingWearLetter) {
                const letter = this.pendingWearLetter;
                this.pendingWearLetter = null;
                this.adapter.queueInput(letter);
            } else if (action.type === 'quaff' && this.pendingQuaffLetter) {
                const letter = this.pendingQuaffLetter;
                this.pendingQuaffLetter = null;
                this.adapter.queueInput(letter);
            } else if (action.type === 'eat' && this.pendingEatLetter) {
                const letter = this.pendingEatLetter;
                this.pendingEatLetter = null;
                this.adapter.queueInput(letter);
            }
        }
        await this.adapter.sendKey(action.key);
    }

    /**
     * Refresh inventory by sending 'i' and parsing the result.
     * This is expensive (requires extra key press + screen read), so call sparingly.
     */
    async _refreshInventory() {
        // Headless adapters can provide inventory lines directly.
        if (this.adapter.getInventoryLines) {
            const lines = await this.adapter.getInventoryLines();
            const success = this.inventory.parseFromLines(lines);
            if (success) {
                this.inventory.lastUpdate = this.turnNumber;
            }
            return success;
        }

        // Send 'i' to view inventory
        await this.adapter.sendKey('i');

        // Read the inventory screen (use raw lines so row 0 is included)
        const rawScreen = await this.adapter.readScreen();
        const lines = rawScreen.map(row => row.map(cell => cell.ch || ' ').join(''));
        const success = this.inventory.parseFromLines(lines);

        // Dismiss inventory screen (space or escape)
        await this.adapter.sendKey(' ');

        // Update last check turn
        if (success) {
            this.inventory.lastUpdate = this.turnNumber;
        }

        return success;
    }

    /**
     * Evaluate whether it's safe/wise to descend stairs.
     * Returns {shouldDescend: boolean, reason: string}
     */
    _shouldDescendStairs() {
        if (!this.status) {
            return { shouldDescend: true, reason: 'no status available (default: descend)' };
        }

        const hpPercent = this.status.hp / this.status.hpmax;
        const dungeonLevel = this.status.dungeonLevel || 1;
        const playerLevel = this.status.experienceLevel || 1;

        // Check for nearby threats
        const nearbyMonsters = findMonsters(this.screen);
        const hasNearbyMonsters = nearbyMonsters.length > 0;

        // Assess danger of nearby monsters
        let maxDanger = DangerLevel.LOW;
        for (const monster of nearbyMonsters.slice(0, 3)) {
            const danger = assessMonsterDanger(
                monster.ch,
                this.status.hp,
                this.status.hpmax,
                playerLevel,
                dungeonLevel
            );
            maxDanger = Math.max(maxDanger, danger);
        }

        // Check resources
        const healingPotions = this.inventory.findHealingPotions();
        const potionCount = healingPotions.length;

        // Decision criteria (ordered by priority)

        // 1. NEVER descend when being actively chased and HP low
        if (hasNearbyMonsters && hpPercent < 0.5) {
            return { shouldDescend: false, reason: `HP too low (${Math.round(hpPercent*100)}%) with monsters nearby` };
        }

        // 2. Don't descend when surrounded by multiple monsters (risky regardless of HP)
        if (nearbyMonsters.length >= 3) {
            return { shouldDescend: false, reason: `surrounded by ${nearbyMonsters.length} monsters, too risky` };
        }

        // 3. Don't descend if HP is critically low (< 40%) unless we're on Dlvl 1
        if (hpPercent < 0.4 && dungeonLevel > 1) {
            return { shouldDescend: false, reason: `HP critical (${Math.round(hpPercent*100)}%), should heal first` };
        }

        // 4. Don't descend with moderate HP and no potions (even on mid-levels)
        if (hpPercent < 0.5 && potionCount === 0 && dungeonLevel >= 2) {
            return { shouldDescend: false, reason: `HP moderate (${Math.round(hpPercent*100)}%), no healing potions available` };
        }

        // 5. Don't descend on deep levels (Dlvl 4+) with moderate HP and no potions
        if (dungeonLevel >= 4 && hpPercent < 0.7 && potionCount === 0) {
            return { shouldDescend: false, reason: `HP moderate (${Math.round(hpPercent*100)}%), no healing potions, deep level` };
        }

        // 6. Don't descend if facing HIGH danger monsters nearby
        if (maxDanger >= DangerLevel.HIGH) {
            return { shouldDescend: false, reason: `HIGH danger monsters nearby, should clear them first` };
        }

        // 7. On deep levels (Dlvl 5+), require good HP (>60%) and resources
        if (dungeonLevel >= 5) {
            if (hpPercent < 0.6) {
                return { shouldDescend: false, reason: `deep level (Dlvl ${dungeonLevel}), HP too low (${Math.round(hpPercent*100)}%)` };
            }
            if (potionCount === 0 && hpPercent < 0.8) {
                return { shouldDescend: false, reason: `deep level, no potions, HP not full (${Math.round(hpPercent*100)}%)` };
            }
        }

        // 8. Safe to descend
        const hpStatus = hpPercent >= 0.8 ? 'excellent' : hpPercent >= 0.6 ? 'good' : 'moderate';
        const resourceStatus = potionCount >= 2 ? ` (${potionCount} potions)` : potionCount === 1 ? ' (1 potion)' : ' (no potions)';
        return { shouldDescend: true, reason: `descending (HP ${hpStatus}: ${Math.round(hpPercent*100)}%${resourceStatus})` };
    }

    /**
     * Find a direction to flee from monsters.
     */
    _fleeFrom(px, py, monsters, level) {
        // Find the direction that maximizes distance from all monsters
        const dirs = [
            { dx: -1, dy: -1, key: 'y' }, { dx: 0, dy: -1, key: 'k' },
            { dx: 1, dy: -1, key: 'u' }, { dx: -1, dy: 0, key: 'h' },
            { dx: 1, dy: 0, key: 'l' }, { dx: -1, dy: 1, key: 'b' },
            { dx: 0, dy: 1, key: 'j' }, { dx: 1, dy: 1, key: 'n' },
        ];

        let bestDir = null;
        let bestScore = -Infinity;

        for (const dir of dirs) {
            const nx = px + dir.dx;
            const ny = py + dir.dy;
            const cell = level.at(nx, ny);
            if (!cell || !cell.walkable) continue;
            if (cell.monster) continue; // don't flee into another monster

            // Score = min distance to any monster (higher is better)
            let minDist = Infinity;
            for (const mon of monsters) {
                const dist = Math.max(Math.abs(nx - mon.x), Math.abs(ny - mon.y));
                if (dist < minDist) minDist = dist;
            }

            if (minDist > bestScore) {
                bestScore = minDist;
                bestDir = dir.key;
            }
        }

        return bestDir;
    }

    /**
     * Find an adjacent monster (for melee combat).
     * Skips known pets and positions where we refused to attack.
     */
    _findAdjacentMonster(px, py) {
        const monsters = findMonsters(this.screen);
        for (const mon of monsters) {
            if (Math.abs(mon.x - px) <= 1 && Math.abs(mon.y - py) <= 1) {
                if (mon.x !== px || mon.y !== py) { // not self
                    const posKey = mon.y * 80 + mon.x;
                    // Skip known pets (by position)
                    if (this.petPositions.has(posKey)) continue;
                    // Skip positions where we declined "Really attack?"
                    if (this.refusedAttackPositions.has(posKey)) continue;
                    // Skip monsters whose character type was identified as pet via displacement
                    if (this.knownPetChars.has(mon.ch)) continue;
                    this.lastAttemptedAttackPos = { x: mon.x, y: mon.y };
                    return mon;
                }
            }
        }
        return null;
    }

    /**
     * Detect combat oscillation: agent moving between same 2-3 positions repeatedly.
     * Returns true if oscillation detected (same 2-3 positions, 3+ times in last 8 combat turns).
     */
    _detectCombatOscillation(px, py) {
        // Add current position to combat history
        this.combatPositions.push({ x: px, y: py, turn: this.turnNumber });

        // Keep only last 8 positions
        if (this.combatPositions.length > 8) {
            this.combatPositions.shift();
        }

        // Need at least 8 positions to detect oscillation
        if (this.combatPositions.length < 8) {
            return false;
        }

        // Count unique positions in last 8 turns
        const positionCounts = new Map();
        for (const pos of this.combatPositions) {
            const key = `${pos.x},${pos.y}`;
            positionCounts.set(key, (positionCounts.get(key) || 0) + 1);
        }

        const uniquePositions = positionCounts.size;
        const maxRepeats = Math.max(...positionCounts.values());

        // Oscillation: 2-3 unique positions, with at least one repeated 3+ times
        if (uniquePositions <= 3 && maxRepeats >= 3) {
            return true;
        }

        return false;
    }

    /**
     * Mark unexplored cells adjacent to a well-searched position as explored stone.
     * This removes dead-end frontier cells from the exploration target list.
     */
    _markDeadEndFrontier(px, py, level) {
        const dirs = [
            [-1,-1], [0,-1], [1,-1],
            [-1,0],          [1,0],
            [-1,1],  [0,1],  [1,1],
        ];
        for (const [dx, dy] of dirs) {
            const nx = px + dx, ny = py + dy;
            const cell = level.at(nx, ny);
            if (cell && !cell.explored) {
                // Mark as explored stone (dead end)
                cell.explored = true;
                cell.type = 'stone';
                cell.ch = ' ';
                cell.walkable = false;
                cell.stale = true;
            }
        }
    }

    /**
     * Follow a path, returning the next action.
     * Just walk toward the next cell — the JS port auto-opens closed doors,
     * and the C binary's "This door is closed" is handled by _handleUIState.
     */
    _followPath(path, actionType, reason) {
        const key = path.firstKey;
        // Safety check: if firstKey is null (path too short), we're likely already at destination
        if (!key) {
            console.warn(`_followPath: path.firstKey is null (path length ${path.path.length}), reason: ${reason}`);
            // Return a wait action instead of invalid movement
            return { type: 'wait', key: '.', reason: `path.firstKey null: ${reason}` };
        }
        return { type: actionType, key, reason };
    }

    /**
     * Path commitment for exploration: pick a target and follow it until we
     * reach it, it becomes invalid, or we're stuck trying to reach it.
     * This prevents oscillation between nearby frontier cells.
     */
    _commitToExploration(level, px, py) {
        // Check if we've reached our committed target
        if (this.committedTarget) {
            const tx = this.committedTarget.x;
            const ty = this.committedTarget.y;
            if (px === tx && py === ty) {
                // Reached it! Before clearing, check if we should continue through a door
                const currentCell = level.at(px, py);
                const atDoor = currentCell && (currentCell.type === 'door_open' || currentCell.type === 'door_closed');

                // Only use door-continuation logic for actual doors, not corridors
                // (corridor logic was causing oscillation by walking backwards)
                if (atDoor) {
                    // Check all cardinal directions for unexplored space
                    const dirs = [
                        { key: 'k', dx: 0, dy: -1, name: 'north' },
                        { key: 'j', dx: 0, dy: 1, name: 'south' },
                        { key: 'h', dx: -1, dy: 0, name: 'west' },
                        { key: 'l', dx: 1, dy: 0, name: 'east' },
                    ];

                    for (const dir of dirs) {
                        const nx = px + dir.dx;
                        const ny = py + dir.dy;
                        const ncell = level.at(nx, ny);

                        // Walk through doors into unexplored cells
                        if (!ncell || !ncell.explored) {
                            console.log(`[DOOR-EXPLORE] At door, continuing ${dir.name} into unexplored at (${nx},${ny})`);
                            return { type: 'explore', key: dir.key, reason: `continuing ${dir.name} through door` };
                        }
                    }
                }

                // Reached target and nothing to continue through - clear and find next
                this.committedTarget = null;
                this.committedPath = null;
                this.targetStuckCount = 0;
                this.lastCommittedDistance = null;
            }
        }

        // Check if committed target is still a valid frontier cell
        if (this.committedTarget) {
            const tx = this.committedTarget.x;
            const ty = this.committedTarget.y;
            const targetCell = level.at(tx, ty);

            // If we're very close to the target (1-3 cells), keep it even if it's not a frontier anymore
            // This handles the case where a door opens and reveals cells beyond, making the door
            // no longer a "frontier" but we still want to walk through it
            const distToTarget = Math.max(Math.abs(px - tx), Math.abs(py - ty));
            const veryClose = distToTarget <= 3;

            // Invalid if: not explored, not walkable, or no longer borders unexplored
            let stillFrontier = false;
            if (targetCell && targetCell.explored && targetCell.walkable) {
                const dirs = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
                for (const [dx, dy] of dirs) {
                    const nx = tx + dx, ny = ty + dy;
                    const neighbor = level.at(nx, ny);
                    if (neighbor && !neighbor.explored) { stillFrontier = true; break; }
                }
            }

            // Keep target if: still a frontier OR we're very close to it
            if (!stillFrontier && !veryClose) {
                console.log(`[COMMIT] Abandoning target (${tx},${ty}): stillFrontier=${stillFrontier}, distToTarget=${distToTarget}, veryClose=${veryClose}`);
                this.committedTarget = null;
                this.committedPath = null;
                this.targetStuckCount = 0;
                this.lastCommittedDistance = null;
            } else if (!stillFrontier && veryClose) {
                console.log(`[COMMIT] Keeping target (${tx},${ty}) despite not frontier: veryClose=${veryClose}, distToTarget=${distToTarget}`);
            }
        }

        // Re-path to committed target
        if (this.committedTarget) {
            const tx = this.committedTarget.x;
            const ty = this.committedTarget.y;

            // If we're already at the target, clear it and find a new one
            // This can happen if the target was set but we're already there
            if (px === tx && py === ty) {
                console.log(`[COMMIT] Already at target (${tx},${ty}), clearing and finding new target`);
                this.committedTarget = null;
                this.committedPath = null;
                this.targetStuckCount = 0;
                this.lastCommittedDistance = null;
                // Fall through to find a new target below
            } else {
                const path = findPath(level, px, py, tx, ty);
                console.log(`[COMMIT] Re-pathing from (${px},${py}) to target (${tx},${ty}): found=${path.found}, cost=${path.cost}`);
                if (path.found) {
                    this.committedPath = path;
                    this.consecutiveWaits = 0;

                    // Track distance progress
                    const distToTarget = Math.max(Math.abs(px - tx), Math.abs(py - ty));
                    if (!this.lastCommittedDistance) this.lastCommittedDistance = distToTarget;

                    // Abandon if no progress in 5 turns
                    if (distToTarget >= this.lastCommittedDistance) {
                        this.targetStuckCount++;
                        if (this.targetStuckCount >= 5) {
                            console.log(`[COMMIT] Abandoning target (${tx},${ty}) - no progress in 5 turns (dist=${distToTarget})`);
                            const tKey = ty * 80 + tx;
                            this.failedTargets.add(tKey);
                            this.committedTarget = null;
                            this.committedPath = null;
                            this.targetStuckCount = 0;
                            this.lastCommittedDistance = null;
                            // Fall through to find new target
                        } else {
                            this.lastCommittedDistance = distToTarget;
                            return this._followPath(path, 'explore', `following path to (${tx},${ty}) [stuck=${this.targetStuckCount}]`);
                        }
                    } else {
                        // Making progress - reset counter
                        this.targetStuckCount = 0;
                        this.lastCommittedDistance = distToTarget;
                        return this._followPath(path, 'explore', `following path to (${tx},${ty})`);
                    }
                } else {
                    // Can't reach target - blacklist immediately
                    console.log(`[COMMIT] Abandoning target (${tx},${ty}) - path not found`);
                    const tKey = ty * 80 + tx;
                    this.failedTargets.add(tKey);
                    this.committedTarget = null;
                    this.committedPath = null;
                    this.targetStuckCount = 0;
                    this.lastCommittedDistance = null;
                }
            }
        }

        // Find a new target: use findExplorationTarget but commit to its destination
        // Skip blacklisted targets we've failed to reach
        //
        // Stuck detection: If frontier exists but exploration progress is low,
        // switch to picking FAR targets to break out of local loops
        const frontier = level.getExplorationFrontier();
        const exploredPercent = level.exploredCount / (80 * 21);
        const isStuckExploring = (
            frontier.length > 10 &&                      // Has frontier to explore
            (this.levelStuckCounter > 20 ||              // Been stuck, OR
             (this.turnNumber > 150 && exploredPercent < 0.25)) &&  // Taking too long with low coverage
            exploredPercent < 0.60                       // Not yet thoroughly explored
        );

        // When stuck exploring (moving but not progressing), clear blacklist
        // to allow reconsidering distant targets that may have been prematurely blacklisted
        if (isStuckExploring && this.turnNumber % 50 === 0) {
            this.failedTargets.clear();
        }

        // PRIORITY: Systematic door opening when stuck with high frontier
        // If we have many unreachable frontier cells, closed doors are likely blocking access
        if (frontier.length > 25 && this.levelStuckCounter > 20) {
            // Find all closed/locked doors in explored areas
            const closedDoors = [];
            for (let y = 0; y < 21; y++) {
                for (let x = 0; x < 80; x++) {
                    const cell = level.at(x, y);
                    if (cell && cell.explored && (cell.type === 'door_closed' || cell.type === 'door_locked')) {
                        // Check if we've already tried this door recently
                        const doorKey = y * 80 + x;
                        if (!this.failedTargets.has(doorKey)) {
                            closedDoors.push({ x, y, type: cell.type, dist: Math.max(Math.abs(x - px), Math.abs(y - py)) });
                        }
                    }
                }
            }

            if (closedDoors.length > 0) {
                console.log(`[DOOR-SYSTEMATIC] Found ${closedDoors.length} closed/locked doors to try`);
                // Sort by distance, try nearest door first
                closedDoors.sort((a, b) => a.dist - b.dist);

                for (const door of closedDoors) {
                    const path = findPath(level, px, py, door.x, door.y, { allowUnexplored: false });
                    if (path.found) {
                        const action = door.type === 'door_locked' ? 'kicking' : 'opening';
                        console.log(`[DOOR-SYSTEMATIC] ${action} ${door.type} door at (${door.x},${door.y}) to unlock frontier (${frontier.length} unreachable)`);

                        // Set pending locked door if it's locked (will trigger kicking logic)
                        if (door.type === 'door_locked' && !this.pendingLockedDoor) {
                            this.pendingLockedDoor = { x: door.x, y: door.y, attempts: 0 };
                        }

                        return this._followPath(path, 'navigate', `${action} door at (${door.x},${door.y}) to unlock areas`);
                    }
                }
            }
        }

        // Log spatial awareness when stuck (for debugging)
        if (isStuckExploring && this.turnNumber % 50 === 0) {
            try {
                const quadrants = level.getQuadrantCoverage();
                const centroid = level.getUnexploredCentroid();
                const bias = level.getExplorationBias();
                console.log(`[SPATIAL] Quadrants: NW=${(quadrants.NW*100).toFixed(0)}% NE=${(quadrants.NE*100).toFixed(0)}% SW=${(quadrants.SW*100).toFixed(0)}% SE=${(quadrants.SE*100).toFixed(0)}%`);
                if (centroid) {
                    console.log(`[SPATIAL] Unexplored centroid at (${centroid.x},${centroid.y}), mass=${centroid.mass}`);
                }
                if (bias.direction) {
                    console.log(`[SPATIAL] Bias: explore ${bias.direction} (priority ${(bias.priority*100).toFixed(0)}%)`);
                }
            } catch (err) {
                // Ignore errors in spatial logging
            }
        }

        const options = { preferFar: isStuckExploring };
        const explorationPath = findExplorationTarget(level, px, py, this.recentPositions, options);
        if (explorationPath && explorationPath.found) {
            const dest = explorationPath.path[explorationPath.path.length - 1];
            const destKey = dest.y * 80 + dest.x;
            if (!this.failedTargets.has(destKey)) {
                this.committedTarget = { x: dest.x, y: dest.y };
                this.committedPath = explorationPath;
                this.consecutiveWaits = 0;
                if (isStuckExploring) {
                    return this._followPath(explorationPath, 'explore', `[STUCK-FAR] exploring toward distant (${dest.x},${dest.y})`);
                }
                return this._followPath(explorationPath, 'explore', `exploring toward (${dest.x},${dest.y})`);
            }
        }

        // PRIORITY: If we're at or near a door/corridor, walk through it to reveal more map
        // This ensures we explore beyond doors before resorting to wall-searching
        if (frontier.length === 0 && exploredPercent < 0.30) {
            const currentCell = level.at(px, py);
            const isDoor = currentCell && (currentCell.type === 'door_open' || currentCell.type === 'door_closed');

            // Check all adjacent cells for doors or corridors that lead to unexplored space
            const directions = [
                { key: 'k', dx: 0, dy: -1, name: 'north' },
                { key: 'j', dx: 0, dy: 1, name: 'south' },
                { key: 'h', dx: -1, dy: 0, name: 'west' },
                { key: 'l', dx: 1, dy: 0, name: 'east' },
            ];

            for (const dir of directions) {
                const nx = px + dir.dx;
                const ny = py + dir.dy;
                const ncell = level.at(nx, ny);

                // Skip walls
                if (!ncell || (ncell.explored && !ncell.walkable)) continue;

                // Prioritize walking through doors or into unexplored cells
                if (!ncell.explored ||
                    ncell.type === 'door_open' ||
                    ncell.type === 'door_closed' ||
                    ncell.type === 'corridor') {

                    // Check if there's unexplored space beyond this cell
                    const bx = nx + dir.dx;
                    const by = ny + dir.dy;
                    const bcell = level.at(bx, by);

                    if (!bcell || !bcell.explored) {
                        console.log(`[EXPLORE-DOOR] Walking ${dir.name} through ${ncell.explored ? ncell.type : 'unexplored'} at (${nx},${ny})`);
                        return { type: 'explore', key: dir.key, reason: `exploring ${dir.name} through ${ncell.explored ? ncell.type : 'door/corridor'}` };
                    }
                }
            }
        }

        // No frontier found - need to expand vision by moving toward unexplored areas
        // COMMIT to one direction for 20 turns to avoid oscillation
        if (exploredPercent < 0.30 && frontier.length === 0) {
            // Pick a new direction every 20 turns, or if we haven't set one yet
            if (!this.expandDir || (this.turnNumber - this.expandDirTurn) >= 20) {
                const directions = [
                    { key: 'k', dx: 0, dy: -1, name: 'north' },
                    { key: 'j', dx: 0, dy: 1, name: 'south' },
                    { key: 'l', dx: 1, dy: 0, name: 'east' },
                    { key: 'h', dx: -1, dy: 0, name: 'west' },
                ];

                // Score each direction by counting unexplored cells in that direction
                let bestDir = null;
                let bestScore = -1;

                for (const dir of directions) {
                    const nx = px + dir.dx;
                    const ny = py + dir.dy;
                    const ncell = level.at(nx, ny);

                    // Skip if not walkable
                    if (!ncell || (ncell.explored && !ncell.walkable)) continue;

                    // Count unexplored cells in a 10-cell line in this direction
                    // STOP if we hit an explored wall (can't go further)
                    let score = 0;
                    for (let i = 1; i <= 10; i++) {
                        const tx = px + dir.dx * i;
                        const ty = py + dir.dy * i;
                        const tcell = level.at(tx, ty);

                        // Hit an explored wall - can't go further!
                        if (tcell && tcell.explored && !tcell.walkable) {
                            break;
                        }

                        // Count unexplored or walkable cells
                        if (!tcell || !tcell.explored || tcell.walkable) {
                            score++;
                        }
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestDir = dir;
                    }
                }

                if (bestDir) {
                    this.expandDir = bestDir;
                    this.expandDirTurn = this.turnNumber;
                    console.log(`[EXPAND-VISION] Committed to ${bestDir.name} for 20 turns (score=${bestScore}, coverage ${Math.round(exploredPercent*100)}%)`);
                } else {
                    console.log(`[EXPAND-VISION] All directions blocked! (coverage ${Math.round(exploredPercent*100)}%)`);
                }
            }

            if (this.expandDir) {
                return { type: 'explore', key: this.expandDir.key, reason: `walking ${this.expandDir.name} to expand vision - ${Math.round(exploredPercent*100)}% coverage` };
            }
        } else if (this.expandDir) {
            // Clear direction when we find a frontier
            this.expandDir = null;
        }

        return null;
    }

    /**
     * Find an adjacent closed door and return {x, y, key} for opening it.
     */
    _findAdjacentDoor(px, py) {
        const level = this.dungeon.currentLevel;
        const dirList = [
            { dx: 0, dy: -1, key: 'k' }, { dx: -1, dy: 0, key: 'h' },
            { dx: 1, dy: 0, key: 'l' }, { dx: 0, dy: 1, key: 'j' },
            { dx: -1, dy: -1, key: 'y' }, { dx: 1, dy: -1, key: 'u' },
            { dx: -1, dy: 1, key: 'b' }, { dx: 1, dy: 1, key: 'n' },
        ];
        for (const dir of dirList) {
            const nx = px + dir.dx, ny = py + dir.dy;
            const cell = level.at(nx, ny);
            if (cell && cell.type === 'door_closed') {
                return { x: nx, y: ny, key: dir.key };
            }
        }
        return null;
    }


    /**
     * Detect movement failure: if we tried to move but position didn't change,
     * the target cell is blocked. Mark it as not walkable so pathfinding avoids it.
     */
    _detectMovementFailure(action, prePos) {
        if (!action || !prePos) return;

        // Only check movement-type actions (not attack — staying in place is expected)
        const moveTypes = new Set(['explore', 'navigate', 'flee', 'random_move']);
        if (!moveTypes.has(action.type)) return;

        // Check if position changed (need to re-read screen for post-move position)
        // We can't re-read here since _act already sent the key. We'll check on next turn.
        // Instead, save the action for checking on the next turn.
        this._lastMoveAction = action;
        this._lastMovePrePos = prePos;
    }

    /**
     * Check if the last movement action failed and mark cells accordingly.
     * Called at the start of each turn with the new screen.
     */
    _checkLastMoveFailed() {
        if (!this._lastMoveAction || !this._lastMovePrePos || !this.screen) return;

        const px = this.screen.playerX;
        const py = this.screen.playerY;
        const prePos = this._lastMovePrePos;
        const action = this._lastMoveAction;

        // If position didn't change and we tried to move, the target was blocked
        if (px === prePos.x && py === prePos.y && action.key) {
            this.consecutiveFailedMoves++;
            const delta = directionDelta(action.key);
            if (delta) {
                const tx = prePos.x + delta.dx;
                const ty = prePos.y + delta.dy;
                const level = this.dungeon.currentLevel;
                const cell = level.at(tx, ty);

                // Check for door-related messages
                const message = this.screen.message || '';
                const isLockedDoorMessage = message.toLowerCase().includes('door is locked') ||
                                           message.toLowerCase().includes('this door resists');
                const doorOpenedMessage = message.toLowerCase().includes('the door opens') ||
                                         message.toLowerCase().includes('door opens');

                // If the door just opened, save the position for manual fix after map update
                // (The screen might still show it as a wall due to rendering lag)
                if (doorOpenedMessage) {
                    console.log(`[DOOR-OPEN] Door opened at (${tx},${ty}), will fix after map update`);
                    this.justOpenedDoor = { x: tx, y: ty };
                    this.consecutiveFailedMoves = 0; // Reset since door is now open
                    this._lastMoveAction = null;
                    this._lastMovePrePos = null;
                    return; // Don't continue with other checks
                }

                // If we failed to move through a door, it might be locked
                const isDoorCell = cell && (cell.type === 'door_open' || cell.type === 'door_closed');

                if ((isLockedDoorMessage || (isDoorCell && this.consecutiveFailedMoves >= 2)) && cell) {
                    // Mark door as locked
                    console.log(`[LOCKED DOOR] Detected at (${tx},${ty}), cellType=${cell.type}, failedMoves=${this.consecutiveFailedMoves}, msg="${message}"`);
                    cell.type = 'door_locked';
                    cell.explored = true;
                    // Don't mark as unwalkable yet - we'll try to kick it first

                    // Store locked door position for potential kicking
                    if (!this.pendingLockedDoor) {
                        this.pendingLockedDoor = { x: tx, y: ty, attempts: 0 };
                    }

                    // Clear committed target since current path is blocked
                    if (this.committedTarget) {
                        const tKey = this.committedTarget.y * 80 + this.committedTarget.x;
                        this.failedTargets.add(tKey);
                        this.committedTarget = null;
                        this.committedPath = null;
                    }
                } else if (cell && !cell.explored) {
                    // Mark unexplored cell we couldn't walk into as explored wall
                    cell.explored = true;
                    cell.type = 'wall';
                    cell.walkable = false;
                    cell.stale = true;
                }

                // If we've failed to move repeatedly, blacklist committed target
                if (this.consecutiveFailedMoves >= 3 && this.committedTarget) {
                    const tKey = this.committedTarget.y * 80 + this.committedTarget.x;
                    this.failedTargets.add(tKey);
                    this.committedTarget = null;
                    this.committedPath = null;
                }
            }
        } else {
            this.consecutiveFailedMoves = 0;
        }

        this._lastMoveAction = null;
        this._lastMovePrePos = null;
    }

    /**
     * Detect pet displacement: if last action was "attack" and we swapped
     * positions with the target, that was a pet displacement.
     */
    _detectPetDisplacement() {
        if (this.lastAction !== 'attack' || !this.lastAttemptedAttackPos || !this.lastPosition) return;

        const px = this.screen.playerX;
        const py = this.screen.playerY;
        if (px < 0 || py < 0) return;

        const target = this.lastAttemptedAttackPos;
        const oldPos = this.lastPosition;

        // If we're now at the target's old position...
        if (px === target.x && py === target.y) {
            // ...and there's a monster at our old position, it was a swap
            const monsters = findMonsters(this.screen);
            for (const mon of monsters) {
                if (mon.x === oldPos.x && mon.y === oldPos.y) {
                    // This monster is a pet (we displaced it)
                    this.knownPetChars.add(mon.ch);
                    this.refusedAttackPositions.add(mon.y * 80 + mon.x);
                    break;
                }
            }
        }
    }

    /**
     * Track pet positions.
     * On early turns, adjacent d/f/C (dog/cat/horse) are pets.
     * After that, we mark monsters as pets when "Really attack" is declined.
     * Refused-attack positions are refreshed: old ones expire, new ones added
     * when monsters move to new positions.
     */
    _updatePets() {
        const px = this.screen.playerX;
        const py = this.screen.playerY;
        if (px < 0 || py < 0) return;

        this.petPositions.clear();

        const monsters = findMonsters(this.screen);
        const petChars = new Set(['d', 'f', 'C']); // dog, cat, horse

        // Build set of current monster positions
        const currentMonsterPositions = new Set();
        for (const mon of monsters) {
            currentMonsterPositions.add(mon.y * 80 + mon.x);

            const dist = Math.max(Math.abs(mon.x - px), Math.abs(mon.y - py));

            // On first few turns, adjacent d/f/C are almost certainly pets
            if (this.turnNumber < 5 && dist <= 2 && petChars.has(mon.ch)) {
                this.petPositions.add(mon.y * 80 + mon.x);
            }
        }

        // Clean up refused-attack positions: remove positions where no monster exists
        // (the pet moved away, so the position is safe to walk through)
        for (const posKey of this.refusedAttackPositions) {
            if (!currentMonsterPositions.has(posKey)) {
                this.refusedAttackPositions.delete(posKey);
            }
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
