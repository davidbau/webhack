// attrib_exercise.js -- C-faithful exercise/exerchk RNG flow
// Mirrors relevant parts of attrib.c (exercise(), exerper(), exerchk()).

import { rn2, rn1 } from './rng.js';
import { A_STR } from './config.js';

const EXERCISE_LIMIT = 50;
const DEFAULT_NEXT_CHECK = 600;
const ATTR_COUNT = 6;

function ensureExerciseState(player) {
    if (!player) return;
    if (!Array.isArray(player.aexercise) || player.aexercise.length < ATTR_COUNT) {
        player.aexercise = Array.from({ length: ATTR_COUNT }, () => 0);
    }
    if (!Number.isInteger(player.nextAttrCheck)) {
        player.nextAttrCheck = DEFAULT_NEXT_CHECK;
    }
}

// C ref: attrib.c exercise()
export function exercise(player, attr, increase) {
    const roll = increase ? rn2(19) : rn2(2);
    if (!player || roll !== 0) return roll;
    ensureExerciseState(player);
    const cur = player.aexercise[attr] || 0;
    if (increase) {
        player.aexercise[attr] = Math.min(EXERCISE_LIMIT, cur + 1);
    } else {
        player.aexercise[attr] = Math.max(-EXERCISE_LIMIT, cur - 1);
    }
    return roll;
}

// C ref: attrib.c exerchk()
export function exerchk(player, moves) {
    if (!player || !Number.isInteger(moves)) return;
    ensureExerciseState(player);
    if (moves < player.nextAttrCheck) return;

    for (let i = 0; i < ATTR_COUNT; i++) {
        const ex = player.aexercise[i] || 0;
        if (!ex) continue;

        // C ref: if (i == A_STR || !rn2(50)) ...
        if (i === A_STR || rn2(50) < Math.abs(ex)) {
            // Attribute mutation side effects are not modeled here yet.
        }

        // C ref: AEXE(i) += (AEXE(i) > 0) ? -1 : 1;
        player.aexercise[i] += ex > 0 ? -1 : 1;
    }

    // C ref: next_check += rn1(200, 800)
    player.nextAttrCheck += rn1(200, 800);
}

export function initExerciseState(player) {
    ensureExerciseState(player);
}
