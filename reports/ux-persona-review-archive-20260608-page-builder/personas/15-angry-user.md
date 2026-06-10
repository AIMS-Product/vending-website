# Persona Review: Karen — Angry Frustrated User

## Summary

- Pages reviewed: 6
- Issues found: 24
- Blockers: 2
- Overall gut feel: 2/5

I came in already burned — a page wouldn't publish and I think I lost work. I need three things: an UNDO, a way to RECOVER what I lost, and a HELP/SUPPORT button to yell at a human. This builder gives me none of them in any obvious way. It autosaves (fine), it has a "Revision history" panel (good!) — but the panel is EMPTY and says revisions only "appear after publishing" — the exact thing that just failed for me. So the one tool that could save me does nothing. There is no support link anywhere. And it silently flashed "Could not copy link" at me in tiny gray text with zero explanation. That is the whole experience: things fail quietly and there is no exit door.

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 3/5** — "I can find my page and its status, but when something's gone wrong there's no 'get help' button anywhere on the screen."

| #   | Category          | Finding                                                                                                                         | Severity | Why this matters to me                                                                                                  |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Trust & Safety    | No Help / Support / Contact link anywhere on the page or in the sidebar (only SEO pages, Media library, Settings, Sign out)     | High     | My page failed to publish and there is literally nobody to ask and nothing to click — I'm stuck with my own frustration |
| 2   | Feedback & State  | "Published 0 publicly visible" stat — if my publish failed, this just silently shows 0 with no link to "why didn't it publish?" | High     | This confirms my page isn't live but offers zero explanation or recovery path, which is exactly what enraged me         |
| 3   | Navigation & Flow | There's a "Schedule failed" filter tab — implying publishing CAN fail — but no inline explanation of what to do when it does    | Medium   | They KNOW publishing fails (they built a whole filter for it) yet give me no recovery instructions                      |
| 4   | Feedback & State  | Row "ACTIONS" column is a bare 3-dot kebab (⋮) with no labels — I have no idea if "undo" or "restore" is hiding in there        | Medium   | When I'm panicking I need obvious buttons, not a mystery menu                                                           |
| 5   | Copy & Labels     | "Archived 5 retired" — is archiving reversible? Nothing tells me if I can un-archive                                            | Low      | If I archived something by mistake I'd have no idea it's recoverable                                                    |

### /admin/pages/new (Create New Page)

**Gut feel: 3/5** — "Clean enough, but two of the options are dead 'Coming soon' tiles and there's no Cancel/back-out, so if I landed here by mistake I'm hunting for the exit."

| #   | Category          | Finding                                                                                                          | Severity | Why this matters to me                                                                       |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| 6   | Navigation & Flow | No visible "Cancel" or "Back to pages" button — the only way out is the browser back button                      | High     | I came here by accident while flustered and there's no clear escape hatch back to my list    |
| 7   | Feedback & State  | "From template" and "AI-assisted template" are greyed "Coming soon" tiles that still look clickable              | Medium   | I'd click a dead option, nothing happens, and that's one more thing not working for me today |
| 8   | Copy & Labels     | No guarantee that "Start building" creates a draft I can later delete — nothing says "you can change this later" | Low      | After losing a draft, I'm scared to commit to choices I can't reverse                        |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 1/5** — "This is where my work lives and it is a wall of 82 buttons with no Undo, an empty revision panel that won't help me, no support link, and a 'Could not copy link' error it threw without explaining anything."

| #   | Category         | Finding                                                                                                                                                                      | Severity    | Why this matters to me                                                                                                                |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | Trust & Safety   | NO UNDO anywhere — no Ctrl+Z affordance, no "Undo" button after edits, deletes, or block moves (Remove, Move, Hide buttons everywhere with no reversal)                      | **Blocker** | I deleted/moved a block by accident and there is no way back — this is the single thing a frustrated user needs and it does not exist |
| 10  | Trust & Safety   | "Revision history" panel says revisions only appear "after publishing, library refreshes, or draft restores" and is otherwise EMPTY                                          | **Blocker** | The ONE recovery tool is empty precisely because my publish failed — it cannot restore the work I lost, which is infuriating          |
| 11  | Feedback & State | Silent "Could not copy link" error shown as tiny gray text under the toolbar with no reason and no retry                                                                     | Critical    | A failure flashed at me, told me nothing about why, and gave me no way to fix it — classic "make it worse" moment                     |
| 12  | Trust & Safety   | No Help / Support / Contact affordance — there's a "Builder support" heading in the SEO rail but it's buried, not a clear "get help" button                                  | Critical    | When everything is breaking I have no human to reach and no documentation link                                                        |
| 13  | Feedback & State | "Remove" buttons on cards delete content with no confirmation dialog and no undo shown                                                                                       | Critical    | One misclick while frustrated wipes a card permanently — no "are you sure", no recovery                                               |
| 14  | Visual & Layout  | 82 buttons crammed into one screen (per exploration log) — overwhelming when I'm already stressed and just want to fix one thing                                             | High        | I can't find the one control I need in the noise; cognitive overload on top of frustration                                            |
| 15  | Feedback & State | "Saving draft…" / "Draft saved" autosave is good, but copy says "Drafts save automatically" AND there's a manual "Save draft" — unclear which one actually persisted my work | High        | After losing a draft I don't trust "automatic" anything; mixed messaging makes me trust it less                                       |
| 16  | Copy & Labels    | Publish flow has a green "Ready to publish / No hard blockers remain" box — but offers no explanation when publishing actually FAILS                                         | High        | It tells me everything's fine right up until it isn't, then goes silent                                                               |
| 17  | Forms & Input    | Dozens of inputs (58) with my content; if a save fails mid-edit, nothing reassures me my typing is preserved                                                                 | High        | Re-entering all that copy after a failure is the exact thing that makes me rage-quit                                                  |
| 18  | Trust & Safety   | "Revoke" buttons on preview links have no confirmation — and once revoked there's no obvious "re-create / undo" beside them                                                  | Medium      | I'd revoke the wrong link, break a share, and not know how to put it back                                                             |
| 19  | Accessibility    | Icon-only eye buttons and kebab menus with no visible labels — hard to tell what's clickable when I'm scanning fast in a panic                                               | Medium      | I waste time hovering blind controls when I need answers now                                                                          |

### /admin/pages/authors (Authors)

**Gut feel: 3/5** — "A plain create form, but no Cancel, no required-field markers visible, and no sign anything I create here can be edited or deleted later."

| #   | Category       | Finding                                                                                                                     | Severity | Why this matters to me                                                                             |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| 20  | Forms & Input  | Required fields (displayName, slug) show no asterisk or "required" marker visually                                          | Medium   | I'll submit, get rejected, and have to figure out what I missed — more friction when I'm impatient |
| 21  | Trust & Safety | No Cancel button and no list of existing authors with edit/delete — once I "Create author" it's unclear if I can fix a typo | Medium   | If I fat-finger a name there's no visible undo or edit path                                        |
| 22  | Trust & Safety | No Help/Support link here either (consistent absence across the app)                                                        | Low      | Same dead-end problem everywhere                                                                   |

### /admin/pages/redirects (Redirect Manager)

**Gut feel: 3/5** — "Functional form, but redirects are dangerous and there's no confirmation, no edit, and the empty table gives me no comfort that my old broken link is even handled."

| #   | Category       | Finding                                                                                                                | Severity | Why this matters to me                                                                             |
| --- | -------------- | ---------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| 23  | Trust & Safety | Creating a redirect (a destructive routing change) has no confirmation and the empty table shows no edit/delete column | High     | A wrong redirect breaks live URLs and there's no visible way to undo or fix one I created in haste |
| 24  | Copy & Labels  | Empty redirects table is just blank column headers — no "No redirects yet" empty state to reassure me nothing's broken | Low      | Blank space makes me wonder if it failed to load, adding to my anxiety                             |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 3/5** — "A long read-only catalogue of block styles; harmless, but it's clearly a dev/internal page and the only nav out is the sidebar — no help, no breadcrumb."

| #   | Category          | Finding                                                                                                              | Severity | Why this matters to me                                         |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| —   | Navigation & Flow | Read-only audit page with no Back/help control; fine to view but a confusing place to land if I got here by accident | Low      | One more page with no escape hatch or support link if I'm lost |

## Blockers

1. **No Undo anywhere in the editor (Editor).** Remove, Move, and Hide buttons act immediately with no reversal. A frustrated user who misclicks has zero recovery — this is the #1 thing my persona needs and it's entirely absent.
2. **Revision history cannot recover a failed publish (Editor).** The panel is empty and explicitly only populates "after publishing, library refreshes, or draft restores." Since my problem IS a failed publish / lost draft, the one recovery tool is useless exactly when I need it.

## My Top 10 Issues

1. **No Undo in the editor** — Remove/Move/Hide are instant and irreversible. (Blocker)
2. **Revision history is empty and only fills "after publishing"** — useless for recovering a failed publish or lost draft. (Blocker)
3. **No Help / Support / Contact link anywhere in the entire app** — when things break I have no human and no docs to reach. (Critical)
4. **Silent "Could not copy link" error** in tiny gray text with no reason and no retry. (Critical)
5. **"Remove" on cards deletes with no confirmation and no undo** — one panicked misclick wipes content. (Critical)
6. **"Builder support" is a buried heading, not an obvious support button** — help is hidden where a stressed user won't find it. (Critical)
7. **Mixed save messaging** ("Drafts save automatically" + a manual "Save draft") — I can't trust which one preserved my work after I already lost a draft. (High)
8. **Redirect creation has no confirmation, no edit, no undo** — a destructive routing change with no safety net. (High)
9. **No Cancel / Back-out on Create New Page and Authors forms** — no clear escape hatch when I land somewhere by mistake. (High)
10. **"Schedule failed" / "Published 0" states exist but offer no inline explanation or recovery instructions** — the app knows publishing fails but never tells me what to do about it. (High)

---

**File written:** `reports/ux-persona-review/personas/15-angry-user.md`

**Overall gut feel: 2/5** — Functional CMS, but actively hostile to someone trying to recover from a failure: no undo, no working recovery path, no support link.

**Top 3 concerns:**

1. No undo anywhere in the editor — destructive Remove/Move/Hide actions are instant and irreversible.
2. The Revision history panel can't recover a failed publish or lost draft — it's empty and only populates after a successful publish, the exact thing that failed.
3. Zero Help/Support/Contact affordance across the entire app, plus silent unexplained errors ("Could not copy link") — a frustrated user has no escape hatch and no one to ask.
