// test/comparison/test_result_format.js
// Standard test result format for all test types
//
// Supports:
// - Session tests (chargen, gameplay, interface, special)
// - Unit tests
// - E2E tests
//
// Used by test runners and stored in git notes.

import { execSync } from 'node:child_process';

/**
 * Create a generic test result (for unit/e2e tests)
 * @param {string} name - Test name or file
 * @param {string} type - Test type: 'unit', 'e2e', etc.
 * @returns {Object} Test result object
 */
export function createTestResult(name, type) {
    return {
        test: name,
        type,
        passed: true,
        duration: null, // ms, set via setDuration()
    };
}

/**
 * Set duration on a result (works for both session and generic tests)
 * @param {Object} result - Test result object
 * @param {number} durationMs - Duration in milliseconds
 */
export function setDuration(result, durationMs) {
    result.duration = durationMs;
}

/**
 * Create a new session test result
 * @param {Object} session - Session object with file, seed, type info
 * @returns {Object} Test result object
 */
export function createSessionResult(session) {
    const result = {
        session: session.file,
        type: inferSessionType(session.file),
        seed: session.seed,
        passed: true,
        metrics: {
            rngCalls: { matched: 0, total: 0 },
            keys: { matched: 0, total: 0 },
            grids: { matched: 0, total: 0 },
            screens: { matched: 0, total: 0 },
        },
    };

    // Add metadata based on session type
    if (result.type === 'chargen') {
        const match = session.file.match(/chargen_(\w+)/);
        if (match) result.role = match[1];
        // Check for race/alignment variants
        const variant = session.file.match(/chargen_\w+_(\w+)\./);
        if (variant) result.variant = variant[1];
    }

    return result;
}

/**
 * Infer session type from filename
 */
function inferSessionType(filename) {
    if (filename.includes('_chargen')) return 'chargen';
    if (filename.includes('_gameplay')) return 'gameplay';
    if (filename.includes('interface_')) return 'interface';
    if (filename.includes('_special_')) return 'special';
    if (filename.startsWith('seed') && filename.includes('_')) {
        // Option tests like seed301_verbose_on
        const parts = filename.split('_');
        if (parts.length >= 2 && !parts[1].includes('chargen') && !parts[1].includes('gameplay')) {
            return 'option';
        }
    }
    return 'unknown';
}

/**
 * Record RNG comparison for a session
 */
export function recordRng(result, matched, total, divergence = null) {
    result.metrics.rngCalls.matched += matched;
    result.metrics.rngCalls.total += total;
    if (matched < total) {
        result.passed = false;
        if (!result.firstDivergence && divergence) {
            result.firstDivergence = divergence;
        }
    }
}

/**
 * Record keystroke comparison
 */
export function recordKeys(result, matched, total) {
    result.metrics.keys.matched += matched;
    result.metrics.keys.total += total;
    if (matched < total) {
        result.passed = false;
    }
}

/**
 * Record grid comparison
 */
export function recordGrids(result, matched, total) {
    result.metrics.grids.matched += matched;
    result.metrics.grids.total += total;
    if (matched < total) {
        result.passed = false;
    }
}

/**
 * Record screen comparison
 */
export function recordScreens(result, matched, total) {
    result.metrics.screens.matched += matched;
    result.metrics.screens.total += total;
    if (matched < total) {
        result.passed = false;
    }
}

/**
 * Mark session as failed with optional error
 */
export function markFailed(result, error = null) {
    result.passed = false;
    if (error) {
        result.error = typeof error === 'string' ? error : error.message;
    }
}

/**
 * Finalize a result - remove empty/default fields
 */
export function finalizeResult(result) {
    // Remove zero-total metrics for cleaner output
    if (result.metrics) {
        const m = result.metrics;
        if (m.rngCalls?.total === 0) delete m.rngCalls;
        if (m.keys?.total === 0) delete m.keys;
        if (m.grids?.total === 0) delete m.grids;
        if (m.screens?.total === 0) delete m.screens;

        // Remove empty metrics object
        if (Object.keys(m).length === 0) delete result.metrics;
    }

    // Remove null duration
    if (result.duration === null) delete result.duration;

    return result;
}

/**
 * Create a results bundle from multiple session results
 * @param {Object[]} results - Array of session results
 * @param {Object} options - Bundle options
 * @returns {Object} Results bundle
 */
export function createResultsBundle(results, options = {}) {
    const bundle = {
        timestamp: new Date().toISOString(),
        commit: options.commit || getGitCommit(),
        goldenBranch: options.goldenBranch || null,
        results: results.map(finalizeResult),
    };

    // Add summary counts
    bundle.summary = {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
    };

    return bundle;
}

/**
 * Get current git commit hash
 */
function getGitCommit() {
    try {
        return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 8);
    } catch {
        return '';
    }
}

/**
 * Format a single result for console output
 */
export function formatResult(result) {
    const status = result.passed ? 'PASS' : 'FAIL';
    const m = result.metrics || {};
    const parts = [`[${status}] ${result.session}`];

    if (m.rngCalls) parts.push(`rng=${m.rngCalls.matched}/${m.rngCalls.total}`);
    if (m.grids) parts.push(`grids=${m.grids.matched}/${m.grids.total}`);
    if (m.screens) parts.push(`screens=${m.screens.matched}/${m.screens.total}`);
    if (result.error) parts.push(`error: ${result.error}`);

    return parts.join(' ');
}

/**
 * Format bundle summary for console output
 */
export function formatBundleSummary(bundle) {
    const s = bundle.summary;
    const lines = [
        `Commit: ${bundle.commit || '(unknown)'}`,
        `Tests: ${s.passed}/${s.total} passed (${s.failed} failed)`,
    ];
    if (bundle.goldenBranch) {
        lines.splice(1, 0, `Golden: ${bundle.goldenBranch}`);
    }
    return lines.join('\n');
}

/**
 * Merge multiple bundles into one (e.g., session + unit + e2e)
 * @param {Object[]} bundles - Array of result bundles
 * @param {Object} options - Override options (commit, timestamp)
 * @returns {Object} Merged bundle
 */
export function mergeBundles(bundles, options = {}) {
    const allResults = bundles.flatMap(b => b.results || []);
    const merged = {
        timestamp: options.timestamp || new Date().toISOString(),
        commit: options.commit || bundles[0]?.commit || getGitCommit(),
        goldenBranch: bundles.find(b => b.goldenBranch)?.goldenBranch || null,
        results: allResults,
        summary: {
            total: allResults.length,
            passed: allResults.filter(r => r.passed).length,
            failed: allResults.filter(r => !r.passed).length,
        },
    };
    return merged;
}
