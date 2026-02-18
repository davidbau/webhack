// test/comparison/session_loader.js -- Session format normalization and loading.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export function stripAnsiSequences(text) {
    if (!text) return '';
    return String(text)
        // Preserve horizontal cursor-forward movement used in C captures
        // (e.g., "\x1b[9CVersion ...") as literal leading spaces.
        .replace(/\x1b\[(\d*)C/g, (_m, n) => ' '.repeat(Math.max(1, Number(n || '1'))))
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        .replace(/\x1b[@-Z\\-_]/g, '')
        .replace(/\x9b[0-?]*[ -/]*[@-~]/g, '');
}

export function getSessionScreenLines(screenHolder) {
    if (Array.isArray(screenHolder?.screen)) {
        return screenHolder.screen.map((line) => stripAnsiSequences(line));
    }
    if (typeof screenHolder?.screen === 'string') {
        return screenHolder.screen.split('\n').map((line) => stripAnsiSequences(line));
    }
    // Deprecated compatibility path. v3 canonical field is `screen`.
    if (Array.isArray(screenHolder?.screenAnsi)) {
        return screenHolder.screenAnsi.map((line) => stripAnsiSequences(line));
    }
    if (typeof screenHolder?.screenAnsi === 'string') {
        return screenHolder.screenAnsi.split('\n').map((line) => stripAnsiSequences(line));
    }
    return [];
}

export function getSessionScreenAnsiLines(screenHolder) {
    if (Array.isArray(screenHolder?.screen)) {
        return screenHolder.screen.map((line) => String(line || ''));
    }
    if (typeof screenHolder?.screen === 'string') {
        // v3 canonical: ANSI-compressed screen is stored directly in `screen`.
        return screenHolder.screen.split('\n').map((line) => String(line || ''));
    }
    // Deprecated compatibility path. Prefer `screen`.
    if (Array.isArray(screenHolder?.screenAnsi)) {
        return screenHolder.screenAnsi.map((line) => String(line || ''));
    }
    if (typeof screenHolder?.screenAnsi === 'string') {
        return screenHolder.screenAnsi.split('\n').map((line) => String(line || ''));
    }
    return [];
}

function deriveType(raw, fileName) {
    if (typeof raw?.type === 'string' && raw.type.length > 0) {
        return raw.type;
    }
    if (fileName.includes('_chargen')) return 'chargen';
    if (fileName.includes('_gameplay')) return 'gameplay';
    if (fileName.includes('_special_')) return 'special';
    if (fileName.startsWith('interface_')) return 'interface';
    if (fileName.includes('_map')) return 'map';
    return 'gameplay';
}

function normalizeStep(step, index) {
    const row = step || {};
    const rng = Array.isArray(row.rng) ? row.rng : [];
    const hasExplicitRngCalls = Number.isInteger(row.rngCalls);
    const hasExplicitRngTrace = Array.isArray(row.rng);
    return {
        index,
        key: row.key ?? null,
        action: row.action || null,
        rng,
        rngCalls: hasExplicitRngCalls ? row.rngCalls : (hasExplicitRngTrace ? rng.length : null),
        screen: getSessionScreenLines(row),
        screenAnsi: getSessionScreenAnsiLines(row),
        typGrid: normalizeGrid(row.typGrid),
        checkpoints: normalizeCheckpoints(row.checkpoints),
    };
}

function decodeCell(cell) {
    if (typeof cell !== 'string' || cell.length === 0) return 0;
    if (/^\d+$/.test(cell)) return Number(cell);
    const ch = cell.toLowerCase();
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) return code - 48;
    if (code >= 97 && code <= 122) return 10 + (code - 97);
    return 0;
}

function decodeRleGridRow(row, rowWidth = 80) {
    if (!row) return new Array(rowWidth).fill(0);
    const out = [];
    const tokens = String(row).split(',').filter((token) => token.length > 0);
    for (const token of tokens) {
        const sep = token.indexOf(':');
        let count = 1;
        let cell = token;
        if (sep !== -1) {
            count = Number.parseInt(token.slice(0, sep), 10);
            cell = token.slice(sep + 1);
        }
        const value = decodeCell(cell);
        if (!Number.isInteger(count) || count < 1) continue;
        for (let i = 0; i < count; i++) out.push(value);
    }
    if (out.length < rowWidth) out.push(...new Array(rowWidth - out.length).fill(0));
    return out.slice(0, rowWidth);
}

function decodeRleGrid(grid, rowCount = 21, rowWidth = 80) {
    if (typeof grid !== 'string') return null;
    const rows = String(grid).split('|');
    const out = rows.map((row) => decodeRleGridRow(row, rowWidth));
    while (out.length < rowCount) out.push(new Array(rowWidth).fill(0));
    return out.slice(0, rowCount);
}

function normalizeGrid(grid) {
    if (Array.isArray(grid)) return grid;
    if (typeof grid === 'string') return decodeRleGrid(grid);
    return null;
}

function normalizeCheckpoints(checkpoints) {
    if (!Array.isArray(checkpoints)) return null;
    return checkpoints.map((cp) => ({
        ...cp,
        typGrid: normalizeGrid(cp?.typGrid),
        flagGrid: normalizeGrid(cp?.flagGrid),
        wallInfoGrid: normalizeGrid(cp?.wallInfoGrid),
    }));
}

function normalizeLevels(levels) {
    const list = Array.isArray(levels) ? levels : [];
    return list.map((level) => ({
        depth: Number.isInteger(level?.depth) ? level.depth : 1,
        typGrid: normalizeGrid(level?.typGrid),
        rng: Array.isArray(level?.rng) ? level.rng : [],
        rngCalls: Number.isInteger(level?.rngCalls) ? level.rngCalls : null,
        screen: getSessionScreenLines(level),
        screenAnsi: getSessionScreenAnsiLines(level),
        checkpoints: normalizeCheckpoints(level?.checkpoints),
        levelName: level?.levelName || null,
    }));
}

export function normalizeSession(raw, meta = {}) {
    const file = meta.file || raw?.file || 'unknown.session.json';
    const dir = meta.dir || raw?.dir || '';
    const version = Number.isInteger(raw?.version) ? raw.version : 1;
    const source = raw?.source || 'unknown';
    const seed = Number.isInteger(raw?.seed) ? raw.seed : 0;
    const type = deriveType(raw, file);
    const options = raw?.options || {};

    const sourceSteps = Array.isArray(raw?.steps) ? raw.steps : [];
    const startupFromStep = sourceSteps.length > 0
        && (sourceSteps[0]?.key === null || sourceSteps[0]?.action === 'startup')
        ? sourceSteps[0]
        : null;
    const startupRaw = raw?.startup || startupFromStep;

    const startup = startupRaw
        ? {
            rng: Array.isArray(startupRaw.rng) ? startupRaw.rng : [],
            rngCalls: Number.isInteger(startupRaw.rngCalls)
                ? startupRaw.rngCalls
                : (Array.isArray(startupRaw.rng) ? startupRaw.rng.length : null),
            screen: getSessionScreenLines(startupRaw),
            screenAnsi: getSessionScreenAnsiLines(startupRaw),
            typGrid: normalizeGrid(startupRaw.typGrid),
            checkpoints: normalizeCheckpoints(startupRaw.checkpoints),
        }
        : null;

    const replaySteps = startupFromStep ? sourceSteps.slice(1) : sourceSteps;
    const steps = replaySteps.map((step, index) => normalizeStep(step, index));

    return {
        file,
        dir,
        meta: {
            version,
            source,
            seed,
            type,
            options,
            group: raw?.group || null,
            regen: raw?.regen || null,
            screenMode: raw?.screenMode || null,
        },
        startup,
        steps,
        levels: normalizeLevels(raw?.levels),
        raw,
    };
}

function readGoldenFile(relativePath, goldenBranch) {
    try {
        return execSync(`git show ${goldenBranch}:${relativePath}`, {
            encoding: 'utf8',
            maxBuffer: 20 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch {
        return null;
    }
}

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

function loadSessionsFromDir(dir, { useGolden = false, goldenBranch = 'golden' } = {}) {
    const repoRoot = process.cwd();
    const relativePath = dir.startsWith(repoRoot) ? dir.slice(repoRoot.length + 1) : dir;

    if (useGolden) {
        const files = listGoldenDir(relativePath, goldenBranch)
            .filter((file) => file.endsWith('.session.json'));
        return files
            .map((file) => {
                const text = readGoldenFile(`${relativePath}/${file}`, goldenBranch);
                if (!text) return null;
                try {
                    return normalizeSession(JSON.parse(text), {
                        file,
                        dir: `golden:${relativePath}`,
                    });
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    }

    if (!existsSync(dir)) return [];

    return readdirSync(dir)
        .filter((file) => file.endsWith('.session.json'))
        .map((file) => {
            try {
                const text = readFileSync(join(dir, file), 'utf8');
                return normalizeSession(JSON.parse(text), { file, dir });
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

function asTypeSet(typeFilter) {
    if (!typeFilter) return null;
    if (Array.isArray(typeFilter)) {
        return new Set(typeFilter.map((t) => String(t).trim()).filter(Boolean));
    }
    return new Set(String(typeFilter).split(',').map((t) => t.trim()).filter(Boolean));
}

export function loadAllSessions({
    sessionsDir,
    mapsDir,
    useGolden = false,
    goldenBranch = 'golden',
    typeFilter = null,
    sessionPath = null,
} = {}) {
    const typeSet = asTypeSet(typeFilter);

    if (sessionPath) {
        const resolved = resolve(sessionPath);
        const text = readFileSync(resolved, 'utf8');
        const normalized = normalizeSession(JSON.parse(text), {
            file: basename(resolved),
            dir: resolved.slice(0, resolved.length - basename(resolved).length - 1),
        });
        if (typeSet && !typeSet.has(normalized.meta.type)) return [];
        return [normalized];
    }

    const sessions = [
        ...loadSessionsFromDir(sessionsDir, { useGolden, goldenBranch }),
        ...loadSessionsFromDir(mapsDir, { useGolden, goldenBranch }),
    ];

    const filtered = typeSet
        ? sessions.filter((session) => typeSet.has(session.meta.type))
        : sessions;

    return filtered.sort((a, b) => a.file.localeCompare(b.file));
}
