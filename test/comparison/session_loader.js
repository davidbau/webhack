// test/comparison/session_loader.js -- Session format normalization and loading
//
// Handles v1/v2/v3 session format differences and provides unified access
// to session data. This module focuses on format parsing, not game logic.

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

// Strip ANSI escape/control sequences from a terminal line.
export function stripAnsiSequences(text) {
    if (!text) return '';
    return String(text)
        // CSI sequences (e.g. ESC[31m, ESC[0K)
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        // OSC sequences (e.g. ESC]...BEL or ESC]...ESC\)
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        // Single-character ESC sequences (e.g. ESC(0, ESC)0)
        .replace(/\x1b[@-Z\\-_]/g, '')
        // Remaining raw C1 CSI
        .replace(/\x9b[0-?]*[ -/]*[@-~]/g, '');
}

// Session screens may provide plain `screen`, richer `screenAnsi`, or both.
// Prefer ANSI when present, but normalize to plain text for comparisons.
export function getSessionScreenLines(screenHolder) {
    const raw = Array.isArray(screenHolder?.screenAnsi)
        ? screenHolder.screenAnsi
        : (Array.isArray(screenHolder?.screen) ? screenHolder.screen : []);
    return raw.map((line) => stripAnsiSequences(line));
}

// ---------------------------------------------------------------------------
// Session format helpers (v3 format)
// ---------------------------------------------------------------------------

// Get startup data from a v3 session.
// V3 format: startup is the first step with key === null and action === 'startup'
// Also checks for top-level startup field for sessions that use rngCalls instead of full trace.
export function getSessionStartup(session) {
    // Check for top-level startup field (used by some wizard transition sessions)
    if (session?.startup) {
        const rng = Array.isArray(session.startup.rng) ? session.startup.rng : [];
        return {
            rng,
            rngCalls: Number.isInteger(session.startup.rngCalls)
                ? session.startup.rngCalls
                : rng.length,
            typGrid: session.startup.typGrid,
            screen: session.startup.screen,
            screenAnsi: session.startup.screenAnsi,
        };
    }

    if (!session?.steps?.length) return null;

    const firstStep = session.steps[0];
    if (firstStep.key === null && firstStep.action === 'startup') {
        const rng = firstStep.rng || [];
        return {
            rng,
            rngCalls: Number.isInteger(firstStep.rngCalls)
                ? firstStep.rngCalls
                : rng.length,
            typGrid: firstStep.typGrid,
            screen: firstStep.screen,
            screenAnsi: firstStep.screenAnsi,
        };
    }

    return null;
}

// Get character config from v3 session (from options field)
export function getSessionCharacter(session) {
    if (!session?.options) return {};
    return {
        name: session.options.name,
        role: session.options.role,
        race: session.options.race,
        gender: session.options.gender,
        align: session.options.align,
    };
}

// Normalize a step to ensure rngCalls is available
function normalizeStep(step) {
    if (!step) return step;
    const rng = Array.isArray(step.rng) ? step.rng : [];
    return {
        ...step,
        rng,
        rngCalls: Number.isInteger(step.rngCalls) ? step.rngCalls : rng.length,
    };
}

// Get gameplay steps (excluding startup step in v3 format)
// Normalizes steps to ensure rngCalls is available
export function getSessionGameplaySteps(session) {
    if (!session?.steps) return [];

    // Skip first step if it's startup (key === null)
    const steps = session.steps.length > 0 && session.steps[0].key === null
        ? session.steps.slice(1)
        : session.steps;

    return steps.map(normalizeStep);
}

// Check if the first step has a 'burst' of RNG from startup
export function hasStartupBurstInFirstStep(session) {
    if (!session?.steps?.length) return false;
    const firstStep = session.steps[0];
    return firstStep.key === null && firstStep.action === 'startup';
}

// Collect RNG calls consumed during character selection menus before newgame().
// For chargen sessions, steps before "confirm-ok" may consume RNG (e.g., pick_align).
export function getPreStartupRngEntries(session) {
    if (session.type === 'chargen') {
        const out = [];
        for (const step of (session.steps || [])) {
            if (step.action === 'confirm-ok') break;
            out.push(...(step.rng || []));
        }
        return out;
    }
    if (session.chargen && session.chargen.length > 0) {
        const out = [];
        const confirmIndex = session.chargen.findIndex(s => s.action === 'confirm-ok');
        for (let i = 0; i < confirmIndex && i < session.chargen.length; i++) {
            out.push(...(session.chargen[i].rng || []));
        }
        return out;
    }
    return [];
}

// ---------------------------------------------------------------------------
// Session classification
// ---------------------------------------------------------------------------

// Classify session by type based on filename and content
export function classifySession(session) {
    const file = session.file || '';
    if (file.includes('_chargen')) return 'chargen';
    if (file.includes('_gameplay') || file.includes('_selfplay')) return 'gameplay';
    if (file.includes('_map')) return 'map';
    if (file.includes('_special')) return 'special';
    if (session.type) return session.type;
    return 'other';
}

// Create typed session result
export function createTypedSessionResult(session) {
    const type = classifySession(session);
    return {
        session: session.file,
        type,
        seed: session.seed || 0,
        passed: false,
    };
}

// ---------------------------------------------------------------------------
// Session loading
// ---------------------------------------------------------------------------

// Read a file from a git branch
function readGoldenFile(relativePath, goldenBranch) {
    try {
        return execSync(`git show ${goldenBranch}:${relativePath}`, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch {
        return null;
    }
}

// List files in a directory from a git branch
function listGoldenDir(relativePath, goldenBranch) {
    try {
        const output = execSync(`git ls-tree --name-only ${goldenBranch}:${relativePath}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return output.trim().split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

// Load sessions from a directory (or from a golden git branch)
export function loadSessions(dir, useGolden = false, goldenBranch = 'main', filter = () => true) {
    const relativePath = dir.replace(process.cwd() + '/', '');

    if (useGolden) {
        const files = listGoldenDir(relativePath, goldenBranch).filter(f => f.endsWith('.session.json'));
        return files
            .map((f) => {
                try {
                    const text = readGoldenFile(`${relativePath}/${f}`, goldenBranch);
                    if (!text) return null;
                    return { file: f, dir: `golden:${relativePath}`, ...JSON.parse(text) };
                } catch {
                    return null;
                }
            })
            .filter((s) => s && filter(s));
    }

    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter(f => f.endsWith('.session.json'))
        .map((f) => {
            try {
                return { file: f, dir, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) };
            } catch {
                return null;
            }
        })
        .filter((s) => s && filter(s));
}

// Load a single session file
export function loadSession(filePath) {
    try {
        const content = readFileSync(filePath, 'utf8');
        const session = JSON.parse(content);
        session.file = basename(filePath);
        return session;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Session normalization
// ---------------------------------------------------------------------------

// Normalize a session to a consistent format for processing.
// This handles differences between v1/v2/v3 session formats.
export function normalizeSession(session) {
    if (!session) return null;

    // Ensure session has required fields
    const normalized = {
        seed: session.seed || 0,
        type: classifySession(session),
        file: session.file || 'unknown',
        options: {
            name: session.options?.name || 'Agent',
            role: session.options?.role,
            race: session.options?.race,
            gender: session.options?.gender,
            align: session.options?.align,
            wizard: session.options?.wizard || false,
            ...session.options,
        },
        steps: session.steps || [],
        chargen: session.chargen || [],
    };

    // Copy other fields
    if (session.startup) normalized.startup = session.startup;
    if (session.grids) normalized.grids = session.grids;
    if (session.rng) normalized.rng = session.rng;

    return normalized;
}
