#!/bin/bash
# Analyze when C makes themeroom RNG calls
cat test/comparison/maps/seed163_maps_c.session.json | \
  jq -r '.levels[0].rng[]' 2>/dev/null | \
  awk '/nhl_rn2/{count++} END{print "Total nhl_rn2 calls:", count}'

echo ""
echo "Pattern of rn2(3) and rn2(2) pairs (theme selection):"
cat test/comparison/maps/seed163_maps_c.session.json | \
  jq -r '.levels[0].rng[]' 2>/dev/null | \
  grep "nhl_rn2" | \
  grep -E "rn2\((2|3)\)" | \
  head -20

echo ""
echo "Should be ~37 pairs of (rn2(3), rn2(2)) based on 223 total / 6 calls per room attempt"
