#!/usr/bin/env bash
# Test multiple seeds to see average combat/exploration stats

for seed in 44444 11111 55555; do
    echo "=== TESTING SEED $seed ==="
    node diagnose_turn_usage.mjs --seed=$seed 2>&1 | tail -20
    echo ""
done
