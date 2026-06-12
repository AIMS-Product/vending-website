# Persona Review — Tom, "Just Get It Done" Pragmatist (50)

Plumber who runs a small business. I'm only here because I heard vending might be a side income. I want to know what this is, what it costs, and how to get hold of someone — in the fewest clicks — then get back to work. I don't read paragraphs of marketing and I don't trust fluff.

## Summary

- **Pages reviewed:** 9 public pages (/, /about, /apply, /case-studies, /contact, /news, a news article, /pre-call-resources, /thank-you-for-applying) + the news listing; admin studio glanced at only (irrelevant to me as a prospect).
- **Issues found:** 11
- **Blockers:** 0 (I can technically complete the core tasks — but several leave me unsure or distrustful)
- **Overall gut feel:** **2.5 / 5** — the site works, but the headline shows "0 entrepreneurs launched", the main button says "STEP INSIDE" instead of "Apply", there's no price and no phone number, and the apply confirmation is a tiny line I'd miss. It does the job only if you already trust it.

## Journey Review

| Journey             | Score | Could I complete it?         | Where I'd give up                                                                                                         |
| ------------------- | ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| discover-and-apply  | 3/5   | Yes                          | The "0+ entrepreneurs launched" stats nearly made me leave before I found the form; success message so faint I'd resubmit |
| contact-the-team    | 2/5   | Only if I keep looking       | No Contact in the top nav and no phone number — I'd assume there's no way to reach them and bail                          |
| read-a-news-article | 3/5   | Yes                          | First paint looks broken (empty cards + a broken image showing raw text); "NEWS" leads to a page titled "BLOG"            |
| evaluate-trust      | 2/5   | Yes, mechanically            | No price anywhere and zeroed-out stats — I can reach the pages but they don't earn my trust                               |
| pre-call-prep       | 3/5   | Yes (if I had a call booked) | "RESOURCES" in the nav sends me to a call-prep checklist I didn't ask for                                                 |

### Per-journey notes

**Discover & Apply (3/5).** Two clicks to a filled application is fine — that part respects my time. But the orange header button says "STEP INSIDE", which tells me nothing; I had to scroll to find the word "APPLY NOW". Worse, right under the program section the counters read `0+ ENTREPRENEURS LAUNCHED`, `$0M+ SNACK/DRINK SALES`, `0+ VENDING LOCATIONS`. That reads as "nobody has done this." When I did submit, the only confirmation was a small green line beside the button while the form stayed full — I'd think it failed and click again.

**Contact the Team (2/5).** There's no "Contact" at the top of the page. I had to scroll to the footer to find "CONTACT US". When I got there it's a form and nothing else — no phone, no email. I run a business off my phone; if I can't call you, I'll call the next outfit.

**Read a News Article (3/5).** The articles are readable once you get into them, but the listing looks half-broken on arrival: blank card outlines and one card showing the raw text "Top 10 Profitable Products to Stock in Your Vending Machine..." because the image errored (HTTP 500). And clicking "NEWS" lands me on a page headed "BLOG" — made me think I mis-clicked.

**Evaluate Trust (2/5).** I can get to About, Case Studies, Terms, and Privacy, so the bones are there. But there's no price for the program anywhere, and the homepage numbers are zeros. To a guy who reads quotes all day, hidden price + zero results = walk away.

**Pre-Call Prep (3/5).** Fine page if you've actually booked a call. Problem is the top-nav "RESOURCES" dumps you here — a "prepare for your call" checklist — when I expected general info to size up the offer.

## Page-by-Page Review

### / (homepage) — gut feel 2/5

The hero is clear enough ("Turn Vending Into Your Path to Financial Freedom"), but the stat block undercuts everything by showing zeros, the only header CTA is the vague "STEP INSIDE", there's no price, and the page jumps on load.

| #   | Category        | Finding                                                            | Evidence                        | Severity |
| --- | --------------- | ------------------------------------------------------------------ | ------------------------------- | -------- |
| 001 | Trust & Safety  | Stats show `0+ ENTREPRENEURS LAUNCHED / $0M+ SALES / 0+ LOCATIONS` | home-002-full.png; home-text.md | critical |
| 002 | Copy & Labels   | Header CTA is "STEP INSIDE", not "Apply"                           | home-001-load.png; home-text.md | high     |
| 006 | Trust & Safety  | No price/cost shown anywhere for the program                       | home-text.md; about-text.md     | high     |
| 010 | Visual & Layout | CLS 0.263 on load; horizontal scroll on mobile                     | exploration-log.md              | medium   |

### /apply — gut feel 3/5

Form is short and sensible (dropdowns for state/budget/stage/timeline, only Name/Email/State/stage/budget/timeline required). Native "Please fill out this field" validation works. The weak spot is the success state.

| #   | Category         | Finding                                                                                      | Evidence                                          | Severity |
| --- | ---------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------- |
| 005 | Feedback & State | Success = tiny green line; form not cleared, no redirect to existing /thank-you-for-applying | journey-discover-and-apply-004...png; journeys.md | high     |

### /contact — gut feel 2/5

Form-only. No phone, no email, and not in the top nav.

| #   | Category          | Finding                                       | Evidence                              | Severity |
| --- | ----------------- | --------------------------------------------- | ------------------------------------- | -------- |
| 003 | Navigation & Flow | Contact missing from header nav (footer only) | home-text.md; journeys.md             | high     |
| 004 | Copy & Labels     | No phone number or email on the contact page  | contact-text.md; contact-001-load.png | high     |

### /news + article — gut feel 3/5

Readable once you're in, but first impression looks broken and the naming is inconsistent.

| #   | Category         | Finding                                                  | Evidence                              | Severity |
| --- | ---------------- | -------------------------------------------------------- | ------------------------------------- | -------- |
| 007 | Feedback & State | Blank cards on first paint; image 500 shows raw alt text | news-001-load.png; exploration-log.md | high     |
| 008 | Copy & Labels    | "NEWS" nav → page titled "BLOG" → breadcrumb "BLOG"      | news-001-load.png; news-text.md       | medium   |

### /pre-call-resources — gut feel 3/5

Fine for its purpose; wrong target for the "Resources" nav item.

| #   | Category      | Finding                                                       | Evidence                                 | Severity |
| --- | ------------- | ------------------------------------------------------------- | ---------------------------------------- | -------- |
| 009 | Copy & Labels | Nav "RESOURCES" → call-prep checklist, not a resource library | pre-call-resources-text.md; home-text.md | medium   |

### /about, /case-studies, /terms, /privacy, /thank-you-for-applying — gut feel 3/5

These load fine and read fine. Case studies are plentiful and specific (real names, real routes), which is the one place this site actually earns trust. No new pragmatist findings beyond the site-wide pricing gap (006) already logged.

### /admin/\* — not my concern

As a vending prospect I never touch the admin studio. One thing leaked into a public-adjacent view worth noting:

| #   | Category       | Finding                                             | Evidence           | Severity |
| --- | -------------- | --------------------------------------------------- | ------------------ | -------- |
| 011 | Trust & Safety | "Schedule failed" state visible in admin pages list | exploration-log.md | low      |

## Blockers

None that stop me outright — but contact (no phone, buried link) and trust (zeroed stats, no price) are close. I _can_ complete every core task; I just wouldn't _want_ to, because the site keeps giving me reasons to doubt it.

## My Top 10 Issues

1. **(001, critical)** Homepage stats show `0+` entrepreneurs, `$0M+` sales, `0+` locations — reads as a dead or broken program.
2. **(002, high)** Main header button says "STEP INSIDE" instead of "Apply" — I shouldn't hunt for the obvious action.
3. **(004, high)** No phone number or email on the contact page — I want to call, not fill a form.
4. **(003, high)** Contact link is footer-only, missing from the top nav.
5. **(006, high)** No price anywhere — I have to apply and take a sales call just to learn what it costs.
6. **(005, high)** Apply success is a faint green line; form stays full, no redirect — easy to miss and resubmit.
7. **(007, high)** /news first paint looks broken: empty cards and a 500'd image showing raw text.
8. **(008, medium)** "NEWS" nav lands on a page titled "BLOG" — inconsistent naming.
9. **(009, medium)** "RESOURCES" nav goes to a pre-call checklist, not a resource library.
10. **(010, medium)** Homepage jumps on load (CLS 0.263) and scrolls sideways on mobile.
