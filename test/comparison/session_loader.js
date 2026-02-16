// test/comparison/session_loader.js -- Session format normalization and loading.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export function stripAnsiSequences(text) {
    if (!text) return '';
    return String(text)
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        .replace(/\x1b[@-Z\\-_]/g, '')
        .replace(/\x9b[0-?]*[ -/]*[@-~]/g, '');
}

export function getSessionScreenLines(screenHolder) {
    const raw = Array.isArray(screenHolder?.screenAnsi)
        ? screenHolder.screenAnsi
        : (Array.isArray(screenHolder?.screen) ? screenHolder.screen : []);
    return raw.map((line) => stripAnsiSequences(line));
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
    return {
        index,
        key: row.key ?? null,
        action: row.action || null,
        rng,
        rngCalls: Number.isInteger(row.rngCalls) ? row.rngCalls : rng.length,
        screen: getSessionScreenLines(row),
        screenAnsi: Array.isArray(row.screenAnsi) ? row.screenAnsi : null,
        typGrid: Array.isArray(row.typGrid) ? row.typGrid : null,
        checkpoints: row.checkpoints || null,
    };
}

function normalizeLevels(levels) {
    const list = Array.isArray(levels) ? levels : [];
    return list.map((level) => ({
        depth: Number.isInteger(level?.depth) ? level.depth : 1,
        typGrid: Array.isArray(level?.typGrid) ? level.typGrid : null,
        rng: Array.isArray(level?.rng) ? level.rng : [],
        rngCalls: Number.isInteger(level?.rngCalls) ? level.rngCalls : null,
        screen: getSessionScreenLines(level),
        screenAnsi: Array.isArray(level?.screenAnsi) ? level.screenAnsi : null,
        checkpoints: level?.checkpoints || null,
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
                : (Array.isArray(startupRaw.rng) ? startupRaw.rng.length : 0),
            screen: getSessionScreenLines(startupRaw),
            screenAnsi: Array.isArray(startupRaw.screenAnsi) ? startupRaw.screenAnsi : null,
            typGrid: Array.isArray(startupRaw.typGrid) ? startupRaw.typGrid : null,
            checkpoints: startupRaw.checkpoints || null,
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
