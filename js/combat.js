// combat.js -- Compatibility shim for tests and legacy imports.
//
// Earlier versions of this codebase referenced combat primitives from
// `js/combat.js`. The implementation has since been split into
// `uhitm.js`/`mhitu.js`; this shim re-exports the active functions.

import { playerAttackMonster } from './uhitm.js';
import { monsterAttackPlayer } from './mhitu.js';
import { newexplevel } from './exper.js';

export { playerAttackMonster, monsterAttackPlayer };

// C helper: new level on sufficient XP.
export function checkLevelUp(player, display) {
    newexplevel(player, display);
}
