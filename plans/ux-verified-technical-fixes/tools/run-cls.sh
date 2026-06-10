#!/usr/bin/env bash
# Cold-load CLS runner for S1.
#
# Protocol: for each page, start a FRESH `next start` on port 3000, wait until
# it answers, measure ONE page (first-ever hit on that server), then kill the
# server. This guarantees a true cold server-side route cache per page, and the
# Playwright harness uses a fresh no-cache browser context per page too.
#
# Usage: run-cls.sh <out.json>
set -euo pipefail

ROOT="/Users/jamesaims/Desktop/Development/vending-website"
OUT="$1"
PORT=3000
TOOLS="$ROOT/plans/ux-verified-technical-fixes/tools"

PAGES=("/" "/about" "/news" "ARTICLE")
TMP_DIR="$(mktemp -d)"
PARTIALS=()

start_server() {
  ( cd "$ROOT" && PORT=$PORT npx next start -p $PORT >/tmp/next-s1.log 2>&1 & echo $! > /tmp/next-s1.pid )
  for _ in $(seq 1 60); do
    if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  echo "server failed to start" >&2
  cat /tmp/next-s1.log >&2
  return 1
}

stop_server() {
  if [ -f /tmp/next-s1.pid ]; then
    kill "$(cat /tmp/next-s1.pid)" 2>/dev/null || true
    rm -f /tmp/next-s1.pid
  fi
  # Belt-and-suspenders: free the port.
  lsof -ti:$PORT 2>/dev/null | xargs kill 2>/dev/null || true
  sleep 1
}

trap stop_server EXIT

i=0
for page in "${PAGES[@]}"; do
  i=$((i+1))
  partial="$TMP_DIR/part-$i.json"
  PARTIALS+=("$partial")
  echo "=== cold load: $page ==="
  start_server
  node "$TOOLS/measure-cls.mjs" "http://localhost:$PORT" "$partial" "$page"
  stop_server
done

# Merge partials into one results file.
node -e '
const fs = require("fs");
const parts = process.argv.slice(2);
const out = process.env.OUT;
const merged = { results: [] };
for (const p of parts) {
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  merged.baseUrl = j.baseUrl;
  merged.settleMs = j.settleMs;
  merged.results.push(...j.results);
}
fs.writeFileSync(out, JSON.stringify(merged, null, 2));
console.log("merged ->", out);
' "${PARTIALS[@]}"

rm -rf "$TMP_DIR"
