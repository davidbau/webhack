// rng.js -- Random number generation
// Faithful port of rnd.c from the C source.
// Uses ISAAC64 PRNG for exact C compatibility.
// C ref: rnd.c, isaac64.c

import { isaac64_init, isaac64_next_uint64 } from './isaac64.js';

let ctx = null; // ISAAC64 context

// --- PRNG call logging ---
// When enabled, every rn2/rnd/rnl/d call is logged in the same format
// as the C PRNG logger (003-prng-logging patch).  Enable with enableRngLog(),
// retrieve with getRngLog(), disable with disableRngLog().
let rngLog = null;       // null = disabled, Array = enabled
let rngCallCount = 0;
let rngLogWithTags = false;  // when true, log includes caller info

export function enableRngLog(withTags = false) {
    rngLog = [];
    rngCallCount = 0;
    rngLogWithTags = withTags;
}

export function getRngLog() {
    return rngLog;
}

export function disableRngLog() {
    rngLog = null;
}

function logRng(func, args, result) {
    if (!rngLog) return;
    rngCallCount++;
    let tag = '';
    if (rngLogWithTags) {
        // Extract caller from stack trace (skip logRng → rn2/rnd → caller)
        const stack = new Error().stack;
        const lines = stack.split('\n');
        // lines[0]="Error", [1]=logRng, [2]=rn2/rnd, [3]=caller
        const callerLine = lines[3] || '';
        const m = callerLine.match(/at (\S+).*?([^/]+\.js:\d+)/);
        tag = m ? ` @ ${m[1]}(${m[2]})` : '';
    }
    rngLog.push(`${rngCallCount} ${func}(${args}) = ${result}${tag}`);
}

// Initialize the PRNG with a seed (unsigned long, up to 64 bits)
// C ref: rnd.c init_isaac64() -- converts seed to little-endian bytes
export function initRng(seed) {
    // Convert seed to BigInt, then to 8 little-endian bytes
    // C ref: rnd.c init_isaac64() -- sizeof(unsigned long) = 8 on 64-bit Linux
    let s = BigInt(seed) & 0xFFFFFFFFFFFFFFFFn;
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        bytes[i] = Number(s & 0xFFn);
        s >>= 8n;
    }
    ctx = isaac64_init(bytes);
    // Reset log counter on re-init (like C's init_random)
    if (rngLog) {
        rngLog.length = 0;
        rngCallCount = 0;
    }
}

// Raw 64-bit value, modulo x -- matches C's RND(x) macro
// C ref: rnd.c RND() = isaac64_next_uint64() % x
function RND(x) {
    const raw = isaac64_next_uint64(ctx);
    return Number(raw % BigInt(x));
}

// 0 <= rn2(x) < x
// C ref: rnd.c:93-107
export function rn2(x) {
    if (x <= 0) return 0;
    const result = RND(x);
    logRng('rn2', x, result);
    return result;
}

// 1 <= rnd(x) <= x
// C ref: rnd.c:153-165
export function rnd(x) {
    if (x <= 0) return 1;
    const result = RND(x) + 1;
    logRng('rnd', x, result);
    return result;
}

// rn1(x, y) = rn2(x) + y -- random in [y, y+x-1]
// C ref: hack.h macro -- NOT logged separately (rn2 inside is logged)
export function rn1(x, y) {
    return rn2(x) + y;
}

// rnl(x) - luck-adjusted random, good luck approaches 0
// C ref: rnd.c:109-151
export function rnl(x, luck = 0) {
    if (x <= 0) return 0;
    let adjustment = luck;
    if (x <= 15) {
        adjustment = Math.floor((Math.abs(adjustment) + 1) / 3) * Math.sign(adjustment);
    }
    let i = RND(x);
    if (adjustment && rn2(37 + Math.abs(adjustment))) {
        i -= adjustment;
        if (i < 0) i = 0;
        else if (i >= x) i = x - 1;
    }
    logRng('rnl', x, i);
    return i;
}

// d(n, x) = NdX dice roll = n + sum of n RND(x) calls
// C ref: rnd.c:173-188
export function d(n, x) {
    // C: tmp = n; while(n--) tmp += RND(x); return tmp;
    let tmp = n;
    for (let i = 0; i < n; i++) {
        tmp += RND(x);
    }
    logRng('d', `${n},${x}`, tmp);
    return tmp;
}

// C ref: rnd.c rnz() -- randomized scaling
export function rnz(i) {
    let x = i;
    let tmp = 1000;
    tmp += rn2(1000);
    tmp *= rne(4);
    if (rn2(2)) {
        x = Math.floor(x * tmp / 1000);
    } else {
        x = Math.floor(x * 1000 / tmp);
    }
    return x;
}

// C ref: rnd.c rne() -- 1 <= rne(x) <= max(u.ulevel/3, 5)
// During mklev at level 1, u.ulevel = 1, so utmp = 5
export function rne(x) {
    const utmp = 5; // u.ulevel < 15 → utmp = 5
    let tmp = 1;
    while (tmp < utmp && !rn2(x))
        tmp++;
    return tmp;
}

// Advance the PRNG by n steps without logging.
// Used to skip past C startup calls (o_init, u_init, etc.) that JS
// doesn't implement yet, aligning the PRNG state for level generation.
export function skipRng(n) {
    for (let i = 0; i < n; i++) {
        isaac64_next_uint64(ctx);
    }
}

// Return the raw ISAAC64 context (for save/restore)
export function getRngState() {
    return ctx;
}

// Restore ISAAC64 context (for save/restore)
export function setRngState(savedCtx) {
    ctx = savedCtx;
}

// Initialize with a random seed by default
initRng(Math.floor(Math.random() * 0xFFFFFFFF));
