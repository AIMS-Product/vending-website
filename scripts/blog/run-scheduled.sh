#!/bin/zsh
# Daily launchd entry for the blog drafter (NOT loaded; see scripts/blog/README.md).
# Runs only on odd days of the year so the two sites alternate. Saves a DRAFT, never publishes.
set -euo pipefail
day=$(( 10#$(date +%j) ))
if (( day % 2 != 1 )); then
  echo "$(date -u +%FT%TZ) not a odd day ($day), skipping"
  exit 0
fi
cd "$HOME/vending-website"
git fetch -q origin && git merge-base --is-ancestor HEAD origin/main || echo "warn: checkout is not on origin/main"
echo "$(date -u +%FT%TZ) drafting"
node --env-file=.env.local scripts/blog/draft-next.mjs --save
