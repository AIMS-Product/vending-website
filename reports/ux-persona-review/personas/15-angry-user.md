# Persona Review — 15. Karen, Angry Frustrated User (47)

**Context I bring:** Something already went wrong before I got here — a payment, a lost form, a confusing email — and I have zero patience. I'm not browsing. I'm here to FIX something and get out. The first thing I look for is "how do I reach a human." The second is "did the thing I just did actually work, or do I have to do it again."

## Summary

- **Pages reviewed:** 28 (8 public + 404 + 404 CMS draft + legacy blog 404 + 16 admin)
- **Issues found:** 18
- **Blockers:** 1 (no human contact channel anywhere — no phone, no email, no live support; a frustrated user with an urgent problem has nowhere to go)
- **Overall gut feel:** **2 / 5** — Pages load and forms technically submit, but for a frustrated user this app is a wall: you cannot phone anyone, you cannot email anyone, and after you submit the one form available you can't tell whether it worked. It compounds frustration instead of relieving it.

The single thing that defines this app for me: **there is no phone number and no email address on the entire public site.** The homepage, the contact page, and the footer all route every question into a web form that, when I submit it, shows nothing more than a faint green sentence I'll probably miss. For someone who is already angry, that is the worst possible experience — I have a problem, I want to talk to someone NOW, and the app's answer is "fill out this form and hope."

---

## Journey Review

| #   | Journey                  | Score | Could I complete it?                     | Where I'd give up                                                                                                                                                                                                                  |
| --- | ------------------------ | ----- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Discover & Apply         | 2/5   | Technically yes, but I'd think it failed | After clicking SUBMIT — the only confirmation is a tiny green line beside the button; nothing redirects, the form doesn't clear, no reference number. I'd assume it broke and either rage-resubmit or leave.                       |
| 2   | Contact the Team         | 1/5   | No — not the way I need to               | Immediately. There's no Contact in the top nav, and when I finally find it in the footer it's ANOTHER form with no phone/email. I came here to talk to a person; this gives me a contact box and a prayer.                         |
| 3   | Read a News Article      | 3/5   | Yes                                      | Not really blocked, but /news first paints as three empty card outlines (looks broken to an already-suspicious user) and the page is titled "BLOG" while the nav said "NEWS". Minor friction, but it makes me trust the site less. |
| 4   | Evaluate Trust           | 2/5   | Yes, the pages load                      | Trust is exactly what I'm low on. Stats read "0+ Entrepreneurs launched / $0M+ sales / 0+ locations" and there's no phone or company contact — to an angry skeptic this screams "placeholder / can't reach anyone."                |
| 5   | Pre-Call Resources       | 3/5   | Yes                                      | Page loads fine; it's a wall of 14 links with no embedded media. If I'm prepping in a hurry and frustrated, I don't know which link matters. Not a blocker.                                                                        |
| 6   | Admin: Create News Draft | 2/5   | Yes, but only by guessing the URL        | The studio sidebar has no News/Blog section at all — I'd have to already KNOW /admin/news exists. A frustrated admin trying to fix a post can't find where posts live.                                                             |
| 7   | Admin: Create SEO Page   | 2/5   | Eventually                               | First-open "Quick Tour" overlay covers the very panel it points at and blocks me. When I'm in a hurry an unskippable tour over a broken-looking panel is exactly what sets me off.                                                 |
| 8   | Admin: Media & Settings  | 2/5   | Partly                                   | Redirects manager and News CMS are orphaned (no link anywhere). And the SEO list shows a "Schedule failed" filter in the nav — a raw failure state staring at me with no explanation of what failed or how to fix it.              |

### Per-journey notes

**Discover & Apply (2/5).** The journey log itself records that the automation "missed the success state and re-submitted 5 more times." That is not an automation quirk to me — that is the EXACT thing a frustrated human does. When I don't see clear confirmation, I click again. And again. The app even has a finished `/thank-you-for-applying` page sitting there unused — the form just doesn't send me to it. A real confirmation page (with a reference number) is the difference between "okay, handled, I can stop" and "did that even go through?!"

**Contact the Team (1/5).** This is the journey that matters most to me and it's the worst. Contact isn't in the header — only the footer link "CONTACT US". And the contact page (`contact-002-full.png`) is just a form: Name, Email, Phone, City, State, Message, "SEND MESSAGE". No phone number to call. No email to write. No hours. No "we reply within X." If I have an urgent problem, "fill in this box and wait" is not help.

**Evaluate Trust (2/5).** I'm already burned, so I'm hunting for reasons NOT to trust. The homepage hero counters literally say "0+ Entrepreneurs launched" and "$0M+ Snack/Drink sales" — to me that reads as a half-built site. Combined with no findable phone number, an angry skeptic concludes "I'll never be able to reach these people if something goes wrong."

---

## Page-by-Page Review

### / (Home) — Gut feel 2/5

_The pitch is loud but there's no way to reach a person, and the proof numbers read as zeros._

| #   | Category          | Finding                                                                                                             | Evidence                                                                                                             | Severity |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Trust & Safety    | No phone number or email anywhere on the homepage or in the footer — every path is a web form                       | text/home-text.md footer block (lines 165-172: only Home/About/Resources/Case Studies/News/Contact Us/Terms/Privacy) | blocker  |
| 2   | Trust & Safety    | Headline proof stats render as zeros: "0+ ENTREPRENEURS LAUNCHED", "$0M+ SNACK/DRINK SALES", "0+ VENDING LOCATIONS" | text/home-text.md lines 23-28                                                                                        | high     |
| 3   | Navigation & Flow | "CONTACT US" is footer-only; header nav has no Contact/Help/Support entry                                           | text/home-text.md ARIA "navigation Primary" lists only About/Resources/Case Studies/News (lines 180-188)             | high     |

### /apply — Gut feel 2/5

_Submitting feels like nothing happened — and the app already proved a user will resubmit._

| #   | Category         | Finding                                                                                                                                                    | Evidence                                                                                                                                                           | Severity |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 4   | Feedback & State | Success confirmation is a single faint green line beside the button — no redirect, form not cleared, easy to miss and resubmit                             | journey-discover-and-apply-004-04-submit-continue-round-1-.png ("Thanks. We received your details and will follow up shortly."); journeys.md notes 6 submit clicks | critical |
| 5   | Feedback & State | A finished `/thank-you-for-applying` page exists but the form never routes to it                                                                           | text/thank-you-for-applying-text.md ("THANKS FOR APPLYING."); journeys.md Discover & Apply friction note                                                           | high     |
| 6   | Forms & Input    | No application reference/confirmation number issued — I can't quote anything when I follow up                                                              | journey-discover-and-apply-004-04-submit-continue-round-1-.png                                                                                                     | medium   |
| 7   | Forms & Input    | Validation is browser-default only, one field at a time ("Please fill out this field.") — not tied to a visible label, surfaces a single field per attempt | apply-003-form-empty-submit.png                                                                                                                                    | medium   |

### /contact — Gut feel 1/5

_I came to reach a human and got a form with no fallback channel._

| #   | Category         | Finding                                                                                                                                   | Evidence                                                                                                                            | Severity |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 8   | Trust & Safety   | Contact page offers ONLY a web form — no phone, no email, no response-time expectation                                                    | contact-002-full.png; text/contact-text.md (only Name/Email/Phone/City/State/Message + "SEND MESSAGE", lines 17-77)                 | critical |
| 9   | Feedback & State | "SEND MESSAGE" submit was not exercised, but the page shows no success/error region designed — same vanishing-confirmation risk as /apply | exploration-log.md /contact form#1 "external-bucket form: filled for visual review, NOT submitted"; contact-002-full.png            | high     |
| 10  | Copy & Labels    | No statement of when/whether anyone replies — "Send the team a note" sets no expectation for an impatient user                            | text/contact-text.md line 15 ("Send the team a note about vending locations, machine decisions, partnerships, or accelerator fit.") | medium   |

### /this-page-does-not-exist (404) — Gut feel 2/5

_Clean, but a dead end when I'm already lost._

| #   | Category          | Finding                                                                                                  | Evidence                                                                                                        | Severity |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| 11  | Navigation & Flow | 404 offers only "Back to home" — no search, no contact/help link, no suggestion of where the thing moved | this-page-does-not-exist-001-load.png; text/this-page-does-not-exist-text.md (lines 11-17, only "Back to home") | high     |
| 12  | Copy & Labels     | "doesn't exist or has moved" — if it MOVED, don't tell me; take me there or give me a link               | text/this-page-does-not-exist-text.md line 15 ("The page you're looking for doesn't exist or has moved.")       | low      |

### /blog/... (legacy path) — Gut feel 1/5

_An old bookmarked link 404s with no redirect — classic "the thing in my email is broken" moment._

| #   | Category          | Finding                                                                                                        | Evidence                                                                                                                     | Severity |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| 13  | Navigation & Flow | Legacy `/blog/{slug}` returns a hard 404 instead of redirecting to the live `/news/{slug}` article that exists | exploration-log.md /blog/how-to-choose...: "Status: 404", "404 /blog/how-to-choose-the-perfect-location-for-vending-machine" | high     |

### /news — Gut feel 3/5

| #   | Category         | Finding                                                                                            | Evidence                                                                                                                                            | Severity |
| --- | ---------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 14  | Feedback & State | Above-the-fold renders three empty card outlines before scroll — looks broken to a suspicious user | journeys.md Read a News Article friction note ("empty card outlines before any scrolling … first paint looks broken/unfinished"); news-001-load.png | medium   |
| 15  | Copy & Labels    | Section is "NEWS" in nav/URL but the page heading is "BLOG" — same thing, two names                | journeys.md Read a News Article friction note ("Page is headed 'BLOG' while the nav item … says 'NEWS'")                                            | low      |
| 16  | Feedback & State | A news thumbnail 500s on load (broken image) — reinforces "this site is broken" for an angry user  | exploration-log.md /news Console Errors: "500 (Internal Server Error)" on /\_next/image (CDN asset)                                                 | medium   |

### /admin/pages (Studio) — Gut feel 2/5

| #   | Category         | Finding                                                                                                         | Evidence                                                                                                                             | Severity |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 17  | Feedback & State | A "Schedule failed" filter sits in the workflow nav with no inline explanation of what failed or how to recover | text/admin-login-text.md line 68 ("Schedule failed"); exploration-log.md lists it as a nav link to /admin/pages?view=schedule-failed | high     |

### /admin/forgot-password — Gut feel 3/5

| #   | Category      | Finding                                                                                                                                                                              | Evidence                                                                                                             | Severity |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 18  | Copy & Labels | Reset copy hedges ("If it has admin access, we'll send a password reset link") with no on-screen confirmation flow tested — a locked-out admin can't tell if the email is on its way | text/admin-forgot-password-text.md line 10; exploration-log.md (Send button skipped, "no visible validation errors") | medium   |

---

## Blockers

1. **No human contact channel anywhere on the public site (Finding 1 + 8).** No phone, no email, no chat — only web forms whose success state is a faint green line. For a frustrated user with an urgent problem, this is a complete dead end. This is the one thing that, on its own, would make me give up and badmouth the company.

---

## My Top 10 Issues

1. **No phone/email anywhere — only forms.** (blocker) I can't reach a human when something's wrong. — _home/contact, Findings 1, 8_
2. **Apply submit shows a faint green line, no redirect, no cleared form.** (critical) I can't tell it worked, so I resubmit — the test itself did this 6 times. — _Finding 4_
3. **Contact page is a form with zero fallback channel and no reply-time promise.** (critical) — _Findings 8, 10_
4. **A finished thank-you page exists but the form never uses it.** (high) The fix is sitting right there unused. — _Finding 5_
5. **404 is a dead end — only "Back to home", no search/help/contact.** (high) When I'm already lost, you send me back to square one. — _Finding 11_
6. **Legacy /blog/ links hard-404 with no redirect.** (high) The link in my email is broken and nobody catches it. — _Finding 13_
7. **Contact is footer-only — not in the header nav.** (high) I scan the top for "help" and find nothing. — _Finding 3_
8. **"Schedule failed" surfaced as raw admin nav with no recovery.** (high) A failure state with no explanation is salt in the wound. — _Finding 17_
9. **Proof stats read "0+ / $0M+ / 0+".** (high) Looks like a half-built, untrustworthy site. — _Finding 2_
10. **/news first-paints as empty card outlines and a thumbnail 500s.** (medium) "Broken" is my default assumption, and the site confirms it. — _Findings 14, 16_
