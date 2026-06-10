# Persona 07 — Jake, Distracted Mobile User (22)

> Thumb-only, multitasking, half-watching a video. Judges whether a site "works on my phone" in a couple of seconds. Cares about: touch targets, no horizontal scroll, layouts that adapt, keeping state when I switch apps, mobile-correct keyboards.

## Summary

- **Pages reviewed:** 28 (public + admin), focus on every `-mobile.png` and the Responsive table
- **Findings:** 12
- **Blockers:** 0
- **Overall gut feel:** **2.5 / 5** — the bones are mobile-aware (hamburger nav, single-column stacking, correct `email`/`tel` keyboards, big orange CTA), but three pages side-scroll on a 375px phone, an article headline runs off the edge, and the apply confirmation is so faint I'd resubmit thinking it failed.

### What's genuinely good for me (so I'm NOT flagging it)

- Header collapses to a real hamburger at 375px (`home-003-mobile.png`) — nav doesn't cram.
- The apply/contact form uses `type="email"`, `type="tel"`, and `autoComplete` (`PublicLeadForm.tsx:135-154`), so my phone pops the @ keyboard and number pad. That's the thing most sites get wrong and this one got right.
- Forms stack to a clean single column on mobile (`contact-005-mobile.png`, `apply-005-mobile.png`).
- The primary CTA ("STEP INSIDE" / "SUBMIT APPLICATION") is a fat, high-contrast orange button — easy thumb target.

---

## Journey Review

| Journey                  | Score | Could I complete it?                | Where I'd give up                                                                                  |
| ------------------------ | ----- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| discover-and-apply       | 2/5   | Yes, but I'd resubmit several times | The success confirmation is a tiny green line beside the button; I'd think it failed and tap again |
| contact-the-team         | 3/5   | Only if I find the footer           | Contact isn't in the hamburger menu — I'd assume there's no contact option                         |
| read-a-news-article      | 2/5   | Yes, eventually                     | First paint shows empty card outlines + a broken image; an article H1 side-scrolls the page        |
| evaluate-trust           | 3/5   | Yes                                 | /case-studies side-scrolls on my phone, which dents the "is this legit" check                      |
| pre-call-prep            | 4/5   | Yes                                 | Loads clean, single column, nothing to trip on                                                     |
| admin-create-news-draft  | n/a   | —                                   | Admin isn't a phone job for me; not my lens                                                        |
| admin-create-seo-page    | n/a   | —                                   | Same — desktop tool                                                                                |
| admin-manage-content-ops | n/a   | —                                   | Same                                                                                               |

### Journey notes

- **discover-and-apply:** Reaching the form is 2 taps and the form itself is mobile-friendly. The failure is the _finish line_ — after I tap SUBMIT the only feedback is small green text off to the side and the selects flip back to "Select" (`journey-discover-and-apply-004`). The journey log proves how invisible this is: the automation resubmitted 5 more times. That's me on a phone, exactly.
- **read-a-news-article:** I tapped "NEWS" and landed on a page titled "BLOG" — and the article breadcrumb says "BLOG" too. On a small screen that mismatch makes me think I mis-tapped. First paint also shows blank card outlines (scroll-reveal) and a broken image rendered as raw caption text.

---

## Page-by-Page Review (mobile lens)

### / (home) — 2/5

Above the fold is great on mobile, but the page side-scrolls (`exploration-log.md`: "mobile-375 | home-003-mobile.png | horizontal scroll present") and CLS is 0.263. First impression wobbles. → **07-mobile-003, 07-mobile-011**

### /apply — 2/5

Form is mobile-correct (keyboards, stacking, big button) but the success state is near-invisible and the form resets in place with no navigation. → **07-mobile-001, 07-mobile-010**

### /contact — 3/5

Form stacks cleanly (`contact-005-mobile.png`); correct input types. But it's only reachable from the footer, not the hamburger. → **07-mobile-006**

### /case-studies — 2/5

Header fits, but the page side-scrolls on 375px (`case-studies-003-mobile.png`). → **07-mobile-004**

### /news — 2/5

Heading says "BLOG" not "NEWS"; cards paint empty first; one image is broken (`news-001-load.png`, 500 from website-files.com CDN). → **07-mobile-005, 07-mobile-007, 07-mobile-012**

### /news/\* (articles) — 2/5

H1 "ENTREPRENEURSHIP" overflows the right edge and side-scrolls the page (`news-top-5-questions-...-004-mobile.png`); breadcrumb "HOME / BLOG" continues the naming mismatch. → **07-mobile-002, 07-mobile-007**

### /pre-call-resources — 4/5

Clean single column, no overflow, fast. No issues.

### /about, /privacy, /terms, /thank-you-for-applying — 3/5

"none detected" on mobile responsive; CLS 0.263 on /about. Fine for me.

### Footer (every page) — 2/5

Footer links are ~17px tall (`HOME` 43x17, `PRIVACY POLICY` 120x17). These are the ONLY path to Contact/Terms/Privacy, and they're the hardest things to thumb-tap on the site. → **07-mobile-008**

### Admin (all /admin/\*) — not scored through my lens

Admin is a desktop content tool. Responsive table says "none detected" on mobile for the admin pages; the dense 10x10px and 32x32px control targets there are a real problem but belong to a desktop-admin persona, not me.

---

## Blockers

None. Everything is reachable; the issues are friction and polish, not dead ends.

---

## My Top 10 Issues

1. **(critical) Apply success is invisible on a phone** — tiny green line beside the button, no redirect, form resets in place; I'd resubmit thinking it failed. `07-mobile-001`
2. **(high) Article H1 overflows and side-scrolls the page at 375px** — long uppercase word won't break. `07-mobile-002`
3. **(high) Homepage side-scrolls on mobile.** `07-mobile-003`
4. **(high) /case-studies side-scrolls on mobile** — on the trust page. `07-mobile-004`
5. **(high) /news first paint = empty card outlines + a broken image as raw text** — looks unloaded. `07-mobile-005`
6. **(medium) Contact missing from header/hamburger** — footer-only. `07-mobile-006`
7. **(medium) NEWS vs BLOG naming mismatch** across nav, heading, breadcrumb. `07-mobile-007`
8. **(medium) Footer link tap targets ~17px tall** — the only path to Contact/legal. `07-mobile-008`
9. **(medium) No inline form validation** — invalid submit gives no visible error. `07-mobile-010`
10. **(medium) Broken article image (500 from legacy Webflow CDN) shows as raw alt text.** `07-mobile-012`
