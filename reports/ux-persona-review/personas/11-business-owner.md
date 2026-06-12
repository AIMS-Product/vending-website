# Persona Review — Priya, Overwhelmed Small Business Owner (39)

> I run a bakery. I'm doing this between customers. If a thing isn't obvious in the
> first few seconds, or it asks me for a number I haven't decided yet, or it loses
> what I typed, I close the tab and get back to work. I have maybe 10 minutes, and
> 8 of those are spoken for.

## Summary

- **Pages reviewed**: 16 public pages (home, about, apply, case-studies, contact, news + 3 articles, pre-call-resources, privacy, terms, thank-you-for-applying, 404s) — admin/studio is not my world, I skimmed it.
- **Issues found**: 18
- **Blockers**: 0 (nothing is outright broken for me as a visitor) — but two **critical** confidence-killers.
- **Overall gut feel**: **2.5 / 5** — The site is attractive and the writing is clear, but the one task I came to do (apply) asks me for decisions I haven't made and then doesn't convincingly tell me it worked. That's exactly the kind of friction that makes an overwhelmed person give up.

---

## Journey Review

| Journey                          | Score | Could I complete it?                                  | Where I'd give up                                                                                                                                      |
| -------------------------------- | ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discover & Apply                 | 2/5   | Technically yes, but I'd hesitate hard and might bail | The required "budget / stage / timeline" dropdowns — I haven't decided those. And after submitting, the confirmation is so faint I'd assume it failed. |
| Contact the Team                 | 3/5   | Yes, if I found it                                    | "Contact" isn't in the top menu — I'd hunt for it before scrolling to the footer.                                                                      |
| Read a News Article              | 3/5   | Yes                                                   | The listing looks half-broken on first paint (empty cards), so I'd doubt it loaded.                                                                    |
| Evaluate Trust Before Committing | 3/5   | Yes                                                   | "0+ entrepreneurs launched / $0M+" on the homepage reads as broken or as "nobody's done this," which dents trust right where it's built.               |
| Pre-Call Resources               | 4/5   | Yes                                                   | Short, clear, scannable — this is the kind of page I want everywhere.                                                                                  |
| Admin journeys (6–8)             | —     | N/A                                                   | Not my role; I'm a visitor, not a studio admin.                                                                                                        |

### Discover & Apply — 2/5

This is the journey I actually came for, and it's the one that worries me most. The form
is one screen, which I like. But of the six required fields, three are **decisions, not
facts**: "Business stage*", "Available startup budget*", and "Launch timeline*"
(`text/apply-text.md`: "Available startup budget* (required)"). I run a bakery — I'm
_curious_ about vending, I haven't picked a budget band or a launch month. Being forced
to commit to "$10k–$25k" and "Next 30 days" just to ask a question makes me feel like
I'm being qualified before I'm ready, and an overwhelmed person reads that as "this
isn't for me yet" and leaves.

Then the part that would genuinely make me re-submit or give up: after I hit "SUBMIT
APPLICATION", the only confirmation is a small line of **green text beside the button** —
"Thanks. We received your details and will follow up shortly."
(`journey-discover-and-apply-004-04-submit-continue-round-1-.png`). The form doesn't
clear, the button stays active, and there's no big "done" screen. The automation itself
re-submitted five more times because it missed this — that's me, glancing up to serve a
customer, looking back, and not knowing if it sent. There's already a proper
"THANKS FOR APPLYING." page in the app (`text/thank-you-for-applying-text.md`) but the
form doesn't take me there. That's the single biggest miss for my persona.

### Contact the Team — 3/5

When something's on fire in my day I want "Contact" up top, obvious. It's only in the
footer (`journeys.md`: "link is in the FOOTER only"). The top nav has About, Resources,
Case Studies, News, Step Inside — no Contact. I'd scan the header, not see it, and
either give up or scroll all the way down hunting.

### Read a News Article — 3/5

The article itself reads fine. But the listing page is headed "BLOG"
(`text/news-text.md`: "BLOG") while the menu item I clicked said "NEWS" — for a tired
brain, two names for one thing is a small "wait, did I land in the wrong place?" And the
first thing I see is empty card outlines with no images (`news-001-load.png`), one card
even showing raw alt text "Top 10 Profitable Products to Stock in Your Vending Machine…"
instead of a picture. First impression: half-loaded / broken.

### Pre-Call Resources — 4/5

This is the model the rest of the site should copy: a heading, one sentence, three
bullets (`text/pre-call-resources-text.md`). I can read the whole thing in 15 seconds
and know exactly what to do. No overload. More of this, please.

---

## Page-by-Page Review

### / (Home) — Gut feel 2/5

_Beautiful, but the headline stats undercut it and it's a very long scroll._

| #   | Category          | Finding                                                                                                                                                          | Evidence                                                              | Severity |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| 1   | Trust & Safety    | The proof stats all read "0+" — "0+ Entrepreneurs launched", "$0M+", "0+ Vending locations w/our guidance"                                                       | `text/home-text.md` lines "0+ / ENTREPRENEURS LAUNCHED", "$0M+", "0+" | critical |
| 2   | Visual & Layout   | First action ("Apply Now") is clear, but the page is an extremely long single scroll of ~15 testimonials before "Take Action" — exhausting when I have 2 minutes | `home-002-full.png`, `text/home-text.md` (15 testimonial blocks)      | medium   |
| 3   | Visual & Layout   | Homepage layout shift CLS 0.263 — content jumps as it loads                                                                                                      | exploration-log.md `/` "Layout shift (CLS): 0.263"                    | low      |
| 4   | Navigation & Flow | Mobile menu is an icon-only hamburger with no label; fine, but it's the only way to reach anything on phone                                                      | `home-003-mobile.png`                                                 | low      |

### /apply — Gut feel 2/5

_The core task, and the highest-friction page for me._

| #   | Category          | Finding                                                                                                                                    | Evidence                                                                                                                   | Severity |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| 5   | Forms & Input     | Three required fields are decisions I may not have made yet (stage, budget, timeline), forcing premature commitment                        | `text/apply-text.md`: "Available startup budget* (required)", "Launch timeline* (required)", "Business stage\* (required)" | critical |
| 6   | Feedback & State  | Success confirmation is a faint inline green line beside the button — easy to miss; form doesn't clear or redirect                         | `journey-discover-and-apply-004-04-submit-continue-round-1-.png`                                                           | critical |
| 7   | Navigation & Flow | A real `/thank-you-for-applying` page exists but the form never routes there                                                               | `text/thank-you-for-applying-text.md`; `journeys.md` "does not route to it"                                                | high     |
| 8   | Forms & Input     | No progress saving — if I get pulled away mid-form and the tab reloads, I lose everything                                                  | `apply-002-full.png` (single uncontrolled form, no save/draft)                                                             | high     |
| 9   | Forms & Input     | Validation fires only after submit, one tooltip at a time ("Please fill out this field.") — I can't see upfront which fields will block me | `apply-003-form-empty-submit.png`                                                                                          | medium   |
| 10  | Visual & Layout   | On mobile the submit button sits far below the fold with no sticky CTA; long scroll past the giant hero before the form even starts        | `apply-005-mobile.png`                                                                                                     | medium   |

### /contact — Gut feel 3/5

| #   | Category          | Finding                                                                                                               | Evidence                                                                                      | Severity |
| --- | ----------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| 11  | Navigation & Flow | No "Contact" in the header nav — only in the footer                                                                   | `text/contact-text.md` ARIA "navigation Primary" lists only About/Resources/Case Studies/News | high     |
| 12  | Forms & Input     | Message is required but there's no hint of expected length or what to include — blank box, blank mind when I'm rushed | `text/contact-text.md`: "Message\* (required)"                                                | low      |

### /news (BLOG) — Gut feel 2/5

| #   | Category         | Finding                                                                                                   | Evidence                                                               | Severity |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| 13  | Copy & Labels    | Section is "NEWS" in the nav/URL but the page heading is "BLOG" — two names for one thing                 | `text/news-text.md`: "BLOG"; nav label "NEWS"                          | medium   |
| 14  | Visual & Layout  | Above the fold shows empty card outlines and raw alt text instead of images — looks broken on first paint | `news-001-load.png`; exploration-log.md `/news` "500 /\_next/image…"   | high     |
| 15  | Feedback & State | A thumbnail image returns 500, so a card renders its alt text as visible body copy                        | exploration-log.md `/news` Console Error "500 (Internal Server Error)" | medium   |

### News articles — Gut feel 3/5

| #   | Category        | Finding                                                                                       | Evidence                                                             | Severity |
| --- | --------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| 16  | Visual & Layout | Article CLS 0.263 and ~2s load on the first article — content shifts while I'm trying to read | exploration-log.md `/news/how-to-choose…` "1743ms DCL", "CLS: 0.263" | low      |

### /thank-you-for-applying — Gut feel 4/5

| #   | Category         | Finding                                                                                                       | Evidence                                                      | Severity |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| 17  | Feedback & State | This is a clear, reassuring confirmation — the problem (finding 7) is that the apply form never sends me here | `text/thank-you-for-applying-text.md`: "THANKS FOR APPLYING." | —        |

### Sitewide — touch targets

| #   | Category                  | Finding                                                                                             | Evidence                                                            | Severity |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| 18  | Accessibility & Inclusion | Footer/header links are 17–20px tall — fiddly to tap accurately on a phone with flour on my fingers | exploration-log.md `/` "small touch target: a 'CONTACT US' 93x17px" | low      |

---

## Blockers

None that stop a determined visitor. But for _my_ persona — someone with no spare
patience — findings 5, 6 and 1 are effectively soft blockers on the apply journey: they'd
make me hesitate, doubt, and quite likely abandon.

---

## My Top 10 Issues

1. **Apply success is invisible** — faint green text beside the button, no redirect, form
   stays filled. I'd assume it failed and either re-submit or give up. (#6)
2. **Apply form forces decisions I haven't made** — budget / stage / timeline are all
   required. I'm exploring, not committing. (#5)
3. **Homepage proof reads "0+ / $0M+"** — the trust numbers look broken or empty exactly
   where trust is supposed to be built. (#1)
4. **The real thank-you page exists but is never used** — easy win, big reassurance. (#7)
5. **No progress saving on the apply form** — one interruption and I retype everything. (#8)
6. **Contact isn't in the top nav** — when I need help I have to go hunting in the footer. (#11)
7. **News listing looks broken on first paint** — empty cards + raw alt text. (#14)
8. **"NEWS" vs "BLOG"** — two names for one section adds a flicker of doubt. (#13)
9. **Apply is a long scroll on mobile with the submit button buried** — no sticky CTA. (#10)
10. **Homepage is an exhausting single scroll** of 15 testimonials before the final CTA. (#2)
