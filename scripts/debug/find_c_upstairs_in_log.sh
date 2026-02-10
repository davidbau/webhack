#!/bin/bash
# Search C RNG log for any stairway-related function calls

echo "Searching for stairway-related RNG calls in C log..."
grep -n "stair\|upstair\|place.*hero\|u_on_newpos" /tmp/c_rng_trace.log | head -20

echo ""
echo "First 10 RNG calls (to check level gen):"
head -10 /tmp/c_rng_trace.log

echo ""
echo "RNG calls around position 100-120:"
sed -n '100,120p' /tmp/c_rng_trace.log
