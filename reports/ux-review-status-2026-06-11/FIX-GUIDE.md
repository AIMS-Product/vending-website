# UX Fix Guide — Every Unfixed Issue, In Plain English

Date: 2026-06-11. Companion to STATUS.md / index.html in this folder. Every issue from both June 10 UX reviews that is not fully fixed in code gets three things here: **What** is wrong, **Why** it matters, and **Fix** — how it probably should be solved. Issues that fail for the same underlying reason are grouped so one fix closes several IDs. A final section lists the issues that are unfixed because they are waiting on a business decision, with the decision spelled out.

## Section 1 — SEO Page Builder (5 items — the last gaps in an otherwise complete round)

### P2-3 — PARTIAL — /admin/pages/redirects — Invalid redirect paths still hit a jargon error

**What:** The redirect form now shows friendly inline errors and keeps what you typed — but only for _empty_ paths. Type a path that doesn't start with a slash (like `foo` instead of `/foo`) and it slips past the form's validation, reaches the server, and comes back with the old developer-speak error "Path must be root-relative."

**Why:** The one mistake a non-technical admin is most likely to make (forgetting the leading slash) is exactly the case that still gets the confusing message. They won't know what "root-relative" means, so they're stuck.

**Fix:** Add one rule to the form's validation schema (`src/app/admin/pages/redirects/actions.ts:45-48`): the path must start with `/`. Show the same friendly message that already exists for the empty case — "Start the path with / (for example /resources/old-page)" — so the bad value never reaches the server.

### P2-4 — NOT_FIXED — /admin/pages/[id] — Nothing on a new page tells you which fields you must fill in to publish

**What:** A brand-new page is a canvas of grey placeholder text ("Hero headline", "Supporting copy"...) with no visual marker saying which of those fields are required before the page can go live. This issue was never mapped to any fix in the round, so it fell through the cracks.

**Why:** The publish checklist now exists, but you only discover the requirements _after_ you try to publish. A first-time user types into whatever looks interesting, hits Publish, and is sent back to do homework they could have seen up front. It recreates a milder version of the original "whack-a-mole publishing" complaint.

**Fix:** Reuse the publish-blocker derivation that already powers the checklist (the work from fix N1) to badge required fields on the canvas itself — a small "Required to publish" tag on the hero headline, CTA label, and CTA destination placeholders — and/or show the checklist in an empty-state panel when the page is brand new (`src/components/admin/seo-page-editor/SeoPageEditorCanvas.tsx:238-245`). The data already exists; this is presentation only.

### SEO-P3a — PARTIAL — editor — Save confirmations use three different message styles

**What:** The double "Draft saved" toast was fixed, but saving still talks to you in different voices depending on the path you took: "Draft saved", "Draft saved and preview opened", "Save failed" — different texts appearing in different ways.

**Why:** Inconsistent confirmations make users re-read every message instead of recognising a pattern. Once they trust the pattern, they stop checking — which is the point of a confirmation.

**Fix:** Standardise on one toast component, one position, and a fixed grammar ("Draft saved", "Draft saved — preview opened", "Save failed — retrying") across all save paths (`SeoEditorManualSubmitToast.tsx`, `src/app/admin/pages/actions.ts:245-258`).

### SEO-P3b — NOT_FIXED — /admin/pages — Page URLs in the list look like computer errors

**What:** Each row in the pages list shows the page's URL in tiny grey monospace type (`src/app/admin/pages/page.tsx:802-807`). One persona (Betty, the grandparent) read these as error codes.

**Why:** Monospace + grey + small is the visual language of "something technical went wrong". For non-technical admins it adds anxiety to a screen they use daily.

**Fix:** Render the URL in the normal UI font, slightly muted, prefixed with a link icon — or show it as a clickable link styled like one. Keep monospace for genuinely technical surfaces only.

### SEO-P3c — NOT_FIXED — /admin/pages — "No results" state pushes you to create a page instead of clearing your search

**What:** When a search finds nothing, a full-width "Create page" button dominates, with "Clear search" as an afterthought (`src/app/admin/pages/page.tsx:532-554`).

**Why:** Nine times out of ten a no-results state means a typo, not a missing page. The layout pushes the wrong action — and an accidental duplicate page is exactly the junk-content problem the review flagged elsewhere.

**Fix:** Flip the hierarchy: "Clear search" as the primary button, "Create page" as a secondary/ghost action below it.

### SEO-P3d — NOT VERIFIABLE FROM CODE — /admin/pages/new — Create-gate click was flaky under automation

**What:** During the review, automated clicks on the create gate sometimes missed — a possible hydration race. The gate has since been rewritten as a single static panel and no hydration errors were observed on reload.

**Why / Fix:** Probably already resolved by the rewrite; can't be proven by reading code. Worth one manual check (open /admin/pages/new, click immediately) next time you're in the app. No code work planned unless it reproduces.

## Section 2 — Full-app: issues marked "handled" that the code says are not (highest priority)

### C096 + C099 + C020 + C127 + C134 — P2/P3 — every public page — The page visibly jumps as it loads (layout shift 0.263)

**What:** On the first visit, the homepage, About, News, and every article measurably shift after they appear — a Cumulative Layout Shift of 0.263, where under 0.1 counts as "good". Five separate findings traced to this. Partial work was done (hero images reserve space, stat numbers no longer count up from 0), and warmed-up loads now measure 0.000 — but the very first cold load still hits 0.263. The fix round root-caused the remaining shift to the **footer streaming in late** and explicitly declared it out of scope; the disposition table then marked the issue "handled", which is why it shows as fixed in the plans but not in reality.

**Why:** First impressions: the jump happens on a visitor's _first ever_ load — exactly the moment a sceptical prospective applicant is judging whether the site is legit. It also drags Core Web Vitals, which feeds Google ranking for a business that lives on organic search.

**Fix:** Finish the two remaining pieces. (1) Stop the footer shift: reserve the footer's height (a `min-height` on the footer container) or stop streaming it after first paint. (2) Add `font-display` handling to the Inter font config in `src/app/layout.tsx:10-13` (next/font with `display: 'swap'` plus `adjustFontFallback`, or `display: 'optional'`) so text doesn't reflow when the webfont lands. Then re-measure cold loads and confirm under 0.1.

### C005 — P2 — /news — Article cards are invisible until you scroll

**What:** The news cards animate in on scroll — which means on first load, the cards already on screen render as blank outlines until you nudge the page. The "fix" applied (an image-fallback component) solves a different problem: images that fail. It does nothing for cards that are _waiting for a scroll event that never comes_.

**Why:** The page looks broken or empty at exactly the moment someone lands on it. Several personas assumed there were no articles.

**Fix:** In the scroll-reveal logic in `src/components/sections/NewsList.tsx`, render anything already in the viewport visible immediately (IntersectionObserver fires on mount for in-view elements — apply the revealed state on first callback rather than only on scroll), and keep the animation only for cards genuinely below the fold.

### C050 — P2 — news articles — Links inside article text are too faint to pass accessibility contrast

**What:** Article byline contrast was fixed and links got underlines — good. But the link colour inside article body text is still light blue `#2d9fd6` on the pale background, about 2.4:1 contrast where accessibility (WCAG AA) requires 4.5:1. The accessibility sweep explicitly excluded article pages from its scope, so this survived.

**Why:** Low-vision readers genuinely can't pick the links out, and it's a hard, measurable WCAG failure — the kind that shows up in automated audits and accessibility complaints.

**Fix:** One CSS change: in `src/app/globals.css`, raise `.public-news-prose a` from `#2d9fd6` to the brand's darker blue `#066a99` (already used for the byline, measures 5.7:1). Underlines are already there.

### C100 + C153 + C154 — P2/P3 — 404 page — The "page not found" page is off-brand and only half-helpful

**What:** Three findings, one small page. (1) C100: it's the only public page that drops the brand — plain semi-bold heading and a white pill button instead of the heavy black display face and orange brand button used everywhere else. (2) C153 partial: recovery links to News/About/Apply were added, but the requested Contact link and search box were not. (3) C154 partial: the copy still says the content "has moved" while offering no way to find where.

**Why:** People hit 404s from stale links shared in groups and old emails — high-intent visitors. An off-brand page reads as "this site is broken or fake", and a dead end loses someone who was actively looking for you.

**Fix:** One pass over `src/app/not-found.tsx`: set the heading in the brand display face ("PAGE NOT FOUND."), restyle "Back to home" as the standard orange brand button, add Contact to the recovery links, and either drop the "or has moved" clause or add a search box. Twenty lines, closes three findings.

### C141 + C033 + C019 — P2/P3 — /admin/news — You can't archive a news post from the list

**What:** Three findings, same gap. News list rows have only an Edit link — no archive or delete. Retiring a post means opening each post's editor and hunting for the Archive control. The SEO pages list already solved this with a per-row "⋮" actions menu and bulk archive.

**Why:** Tidying old content is a routine batch job. Editor-only archiving turns a 30-second task into a click-marathon, and inconsistency between the two lists makes the studio feel like two different products.

**Fix:** Port the existing pattern: give `PostRow` in `src/app/admin/news/page.tsx:343-379` the same actions menu the pages list uses (`PageActionsMenu`, Archive with confirm dialog), and optionally the same row-checkbox bulk archive added in the SEO round (`BulkArchiveControls`). Server action for archiving news already exists in the editor path — reuse it.

### C014 — P1 — /apply — Form errors are announced per-field, but there's no summary at the top

**What:** Validation was substantially fixed — friendly inline messages, screen-reader attributes, a live announcement region. The missing piece: when a submit fails, there's no summary at the top listing the failed fields with links to jump to each, and the announcement region sits at the bottom of the form.

**Why:** On a long form (especially mobile), an error in a field that's scrolled off-screen is invisible — the user hits Submit, nothing seems to happen, and they leave. The top summary is also the standard accessible pattern (WCAG 3.3.1 technique) for screen-reader users to understand the full task.

**Fix:** On failed submit, render an error box above the form ("3 things need fixing: Name, Email, State") where each item is an anchor that focuses its field, and move focus to that box. The per-field state needed to build the list already exists in `PublicLeadForm.tsx` — this is assembly, not new validation.

### C117 — P1 — /apply — Budget/stage/timeline are still required (interim by design)

**What:** "Not sure yet" options were added to all three dropdowns — that part is done. The fields themselves remain mandatory; making them properly optional is explicitly parked as decision K4 with Kody.

**Why:** Forcing a commitment ("budget") that an early-stage lead hasn't made loses leads at the most expensive moment. The interim "Not sure yet" softens this well.

**Fix:** No code work until K4 is decided. When it is: either keep required+"Not sure yet" (current state, defensible) or drop `required` from the three selects in `PublicLeadForm.tsx:227-268`. One-line change either way — chase the decision, not the code.

## Section 3 — Full-app P3s: small public-site fixes (not deferred, just never scheduled)

### C093 + C110 + C094 + C129 + C047 — global — Every nav and footer link is too small to tap reliably

**What:** Five findings, one root cause: header nav links are ~20px tall and footer links ~17px tall, far below the 44px minimum for comfortable touch targets. The admin studio repeats it with 10px status dots and 32px icon buttons.

**Why:** Most of this site's traffic comes from social media — phones. Fiddly links cause mis-taps, rage-taps, and a cheap feeling, and target size is also a WCAG criterion.

**Fix:** Pure CSS, no visual redesign: add vertical padding so each link's _tappable_ box reaches 44px while the text stays the same size — `py-3` (or `min-h-[44px] flex items-center`) on `HeaderNavLink` (`src/components/site/Header.tsx:131-135`) and footer links (`src/components/site/Footer.tsx:53-56`). For admin dots/icons, ensure a 24px+ hit area via padding on the interactive element.

### C012 — / — There's no "Home" link in the top nav

**What:** Returning home depends on knowing the logo is clickable; the nav itself has no Home item.

**Why:** Less-technical visitors (several personas) genuinely don't know the logo convention and get stranded.

**Fix:** Add `{ label: 'Home', href: '/' }` to `primaryNav` in `src/lib/content/nav.ts:9-14`, or give the logo a hover/focus treatment that makes it read as a link. The nav item is the safer bet for this audience.

### C040 + C059 — / — Two different labels (and two adjacent copies) for the same Apply link

**What:** The nav button says "STEP INSIDE", the hero says "APPLY NOW" — both go to /apply. Keyboard users additionally hit two identical adjacent Apply links in the header (tab stops 7 and 8).

**Why:** Two labels for one destination makes people wonder if they're different things, and the duplicate tab stop is noise for keyboard users. "Step inside" also hides what the button does (see deferred C011/C113 — final wording is a Kody decision, but the duplication isn't).

**Fix:** Use one label for both (the literal "APPLY NOW" until Kody rules on wording) in `Header.tsx:41-46` and `home.ts:32`, and remove or differentiate the duplicated header link so there's a single Apply tab stop.

### C013 — / — The nav says "Resources" but leads to a call-prep checklist

**What:** The "RESOURCES" nav item opens /pre-call-resources — a page for people who already booked a call, headed "PREPARE FOR YOUR VENDING STRATEGY CALL".

**Why:** A first-time visitor clicking "Resources" expects guides and articles; landing on someone else's homework feels like a wrong turn and wastes the nav slot on the wrong audience.

**Fix:** Cheapest: rename the nav item to "Pre-Call Prep" (`src/lib/content/nav.ts:11`). Better: point "Resources" at /news or a real resource index, and link the pre-call page only from booking confirmations.

### C092 — global — Contact isn't reachable from the header or mobile menu

**What:** Contact lives only in the footer. On mobile, opening the hamburger gives no Contact option — you must scroll to the bottom of any page.

**Why:** When a prospect has a question, friction in _finding the contact path_ reads as evasiveness — the sceptic persona called it out. (Related to deferred decision K2 on header placement, but the mobile-menu gap can be closed without re-litigating the desktop header.)

**Fix:** Minimum: add Contact to the mobile menu's link list in `Header.tsx`. If K2 approves: add it to `primaryNav` so desktop gets it too.

### C025 + C028 + C029 + C125 — /apply — Form ergonomics: focus, keyboard submit, the State dropdown, and the buried button

**What:** Four small frictions on the money page: no field is focused on load (C025); there's no Cmd/Ctrl+Enter submit (C028); State is a raw 50-option dropdown with no type-to-search beyond browser default (C029); and on mobile the submit button is below a tall hero with no sticky bar (C125).

**Why:** This form is the site's conversion event. Every saved tap measurably matters, and the personas most likely to apply (mobile, social-media arrivals) hit all four at once.

**Fix:** In `PublicLeadForm.tsx` / `ApplyPageContent.tsx`: add `autoFocus` to the Name field on /apply; add an `onKeyDown` Cmd/Ctrl+Enter handler that submits the form; swap State's native select for a searchable combobox (or at minimum keep the native select, which does basic type-ahead, and prefill from IP geo as an editable default); tighten the mobile hero and add a sticky "Submit application" bar once the form is in view (the SEO editor's mobile sticky-bar from fix N11 is a ready-made pattern).

### C043 + C075 — /apply — Copy assumes you already know who Mike is and what to write

**What:** The headline says "Apply to build your vending business with Mike." — no surname, no context for someone landing cold (C043). The open-text label "What are you trying to build?" is vague, especially for second-language readers, and overlaps the intro line (C075).

**Why:** /apply is a common direct-landing page from ads and shares; cold visitors shouldn't need the homepage's context. Vague questions get vague answers — or none.

**Fix:** In `ApplyPageContent.tsx:24`: "Apply to build your vending business with Mike Hoffman, founder of Vendingpreneurs." In `PublicLeadForm.tsx:280`, relabel to something concrete with an example: "Tell us about your vending goals — e.g. 'I want 5 machines in offices within a year.'"

### C088 — /apply — No privacy note where people hand over their details

**What:** The form collects name, email, phone, location, and budget with no consent line or Privacy Policy link at the point of submission.

**Why:** It's both a trust signal at the most sensitive moment and table stakes for privacy compliance expectations (the policy exists; it's just not referenced where data is collected).

**Fix:** One line under the submit button in `PublicLeadForm.tsx:287-297`: "By applying you agree to our Privacy Policy. We never sell your data." with the policy linked.

### C149 — /apply — No reference number after applying

**What:** The thank-you page confirms receipt but issues nothing the applicant can quote later.

**Why:** When someone follows up ("I applied two weeks ago…") neither side can identify the application; it makes the operation feel small and makes support threads slower.

**Fix:** Generate a short reference (the lead row's ID prefix is enough, e.g. "VP-4F2A") and show it on `/thank-you-for-applying` and in the confirmation email. Requires passing the created lead's ID through to the thank-you state.

### C126 + C152 — /contact — The message box gives no guidance and the page sets no reply expectation

**What:** The required Message field is an empty box with no hint about what to write or how long (C126), and nothing says when — or whether — anyone replies (C152).

**Why:** Blank boxes intimidate; people skip forms they can't size up. And a form with no reply promise feels like a black hole — the angriest persona finding on this page.

**Fix:** Add a placeholder to the Message textarea ("Tell us where you are and your main question — a sentence or two is fine") in `PublicLeadForm.tsx:450-460`, and one sentence in the /contact intro: "We reply within 1 business day." (Confirm the actual SLA with Kody before promising it.)

### C027 — /contact — The State field is required on one form and optional on the other, silently

**What:** The behaviour is now intentional in code (required on apply, optional on contact) but contact's State shows no "(optional)" label, so the inconsistency is still visible to anyone who uses both.

**Why:** Identical-looking forms behaving differently erodes trust in the form system; the fix is purely labelling.

**Fix:** In the shared `SelectField`, render "(optional)" next to the label when `required` is false (or just on contact's State) — `PublicLeadForm.tsx:396-404`.

### C155 — /admin/forgot-password — Reset confirmation still hedges

**What:** After requesting a reset, the message reads "If {email} has Studio access, a password reset email is on its way" — better than before, but it still leaves a locked-out admin unsure whether to wait or retry, and there's no guidance to check spam.

**Why:** Password reset is used at the moment of maximum frustration; ambiguity there generates support pings to you.

**Fix:** Extend the copy in `ForgotPasswordForm.tsx:40`: "…a reset link is on its way — check your inbox and spam folder. It can take a couple of minutes."

### C052 + C057 — articles & news editor — Sidebar landmarks are nested inside other landmarks

**What:** The article share-rail and sidebar `<aside>` elements sit inside the `<article>` landmark (`NewsArticle.tsx:22-81`), and the news editor's aside is nested inside the admin shell's `<section>` (`NewsEditorForm.tsx:214`). Axe flags "complementary landmark not at top level".

**Why:** Screen-reader users navigate by landmarks; nested complementary regions make the page map confusing. The equivalent issue in the SEO editor was already fixed in round 2 (N17) — these two surfaces were missed.

**Fix:** Same treatment N17 used: either hoist the aside to be a sibling of `<main>`, or drop the `aside`/`role="complementary"` in favour of a plain `div` where the region isn't truly complementary.

### C053 + C086 — /case-studies — Headings skip from h1 straight to h3

**What:** The page's h1 is followed by card titles marked h3 with no h2 between (`CaseStudiesHero.tsx:10`, `CaseStudyQuotes.tsx:35`).

**Why:** Heading order is the other main way screen-reader users skim a page; skipped levels break the outline. It's also an automated-audit flag.

**Fix:** Add an h2 over the quotes section ("Member results") or demote the card titles to h2 — whichever matches the visual design. Two-line change.

### C132 — /admin/pages/new — Duplicate unnamed landmark (needs a runtime check)

**What:** Axe reported a "landmark-unique" violation on the create wizard during the review. The wizard has since been rewritten to one step; code inspection can't confirm whether the duplicate landmark survived.

**Why / Fix:** Run axe on /admin/pages/new once (the review's script in `reports/ux-persona-review-seo-builder/scripts/` can be reused). If it still fires, give the offending landmark a unique `aria-label` or collapse it.

### C063 + C072 + C073 — public copy — Idioms that don't translate

**What:** Three concrete spots: "makes a vending route compound… posts drop here" on /news (`NewsHero.tsx:12-14`); "increase your bottom line" on the homepage (`home.ts:139`); "300% boost via vetted options" in an article preview.

**Why:** The reviews' second-language persona stumbled on each of these. Plain words convert better for everyone, not just ESL readers — and these three are one-line content edits, unlike the bigger voice questions parked with Kody.

**Fix:** Swap in the literal phrasing the review proposed: "helps a vending route grow steadily — we add new posts here when we publish them"; "increase your profit"; "up to 300% higher sales using pre-checked machine and location choices."

### C118 — / — Hero copy is corporate buzzword soup

**What:** "Launch and scale a profitable vending machine business with minimal time investment", "structured roadmap to success", etc. (`home.ts`).

**Why:** The skeptic persona read it as template-site language; plain speech is the brand's actual differentiator given the founder-led story.

**Fix:** Rewrite the hero line in plain English — review's candidate: "Start a vending business without the guesswork — we show you exactly how, step by step." Worth batching with the Kody copy decisions (K-series) so voice changes happen once, but it isn't formally deferred, so flagging it here.

### C120 — /about — The founder story has no skimmable version

**What:** The About page is several dense paragraphs with no summary (`about.ts`, `AboutHero.tsx:16-20`).

**Why:** Most visitors skim; the credibility facts are buried mid-paragraph where skimmers never see them.

**Fix:** Add a three-bullet "The short version" block above the story (quit the 60-hour job → built vending income → now teaches the system), pulling numbers consistent with whatever substantiation decision comes out of deferred C084.

### C121 — / — Fifteen testimonials stand between the visitor and the final call-to-action

**What:** The homepage stacks ~15 full testimonials before the closing "Take Action" section (`Testimonials.tsx:23-36`).

**Why:** Long single-scrolls bury the action; mobile users especially never reach it. Social proof has diminishing returns after the first few.

**Fix:** Show 3–4 testimonials with a "See more stories" expander (or link to /case-studies), and add a mid-page CTA so action is reachable without the full scroll.

### C143 — /pre-call-resources — A "watch this before your call" page with nothing to watch

**What:** The page is 14 external links and zero embedded media (`SupportPage.tsx:21-30` renders text lists only).

**Why:** People do watch embedded videos and don't reliably click out to them; for call-prep, completion rate is the whole point of the page.

**Fix:** Add an embed slot to the `SupportPage` component (YouTube iframe with aspect-ratio box) and inline the key prep video(s) at the top of the page.

## Section 4 — Full-app P3s: admin studio polish

### C010 + C107 — /admin/pages — Status dots got labels, but the targets are still tiny

**What:** Both findings are now half-fixed: visible text labels and a legend were added next to the readiness/status dots (good), but the dots themselves remain 10px and row actions still hide behind small "⋮" buttons.

**Why:** The comprehension problem is solved; the remaining issue is purely motor — small targets on a dense table used daily.

**Fix:** Bump the interactive hit areas to 24px+ (padding around the dot/“⋮” buttons in `page.tsx:1069-1094`), keeping the visual size if you like the compact look. James's own UI preference notes favour compact spacing — pad the _hit area_, not the visuals.

### C017 — /admin/pages — You can archive from the list now, but still not from inside the editor

**What:** The list row "⋮" menu has Archive with a confirm — done. The editor itself still has no archive control, so if you're already in a page you must back out to the list to retire it.

**Why:** "I'm looking at the thing I want to archive" is the most natural moment to archive it.

**Fix:** Add "Archive page" to the editor's settings/danger area (publish panel or page-settings drawer), reusing the existing `adminArchiveSeoPage` action and the list's confirm dialog.

### C102 — /admin — Every section invents its own breadcrumb style

**What:** Section eyebrows vary with no scheme: "CMS Assets", "Studio Settings", "CMS Governance", "Blog CMS", none at all on SEO pages (`AdminShell.tsx:80-101`).

**Why:** Inconsistent labelling makes one studio feel like five bolted-together tools and weakens orientation ("where am I?").

**Fix:** Pick one pattern — "Studio › Media library", "Studio › Settings › Users", "Studio › SEO pages" — and apply it to every route through the shared `AdminShell` header so it can never drift again.

### C103 — /admin — Stat-card colours mean different things on different screens

**What:** Within pages/news the tones are consistent now (blue=all, amber=drafts, green=published), but Libraries reuses the same colours with unrelated meanings (blue=CTAs, green=approved proofs…).

**Why:** Colour is a language; once green means "live" somewhere, green meaning "proofs" elsewhere quietly mistrains the user.

**Fix:** Define semantic tokens (info / warning / success / neutral) in the admin UI helpers, and have each stat card declare a _meaning_, not a colour. Libraries' cards then map to neutral/info unless they truly signal good/needs-work.

### C104 — /admin — Four different "primary button" styles

**What:** "Create page"/"Invite user" (auto-width, blue, +icon), "Save CTA preset" (full-width solid), blog editor's identical "Save draft"/"Publish" pair, and the SEO editor's outline pills — four styles for the same concept.

**Why:** Button style is how users learn "this is the main action here"; four dialects mean re-learning per screen. (Same family as deferred C098 design-system unification, but the admin-side button cleanup doesn't need the public-site decision.)

**Fix:** Consolidate on the existing `adminPrimaryButtonClass`/`adminSecondaryButtonClass` in `AdminUi.tsx` — extend them into a small `Button` component with primary/secondary/ghost variants and replace one-off styles where they appear.

### C108 — /admin/news/new — The blog editor is a blank white void

**What:** Title, Excerpt, and Body are all placeholder-free; the body is a bare textarea with no toolbar or hint (`NewsEditorForm.tsx:189-197`).

**Why:** Empty-box paralysis, and it badly undersells the studio next to the polished SEO builder one menu item away.

**Fix:** Minimum: placeholders ("Write your post in Markdown — headings with #, links with [text](url)") and a one-line format hint. Better: match the SEO builder's designed empty-state treatment.

### C137 — /admin/pages — A failed scheduled publish doesn't show in the stats

**What:** "Schedule failed" exists as a filter, but the KPI cards up top never mention it; you only learn of a failure if you go looking.

**Why:** This is the silent version of the original P0 "my scheduled page never went live and I don't know why" — the scheduling flow now tells the truth, but the list page can still hide a failure.

**Fix:** When the schedule-failed count is greater than zero, surface it — either a red count badge on the relevant KPI card or a slim alert bar above the table linking to the existing filter.

### C139 — /admin — No search across content types

**What:** Search is per-CMS ("Search SEO pages"); there's no single box that finds a page, post, or media item.

**Why:** Users remember _content_, not which CMS it lives in. As content grows, "where did I put that" becomes a daily tax.

**Fix:** A studio-level search (header of AdminShell) querying pages + news + media titles and returning a grouped result list. Moderate effort — reasonable to schedule rather than batch with the quick wins.

### C140 — /admin/pages — After creating a page, nothing points you to it

**What:** The list revalidates on save, but there's no success toast with a link to the new page; during the review the new row wasn't reliably visible at the top.

**Why:** "Did that work?" after creation is the same honesty-about-state problem the rest of the fixes addressed.

**Fix:** After successful create, show a toast "Page created — Open" linking to the editor, and/or sort the list so the new row is visibly first (created-desc default or a highlight on the new row).

### C142 — /admin/libraries — Content libraries has no sidebar entry

**What:** /admin/libraries is reachable only via a link in the Media library header; the sidebar's `contentSections` simply doesn't include it (`AdminShell.tsx:38-66` — the type exists, it's just never added).

**Why:** Same class of bug as the invisible News nav (the round's P0): a working feature that most admins will never find.

**Fix:** Add the libraries section object to `contentSections` in `AdminShell.tsx` — a few lines, same shape as the `blogSection` fix already made.

### C145 — /admin/news/new — Save was occasionally not findable

**What:** One review run failed to find a visible Save control. Current code shows a persistent "Save draft" in the sidebar Publish card, and the agent couldn't reproduce a visibility problem from code.

**Why:** Probably already fine; but "save is sometimes invisible" is too dangerous to dismiss on one reading.

**Fix:** Quick manual check at narrow viewport (the likely culprit: sidebar below the fold on small screens). If it scrolls away, pin Save in the editor header — the SEO editor's sticky mobile save bar (N11) is the ready pattern.

### C111 — /case-studies — Testimonial cards are ragged

**What:** Equal-height cards and avatars are now in place; remaining niggle is ragged bottoms from unnormalised quote lengths within a row.

**Why:** Pure polish — the grid reads slightly untidy on wide screens.

**Fix:** Clamp long quotes (`line-clamp-6` plus a "more" affordance) or accept the variance; lowest priority in this guide.

### C106 — news articles — Share buttons labelled "X", "in", "f", "link"

**What:** Screen-reader labels are fixed; visually the four share chips still mix a brand glyph, two lowercase abbreviations, and a word.

**Why:** Looks unfinished, and "in"/"f" are only guessable if you already know the brands.

**Fix:** Replace the text chips with a consistent icon set (X, LinkedIn, Facebook, copy-link SVGs) in `NewsArticle.tsx:150-164`; the aria-labels already in place carry the meaning.

## Section 5 — Unfixed because a decision is pending (no code work until the call is made)

These 29 are documented deferrals — almost all waiting on Kody (marketing). Each line: what's parked, and the decision that unblocks it.

### Contact & trust (the biggest cluster)

- **C148 / C114 (P2):** No phone/email anywhere; contact page is form-only. _Decision K1: add a support email, email + phone, or keep form-only funnel design._ The review's strongest deferred item — 11 personas flagged it.
- **C003 (P2) / C092-related:** Contact missing from header nav. _Decision K2: does Contact belong in the header?_ (The mobile-menu half is fixable now — see C092 above.)
- **C077 / C115 (P2):** No pricing or "how pricing works" anywhere. _Decision K5: publish a range, a "pricing explained" page, or keep it for the call._
- **C078 / C080 (P2):** "Passive income / financial freedom" framing and an unsubstantiated "$10k/month" quote. _Decision K6: soften, substantiate, or keep._ Carries regulatory/credibility risk worth flagging when you raise it.
- **C082 (P2):** Founder is "Mike", no surname or company registration details. _Decision K7: how much identity/credential detail to publish._
- **C084 (P3):** About-page personal financial figures with no substantiation. Same conversation as K6.
- **C079 / C085 / C087 (P3):** Testimonials undated/unverifiable, case studies have no written outcomes, every rating is 5/5. _Same trust-content decision family — bring to Kody as one "social proof standards" item._
- **C081 (P3):** "Featured partners" logo wall (PepsiCo, Doritos…) implies endorsement. _Decision: state the actual relationship or relabel._
- **C083 (P3):** "I'm not here to sell a dream" line reads as protesting too much. _Copy call for Kody._

### Voice & wording

- **C011 / C113 (P2):** "STEP INSIDE" nav CTA doesn't say what it does. _Decision K3: final CTA wording._ (De-duplication of the two header links can proceed now — see C040+C059.)
- **C064 / C065 / C067 (P3):** "Rat Race" heading, idiom-heavy testimonials, "accelerator fit" phrasing. _Part of the same voice review as K-series copy items._
- **C066 (P3):** US-state dropdown with "$5k" abbreviations and no country context. _Minor copy ruling._
- **C068 / C069 (P3):** Admin jargon ("Needs links", "CMS shell", "Metadata issues"). _Admin-copy glossary decision; low stakes._

### Structural / future work (deferred to named follow-up nodes)

- **C098 (P2):** Public site and admin studio are two unrelated design systems. _Explicitly parked as a future design-system unification node — real project, schedule deliberately._
- **C124 (P2):** Apply form loses everything on an accidental tab reload. _Parked as a future draft-persistence node (localStorage autosave of form fields). Worth pulling forward — it's conversion-critical and self-contained._
- **C038 / C109 / C146 / C147 (P3):** No settings landing page; wizard advertises 4 page types but the studio surfaces one; no shareable URL until first save; an internal block-preview audit tool with no inbound link. _All small structural calls — fold into the next admin polish round._
- **C131 / C133 (P3):** First-article slow load (mostly the CLS/footer work in Section 2) and a silent image-optimizer 500 in the console. _Re-measure after the Section 2 CLS fix; add an error boundary/log for the optimizer failure if it persists._

### Closed, no action

- **SEO P2-13:** The "floating avatar overlapping Sign out" was a dev-only browser overlay, not app code. Verified non-issue.

## Suggested batches

1. **Quick wins, one sitting (~15 issues):** P2-3 schema rule, C050 link colour, 404 pass (C100/C153/C154), C012 Home link, C040/C059 label+dupe, C063/C072/C073 copy swaps, C088 privacy line, C126/C152 contact copy, C027 optional label, C155 reset copy, C142 sidebar entry, SEO-P3b/c list styling.
2. **The CLS finish (C096 cluster):** footer height + font-display, then re-measure cold loads.
3. **Forms & conversion (C014, C025/C028/C029/C125, C149, consider pulling C124 forward).**
4. **Admin parity (C141 cluster, C017, C137, C140, C108, P2-4 canvas cues, C010/C107 hit areas).**
5. **A11y sweep leftovers (C052/C057, C053/C086, C093 cluster, C132 axe check).**
6. **Kody agenda:** one meeting covering K1–K7 + the social-proof standards cluster — most of Section 5 unblocks from a single conversation.
