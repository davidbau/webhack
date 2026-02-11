#!/bin/bash
source ~/.nvm/nvm.sh && nvm use 25 > /dev/null 2>&1

echo "Testing agent performance on 5 seeds (500 turns each)..."
echo "Seed | MaxDepth | Turns | Explored | Status"
echo "-----|----------|-------|----------|-------"

for seed in 1 42 100 777 9999; do
  result=$(node selfplay/runner/c_runner.js --seed=$seed --max-turns=500 2>&1)
  depth=$(echo "$result" | grep "Max depth reached:" | awk '{print $4}')
  turns=$(echo "$result" | grep "Game ended after" | awk '{print $4}')
  explored=$(echo "$result" | tail -50 | grep "Explored cells:" | tail -1 | awk '{print $3}')
  status=$(echo "$result" | grep "Death cause:" | awk '{print $3}')
  
  printf "%5s | %8s | %5s | %8s | %s\n" "$seed" "$depth" "$turns" "$explored" "$status"
done
