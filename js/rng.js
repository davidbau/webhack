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
//
// Caller context propagation (withTags=true):
// Like C's improved 003 patch, wrapper functions (rnz, rne, rnl, rn1)
// capture the caller's identity once on entry. Internal rn2/rnd calls
// inherit that context rather than showing "rnz" or "rne" as the caller.
// Context is cleared when the outermost RNG function returns.
let rngLog = null;       // null = disabled, Array = enabled
let rngCallCount = 0;
let rngLogWithTags = false;  // when true, log includes caller info
let rngCallerTag = null;     // current caller annotation (propagated through wrappers)
let rngDepth = 0;            // nesting depth for context propagation

export function enableRngLog(withTags = false) {
    rngLog = [];
    rngCallCount = 0;
    rngLogWithTags = withTags;
    rngCallerTag = null;
    rngDepth = 0;
}

export function getRngLog() {
    return rngLog;
}

export function disableRngLog() {
    rngLog = null;
    rngCallerTag = null;
    rngDepth = 0;
}

// Capture caller context on first entry into an RNG function.
// Wrapper functions (rnz, rne, rnl, rn1) and primitives (rn2, rnd)
// all call this. Only the outermost call (depth 0→1) captures the
// stack trace; inner calls inherit the existing tag.
function enterRng() {
    rngDepth++;
    if (rngDepth === 1 && rngLogWithTags) {
        const stack = new Error().stack;
        const lines = stack.split('\n');
        // [0]=Error, [1]=enterRng, [2]=rn2/rnz/etc, [3]=caller
        const callerLine = lines[3] || '';
        // ESM stack frames:
        //   "    at funcName (file:///path/to/file.js:line:col)"
        //   "    at file:///path/to/file.js:line:col"
        const m = callerLine.match(/at (?:(\S+) \()?.*?([^/\s]+\.js):(\d+)/);
        if (m) {
            rngCallerTag = m[1] ? `${m[1]}(${m[2]}:${m[3]})` : `${m[2]}:${m[3]}`;
        } else {
            rngCallerTag = null;
        }
    }
}

// Clear caller context when the outermost RNG function returns.
function exitRng() {
    if (--rngDepth === 0) {
        rngCallerTag = null;
    }
}

function logRng(func, args, result) {
    if (!rngLog) return;
    rngCallCount++;
    const tag = rngCallerTag ? ` @ ${rngCallerTag}` : '';
    rngLog.push(`${rngCallCount} ${func}(${args})=${result}${tag}`);
}

let _currentSeed = 0;

// Get the current RNG seed
export function getRngSeed() {
    return _currentSeed;
}

// Initialize the PRNG with a seed (unsigned long, up to 64 bits)
// C ref: rnd.c init_isaac64() -- converts seed to little-endian bytes
export function initRng(seed) {
    _currentSeed = seed;
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
    enterRng();
    if (x <= 0) { exitRng(); return 0; }

    // Debug Lua RNG calls
    if (typeof process !== 'undefined' && process.env.DEBUG_LUA_RNG === '1' && x >= 1000 && x <= 1040) {
        const stack = new Error().stack;
        console.log(`\n=== rn2(${x}) called (Lua RNG) ===`);
        console.log(`Stack:\n${stack}`);
    }

    const result = RND(x);
    logRng('rn2', x, result);
    exitRng();
    return result;
}

// 1 <= rnd(x) <= x
// C ref: rnd.c:153-165
export function rnd(x) {
    enterRng();
    if (x <= 0) { exitRng(); return 1; }
    const result = RND(x) + 1;
    logRng('rnd', x, result);
    exitRng();
    return result;
}

// rn1(x, y) = rn2(x) + y -- random in [y, y+x-1]
// C ref: hack.h macro -- NOT logged separately (rn2 inside is logged)
export function rn1(x, y) {
    enterRng();
    const result = rn2(x) + y;
    exitRng();
    return result;
}

// rnl(x) - luck-adjusted random, good luck approaches 0
// C ref: rnd.c:109-151
export function rnl(x, luck = 0) {
    enterRng();
    if (x <= 0) { exitRng(); return 0; }
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
    exitRng();
    return i;
}

// d(n, x) = NdX dice roll = n + sum of n random calls
// When called from Lua code (themerms.js), matches Lua's d() implementation
// which uses math.random() that is replaced with nh.random()
// C ref: dat/nhlib.lua d() uses math.random(1, faces), replaced with nh.random(1, faces)
// C ref: nhlua.c nhl_random(1, faces) = 1 + rn2(faces), logs rn2() call
export function d(n, x) {
    // Lua's d(): for i=1,dice do sum = sum + math.random(1, faces) end
    // math.random is replaced with nh.random in C
    // nh.random(1, x) = 1 + rn2(x), logs rn2(x)
    // Match C's logging by calling rn2(x) + 1 directly
    let tmp = 0;
    for (let i = 0; i < n; i++) {
        tmp += 1 + rn2(x);  // Match nh.random(1, x) = 1 + rn2(x)
    }
    return tmp;
}

// C ref: rnd.c rnz() -- randomized scaling
// C logs rnz summary via explicit rng_log_write; internal rn2 calls are
// suppressed by RNGLOG_IN_RND_C. Internal rne(4) IS logged (explicit log).
export function rnz(i) {
    enterRng();
    let x = i;
    let tmp = 1000;
    tmp += rn2(1000);
    tmp *= rne(4);
    if (rn2(2)) {
        x = Math.floor(x * tmp / 1000);
    } else {
        x = Math.floor(x * 1000 / tmp);
    }
    logRng('rnz', i, x);
    exitRng();
    return x;
}

// C ref: rnd.c rne() -- 1 <= rne(x) <= max(u.ulevel/3, 5)
// During mklev at level 1, u.ulevel = 1, so utmp = 5
// C logs rne summary via explicit rng_log_write; internal rn2 calls are
// suppressed by RNGLOG_IN_RND_C. We match this with rngDepth check in rn2.
export function rne(x) {
    enterRng();
    const utmp = 5; // u.ulevel < 15 → utmp = 5
    let tmp = 1;
    while (tmp < utmp && !rn2(x))
        tmp++;
    logRng('rne', x, tmp);
    exitRng();
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

// Get the RNG call count (for save/restore)
export function getRngCallCount() {
    return rngCallCount;
}

// Set the RNG call count (for save/restore)
export function setRngCallCount(count) {
    rngCallCount = count;
}

// Initialize with a random seed by default
initRng(Math.floor(Math.random() * 0xFFFFFFFF));
