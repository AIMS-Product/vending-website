# 2026-08-10 — Kody copy pass + /book-now clone

Source: Kody's Google Doc `1IBPBVeNPqzMKRUFHpe70De_8mSTzeG5Q_XjjBksyT6A`.
Page 1 = Calendly/scoring reference. Page 2 = the work below.

Adam's decisions (2026-08-10):

- Trust line goes under **in-page CTA buttons only** — not the header nav CTA, not the sticky bottom bar.
- The new contact H1 **replaces** the old headline _and_ the orange `Earn $1–$5,000/mo` sub-headline.
- The four social-ad booking pages are **frozen** on their current copy. Kody's doc
  has a separate "Universal" section for what he wanted everywhere, and the hero /
  video rewrite is not in it; those four carry paid traffic and are not mentioned
  in the doc at all. `booking-pages.ts` now owns that copy outright instead of
  inheriting it from `apply-page.ts`. Unpin when Kody confirms.

**Status: implemented on `feat/kody-copy-pass-book-now`.** 1420 tests green,
typecheck clean, production build green, copy verified against a real server
render on `/contact`, `/book-now`, `/booking-t5-socials` and `/`.

---

## 0. Page 1 of the doc — already built, no change

Kody's scoring table and three Calendly embeds already match the code exactly:

| Band               | Doc URL                           | In code                                |
| ------------------ | --------------------------------- | -------------------------------------- |
| 76–100 top closers | `calendly.com/d/cvr6-cfd-zgd/...` | `thank-you-links.ts:40`                |
| 46–75 Lane 1       | `calendly.com/d/cxfn-hh2-h8g/...` | `thank-you-links.ts:35`                |
| 31–45 setter       | `calendly.com/d/cvsd-wxt-cvb/...` | `thank-you-links.ts:30`                |
| 0–30 disqualify    | roadmap downsell                  | `FitResultPanel` not_right_time branch |

Bands render the calendar inline in place of the fit message already (shipped 2026-08-07).
**Action: none.** Confirm back to Kody rather than re-implement.

---

## 1. Universal

### 1a. Nav CTA label

`src/components/site/Header.tsx:46` (desktop) and `:108` (mobile) — hardcoded
`Build Your Vending Route` → `Get Started`.
Both strings move into `src/lib/content/nav.ts` as `headerCta = { label, href: "/contact" }`
(the repo's own rule: copy lives in `src/lib/content/`, never inline in JSX).

### 1b. Resources link

`src/lib/content/nav.ts` — `primaryNav` and `footerColumns[0]`:
`{ label: "Resources", href: "/pre-call-resources" }` → `href: "/news"`.

Use the internal path, not Kody's absolute `https://www.vendingpreneurs.com/news` —
same destination, keeps client-side nav and avoids a full page load.

**Flag to Kody, do not silently resolve:** the nav already has a `News → /news` item.
After this change two nav links point to the same page, and `/pre-call-resources`
becomes unlinked from the whole site (page stays live, still reachable by URL).

### 1c. Trust line

New shared string in `src/lib/content/apply-page.ts`:
`export const CTA_TRUST_LINE = "Free 45-minute call. No purchase necessary."`

Rendered under the CTA in:

- `ApplyHero.tsx` — replaces the current `ctaNote` ("Answer a few quick questions…"),
  which describes a flow that no longer matches /book-now anyway
- `ApplyTools.tsx`
- `ApplyRoadmap.tsx`
- `ApplyYouTube.tsx`
- `HeroV2.tsx` (homepage hero)
- `FinalCtaV2.tsx` (homepage closing band)

Not in: `Header.tsx`, `ApplyStickyCta.tsx`.

---

## 2. Homepage

- `src/lib/content/home-v2.ts` — `heroV2.badges[0]` `500+` → `850+`.
- Same file: `tickerV2.items` and `tickerV2.srSummary` say `500+ entrepreneurs launched` → `850+`.
  Leaving them at 500 would put two different numbers on one scroll.
- `src/lib/content/popups.ts:167` — `note: "500+ entrepreneurs launched"` → `850+`.
- `src/lib/content/home.ts:32,141,151` — CTA label `Apply Now` → `Book Your Call` (3 places).
  Hrefs stay `/apply`, which already 301s to `/contact` (`next.config.ts:77`).

---

## 3. Contact page copy

All of this is `src/lib/content/apply-page.ts`. **It is shared by `/contact`,
`/booking-youtube` and `/booking-meta`** — all three render `ApplyLandingPage`.
That matches Kody's 2026-07-24 instruction that the two booking pages be 1:1 with
contact, so the shared edit is correct. Confirm anyway.

### 3a. Hero (`applyHero`)

```
eyebrow:  "Start Your Vending Business Today"
headline: "Everyday People Are Building $5-$60k/Month Vending Routes Without
           Quitting Their Job or Risking Savings"
body:     "You can spend months figuring out vending, make costly mistakes, and
           wonder if you're on the right path. Or you can join people who've
           already proven the system works and reach profitability faster."
ctaLabel: "Book Your Free Strategy Call"
```

- Delete the `subheadline` object and its JSX block in `ApplyHero.tsx`.
- Delete `ctaNote`; the trust line takes that slot.
- H1 clamp needs a look — it goes from 5 words to 20. Widen `max-w-[15ch]` and
  drop the top of the `clamp()` so it does not run 6 lines on mobile.
- `trustStats` unchanged (already `850+`).

### 3b. Video section (`applyVsl`)

```
title:    "Meet the Founder"
subtitle: "Before you schedule your free consultation, watch this."
caption:  "Mike breaks down how the business model works, what makes a location
           worth pursuing, and how he and others have built a vending route with
           no experience while working a 9-to-5 to create the freedom to spend
           more time with their families."
```

Caption is a `RichSegment[]`; Kody supplied no bold, so it becomes a single
`{ text: ... }` segment. `Mike` could stay bold to match the existing treatment —
ask him, default to plain (verbatim).

### 3c. Compliance flag — surface, do not decide

`applyFooter.disclaimer` says _"The $1–$5,000 claim is based on the average
profitability of our community members' machines."_ The new H1 claims
**$5–$60k/month**. The disclaimer no longer covers the headline claim.
Kody/Joe own compliance sign-off (per AGENTS.md); flag before publish, do not reword.

---

## 4. `/book-now`

New route `src/app/book-now/page.tsx` — same shell as `/booking-youtube`:
`ApplyLandingPage` with `source_path: "/book-now"`, `robots: noindex`,
canonical `/contact`. Every copy change above lands here automatically.

The one difference is the form: no qualification stage.

**Required behaviour:** name / email / phone + both consent checkboxes → submit →
lead is persisted and contactable → the setter calendar
(`calendly.com/d/cvsd-wxt-cvb/vendingpreneurs-quick-discovery`) appears in place
of the form. No timeline question, no invest question, no scoring.

**Why not just reuse `BookingForm`** (the existing `simpleContact` form on the four
social-ad pages): it has no consent checkboxes — those only render under
`showInlineQualificationFields` — and it _redirects_ to Calendly instead of
embedding it. Kody asked for opt-in and an inline widget.

**Implementation — smallest correct change:**

1. `PublicLeadForm.tsx`: add `bookingEmbedUrl?: string`. When set, the branch at
   `:368` (`atStageTwo && startedSessionToken`) renders `<CalendlyEmbed>` instead
   of `<QualificationQuestionsStage>` — prefilled with name/email + UTMs via the
   existing `buildCalendlyBookingUrl`, `hideDetails` on, same as `FitResultPanel`.
   ~10 lines. Stage 1 (`startInlineQualification`) is untouched, so Supabase
   persistence, Close sync, Slack alert and both consents all behave exactly as
   they do on `/contact` today.
2. `ApplyQuiz.tsx`: thread an optional `bookingEmbedUrl` prop through.
3. `ApplyLandingPage.tsx`: same optional prop, passed to `ApplyQuiz`.
4. Setter URL comes from `THANK_YOU_LINKS` / `NEXT_PUBLIC_SETTER_CALENDLY_URL` —
   never a second hardcoded copy.

Section heading for the band on `/book-now` — `applyQuiz.title` currently reads
"Book Your Call and see if vending is right for you". The "see if you're a fit"
half no longer applies. Ask Kody for a replacement; default to
"Book Your Call" until he answers.

---

## Tests

- `PublicLeadForm.test.ts` — new case: `bookingEmbedUrl` set → stage-1 success
  renders the Calendly iframe, never the timeline/invest questions.
- Nav/header snapshot or assertion for `Get Started` + `Resources → /news`.
- `booking-pages.test.ts` style check that `/book-now` is noindex + canonical `/contact`.
- Existing `thank-you/page.test.tsx` and scoring tests must stay green — this
  change must not touch the scored funnel.

## Verification before ship

`npm run lint && npx tsc --noEmit && npm test && npm run build`
(kill the dev server first — `scripts/guard-next-build.mjs` blocks `next build`
while it runs).

Then a headless Playwright pass on `/book-now`: submit → assert the setter iframe.
**Calendly embeds render blank in Adam's Chrome profile** (extension / 3rd-party
cookie blocking) — do not diagnose the embed from his browser.

## Ship path

Production is live on `vendingpreneurs.com` (cut over 2026-07-27). Branch,
preview deploy, verify on the `*.vercel.app` URL, then merge to `main`.
Never `vercel --prod` from a working tree.

## Open questions for Kody

1. Two nav links to `/news`, and `/pre-call-resources` goes unlinked — intended?
2. Copy changes hit `/booking-youtube` and `/booking-meta` too. Confirm.
3. `$5–$60k/month` headline vs the `$1–$5,000` disclaimer — needs compliance sign-off.
4. New heading for the form band on `/book-now`.
5. Should `/book-now` also be the destination for any ad traffic, or is it link-only?
