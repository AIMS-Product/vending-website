#!/bin/zsh
# Draft up to N posts in a row (news_posts DRAFTS only, never published).
#   scripts/blog/draft-batch.sh 20
# Exit codes from draft-next: 0 saved, 2 gate failed (slug added to failed.txt), 3 live page exists,
# 4 queue empty (stop). Anything else is an error; 3 in a row stops the batch.
set -u
n=${1:?count}; shift
saved=0; failed=0; errors=0; i=0
while (( saved < n )); do
  i=$((i+1))
  echo "=== run $i $(date -u +%FT%TZ) saved=$saved failed=$failed"
  node --env-file="${ENV_FILE:-.env.local}" scripts/blog/draft-next.mjs --save "$@"
  code=$?
  case $code in
    0) saved=$((saved+1)); errors=0 ;;
    2|3) failed=$((failed+1)); errors=0 ;;
    4) echo "queue empty"; break ;;
    *) errors=$((errors+1)); echo "error exit $code ($errors in a row)"; (( errors >= 3 )) && break; sleep 60 ;;
  esac
done
echo "=== done $(date -u +%FT%TZ) saved=$saved failed=$failed runs=$i"
