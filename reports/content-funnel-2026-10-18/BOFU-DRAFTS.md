# BOFU page outlines: B1 /reviews, B2 pricing, B5 objection FAQ (drafts, 2026-10-21)

Source: `CONTENT-FUNNEL-PLAN.md` (2026-10-18; lives untracked in the main checkout under this folder), Step 3.
These are **outlines, not copy**. Nothing here is approved to publish. Every price, refund term, number, timeframe,
rating count or claim is a placeholder marked **[NEEDS ADAM]** (business decision) or **[NEEDS KODY]** (compliance:
FTC earnings claims, Business Opportunity Rule, disclaimer). No figure in this file is a real figure.

## Decisions first (plan section 4)

- [ ] **D-price**: publish a price, a range, or "from $X" on the site? (Plan recommends a range plus what's included.) Blocks B2 and the price answer in B5.
- [ ] **D-respond**: respond publicly (disclosed, factual) to the Reddit/FB complaints and say what changed? Blocks B1's "what changed" section.
- [ ] **D-competitors**: name competitors on comparison pages? (Affects only links out of B1/B2 to future MOFU pages.)
- [ ] **D1 (open since 08-31)**: copy sign-off to index `/solutions/*` and `/process/*`. B1/B2 link into them.

Shared rules for all three pages: claim-free if used as Google Ads landing pages (AGENTS.md: "Unreliable claims"
disapprovals 2026-10-10); primary CTA `/contact` (site form books ~60% vs lead magnet ~2%, plan section 1); the
figures on `/` and `/contact` are CEO-approved and are linked to, never restated or edited here.

---

## B1 `/reviews`: "Vendingpreneurs reviews: the good, the bad, and what changed"

**Purpose.** Own the brand SERP (`vendingpreneurs reviews / legit / worth it / complaints / reddit`), where a
two-year-old Reddit thread and an AI Overview built on it currently answer first. Give a buyer who is about to decide
an honest page from us, then send them to `/contact`.

**Sections.**

1. Hero: plain headline (no numbers), one line on what the page covers, `/contact` CTA plus "skip to the complaints"
   anchor.
2. Ratings where people actually leave them: Trustpilot and Google, shown as links/embeds of the live widgets, not
   typed-in numbers. **[NEEDS ADAM]** which platforms; **[NEEDS KODY]** whether a static rating may be shown.
3. "What people complain about" (only if D-respond = yes): name the themes from the public threads (lead service
   quality, support response time). Quote nothing we can't link. **[NEEDS ADAM]** final wording.
4. "What changed": dated list of concrete changes per theme. **[NEEDS ADAM]** (facts from Mike/ops); **[NEEDS KODY]**.
5. Member stories: grid linking existing case studies (`/case-studies`) and video stories. Reuse the approved
   testimonial set only; add each story's existing disclaimer. **[NEEDS KODY]** for any outcome named in a card title.
6. "Who this is NOT for": honest fit criteria. **[NEEDS ADAM]**.
7. Objection FAQ (B5 block, the subset about trust: scam, lead quality, support, refunds).
8. Final CTA: `/contact` quiz; secondary "not ready yet" link to the roadmap.

**Proof it links.** `/case-studies` (+ individual stories), video stories already on the site, Trustpilot/Google
profiles, `/about` (Mike), B2 pricing page.

**Schema.** `FAQPage` for the FAQ block only. No `AggregateRating` markup unless **[NEEDS KODY]** clears it (self-
serving review markup is also ignored by Google).

---

## B2 pricing page (`/pricing` or `/how-much-does-vendingpreneurs-cost`)

**Purpose.** `vendingpreneurs cost` searches are rising and no page answers them, so Reddit's figure becomes the answer.
Say plainly what the program includes, what it costs (or the range and why), and what it does not include.

**Sections.**

1. Hero: the question as the headline; one-line answer. **[NEEDS ADAM]** price / range / "from $X" or "price on the
   call, here's why" (D-price).
2. What's included: list of program components, each linking to its `/solutions/*` or `/process/*` page (depends on
   D1). **[NEEDS ADAM]** confirm the list.
3. What it does NOT include: machines, locations, inventory, financing. **[NEEDS ADAM]** confirm.
4. Payment options and financing partners. **[NEEDS ADAM]** (terms); **[NEEDS KODY]** (any APR/monthly figure).
5. Guarantee / refund terms in plain words. **[NEEDS ADAM]** (policy text must match the contract); **[NEEDS KODY]**.
6. Total cost of getting started (program + machine + location costs) as a structure only; every number
   **[NEEDS ADAM]** + **[NEEDS KODY]**. Link the existing finance templates resource.
7. Compare-the-options table (DIY / course / program). Labels only, no competitor names unless D-competitors = yes.
8. Objection FAQ (B5 block, subset about money: price, capital needed, financing with bad credit, refunds).
9. Final CTA `/contact`.

**Proof it links.** B1 `/reviews`, `/case-studies`, finance templates resource, `/process/*` pages.

**Schema.** `FAQPage` for the FAQ block. No `Offer`/`Product` price markup until D-price is decided.

---

## B5 objection FAQ (shared block for `/contact`, `/pricing`, `/reviews`)

**Purpose.** Answer the objections buyers actually raise on sales calls, in their words, where they decide.
**Source must be real calls**: pull the top 15 objections from Close call notes / Avoma, not guesses.
**[NEEDS ADAM]** approve the pull (read-only) and who drafts answers.

**Must cover (plan list), each answer [NEEDS ADAM] + [NEEDS KODY] where it touches money or outcomes:**

1. How much does it cost? (follows D-price)
2. Is this a scam / is it legit? (link B1)
3. How good are the leads / the lead service, and what exactly is in it?
4. How much time per week does it take?
5. How much capital do I need to start?
6. Can I finance with bad credit?
7. What if I can't land a location?
8. What is the refund policy?
   9-15. Filled from the call-note pull.

**Build note.** One typed content module (e.g. `src/lib/content/objection-faq.ts`) rendered by one component with
`FAQPage` JSON-LD, placed on all three pages so answers never drift. `/contact`'s existing 5 FAQs stay as they are
(CEO-approved page); the block is added below them only with Adam's OK.

## Open questions for Adam

1. Which of the four decisions above can be made this week? B1 can ship without D-price; B2 cannot.
2. Who owns the "what changed" facts (Mike or ops)?
3. Is Kody reviewing page by page or one batch?
