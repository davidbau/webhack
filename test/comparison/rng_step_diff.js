#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';

import { replaySession } from '../../js/replay_core.js';
import { DEFAULT_FLAGS } from '../../js/storage.js';
import { normalizeSession } from './session_loader.js';

function stripSource(entry) {
    if (!entry || typeof entry !== 'string') return '';
    const noPrefix = entry.replace(/^\d+\s+/, '');
    const at = noPrefix.indexOf(' @ ');
    return at >= 0 ? noPrefix.slice(0, at) : noPrefix;
}

function isMidlog(entry) {
    return typeof entry === 'string'
        && (entry.startsWith('>') || entry.startsWith('<') || entry.startsWith('~'));
}

function isComposite(entry) {
    return typeof entry === 'string'
        && (entry.startsWith('rne(') || entry.startsWith('rnz(') || entry.startsWith('d('));
}

function buildComparable(rawEntries) {
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const out = [];
    for (let i = 0; i < entries.length; i++) {
        const norm = stripSource(entries[i]);
        if (!norm || isMidlog(norm) || isComposite(norm)) continue;
        out.push({ norm, raw: entries[i], rawIndex: i });
    }
    return out;
}

function firstDivergence(actualRaw, expectedRaw) {
    const a = buildComparable(actualRaw);
    const e = buildComparable(expectedRaw);
    const total = Math.max(a.length, e.length);
    for (let i = 0; i < total; i++) {
        if ((a[i]?.norm || '') !== (e[i]?.norm || '')) {
            return { index: i, actual: a, expected: e };
        }
    }
    return { index: -1, actual: a, expected: e };
}

function printRawWindow(label, rawEntries, centerRawIndex, window) {
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    if (!entries.length) return;
    const center = Number.isInteger(centerRawIndex) ? centerRawIndex : 0;
    const lo = Math.max(0, center - window);
    const hi = Math.min(entries.length - 1, center + window);
    console.log(`${label} raw window [${lo}..${hi}] (center=${center})`);
    for (let i = lo; i <= hi; i++) {
        const mark = (i === center) ? '>>' : '  ';
        console.log(`${mark} [${i}] ${entries[i]}`);
    }
}

function parseArg(name, fallback) {
    const idx = process.argv.indexOf(name);
    if (idx < 0 || idx + 1 >= process.argv.length) return fallback;
    const n = Number.parseInt(process.argv[idx + 1], 10);
    return Number.isInteger(n) ? n : fallback;
}

function parsePhaseArg() {
    const idx = process.argv.indexOf('--phase');
    if (idx < 0 || idx + 1 >= process.argv.length) return 'step';
    const v = String(process.argv[idx + 1] || '').toLowerCase();
    return (v === 'startup') ? 'startup' : 'step';
}

async function main() {
    const input = process.argv[2];
    if (!input) {
        console.error('Usage: node test/comparison/rng_step_diff.js <session.json> [--step N] [--window N]');
        process.exit(2);
    }
    const step = parseArg('--step', 1);
    const phase = parsePhaseArg();
    const window = parseArg('--window', 4);
    const abs = resolve(input);

    const rawJson = JSON.parse(readFileSync(abs, 'utf8'));
    const session = normalizeSession(rawJson, { file: basename(abs), dir: resolve(abs, '..') });

    process.env.RNG_LOG_TAGS = '1';
    const replayFlags = { ...DEFAULT_FLAGS, bgcolors: true, customcolors: true };
    if (session.meta.options?.autopickup === false) replayFlags.pickup = false;
    const replay = await replaySession(session.meta.seed, session.raw, {
        captureScreens: true,
        startupBurstInFirstStep: false,
        flags: replayFlags,
        replayMode: session.meta.type === 'interface' ? 'interface' : undefined,
    });

    let expectedRng;
    let actualRng;
    if (phase === 'startup') {
        expectedRng = Array.isArray(session.raw?.startup?.rng) ? session.raw.startup.rng : [];
        actualRng = Array.isArray(replay.startup?.rng) ? replay.startup.rng : [];
    } else {
        const expectedSteps = session.meta.type === 'interface'
            ? (Array.isArray(session.raw?.steps) ? session.raw.steps.slice(1) : [])
            : session.steps;
        expectedRng = Array.isArray(expectedSteps[step - 1]?.rng) ? expectedSteps[step - 1].rng : [];
        actualRng = Array.isArray(replay.steps?.[step - 1]?.rng) ? replay.steps[step - 1].rng : [];
    }

    const diff = firstDivergence(actualRng, expectedRng);
    if (phase === 'startup') {
        console.log(`session=${basename(abs)} phase=startup`);
    } else {
        console.log(`session=${basename(abs)} step=${step}`);
    }
    if (diff.index < 0) {
        console.log('RNG comparable entries match.');
        return;
    }

    const lo = Math.max(0, diff.index - window);
    const hi = diff.index + window;
    console.log(`first divergence index=${diff.index}`);
    for (let i = lo; i <= hi; i++) {
        const a = diff.actual[i];
        const e = diff.expected[i];
        const mark = (i === diff.index) ? '>>' : '  ';
        const an = a ? a.norm : '(end)';
        const en = e ? e.norm : '(end)';
        console.log(`${mark} [${i}] JS=${an} | C=${en}`);
        if (i === diff.index) {
            if (a) console.log(`     JS raw: ${a.raw}`);
            if (e) console.log(`     C  raw: ${e.raw}`);
            printRawWindow('JS', actualRng, a?.rawIndex, window);
            printRawWindow('C ', expectedRng, e?.rawIndex, window);
        }
    }
}

main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
});
