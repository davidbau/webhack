#!/usr/bin/env node
// selfplay/runner/c_manual_record.js
//
// Launch seeded C NetHack in tmux for manual play while recording
// per-key JSONL traces from C instrumentation (NETHACK_KEYLOG).

import { execSync, spawnSync } from 'child_process';
import { resolve } from 'path';
import { TmuxAdapter } from '../interface/tmux_adapter.js';

function parseArgs(argv) {
    const opts = {
        seed: 1,
        role: 'Valkyrie',
        race: 'human',
        gender: 'female',
        align: 'neutral',
        name: 'Recorder',
        symset: 'ASCII',
        tmuxSocket: process.env.SELFPLAY_TMUX_SOCKET || 'default',
        session: `nethack-manual-${Date.now()}`,
        keylog: null,
        keepSession: true,
        fixedDatetime: process.env.NETHACK_FIXED_DATETIME || '20000110090000',
    };

    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--keep-session') opts.keepSession = true;
        else if (a === '--no-keep-session') opts.keepSession = false;
        else if (a === '--real-time') opts.fixedDatetime = '';
        else if (a.startsWith('--seed=')) opts.seed = Number(a.slice(7));
        else if (a.startsWith('--datetime=')) opts.fixedDatetime = a.slice(11);
        else if (a.startsWith('--role=')) opts.role = a.slice(7);
        else if (a.startsWith('--race=')) opts.race = a.slice(7);
        else if (a.startsWith('--gender=')) opts.gender = a.slice(9);
        else if (a.startsWith('--align=')) opts.align = a.slice(8);
        else if (a.startsWith('--name=')) opts.name = a.slice(7);
        else if (a.startsWith('--symset=')) opts.symset = a.slice(9);
        else if (a.startsWith('--tmux-socket=')) opts.tmuxSocket = a.slice(14);
        else if (a.startsWith('--session=')) opts.session = a.slice(10);
        else if (a.startsWith('--keylog=')) opts.keylog = a.slice(9);
    }

    if (!opts.keylog) {
        opts.keylog = `/tmp/nethack_keylog_seed${opts.seed}_${Date.now()}.jsonl`;
    }
    opts.keylog = resolve(opts.keylog);
    return opts;
}

function printUsage() {
    console.log('Usage: node selfplay/runner/c_manual_record.js [options]');
    console.log('  --seed=N            RNG seed (default: 1)');
    console.log('  --keylog=PATH       JSONL output path (default: /tmp/...)');
    console.log('  --role=ROLE         default: Valkyrie');
    console.log('  --race=RACE         default: human');
    console.log('  --gender=GENDER     default: female');
    console.log('  --align=ALIGN       default: neutral');
    console.log('  --name=NAME         player name (default: Recorder)');
    console.log('  --symset=ASCII|DECgraphics');
    console.log('  --tmux-socket=selfplay|default|NAME');
    console.log('  --datetime=YYYYMMDDhhmmss   fixed in-game datetime (default: 20000110090000)');
    console.log('  --real-time         use actual wall-clock datetime (no override)');
    console.log('  --session=NAME      tmux session name');
    console.log('  --keep-session      keep session alive after detach (default: on)');
    console.log('  --no-keep-session   auto-kill session after detach');
}

async function main() {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printUsage();
        return;
    }

    const opts = parseArgs(process.argv);
    process.env.NETHACK_KEYLOG = opts.keylog;
    if (opts.fixedDatetime) process.env.NETHACK_FIXED_DATETIME = opts.fixedDatetime;
    else delete process.env.NETHACK_FIXED_DATETIME;

    const adapter = new TmuxAdapter({
        sessionName: opts.session,
        keyDelay: 1,
        symset: opts.symset,
        tmuxSocket: opts.tmuxSocket,
    });

    console.log(`Starting manual C NetHack session...`);
    console.log(`  seed=${opts.seed}`);
    console.log(`  tmuxSocket=${opts.tmuxSocket}`);
    console.log(`  session=${opts.session}`);
    console.log(`  keylog=${opts.keylog}`);
    console.log(`  datetime=${opts.fixedDatetime || 'real-time'}`);

    await adapter.start({
        seed: opts.seed,
        role: opts.role,
        race: opts.race,
        gender: opts.gender,
        align: opts.align,
        name: opts.name,
    });

    // Lock capture session geometry regardless of attaching client size.
    const tmuxBase = (opts.tmuxSocket === 'default' || opts.tmuxSocket === '')
        ? 'tmux'
        : `tmux -L ${opts.tmuxSocket}`;
    execSync(`${tmuxBase} set-window-option -t ${opts.session} window-size manual`);
    execSync(`${tmuxBase} resize-window -t ${opts.session} -x 80 -y 24`);

    console.log('\nAttach and play. Detach with Ctrl-b d.');
    const attach = spawnSync(
        'tmux',
        [
            ...(opts.tmuxSocket === 'default' || opts.tmuxSocket === '' ? [] : ['-L', opts.tmuxSocket]),
            'attach', '-t', opts.session
        ],
        { stdio: 'inherit' }
    );

    if (!opts.keepSession) {
        await adapter.stop();
    } else {
        const attachCmd = (opts.tmuxSocket === 'default' || opts.tmuxSocket === '')
            ? `tmux attach -t ${opts.session}`
            : `tmux -L ${opts.tmuxSocket} attach -t ${opts.session}`;
        console.log(`Session kept: ${attachCmd}`);
    }

    console.log(`Trace written to ${opts.keylog}`);
    process.exit(attach.status ?? 0);
}

main().catch(err => {
    console.error(err?.stack || String(err));
    process.exit(1);
});
