/**
 * xoshiro256** PRNG implementation to match Lua 5.4's math.random
 *
 * C ref: Lua 5.4 uses xoshiro256** for math.random()
 * NetHack's Lua themed room reservoir sampling uses math.random (invisible to RNG logger)
 * This must be seeded identically to C's Lua to produce the same themed room selections
 *
 * Algorithm: https://prng.di.unimi.it/xoshiro256starstar.c
 */

let s0 = 0n;
let s1 = 0n;
let s2 = 0n;
let s3 = 0n;

/**
 * Seed the xoshiro256** state with four 64-bit values
 * C ref: Lua seeds from system entropy, but NetHack should seed from MT state
 *
 * @param {bigint} seed0 - First 64-bit seed value
 * @param {bigint} seed1 - Second 64-bit seed value
 * @param {bigint} seed2 - Third 64-bit seed value
 * @param {bigint} seed3 - Fourth 64-bit seed value
 */
export function seedXoshiro(seed0, seed1, seed2, seed3) {
    s0 = BigInt.asUintN(64, seed0);
    s1 = BigInt.asUintN(64, seed1);
    s2 = BigInt.asUintN(64, seed2);
    s3 = BigInt.asUintN(64, seed3);
}

/**
 * Rotate left operation for 64-bit values
 * @param {bigint} x - Value to rotate
 * @param {number} k - Number of bits to rotate
 * @returns {bigint} - Rotated value
 */
function rotl(x, k) {
    const n = BigInt(k);
    return BigInt.asUintN(64, (x << n) | (x >> (64n - n)));
}

/**
 * Generate next random number (0.0 to 1.0, excluding 1.0)
 * Matches Lua 5.4's math.random() behavior
 *
 * @returns {number} - Random number in [0, 1)
 */
export function xoshiroRandom() {
    // xoshiro256** algorithm
    const result = BigInt.asUintN(64, rotl(s1 * 5n, 7) * 9n);
    const t = s1 << 17n;

    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 45);

    // Convert to double in [0, 1) range
    // Lua 5.4 uses the high 53 bits: (result >> 11) * (1.0 / (1 << 53))
    const shifted = result >> 11n;
    return Number(shifted) * (1.0 / 9007199254740992.0); // 2^53
}

/**
 * Get current state for debugging
 * @returns {object} - Current state
 */
export function getXoshiroState() {
    return {
        s0: s0.toString(16),
        s1: s1.toString(16),
        s2: s2.toString(16),
        s3: s3.toString(16)
    };
}

/**
 * Seed xoshiro from main NetHack RNG seed
 * C ref: Lua's math.random might be seeded from the main game seed, not MT init
 *
 * @param {number} seed - Main RNG seed (e.g., 163)
 */
export function seedFromMainRng(seed) {
    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_XOSHIRO === '1';

    if (DEBUG) {
        console.log(`\n[xoshiro] Seeding from main RNG seed: ${seed}`);
    }

    // Use SplitMix64 to generate 4 independent seeds from the main seed
    const seeds = splitmix64(BigInt(seed));
    seedXoshiro(seeds[0], seeds[1], seeds[2], seeds[3]);

    // Warm up the generator - Lua might advance state during initialization
    // Try different warmup counts to match C's behavior
    const warmupCount = 0; // Adjust this if needed
    for (let i = 0; i < warmupCount; i++) {
        xoshiroRandom();
    }

    if (DEBUG) {
        console.log('[xoshiro] SplitMix seeds:', seeds.map(s => s.toString(16)));
        console.log('[xoshiro] Warmup iterations:', warmupCount);
        console.log('[xoshiro] State after warmup:', getXoshiroState());
    }
}

/**
 * Simple SplitMix64 generator for seeding xoshiro from a single 64-bit value
 * C ref: Common pattern for seeding xoshiro from a single seed
 */
function splitmix64(seed) {
    const results = [];
    let state = BigInt.asUintN(64, seed);

    for (let i = 0; i < 4; i++) {
        state = BigInt.asUintN(64, state + 0x9e3779b97f4a7c15n);
        let z = state;
        z = BigInt.asUintN(64, (z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
        z = BigInt.asUintN(64, (z ^ (z >> 27n)) * 0x94d049bb133111ebn);
        results.push(BigInt.asUintN(64, z ^ (z >> 31n)));
    }

    return results;
}

/**
 * Seed xoshiro from NetHack MT initialization
 *
 * C ref: When Lua is initialized, math.random is seeded from system entropy or MT state
 * For NetHack, we need to seed from the MT19937 state to get deterministic results
 *
 * The MT initialization calls (30 total) set up the MT state:
 * - rn2(1000), rn2(1001), rn2(1002), rn2(1003), rn2(1004)
 * - rn2(1010)
 * - rn2(1012)
 * - rn2(1014) through rn2(1036)
 *
 * We'll use the first 4 values to create 64-bit seeds
 *
 * @param {number[]} mtInitValues - Array of rn2 results from MT init
 */
export function seedFromMT(mtInitValues) {
    if (mtInitValues.length < 30) {
        console.warn(`seedFromMT: got ${mtInitValues.length} values, expected 30`);
    }

    // Strategy: Use first few MT values to create a seed, then use SplitMix64 to expand
    // This is a common pattern for seeding xoshiro from limited entropy
    const v0 = BigInt(mtInitValues[0] || 0);
    const v1 = BigInt(mtInitValues[1] || 0);
    const v2 = BigInt(mtInitValues[2] || 0);
    const v3 = BigInt(mtInitValues[3] || 0);

    // Combine first 4 values into a 64-bit seed
    const combinedSeed = (v0 << 48n) | (v1 << 32n) | (v2 << 16n) | v3;

    // Use SplitMix64 to generate 4 independent 64-bit seeds
    const seeds = splitmix64(combinedSeed);

    seedXoshiro(seeds[0], seeds[1], seeds[2], seeds[3]);

    const DEBUG = typeof process !== 'undefined' && process.env.DEBUG_XOSHIRO === '1';
    if (DEBUG) {
        console.log('\n[xoshiro] Seeded from MT init values:', mtInitValues.slice(0, 4));
        console.log('[xoshiro] Combined seed:', combinedSeed.toString(16));
        console.log('[xoshiro] SplitMix seeds:', seeds.map(s => s.toString(16)));
        console.log('[xoshiro] State:', getXoshiroState());
    }
}
