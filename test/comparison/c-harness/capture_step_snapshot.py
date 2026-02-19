#!/usr/bin/env python3
"""Capture a C NetHack #dumpsnap checkpoint after replaying session steps.

Usage:
  python3 capture_step_snapshot.py <session_json> <step_index> <output_json>

step_index is 0-based over gameplay steps (session.steps excluding startup).
Example: step_index 37 replays 38 gameplay steps, then captures #dumpsnap.
"""

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import time

from run_session import (
    CHARACTER,
    INSTALL_DIR,
    NETHACK_BINARY,
    RESULTS_DIR,
    clear_more_prompts,
    fixed_datetime_env,
    get_clear_more_stats,
    read_checkpoint_entries,
    read_rng_log,
    setup_home,
    tmux_capture,
    tmux_send,
    tmux_send_special,
    wait_for_game_ready,
)


def load_session(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_keys(session):
    raw_steps = session.get("steps") or []
    keys = []
    for i, step in enumerate(raw_steps):
        if i == 0 and (step.get("key") is None or step.get("action") == "startup"):
            continue
        key = step.get("key")
        if not isinstance(key, str):
            continue
        keys.append(key)
    return keys


def build_character(session):
    opts = session.get("options") or {}
    char = dict(CHARACTER)
    for k in ("name", "role", "race", "gender", "align"):
        if isinstance(opts.get(k), str) and opts.get(k):
            char[k] = opts[k]
    return char


def send_char(session_name, ch):
    code = ord(ch)
    if code in (10, 13):
        tmux_send_special(session_name, "Enter")
    elif code == 27:
        tmux_send_special(session_name, "Escape")
    elif code == 127:
        tmux_send_special(session_name, "BSpace")
    elif code < 32:
        tmux_send_special(session_name, f"C-{chr(code + 96)}")
    else:
        tmux_send(session_name, ch)


def replay_steps(session_name, keys, step_index):
    target = min(step_index + 1, len(keys))
    for idx in range(target):
        key = keys[idx]
        # Session gameplay keys are expected to be single-char, but handle
        # multi-char defensively for compatibility with hand-edited traces.
        for ch in key:
            send_char(session_name, ch)
            time.sleep(0.003)
        clear_more_prompts(session_name)
    return target


def run_capture(session_path, step_index, output_path, phase_tag=None):
    session = load_session(session_path)
    keys = extract_keys(session)
    seed = int(session.get("seed", 1))
    char = build_character(session)

    setup_home(char)

    tmpdir = tempfile.mkdtemp(prefix="webhack-step-snapshot-")
    rng_log_file = os.path.join(tmpdir, "rnglog.txt")
    checkpoint_file = os.path.join(tmpdir, "checkpoints.jsonl")
    session_name = f"webhack-step-snapshot-{seed}-{os.getpid()}"

    try:
        monmove_debug = os.environ.get("NETHACK_MONMOVE_DEBUG")
        monmove_debug_env = (
            f"NETHACK_MONMOVE_DEBUG={monmove_debug} " if monmove_debug else ""
        )
        cmd = (
            f"NETHACKDIR={INSTALL_DIR} "
            f"{fixed_datetime_env()}"
            f"{monmove_debug_env}"
            f"NETHACK_SEED={seed} "
            f"NETHACK_RNGLOG={rng_log_file} "
            f"NETHACK_DUMPSNAP={checkpoint_file} "
            f"HOME={RESULTS_DIR} "
            f"TERM=xterm-256color "
            f"{NETHACK_BINARY} -u {char['name']} -D; "
            f"sleep 999"
        )
        subprocess.run(
            ["tmux", "new-session", "-d", "-s", session_name, "-x", "80", "-y", "24", cmd],
            check=True,
        )
        time.sleep(1.0)

        wait_for_game_ready(session_name, rng_log_file)
        time.sleep(0.02)
        clear_more_prompts(session_name)
        time.sleep(0.02)

        replayed_steps = replay_steps(session_name, keys, step_index)
        pre_snapshot_screen = tmux_capture(session_name)

        tag = phase_tag or f"manual_step_{step_index}"
        tmux_send(session_name, "#", 0.2)
        tmux_send(session_name, "dumpsnap", 0.2)
        tmux_send_special(session_name, "Enter", 0.2)
        tmux_send(session_name, tag, 0.2)
        tmux_send_special(session_name, "Enter", 0.2)
        clear_more_prompts(session_name)

        checkpoints, _ = read_checkpoint_entries(checkpoint_file, 0)
        last = checkpoints[-1] if checkpoints else None
        rng_count, _ = read_rng_log(rng_log_file)

        payload = {
            "session": os.path.abspath(session_path),
            "seed": seed,
            "requestedStepIndex": step_index,
            "replayedSteps": replayed_steps,
            "phaseTag": tag,
            "rngCallCount": rng_count,
            "checkpointCount": len(checkpoints),
            "checkpoint": last,
            "preSnapshotScreen": pre_snapshot_screen,
            "screen": tmux_capture(session_name),
            "clearMore": get_clear_more_stats(),
        }

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
            f.write("\n")
    finally:
        subprocess.run(["tmux", "kill-session", "-t", session_name], capture_output=True)
        shutil.rmtree(tmpdir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session_json", help="Path to *.session.json")
    parser.add_argument("step_index", type=int, help="0-based gameplay step index")
    parser.add_argument("output_json", help="Output file path for captured snapshot JSON")
    parser.add_argument("--phase", default=None, help="Optional phase tag for #dumpsnap")
    args = parser.parse_args()

    run_capture(args.session_json, args.step_index, args.output_json, args.phase)


if __name__ == "__main__":
    main()
