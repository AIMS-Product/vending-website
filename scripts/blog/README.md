# Blog drafter

Drafts one blog post from the topic queue, checks it against the blog frame
(spec `2026-11-13-blog-frame.md`), and saves it as a **draft**. Nothing here can
publish: publishing stays a human click in Studio / Admin.

```sh
node --env-file=.env.local scripts/blog/draft-next.mjs           # dry run: writes .claude/blog-drafts/<date>-<slug>.md
node --env-file=.env.local scripts/blog/draft-next.mjs --save    # also saves the draft to the CMS
node --env-file=.env.local scripts/blog/draft-next.mjs --topic X # a specific topic
```

- Writer: `claude -p` on the Claude Code subscription ($0). `ANTHROPIC_API_KEY` is removed from its environment so a paid key is never used.
- Prompt: `prompt.md` (the frame, brand rules, output format). Source data is the only thing the writer may cite.
- Gate: `src/lib/blog/quality-gate.ts`. A failing draft gets one rewrite with the failures listed, then exits 2 without saving.
- Schedule: the launchd plist in this folder is **not loaded**. Loading it runs `run-scheduled.sh` daily at 06:15; the script only drafts on its own day parity so the two sites alternate (VendHub even days, Vendingpreneurs odd days).
- Queue: `topics.json` (first `queued` topic with no `news_posts` row). `held` topics overlap the VendHub blog queue and wait for a decision on which brand owns them.
