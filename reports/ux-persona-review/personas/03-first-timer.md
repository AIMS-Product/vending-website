# Persona Review — Sam, First-Time Visitor (28)

**Persona:** Clicked a link from social media. Zero context about what this is. 10-second patience. Will leave the moment I'm confused or it feels fake.

## Summary

- **Pages reviewed:** 9 public pages (/, /about, /apply, /case-studies, /contact, /news, /news/[article], /pre-call-resources, 404) + the Discover & Apply journey
- **Issues found:** 14
- **Blockers:** 0 (nothing 404'd on me on the core path, but two findings are critical enough to make me leave or doubt the site)
- **Overall gut feel:** 3/5 — The homepage actually tells me what this is in the first 5 seconds, which is rare and good. But the "0+ / $0M+ / 0+" stat counters read as either fake or broken and almost made me bounce, and after I apply I genuinely can't tell if anything happened.

The good news for a site like this: I landed and within my 10 seconds I understood "this is a coaching program to start a vending machine business." That's the single most important thing and it works. What loses points is trust signals that backfire (zeroed-out stats), a primary nav CTA whose label ("STEP INSIDE") doesn't tell me where it goes, and an application success message so quiet I'd assume the form broke.

---

## Journey Review

| Journey            | Score | Could I complete it?                                 | Where I'd give up                                                                                                                                   |
| ------------------ | ----- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| discover-and-apply | 2/5   | Technically yes, but I wouldn't trust that it worked | At the submit step — the success message is a tiny line of green text and the form stays full, so I'd assume it failed and either resubmit or leave |

### discover-and-apply — notes

Finding the form was easy: the homepage hero has a clear "APPLY NOW" button and the program is explained above it, so I knew what I was applying for. The form itself is short and the fields make sense for a first-timer (name, email, where I'm at in my vending journey). All good up to clicking submit.

The problem is the ending. After "SUBMIT APPLICATION", all that happens is a small green sentence appears to the _right_ of the button — "Thanks. We received your details and will follow up shortly." (`journey-discover-and-apply-004-04-submit-continue-round-1-.png`). The form doesn't clear, doesn't disable, and the page doesn't change or scroll. As someone with a 10-second attention span who probably glanced at my phone the second I clicked, I would never see that line. I'd conclude the form didn't work — exactly what the automation did when it resubmitted five more times. A real `/thank-you-for-applying` page exists in this app but the form never sends me there. For the one conversion action this entire site is built around, the payoff is invisible.

---

## Page-by-Page Review

### / (Homepage) — Gut feel 2/5

The hero nails the value prop, but the stat counters showing 0/$0M and the vague nav CTA undercut trust badly for a cold visitor.

| #   | Category          | Finding                                                                                                                                  | Evidence                                                                                                         | Severity            |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------- | ---- |
| 1   | Trust & Safety    | Stat counters render as "0+", "$0M+", "0+" — to a cold visitor this reads as a fake or broken site                                       | `home-002-full.png`; text: "0+ / ENTREPRENEURS LAUNCHED ... $0M+ / SNACK/DRINK SALES ... 0+ / VENDING LOCATIONS" | critical            |
| 2   | Copy & Labels     | Primary nav CTA "STEP INSIDE" doesn't say what it does (it goes to /apply)                                                               | text: "STEP INSIDE"; ARIA: `link "Step inside": /url: /apply`                                                    | high                |
| 3   | Navigation & Flow | Two differently-labelled CTAs ("STEP INSIDE" and "APPLY NOW") both go to /apply, which is confusing about whether they're the same thing | text: "STEP INSIDE" and "APPLY NOW"; both `/url: /apply`                                                         | medium              |
| 4   | Visual & Layout   | Mobile homepage has horizontal scroll — the page feels broken on the phone I arrived on                                                  | exploration-log: "mobile-375                                                                                     | home-003-mobile.png | horizontal scroll present" | high |
| 5   | Visual & Layout   | Layout shift on load (CLS 0.263) — content jumps as I land, which on a slow social-media tap feels janky                                 | exploration-log: "/ ... Layout shift (CLS): 0.263"                                                               | medium              |

### /apply — Gut feel 3/5

Short, sensible form for a newcomer, but the success state is the journey-killer above.

| #   | Category         | Finding                                                                                                         | Evidence                                                                                                                                             | Severity |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 6   | Feedback & State | Success confirmation after submit is a tiny green line beside the button; form stays full and nothing redirects | `journey-discover-and-apply-004-04-submit-continue-round-1-.png`; journeys.md: "small green inline text ... NO redirect, NO page-level confirmation" | critical |
| 7   | Forms & Input    | Submitting empty or invalid shows no validation errors at all, so I don't know which field I missed             | exploration-log: "/apply ... empty: no visible validation errors after empty submit ... invalid: no visible validation errors on invalid data"       | high     |
| 8   | Copy & Labels    | Form headline "Apply to build your vending business with Mike." assumes I know who "Mike" is on first arrival   | text: "APPLY TO BUILD YOUR VENDING BUSINESS WITH MIKE."                                                                                              | low      |

### /news (Blog) — Gut feel 2/5

Article cards are blank/half-loaded above the fold and the page name fights its own nav label.

| #   | Category         | Finding                                                                                                                          | Evidence                                                                                                                       | Severity |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 9   | Copy & Labels    | I clicked "NEWS" in the nav but the page heading says "BLOG" — same place, two names, makes me wonder if I'm where I meant to be | text: "BLOG"; ARIA nav: `link "News": /url: /news`                                                                             | medium   |
| 10  | Visual & Layout  | Above the fold, article cards show as bare outlines / alt-text placeholders before scrolling — first paint looks broken          | `news-001-load.png` (cards show alt text e.g. "Top 10 Profitable Products to Stock in Your Vending Machine" instead of images) | high     |
| 11  | Feedback & State | A cover image fails to load (500) on the news listing, leaving a broken-image slot                                               | exploration-log: "/news ... 500 /\_next/image?url=...website-files.com..."                                                     | medium   |

### /news/[article] — Gut feel 3/5

Readable once open, but the section is called "BLOG" in the in-article back link while the nav called it "NEWS".

| #   | Category          | Finding                                                                                                                         | Evidence                                                                                   | Severity |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| 12  | Navigation & Flow | In-article back link is "BLOG" while the nav item that brought me here is "NEWS" — inconsistent naming for the same destination | exploration-log article inventory: `a "BLOG" links to /news` and `a "NEWS" links to /news` | low      |

### /contact — Gut feel 2/5

I'd struggle to even find this — it's not in the top nav, only the footer.

| #   | Category          | Finding                                                                                                                                                              | Evidence                                                                                          | Severity |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| 13  | Navigation & Flow | "Contact" is not in the header nav, only the footer — if I have a quick question before applying, I have to scroll all the way down to find any way to reach a human | journeys.md (Contact journey): "link is in the FOOTER only — 'CONTACT US'; not in the header nav" | medium   |

### / (general, all pages) — Gut feel 3/5

| #   | Category                  | Finding                                                                                                | Evidence                                                                            | Severity |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------- |
| 14  | Accessibility & Inclusion | All top-nav links are ~17–20px tall touch targets — on the phone I arrived with, they're fiddly to tap | exploration-log: "NOTE: small touch target: a 'ABOUT' 51x20px ... a 'NEWS' 44x20px" | low      |

---

## Blockers

None hard-blocked me, but two findings are functionally as bad for a first-timer:

- **#1 / #6 — Zeroed stats + invisible apply confirmation.** The "0 entrepreneurs / $0M" counters would make me bounce before applying, and if I push through, I can't tell the application worked. Together these gut the one job this site has: convert a cold visitor into an applicant.

---

## My Top 10 Issues

1. **Stat counters show 0+ / $0M+ / 0+** (#1, critical) — reads as fake or broken; biggest trust-killer for a cold visitor.
2. **Apply success is invisible** (#6, critical) — tiny green text, form stays full, no redirect; I'd assume it failed.
3. **No form validation feedback on /apply** (#7, high) — empty/invalid submit shows nothing, I can't tell what I missed.
4. **"STEP INSIDE" nav CTA is unclear** (#2, high) — doesn't tell me it's the application.
5. **News cards blank/broken on first paint** (#10, high) — the section looks unfinished.
6. **Homepage horizontal scroll on mobile** (#4, high) — feels broken on the device I came from.
7. **"NEWS" nav vs "BLOG" heading** (#9, medium) — same section, two names, makes me doubt I'm in the right place.
8. **Two CTAs ("STEP INSIDE" + "APPLY NOW") to the same page** (#3, medium) — ambiguous whether they're the same thing.
9. **Contact buried in footer only** (#13, medium) — no quick way to reach a human before committing.
10. **Layout shift on load** (#5, medium) — content jumps as I land.
