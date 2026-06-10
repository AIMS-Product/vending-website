# Persona Review: Victoria — Executive With 30 Seconds

## Summary

- Pages reviewed: 6
- Issues found: 23
- Blockers: 0
- Overall gut feel: 3/5

I scan, I don't read. The Pages List nails the top-of-fold status story — four big counters tell me the whole content estate in one glance, and that earns real credit. But the moment I open a page, the story collapses: the editor is a wall of controls with the one thing I care about (is this live, what's blocking it) shrunk into a side rail, and the supporting pages (Authors, Redirects) open straight into empty forms with no list, no count, no "here's what exists." For a tool I'd only ever open mid-meeting to check status, half of it makes me click and read to find out anything.

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 4/5** — "The four status counters and the colour-coded readiness/status dots are exactly the at-a-glance scoreboard I need — this page respects my 30 seconds."
| # | Category | Finding | Severity | Why this matters to me |
|---|----------|---------|----------|----------------------|
| 1 | Visual & Layout | Four big metric tiles (All / Drafts / Published / Archived) sit above the fold with large numbers — content health is graspable in under 5 seconds | Low (strength) | This is the one screen I'd actually trust an assistant to read to me; the number-first hierarchy is correct |
| 2 | Feedback & State | READINESS and STATUS render as tiny coloured dots/badges with no legend; a blue "+" and an orange "D" mean nothing without hovering or clicking | High | I can't get status without decoding cryptic icons — defeats the purpose of a scannable list |
| 3 | Copy & Labels | Governance column stacks "Drafting / Review: 6 mo / Needs links" as dense small text — three facts crammed where I'd want one status word | Medium | I won't read a paragraph in a table cell; give me a single status chip |
| 4 | Navigation & Flow | Two parallel filter rows (All/Drafts/Published tabs AND a second All/Drafts/Published… chip row) duplicate each other — unclear which is canonical | Medium | Redundant controls make me hesitate; I expect one obvious filter |
| 5 | Visual & Layout | The redundant chip filters (Needs review, Updating, Needs links, Metadata issues, Scheduled, Schedule failed) are a lot of operational detail for a status view | Low | Fine for an editor, noise for me — but it's below the counters so it doesn't hurt the glance |
| 6 | Feedback & State | The footer "0 published · 1 drafts" repeats the counters already shown up top | Low | Harmless but redundant — wasted space |

### /admin/pages (Pages List — Mobile)

**Gut feel: 3/5** — "On my phone the counters stack into a tall column so I only see one-and-a-half tiles before scrolling — the scoreboard advantage is lost."
| # | Category | Finding | Severity | Why this matters to me |
|---|----------|---------|----------|----------------------|
| 7 | Visual & Layout | Status counters stack vertically; only "All: 1" and part of "Drafts" are above the fold — I'd have to scroll to see Published/Archived | High | I open links from my phone in meetings; the whole point is no scrolling, and here I must scroll for the full picture |
| 8 | Navigation & Flow | The actual pages table is far below the stacked tiles and filters — content is buried on mobile | Medium | A 2-column tile grid on mobile would keep the scoreboard intact |

### /admin/pages/new (Create New Page)

**Gut feel: 4/5** — "A clean card-based picker with a 'SELECTED SETUP' summary and one blue 'Start building' button — I understand the choice and the next step instantly."
| # | Category | Finding | Severity | Why this matters to me |
|---|----------|---------|----------|----------------------|
| 9 | Visual & Layout | Single primary action (Start building) with a clear summary panel — exactly one decision, well framed | Low (strength) | This is how a setup screen should look; I'd hand this to anyone |
| 10 | Feedback & State | Two "Coming soon" cards (From template, AI-assisted) sit at full width across the bottom taking prime real estate for features that don't work | Medium | Dead options waste my eye-time and read as an unfinished product |
| 11 | Copy & Labels | "Page type" and "Starting point" are two separate selectors but it's not obvious both must be set before the button does anything | Low | Minor — most would muddle through, but the dependency isn't signalled |

### /admin/pages/[id] (Page Builder Editor)

**Gut feel: 2/5** — "82 buttons and 58 fields in a three-pane cockpit; the one thing I want — is this live and what's blocking it — is shrunk into a cramped right rail I have to hunt for."
| # | Category | Finding | Severity | Why this matters to me |
|---|----------|---------|----------|----------------------|
| 12 | Visual & Layout | At default zoom the whole editor is a dense three-column wall — outline rail, live canvas, SEO rail — with no dominant focal point | Critical | There is no "look here first"; for a 30-second status check this is overwhelming |
| 13 | Visual & Layout | The "Readiness and publish" panel — the status I came for — is a narrow side column, not a headline; STATUS, NEXT REQUIRED STEP and Publish are stacked small | High | Status should be the loudest thing on a page-status screen, not a side note |
| 14 | Feedback & State | Once enlarged, the readiness card is genuinely good: "draft" pill, "This page is not live yet," Last updated / Published: Not yet, green "Ready to publish — No hard blockers remain" | Low (strength) | When I can actually see it, it answers my exact questions — it's just buried and small |
| 15 | Copy & Labels | "NEXT REQUIRED STEP" is a strong, scannable phrase and the green block is the clearest signal on the screen | Low (strength) | This is the right pattern; it just needs to be promoted to the top, not tucked in a rail |
| 16 | Feedback & State | Copy-link action surfaced "Could not copy link." as quiet grey text under the toolbar — a failure I'd easily miss | High | A silent failure on a "copy public URL" action means I'd tell someone the page is shared when it isn't |
| 17 | Feedback & State | Toolbar stacks three tiny status lines ("Saved automatically · 3:51 PM", "Preview link created.", "Could not copy link.") in faint centred text | Medium | Important state is whispered in grey; success and failure look identical at a glance |
| 18 | Navigation & Flow | Three separate collapse toggles (sidebar, blocks, SEO) plus Pages/Blocks/SEO tabs — navigation within one screen is its own learning curve | Medium | I shouldn't need to learn a layout system to check whether a page is published |
| 19 | Trust & Safety | Publish button is one click with only an optional notes box — no confirm step before a page goes public | Medium | If I'm poking around to check status, an accidental publish has no guardrail |
| 20 | Visual & Layout (Mobile) | On mobile the editor becomes a pile of pill buttons (Pages, Blocks, SEO, Save draft, Live preview, Editor link, Public URL) above the canvas; the readiness panel isn't visible at all without hunting | Critical | I literally cannot see publish status on my phone — for an exec this editor is desktop-only in practice |

### /admin/pages/authors (Authors)

**Gut feel: 2/5** — "It opens straight into an empty 'create' form with no list of existing authors and no count — I can't tell at a glance how many authors exist or who they are."
| # | Category | Finding | Severity | Why this matters to me |
|---|----------|---------|----------|----------------------|
| 21 | Visual & Layout | The page is one blank input form; there's no roster, no count, no "X authors" summary above the fold | High | I open a section to see status, not to fill in a form — I learn nothing in 30 seconds |
| 22 | Copy & Labels | No empty-state message telling me whether authors exist elsewhere or this is genuinely empty | Medium | I can't tell if the list is empty or just not shown — ambiguous |
| 23 | Visual & Layout | Vast empty space below a single small form card — the screen feels unfinished and low-density for no payoff | Low | Reads as a half-built admin page, not a polished product |

### /admin/pages/redirects (Redirects)

**Gut feel: 2/5** — "Same problem as Authors: a create-form on top of an empty table with no count — I can't glance and know how many redirects are live."
| # | Category | Finding | Severity | Why this matters to me |
|---|----------|---------|----------|----------------------|
| 24 | Visual & Layout | Table headers (Old path, Destination, Status, Source, Created) render with zero rows and no "0 redirects" or empty-state copy | High | A blank table with headers makes me wonder if it's broken or genuinely empty |
| 25 | Copy & Labels | No summary count of active redirects anywhere on the page | Medium | For a redirects manager, "how many are active" is the one number I'd want at a glance |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 2/5** — "An endlessly long scrolling gallery of every block variant — useful for a designer, but it's the literal opposite of a 30-second scan."
| # | Category | Finding | Severity | Why this matters to me |
|---|----------|---------|----------|----------------------|
| 26 | Visual & Layout | The page is ~18,000px tall — dozens of stacked block previews with no top-of-page summary, index, or jump links | High | There is no way to grasp this without scrolling forever; it has no glanceable layer at all |
| 27 | Navigation & Flow | No table of contents or anchor nav to reach a specific block type | Medium | If I needed to check one block I'd have to scroll the whole catalogue — no shortcut |

## Blockers

None. No screen is broken or prevents the core task. The damage is to scannability, not function — but for me, scannability _is_ the function.

## My Top 10 Issues

1. **(Critical) Editor has no focal point** — three dense panes, 82 buttons; nothing says "look here first." For a status check it's overwhelming. (Editor #12)
2. **(Critical) Publish status invisible on mobile editor** — the readiness panel doesn't surface on a phone, so I can't tell if a page is live from my device. (Editor #20)
3. **(High) Readiness/publish status is a side rail, not a headline** — the single most important fact is shrunk and tucked away instead of dominating the screen. (Editor #13)
4. **(High) "Could not copy link" failure is silent grey text** — I'd think I shared a URL when I hadn't. (Editor #16)
5. **(High) Pages List status shown only as cryptic coloured dots/letters** — no legend; the scoreboard's strongest list column is undecipherable at a glance. (List #2)
6. **(High) Authors opens to a blank form with no roster or count** — I can't see what exists in 30 seconds. (Authors #21)
7. **(High) Redirects shows an empty headers-only table with no count or empty state** — looks broken, tells me nothing. (Redirects #24)
8. **(High) Mobile counters stack so the full scoreboard requires scrolling** — defeats the at-a-glance design on the device I'd actually use. (List Mobile #7)
9. **(High) Block Preview Audit is an 18,000px scroll with no index** — zero glanceable layer. (Block Audit #26)
10. **(Medium) "Coming soon" cards eat prime space on Create Page** — dead options that read as an unfinished product. (New Page #10)
