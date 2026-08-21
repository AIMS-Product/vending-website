# Site Chatbot — Morning Report (overnight build, 2026-08-21)

Everything is built, tested live, review-hardened, and committed on `feat/vp-chatbot`
(5 commits, NOT pushed — this repo treats pushes as your call). The live site is
untouched. The database tables are already applied to production Supabase, all
empty, with the bot switched off.

## What you have now

An AI "setter" for vendingpreneurs.com that acts like a team member:

- **Talks short and human.** 1-3 sentence replies, no markdown, never admits to
  being a bot, deflects "are you AI" once and pivots to the team following up.
- **Captures without begging.** First reply never asks for contact — it answers
  and asks one easy question back. Once a visitor keeps talking, it offers a
  named deliverable (roadmap, finance templates, matching success story) as the
  reason to share an email. After capture it switches to qualifying: what they
  do for work, capital comfort, timeline, call interest.
- **Matches testimonials to the visitor's job.** All 24 case studies are indexed
  by prior career. Live test: "I work in corporate sales" → it cited Matt Dicks,
  $20K+/mo, with the case-study link, then offered resources.
- **Feeds your real pipeline.** A captured email becomes a normal lead row →
  Close CRM (tagged `chatbot`, entry source safely untouched) → Money Page
  attribution — same as your forms. The team gets a rich profile email instead
  of the plain notification (no double-emailing).
- **Learns from its own transcripts.** A daily pass reads conversations and
  produces: drafted follow-up tasks (approval-only, never auto-sent),
  objections/site gaps, knowledge-base fix suggestions (one click applies them
  to the bot's brain), and site improvement recommendations. A 10-minute cron
  extracts a structured prospect profile from idle conversations and emails it
  to the routing recipients.
- **Fully configurable at `/admin/chatbot`**: persona name/avatar, greeting,
  follow-up message, teaser bubble + delay, brand color, capture mode
  (pre-chat form / on-intent card / off), model, knowledge-base textarea, lead
  routing recipients + test send + missed-leads catch-up digest. Plus
  `/admin/chatbot/conversations` (transcripts, 7 review flags, notes, hand-off)
  and `/admin/chatbot/insights` (KPIs + everything the learning pass found).

## Proven overnight (real runs, not inference)

- Full build green (111 pages), tsc + eslint clean, **1551/1551 tests pass**
  (including new tests on the lead-pipeline seam).
- Live conversation against real OpenAI: 3-turn flow → testimonial match →
  email capture → conversation marked captured → lead row created with
  `metadata.source: chatbot` → notification correctly suppressed → prospect
  profile extracted and stored.
- Both cron routes run clean; learning pass is deterministic and idempotent.
- Adversarial review (Tier-1 focus) found 2 critical + 3 high issues —
  all fixed and re-verified: digest re-email loop, lead-budget bypass via the
  chat box, a one-IP site-wide DoS on the daily cap, a race that could wipe a
  captured email, missing seam tests. Close-sync blast radius, XSS, RLS, cron
  auth, PII-in-logs all verified clean.

## Your morning steps (15 minutes to live trial)

1. **Push the branch** (pre-push guard may object; it's your call per repo
   policy): `git push -u origin feat/vp-chatbot` from the worktree at
   `.claude/worktrees/vp-chatbot` — then open a PR and check the Vercel preview.
2. **On the preview**: visit any page, the widget won't show until you enable
   it. Go to `/admin/chatbot`, set persona (name/avatar/greeting/teaser), paste
   any extra facts into the knowledge base, set routing emails, flip **On**.
3. **Verify `OPENAI_API_KEY` in Vercel env** (the SEO builder already uses one
   there — if it's project-scoped and present, nothing to do). The key in the
   worktree `.env.local` is a borrowed local-test key — replace it with the one
   you meant to share when you get a chance; it was never committed.
4. Test a conversation on the preview, check the lead lands in Close tagged
   `chatbot`, then merge to `main` when happy.

## Costs and guardrails

- Default model `gpt-4o-mini` (admin-configurable). Replies capped at 700
  output tokens; input budgeted per-message/per-conversation; 60 msg/min/IP,
  10 lead-creations/hr/IP, 15 new conversations/hr/IP, 2000 conversations/day
  global valve; 30s/15s OpenAI timeouts. Rough cost at current traffic:
  cents per day.
- Bot config changes take up to ~2 minutes to reach visitors (caching).

## Known ceilings (deliberate, noted in code)

- Phone-only captures (no email) don't create Close leads yet.
- Admin conversation search is in-memory over the latest 500.
- Bot knowledge = site content + case studies + admin textarea; live CMS
  content (news posts, builder pages) isn't ingested yet — good v2 item.
- Learning-pass topic classifier is regex-based; thresholds (≥2/≥3 patterns)
  need volume before insights appear.
