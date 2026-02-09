// selfplay/agent.js -- Top-level NetHack AI agent
//
// The agent's main perceive → decide → act loop. Uses the screen parser
// and map tracker for perception, the strategy/tactics modules for
// decisions, and sends commands through the platform adapter interface.

import { parseScreen, parseTmuxCapture, findMonsters, findStairs } from './perception/screen_parser.js';
import { parseStatus } from './perception/status_parser.js';
import { DungeonTracker } from './perception/map_tracker.js';
import { findPath, findExplorationTarget, findNearest, directionKey, directionDelta } from './brain/pathing.js';

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
     * @param {function} [options.shouldStop] - Check if agent should stop: () => boolean
     */
    constructor(adapter, options = {}) {
        this.adapter = adapter;
        this.maxTurns = options.maxTurns || 10000;
        this.moveDelay = options.moveDelay || 0;
        this.onTurn = options.onTurn || null;
        this.shouldStop = options.shouldStop || (() => false);

        // Perception
        this.dungeon = new DungeonTracker();
        this.screen = null;
        this.status = null;

        // State
        this.turnNumber = 0;
        this.lastAction = '';
        this.consecutiveWaits = 0;
        this.stuckCounter = 0;      // detect when agent is stuck (resets on real progress)
        this.levelStuckCounter = 0; // total stuck turns on this level (never resets)
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
        this.committedTarget = null; // {x, y} of committed exploration target
        this.committedPath = null; // PathResult we're currently following
        this.targetStuckCount = 0; // how many turns we've been stuck on committed path
        this.failedTargets = new Set(); // targets we've failed to reach (blacklisted)
        this.consecutiveFailedMoves = 0; // consecutive turns where movement failed

        // Statistics
        this.stats = {
            turns: 0,
            kills: 0,
            levelsExplored: 0,
            maxDepth: 0,
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

            // Check for game over
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

            // Update pet tracking
            this._updatePets();

            // Decide and act
            const action = this._decide();
            const prePos = { x: this.screen.playerX, y: this.screen.playerY };
            await this._act(action);

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
        if (lower.includes('want to eat')) return 'a';

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
    _decide() {
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

        // Track if we're stuck (same position OR oscillating between nearby positions)
        if (this.lastPosition && this.lastPosition.x === px && this.lastPosition.y === py) {
            this.stuckCounter++;
            this.levelStuckCounter++;
        } else {
            // Detect oscillation: if we've been in this position in the last 6 turns
            const recentCount = this.recentPositionsList.slice(-6).filter(k => k === posKey).length;
            if (recentCount >= 2) {
                this.stuckCounter++;
                this.levelStuckCounter++;
            } else {
                this.stuckCounter = 0;
                this.searchesAtPosition = 0;
            }
        }
        this.lastPosition = { x: px, y: py };

        // --- Emergency checks (highest priority) ---

        // 1. If HP is critical and we have no way to heal, try to flee
        if (this.status && this.status.hpCritical) {
            const nearbyMonsters = findMonsters(this.screen);
            if (nearbyMonsters.length > 0) {
                const fleeDir = this._fleeFrom(px, py, nearbyMonsters, level);
                if (fleeDir) {
                    return { type: 'flee', key: fleeDir, reason: 'HP critical, fleeing' };
                }
            }
        }

        // 2. If hungry and have food, eat
        // TODO: Check inventory for food items before trying to eat
        // For now, skip eating to avoid infinite loop when no food available
        // if (this.status && this.status.needsFood) {
        //     return { type: 'eat', key: 'e', reason: 'need food' };
        // }

        // --- Tactical checks ---

        // 3. If there's a monster adjacent, fight it (unless it's dangerous)
        const adjacentMonster = this._findAdjacentMonster(px, py);
        if (adjacentMonster) {
            const dx = adjacentMonster.x - px;
            const dy = adjacentMonster.y - py;
            const key = DIR_KEYS[`${dx},${dy}`];
            if (key) {
                return { type: 'attack', key, reason: `attacking ${adjacentMonster.ch} at (${adjacentMonster.x},${adjacentMonster.y})` };
            }
        }

        // 4. Pick up items at current position
        const currentCell = level.at(px, py);
        if (currentCell && currentCell.items.length > 0) {
            return { type: 'pickup', key: ',', reason: 'picking up items' };
        }

        // --- Strategic movement ---

        // 5. If on downstairs, descend
        //    Check both cell type and registered features (player '@' overrides '>' on screen)
        const onDownstairs = (currentCell && currentCell.type === 'stairs_down') ||
            level.stairsDown.some(s => s.x === px && s.y === py);
        if (onDownstairs) {
            return { type: 'descend', key: '>', reason: 'descending stairs' };
        }

        // 6. If we've spent too long stuck on this level, head for stairs
        if (this.levelStuckCounter > 20 && level.stairsDown.length > 0) {
            const stairs = level.stairsDown[0];
            const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
            if (path.found) {
                return this._followPath(path, 'navigate', `heading to downstairs (level stuck ${this.levelStuckCounter}) at (${stairs.x},${stairs.y})`);
            }
        }

        // 7. If oscillating / stuck, try different strategies
        if (this.stuckCounter > 3) {
            // Abandon committed path since we're stuck
            this.committedTarget = null;
            this.committedPath = null;

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

            // Head for downstairs if known
            if (level.stairsDown.length > 0) {
                const stairs = level.stairsDown[0];
                const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
                if (path.found) {
                    return this._followPath(path, 'navigate', `heading to downstairs (stuck) at (${stairs.x},${stairs.y})`);
                }
            }

            // Force explore with allowUnexplored to reach frontier through unexplored territory
            const frontier = level.getExplorationFrontier();
            if (frontier.length > 0) {
                for (const target of frontier.slice(0, 20)) {
                    const tKey = target.y * 80 + target.x;
                    if (this.failedTargets.has(tKey)) continue;
                    const path = findPath(level, px, py, target.x, target.y, { allowUnexplored: true });
                    if (path.found) {
                        this.committedTarget = { x: target.x, y: target.y };
                        return this._followPath(path, 'explore', `force-exploring toward (${target.x},${target.y})`);
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
            const path = findPath(level, px, py, stairs.x, stairs.y, { allowUnexplored: true });
            if (path.found) {
                return this._followPath(path, 'navigate', `heading to downstairs at (${stairs.x},${stairs.y})`);
            }
        }

        // 10. Search for secret doors
        if (this.searchesAtPosition < 20) {
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
        await this.adapter.sendKey(action.key);
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
        return { type: actionType, key: path.firstKey, reason };
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
                // Reached it! Clear and find next.
                this.committedTarget = null;
                this.committedPath = null;
                this.targetStuckCount = 0;
            }
        }

        // Check if committed target is still a valid frontier cell
        if (this.committedTarget) {
            const tx = this.committedTarget.x;
            const ty = this.committedTarget.y;
            const targetCell = level.at(tx, ty);
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
            if (!stillFrontier) {
                this.committedTarget = null;
                this.committedPath = null;
                this.targetStuckCount = 0;
            }
        }

        // Re-path to committed target
        if (this.committedTarget) {
            const path = findPath(level, px, py, this.committedTarget.x, this.committedTarget.y);
            if (path.found) {
                this.committedPath = path;
                this.consecutiveWaits = 0;
                return this._followPath(path, 'explore', `following path to (${this.committedTarget.x},${this.committedTarget.y})`);
            }
            // Can't reach target anymore — abandon it
            this.committedTarget = null;
            this.committedPath = null;
            this.targetStuckCount = 0;
        }

        // Find a new target: use findExplorationTarget but commit to its destination
        // Skip blacklisted targets we've failed to reach
        const explorationPath = findExplorationTarget(level, px, py, this.recentPositions);
        if (explorationPath && explorationPath.found) {
            const dest = explorationPath.path[explorationPath.path.length - 1];
            const destKey = dest.y * 80 + dest.x;
            if (!this.failedTargets.has(destKey)) {
                this.committedTarget = { x: dest.x, y: dest.y };
                this.committedPath = explorationPath;
                this.consecutiveWaits = 0;
                return this._followPath(explorationPath, 'explore', `exploring toward (${dest.x},${dest.y})`);
            }
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
                if (cell && !cell.explored) {
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
