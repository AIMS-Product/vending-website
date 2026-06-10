# Persona Review — 02 Marcus (Impatient Power User, 34)

**Lens**: Can a power user get things done FAST? Keyboard support, smart defaults, friction count (clicks/confirms), skippable onboarding. I judge in the first 3 seconds and abandon anything that wastes my time.

## Summary

- **Pages reviewed**: 28 (all public + admin routes in the exploration log)
- **Journeys reviewed**: 8
- **Total findings**: 24
- **Blockers**: 0
- **Overall gut feel**: **3 / 5** — Nothing is outright broken and the paths are short, but it bleeds friction a power user notices instantly: invisible success states, no autofocus, wrong input types, a forced tour overlay in the admin editor, and zero keyboard shortcuts anywhere.

The single thing that would make me bounce: I submit the application, glance away for half a second, and there is _no real confirmation_ — just a tiny green sentence wedged next to the button. The automation literally re-submitted six times because it could not tell it worked. That is a power-user trust killer.

---

## Journey Review

| #   | Journey                  | Score | Could I complete it?                                                         | Where I'd give up                                                                         |
| --- | ------------------------ | ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | discover-and-apply       | 2     | Yes, in 2 clicks                                                             | The success state is so faint I'd assume it failed and re-submit or leave                 |
| 2   | contact-the-team         | 3     | Yes, but Contact is footer-only — I'd hunt the header first                  | Not finding Contact in the top nav; I'd Cmd+F or guess the URL                            |
| 3   | read-a-news-article      | 3     | Yes, 3 clicks                                                                | First paint shows empty card outlines + a "BLOG"/"NEWS" name clash — looks half-loaded    |
| 4   | evaluate-trust           | 4     | Yes                                                                          | Minor: privacy/terms footer-only, which is fine                                           |
| 5   | pre-call-prep            | 4     | Yes, 0 clicks                                                                | Nothing; it's a static resource page, loads fast                                          |
| 6   | admin-create-news-draft  | 2     | Only because I guessed /admin/news                                           | No News/Blog item in the studio sidebar — a power user shouldn't have to type URLs        |
| 7   | admin-create-seo-page    | 2     | Yes, but it's a 3-step wizard + a tour overlay for what should be one screen | The forced Quick Tour overlay blocking the panel; the multi-step wizard for "make a page" |
| 8   | admin-manage-content-ops | 2     | Partially                                                                    | Redirects manager has zero inbound links — it's an orphaned route I can only reach by URL |

### Per-journey notes

**1. Discover & Apply** — Two clicks from home to a submitted application is genuinely fast, and I appreciate that. But the payoff is invisible. The confirmation is a single small green line, "Thanks. We received your details and will follow up shortly.", sitting next to the SUBMIT button (`journey-discover-and-apply-004-04-submit-continue-round-1-.png`). The form doesn't clear, doesn't disable, doesn't redirect — there's a real `/thank-you-for-applying` page that it just... doesn't use. As a power user I move fast and look away; I need a state change I can't miss.

**2. Contact the Team** — The path works but Contact is only in the footer (`journey-contact-the-team-002-02-find-and-click-contact-link.png`). My instinct is the header nav; not finding it there costs me a scroll-to-bottom or a URL guess. Small, but it's the kind of "where did they hide it" friction I resent.

**3. Read a News Article** — Functional in 3 clicks. Two annoyances: the listing renders empty card outlines until I scroll (scroll-reveal animation makes first paint look unfinished, `news-001-load.png`), and the page is titled "BLOG" while the nav item and route both say "NEWS". Pick one name.

**6. Admin: Create a News Draft** — The studio sidebar only has SEO pages, Media library, Settings. There is no News/Blog entry (`journey-admin-create-news-draft-s02-02-look-for-news-in-studio-nav.png`). I had to know /admin/news exists. A daily admin user being forced to memorize URLs is unacceptable for a tool I'd use repeatedly.

**7. Admin: Create an SEO Page** — Making a page is a 3-step wizard, and on first open of the editor a "Quick Tour · Step 1 of 3" overlay covers the outline panel and blocks interaction (`journey-admin-create-seo-page-s04-04-wizard-starting-point-build.png`). There's a "Skip tour" link, which saves it from being a blocker, but forcing a tutorial on a power user is exactly the friction I bail on.

---

## Page-by-Page Review

### / (home) — Gut feel 2/5

The stat counters read "0+", "$0M+", "0+" — looks like broken/unconfigured data, undermines the whole pitch in my first 3 seconds. Mobile has horizontal scroll. CLS 0.263 is visible jank.

### /apply — Gut feel 3/5

Tab order is clean and logical (name → email → phone → city → selects → textarea → submit). But no autofocus on Name, Phone is a plain text input not `tel`, the State select is a 50-item dropdown with no typeahead beyond the native one, and there's no Cmd/Ctrl+Enter to submit.

### /contact — Gut feel 3/5

Same clean tab order. Same lack of `tel` input and submit shortcut. Footer-only discoverability noted in journey 2.

### /news — Gut feel 2/5

Empty card outlines on first paint, BLOG/NEWS naming clash, and a third card with a broken hero image (500 on the Webflow CDN image, `news-001-load.png` shows alt text where the image should be).

### /admin/pages — Gut feel 4/5

This is the good part. Search box, status tabs, metadata filters, sort control, per-row "Open actions" menu, keyboard-reachable. This is how the rest of the app should feel for a power user.

### /admin (SEO page editor) — Gut feel 2/5

Forced Quick Tour overlay, multi-step creation wizard, publish gated behind "Fix SEO title / Fix URL slug" readiness warnings (reasonable, but a lot of ceremony). No archive/delete path discoverable from the editor.

---

## Blockers

None. Everything completes; the damage is friction and trust, not breakage.

---

## My Top 10 Issues

1. **Invisible apply-success state** (critical) — tiny green line, no redirect/clear/disable; I'd re-submit or leave thinking it failed.
2. **No News/Blog in admin sidebar** (high) — orphaned route, URL-only access for a repeated daily task.
3. **Quick Tour overlay forced on editor open** (high) — blocks the panel; classic forced-tutorial friction.
4. **Home stat counters show "0+ / $0M+ / 0+"** (high) — reads as broken data, kills credibility in 3 seconds.
5. **Contact missing from header nav** (medium) — footer-only; I hunt the top nav first.
6. **BLOG vs NEWS naming clash** (medium) — same section, two names across nav/heading/route.
7. **News listing renders empty cards before scroll** (medium) — first paint looks half-loaded.
8. **No autofocus on first form field** (medium) — every form makes me click before typing.
9. **Phone fields are `text`, not `tel`** (medium) — no numeric keypad, sloppy for a power user on any device.
10. **No keyboard submit (Cmd/Ctrl+Enter) on any form** (low) — forces a tab-to-button or mouse for every submit.
