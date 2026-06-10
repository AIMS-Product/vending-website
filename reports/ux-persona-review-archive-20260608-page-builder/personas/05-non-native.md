# Persona Review: Yuki — Non-Native English Speaker

## Summary

- Pages reviewed: 6
- Issues found: 28
- Blockers: 0
- Overall gut feel: 3/5

I read English well, but this tool is built for people who already think in English marketing and SEO words. Many labels are short and "clever" — they assume I know what "readiness", "governance", "orphaned", "eyebrow", "slug", and "canonical" mean. The layout is clean and the buttons are easy to find, so I am never lost. But I am often unsure _what a word means_, and there are almost no help texts or tooltips to explain. When a word is explained (the publish panel does this well), the experience is suddenly good. The app needs to do that everywhere.

---

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 3/5** — "I can see my pages clearly, but the filter chips use SEO words and abbreviations I must guess at."

| #   | Category         | Finding                                                                                                                                                                                  | Severity | Why this matters to me                                                                                                                                                 |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Copy & Labels    | Column header "GOVERNANCE" with values "Drafting", "Review: 6 mo", "Needs links" — "governance" is an abstract English business word, hard to translate, and the meaning here is unclear | High     | In Japanese "governance" (ガバナンス) is borrowed but vague; I cannot tell if this column is about content quality, legal review, or schedule. No tooltip explains it. |
| 2   | Copy & Labels    | Filter chip "Needs links" and view "Needs links → ?view=orphaned" — "orphaned" is figurative English (a page with no parent), not literal                                                | High     | "Orphaned page" is an idiom. I read "orphaned" and think of a child with no parents, not a page with no internal links. Confusing without explanation.                 |
| 3   | Copy & Labels    | "READINESS" column with a "+" circle icon and no label or number                                                                                                                         | High     | "Readiness" is an abstract noun; combined with only an icon I cannot tell what state the page is in or what to do.                                                     |
| 4   | Copy & Labels    | "Review: 6 mo" abbreviation — "mo" for "month"                                                                                                                                           | Medium   | Abbreviations like "mo", "yr", "qty" are not taught to ESL readers; I had to guess "mo" = month. Write "6 months".                                                     |
| 5   | Copy & Labels    | Stat card labels "needs work", "publicly visible", "retired" are casual phrasings                                                                                                        | Medium   | "Retired" for an archived page is a metaphor (a person retires from work). "Archived" is clearer and matches the chip name above.                                      |
| 6   | Forms & Input    | Search placeholder "Search title, keyword, or URL" is good, but "Search SEO pages" appears as the field label elsewhere — minor inconsistency                                            | Low      | Two different descriptions for the same box made me re-check what it searches.                                                                                         |
| 7   | Feedback & State | Status badge is a single letter "D" in a coloured circle with no text                                                                                                                    | Medium   | A lone "D" assumes I know it means "Draft". For a non-native reader an icon + full word is far safer than a single English initial.                                    |
| 8   | Visual & Layout  | "All metadata" filter — "metadata" jargon used as a filter category with no explanation                                                                                                  | Medium   | "Metadata" is technical; I know it as a developer, but a non-technical ESL content editor would not.                                                                   |

### /admin/pages/new (Create New Page)

**Gut feel: 4/5** — "The cards explain themselves well in plain sentences — this is the clearest page for me."

| #   | Category         | Finding                                                                                                            | Severity | Why this matters to me                                                                                                              |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 9   | Copy & Labels    | Helper text "so the builder can start with scoped templates and AI context" — "scoped" and "AI context" are jargon | Medium   | "Scoped templates" does not translate cleanly; I understand each word but not the combined meaning.                                 |
| 10  | Copy & Labels    | Card descriptions use "CTA", "conversion path", "conversion blocks" without expansion                              | Medium   | "CTA" is never spelled out as "call to action" anywhere I saw. The first time an abbreviation appears it should be written in full. |
| 11  | Feedback & State | Two cards say "Coming soon" and are greyed out but still look like buttons                                         | Low      | This is actually clear and good — "Coming soon" is a common phrase I understand and the disabled style is obvious.                  |
| 12  | Copy & Labels    | "Starting point" vs "Page type" — the difference between the two sections is subtle in English                     | Low      | I was briefly unsure why I pick both a "type" and a "starting point"; a one-line explanation would help.                            |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 3/5** — "The publish panel explains things in full sentences, which I love, but the SEO form and block controls are full of unexplained jargon."

| #   | Category         | Finding                                                                                                                                                         | Severity       | Why this matters to me                                                                                                                                                                                                                   |
| --- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | Copy & Labels    | Field "Slug" with no explanation                                                                                                                                | High           | "Slug" is pure technical English slang (it means the URL part). A non-developer ESL editor has zero chance of knowing this; even I had to recall it. Needs help text like "the last part of the web address".                            |
| 14  | Copy & Labels    | Field "Eyebrow" as a block field label                                                                                                                          | High           | "Eyebrow" is design-industry idiom for the small text above a heading. Literally it is the hair above the eye. Completely opaque to me.                                                                                                  |
| 15  | Copy & Labels    | "Canonical URL" labelled as "Preferred URL" in UI, but the field name is `canonicalUrl` and toggles say "noindex"                                               | High           | "Canonical" and "noindex" are deep SEO jargon. "Preferred URL" is a better label, but it still needs a sentence explaining what it does and when to set it.                                                                              |
| 16  | Copy & Labels    | Toggle "Hide from search engines" is clear, but "Include in sitemap" assumes I know what a sitemap is                                                           | Medium         | "Sitemap" is jargon; a short tooltip ("a list of your pages that search engines read") would remove the guesswork.                                                                                                                       |
| 17  | Copy & Labels    | "Topic cluster", "Funnel stage", "Campaign", "Lifecycle" fields with no help text                                                                               | Medium         | These are marketing-strategy English terms. "Funnel stage" is a metaphor (a sales funnel) that does not exist in my mental model.                                                                                                        |
| 18  | Copy & Labels    | "Governance comments" section heading                                                                                                                           | High           | Same problem as the list page. "Governance comments" — are these legal? approval? internal notes? The placeholder "Add an internal note" further down is much clearer; the heading should match that plain language.                     |
| 19  | Feedback & State | Toast messages stack: "Preview link created." then "Could not copy link." — the failure message gives no reason and no fix                                      | High           | "Could not copy link" is vague (review criteria: errors must say what to do). As an ESL reader I cannot tell if I did something wrong or if it is a browser issue. Should say e.g. "Copy failed — select the link and copy it manually." |
| 20  | Copy & Labels    | Buttons "Copy editor link" and "Copy public URL" sit beside each other; "editor link" vs "public URL" distinction is subtle                                     | Medium         | Two near-identical buttons with abstract differences. I was unsure who each link is _for_ (me, or a visitor?). A tooltip would clarify.                                                                                                  |
| 21  | Copy & Labels    | Block panel descriptions: "Visible Q&A for schema", "Media asset with alt text and rights notes"                                                                | Medium         | "Schema" and "rights notes" are jargon dropped without context. "Q&A" is fine; "schema" is not.                                                                                                                                          |
| 22  | Feedback & State | "NEXT REQUIRED STEP → Ready to publish → No hard blockers remain..." — this is excellent plain English                                                          | Low (positive) | This is the one place the app _explains_ itself in full sentences. "No hard blockers remain. Review the public preview, then publish when the page is ready." I understood it instantly. More of this everywhere, please.                |
| 23  | Visual & Layout  | Mobile editor collapses to floating pill buttons (Pages, Blocks, SEO, Save draft...) which is tidy, but "Editor link" / "Public URL" pills lose the word "Copy" | Medium         | On mobile the verb is dropped, so "Editor link" reads like a label, not an action. I could not tell it was a button.                                                                                                                     |
| 24  | Forms & Input    | The SEO form has ~30 fields and only two marked required (title, slug); the rest give no guidance on whether to fill them                                       | Medium         | With so many unexplained fields and no "optional/recommended" hints, an ESL editor cannot prioritise. I would fill nothing for fear of doing it wrong.                                                                                   |

### /admin/pages/authors (Authors)

**Gut feel: 4/5** — "Simple form, clear labels — only the 'Slug' and 'Avatar asset ID' fields stop me."

| #   | Category      | Finding                                                                                     | Severity       | Why this matters to me                                                                                                                                                |
| --- | ------------- | ------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Forms & Input | "Slug" field again, no help text, marked required                                           | High           | Required + unexplained jargon = a real blocker risk for a non-technical ESL user. I do not know what to type. A placeholder example ("e.g. jane-smith") would fix it. |
| 26  | Forms & Input | "Avatar asset ID" expects an ID with no picker or example                                   | Medium         | "Asset ID" is technical and there is no way to browse/choose; I would not know where to find this ID.                                                                 |
| 27  | Copy & Labels | Subtitle "Manage public author identities separately from admin users" is clear and helpful | Low (positive) | Good plain explanation of why this page exists.                                                                                                                       |

### /admin/pages/redirects (Redirects)

**Gut feel: 3/5** — "The example placeholders help a lot, but 'redirect', '301/302', and the empty table are unexplained."

| #   | Category        | Finding                                                                                                                       | Severity | Why this matters to me                                                                                                                                                                          |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | Copy & Labels   | "Redirect Manager", "Create and inspect builder redirects across page prefixes" — "redirect" and "page prefixes" are jargon   | Medium   | "Redirect" I know as a developer, but a content editor may not. "Page prefixes" is unexplained. The placeholders (/resources/old-page → /blog/new-page) are excellent and rescue this somewhat. |
| 29  | Forms & Input   | Status dropdown "301 permanent / 302 temporary / 307 temporary / 308 permanent" — four near-identical options with HTTP codes | High     | These numbers mean nothing to a non-engineer. Even I must think which to choose. There is no help on when to use each; "permanent/temporary" alone would be enough for most users.              |
| 30  | Visual & Layout | Empty table shows only column headers (OLD PATH, DESTINATION, STATUS, SOURCE, CREATED) and no empty-state message             | Medium   | A blank table with headers gives no guidance. An empty state like "No redirects yet — create your first one above" (per review criteria) would reassure me nothing is broken.                   |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 3/5** — "A long visual gallery of block styles — useful to look at, but the title and purpose are unclear to me."

| #   | Category          | Finding                                                                                                                             | Severity | Why this matters to me                                                                                                                                        |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 31  | Copy & Labels     | Page title "Block preview audit" — "audit" + "block" jargon, and no intro sentence explaining what this page is for                 | Medium   | "Audit" is a serious financial/legal word in English; seeing it on a gallery of design samples confused me. I could not tell if I should _do_ something here. |
| 32  | Visual & Layout   | Section labels like "Standard hero / Split hero / Compact hero / Editorial hero", "Eyebrow", "Checklist text" repeat builder jargon | Low      | Consistent with the rest of the app, so at least the words match — but they remain unexplained design terms ("hero", "eyebrow").                              |
| 33  | Navigation & Flow | The page is a very long scroll with no in-page navigation or "back to top"; on mobile it is enormous                                | Low      | Not a language issue, but a long unlabelled scroll made me unsure if there was an action I was missing at the bottom.                                         |

---

## Blockers

None. No feature was completely unusable or broken for me. My problems are about _understanding_, not _functioning_ — but several "High" items (Slug as a required field, the 301/302 dropdown, "Could not copy link" with no fix) come close to blocking a non-technical ESL editor who cannot guess the meaning.

---

## My Top 10 Issues

1. **"Slug" appears as a required field on two pages (editor + authors) with no explanation or example** — pure English tech-slang; a non-developer ESL user literally cannot know what to type. (High)
2. **"Governance" used as a column header AND a comments section heading, unexplained** — abstract English business word; I cannot tell what it covers. The plainer "internal note" wording used elsewhere should replace it. (High)
3. **"Eyebrow" as a form field label** — design-industry idiom with a literal body-part meaning; totally opaque to me. (High)
4. **Redirect status dropdown "301 permanent / 302 / 307 / 308"** — HTTP codes mean nothing to non-engineers; no guidance on which to pick. (High)
5. **"Could not copy link." toast gives no reason and no next step** — violates the rule that errors must say what to do; ESL readers can't infer the fix. (High)
6. **"Canonical / Preferred URL" and "noindex" SEO jargon with no help text** — deep SEO vocabulary an ESL content editor won't know. (High)
7. **"Orphaned" / "Needs links" filter** — "orphaned" is a metaphor; I picture a child, not a page without internal links. (High)
8. **"Readiness" used as a column and panel concept, sometimes shown only as an icon** — abstract noun + icon-only = I can't tell the page's state. (High)
9. **Abbreviations without expansion: "mo" (month), "CTA", "Q&A for schema"** — first use of any abbreviation should be written in full. (Medium)
10. **Empty Redirects table has no empty-state message, only column headers** — a blank table with no words leaves me unsure if it's broken. (Medium)

---

### Note on skipped actions

"Sign out" and the Publish/Archive/Delete actions on the pre-existing sample page were screenshotted but not clicked (correctly labelled as skipped). On look alone: the destructive controls are tucked into a "⋮" actions menu and a separate "Archive page" button, which seems reasonably guarded; "Publish" is a clear blue primary button with a helpful explanation beside it. No comment on behaviour since they weren't executed.
