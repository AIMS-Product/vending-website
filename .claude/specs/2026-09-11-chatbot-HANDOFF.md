# Handoff: chatbot deep pass (2026-09-11)

Worktree `.claude/worktrees/chatbot-dates`. Full findings: `2026-09-11-chatbot-deep-pass.md`.

## State
- PR #29 `fix/chatbot-dates-and-retry` -> main: date in prompt, wrong-year guard in
  get_available_times, one OpenAI 429 retry (<=8s), calendar opens on real start
  phrasings, open times ride with the calendar, dead link + stale /book-now fact.
- PR #30 `fix/chatbot-wording` -> #29: wording pass, price never answered directly,
  `availability-guard.ts` checks every reply vs real slots, replies held not streamed.
- Both local-verified: 314 chatbot tests, tsc 0, eslint clean. Adam merges #29 then #30.

## Open
1. Adam: raise the OpenAI usage tier (30K tokens/min cap causes "something glitched").
2. Kody: is the call 15 or 45 minutes? Prompt + emails say 15. Can calendar availability widen (3 open days of 30)?
3. Bug, own slice (touches Close): a form-seeded invalid phone beats the valid one typed in
   chat ("first value wins"); bae84501's callback task has a wrong number.
4. Duplicate `booking_confirmed` rows inflate booking counts (7+ chats).
5. After merge: replay a sample of the 138 chats through the new prompt + guard; watch
   `vercel logs --environment production --no-branch --query "turn failed"` for a week.

## Gotchas
- Transcripts: read-only PostgREST dump with service role to /tmp (PII, never in repo).
- Vercel MCP runtime logs return 403 for this team; use `vercel logs` CLI.
- Subagents cannot write report files here; have them return findings inline.
