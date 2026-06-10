# Persona Review — Zoe, Confused Teenager (16)

**Lens:** Digital native, but I only know TikTok, Instagram, Snapchat. I've never used a "business" app. I expect everything to be instant, obvious, and feel modern — tap, swipe, scroll. Corporate language, long forms, walls of text, and anything that looks even slightly broken makes me close the tab.

## Summary

- **Pages reviewed:** all public marketing pages (/, /about, /apply, /contact, /case-studies, /news + 3 articles, /pre-call-resources, /privacy, /terms, /thank-you-for-applying). I skipped the /admin studio entirely — no teen would ever land there, and it's not my world.
- **Issues found:** 12
- **Blockers:** 0 (nothing 404'd on me on the main path, but two issues come close to feeling broken)
- **Overall gut feel:** **2.5 / 5** — It mostly works and the design is clean-ish, but it talks like a LinkedIn ad, the apply form is long, the success message is invisible, and the news page literally shows a broken image. It reads as "made for adults, half-finished," not modern.

---

## Journey Review

| Journey             | Score | Could I complete it?                     | Where I'd give up                                                                                                         |
| ------------------- | ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| discover-and-apply  | 2/5   | Technically yes, but I'd doubt it worked | After submit — the confirmation is one tiny line of green text, so I'd think it failed and either re-tap forever or leave |
| contact-the-team    | 2/5   | Only if I scrolled to the very bottom    | At the top of the page — Contact isn't in the menu, so I'd assume there's no way to message them                          |
| read-a-news-article | 3/5   | Yes                                      | Almost gave up on the listing — blank cards + a broken image made it look broken before I scrolled                        |
| evaluate-trust      | 3/5   | Yes                                      | The About page is a wall of text; I'd skim and bail before learning who Mike is, but the reviews are genuinely convincing |
| pre-call-prep       | 3/5   | Yes (if I had the link)                  | Fine, but it's just a list of links — no embedded videos, feels flat for a "resources" page                               |

**discover-and-apply:** The "STEP INSIDE" button doesn't tell me it's an application, the form is 9 fields with 4 dropdowns asking my _budget_ and _launch timeline_ before anyone's even talked to me, and worst of all — after I hit submit, the only sign it worked is a thin green sentence next to the button. The form doesn't clear, nothing big happens. On every app I use I get a checkmark, a "Sent!", a whole new screen. I'd assume it broke.

**contact-the-team:** I look at the top menu for a way to reach people. There's no Contact there — it's buried in the footer, which I never scroll to. I'd conclude you can't message them.

**read-a-news-article:** The listing page shows empty white card outlines and one card has a busted image showing the file caption text. That's the #1 "this site is dead/sketchy" signal for me. Once I scrolled past it the actual article was readable and fine, with a table of contents, which was actually nice.

**evaluate-trust:** The reviews ("Real People, Real Results") are good and there are a lot of them — that part I trust. But the big homepage stats say **0+ entrepreneurs, $0M+, 0+ locations**. A zero count is the universal sign that nobody's here. That undercuts all the reviews.

---

## Page-by-Page Review

### / (Homepage) — Gut feel 2/5

Clean hero, but the "0+" stat counters scream fake, the copy is corporate buzzword soup, mobile scrolls sideways, and the page jumps as it loads.

| Category        | Finding                                                               | Severity |
| --------------- | --------------------------------------------------------------------- | -------- |
| Trust & Safety  | Hero stats all read "0+" / "$0M+" / "0+"                              | high     |
| Copy & Labels   | Buzzword body copy ("launch and scale… with minimal time investment") | medium   |
| Copy & Labels   | "STEP INSIDE" CTA doesn't say it's the apply form                     | medium   |
| Visual & Layout | Horizontal scroll on mobile (375px)                                   | medium   |
| Visual & Layout | Content jumps on load (CLS 0.263)                                     | medium   |

### /apply — Gut feel 2/5

The thing they most want me to do is the most off-putting screen: long form, invisible success.

| Category         | Finding                                                          | Severity |
| ---------------- | ---------------------------------------------------------------- | -------- |
| Feedback & State | Invisible submit confirmation (tiny green line)                  | critical |
| Forms & Input    | 9 fields / 4 required dropdowns on first contact                 | high     |
| Forms & Input    | Only native browser validation tooltips, no styled inline errors | low      |

### /news (Blog) — Gut feel 2/5

First paint looks broken.

| Category        | Finding                                                   | Severity |
| --------------- | --------------------------------------------------------- | -------- |
| Visual & Layout | Blank card outlines + broken image (500) showing alt text | high     |
| Copy & Labels   | Nav says "NEWS", page title says "BLOG"                   | medium   |

### /contact — Gut feel 2/5

| Category          | Finding                                                  | Severity |
| ----------------- | -------------------------------------------------------- | -------- |
| Navigation & Flow | Contact only reachable from the footer, not the top menu | medium   |

### /about — Gut feel 3/5

| Category      | Finding                                        | Severity |
| ------------- | ---------------------------------------------- | -------- |
| Copy & Labels | Wall-of-text founder story, no skimmable TL;DR | low      |

### /case-studies, /pre-call-resources, /privacy, /terms, /thank-you-for-applying — Gut feel 3/5

Functional and not offensive to me, but plain. (Note: the real /thank-you-for-applying page exists and looks fine — frustrating that the apply form never sends me here.)

---

## Blockers

None that hard-stopped me, but two come dangerously close to feeling broken:

- The **invisible apply confirmation** (10-teenager-001) — I'd believe submission failed.
- The **broken news image + blank cards** (10-teenager-004) — I'd believe the site is broken/abandoned.

---

## My Top 10 Issues

1. **(critical) Apply success is invisible** — one tiny green line, no redirect, form stays full. I'd think it didn't work and bail or spam submit.
2. **(high) Homepage stats all show "0+"** — a zero count = "this is fake/dead" to me.
3. **(high) Apply form is long** — 9 fields, 4 dropdowns asking budget/timeline up front. Feels like a job application.
4. **(high) News page shows a broken image + blank cards on load** — the classic "sketchy/abandoned site" signal.
5. **(medium) "STEP INSIDE" button is vague** — doesn't tell me it's the apply form.
6. **(medium) Corporate buzzword copy** — reads like an ad for adults, not made for me.
7. **(medium) "NEWS" menu → "BLOG" page** — same thing, two names, makes me second-guess.
8. **(medium) Contact hidden in the footer** — no way to reach them from the top menu.
9. **(medium) Horizontal scroll on mobile** — feels glitchy and not made for phones.
10. **(medium) Page jumps on load (CLS 0.263)** — feels old and laggy.
