# Persona Review: Zoe — Confused Teenager

## Summary

- Pages reviewed: 6
- Issues found: 31
- Blockers: 2
- Overall gut feel: 2/5

> ok so. i make stuff on tiktok and canva every day and that just _works_, you tap and it does the thing. this is like... my dad's work computer. there's words everywhere i don't know like "governance" and "canonical URL" and "funnel stage" and nobody explains anything. some screens look kinda clean ngl but the second i click into the actual builder it's a WALL of stuff. i'd close the tab.

---

## Page-by-Page Review

### /admin/pages (Pages List)

**Gut feel: 3/5** — "Looks clean-ish like a real app but it's already throwing weird words at me (governance? readiness? metadata?) and I don't know what half the buttons do."

| #   | Category          | Finding                                                                                                                            | Severity | Why this matters to me                                                                                                                                                          |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Copy & Labels     | "Governance", "Readiness", "Metadata", "Drafts/Published/Archived" all stacked as filter chips with no explanation                 | High     | I have literally never seen these words used like this. On TikTok stuff is just "Drafts" and "Posted". I'd be scared to click "Archived" cause I don't know if that deletes it. |
| 2   | Copy & Labels     | The little chips "Needs review / Updating / Needs links / Metadata issues / Scheduled / Schedule failed" are jargon soup           | High     | This reads like an error log, not a thing I'm meant to use. I'd just ignore all of them and feel dumb.                                                                          |
| 3   | Feedback & State  | The "..." menu under ACTIONS and the tiny circle icons (a blue "+" and an orange "D") in READINESS/STATUS columns have zero labels | High     | I don't know what the orange "D" circle means. Is it bad? Is my page broken? No tooltip, nothing. I'd tap it just to find out and panic.                                        |
| 4   | Visual & Layout   | The four stat cards (All / Drafts / Published / Archived) look like buttons but I'm not sure if they're clickable or just numbers  | Medium   | On apps I use, big tappable cards = you tap them. These are ambiguous so I'd poke at them randomly.                                                                             |
| 5   | Navigation & Flow | "Authors" and "Redirects" buttons up top look like they belong with "New SEO page" but go to totally different tools               | Medium   | They're styled almost the same so I'd expect them to be related. Surprise navigation = I get lost.                                                                              |
| 6   | Copy & Labels     | Empty-ish state: "Showing 1 SEO page in active pages" is robotic                                                                   | Low      | A normal app would say "You've got 1 page" not "in active pages". Sounds like a database talking to me.                                                                         |

### /admin/pages/new (Create New Page)

**Gut feel: 4/5** — "Honestly this one's not bad? Big tappable cards, pick a type, hit the blue button — that part feels like picking a template in Canva."

| #   | Category         | Finding                                                                                                                                  | Severity | Why this matters to me                                                                                                                             |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Copy & Labels    | "Choose the page path first so the builder can start with scoped templates and AI context" — what is a "page path"? "scoped templates"?? | Medium   | First sentence and I already don't get it. Just say "Pick what kind of page you want."                                                             |
| 8   | Feedback & State | Two cards ("From template", "AI-assisted template") are greyed with "Coming soon" but still look kinda clickable                         | Low      | I'd tap them anyway hoping for the AI one (that's the fun one!) and be let down. At least the label is there though.                               |
| 9   | Visual & Layout  | "Page type" and "Starting point" are two separate sections but it's not obvious I have to pick from BOTH before "Start building"         | Medium   | I might pick a page type, hit the blue button, and not realise there's a second choice. The "SELECTED SETUP" box helps a bit but I'd skim past it. |
| 10  | Copy & Labels    | Difference between "SEO / Resource page", "Landing page", "Blog page" isn't clear to a normal person                                     | Medium   | I don't know what SEO even is really. I'd just pick "Blog page" cause it's the only word I recognise.                                              |

### /admin/pages/[id] (Page Builder Editor) — THE BIG ONE

**Gut feel: 1/5** — "Nope. This is the boomer-est software I have ever seen, it's a thousand tiny boxes and words and a phone screen makes it WORSE — I'd close it immediately."

| #   | Category                  | Finding                                                                                                                                                             | Severity | Why this matters to me                                                                                                                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | Visual & Layout           | THREE columns crammed in (blocks list, live preview, SEO/publish panel) — total information overload on load                                                        | Blocker  | My eyes don't know where to go. There's like 82 buttons. Apps I use show me ONE thing at a time. I'd give up before doing anything.                                               |
| 12  | Copy & Labels             | "Readiness and publish", "Next required step", "Governance comments", "Revision history", "Lifecycle", "Funnel stage", "Topic cluster", "Canonical / Preferred URL" | Blocker  | This is a different language. I counted like 10 words I don't understand just sitting on screen. I genuinely could not use this without someone teaching me for an hour.          |
| 13  | Forms & Input             | The SEO panel has a MASSIVE form — dozens of fields (meta description, og title, breadcrumb, sitemap checkboxes, review period, scheduled publish...)               | Critical | This is the "settings page with 50 options" nightmare. I'd never fill all that out. I'd just type a title and hope for the best.                                                  |
| 14  | Navigation & Flow         | Two near-identical buttons "Copy editor link" and "Copy public URL" sit side by side                                                                                | High     | What's the difference?? Which one do I send to my friend? I'd copy the wrong one and not realise.                                                                                 |
| 15  | Feedback & State          | "Save draft" exists AND there's tiny text "Drafts save automatically" — so do I need to save or not?                                                                | High     | Snapchat/Insta never make me hit save, it's just saved. Seeing a Save button makes me think it WON'T save unless I press it, but then it says auto-save. Confusing and stressful. |
| 16  | Copy & Labels             | Block list items are super verbose: "Hero1. Vending in Colleges That Works Around Campus LifeSection 1, column 1" all jammed together                               | Medium   | It's a clickable thing but the text is a run-on with no spaces between the parts. Looks broken.                                                                                   |
| 17  | Visual & Layout (mobile)  | On phone the editor collapses to a vertical stack of pill buttons (Pages/Blocks/SEO/Save draft/Live preview/Editor link/Public URL) then a cramped preview          | Critical | This is unusable on a phone and I do EVERYTHING on my phone. The blocks have tiny "::" and "..." icons I can barely tap.                                                          |
| 18  | Feedback & State          | Tiny eye icons (👁) floating next to text blocks with no label                                                                                                      | Medium   | Is that hide? preview? I don't know. Icon-only with no text = I'm guessing.                                                                                                       |
| 19  | Trust & Safety            | "Publish" is a big blue button right there — for a teen this feels scary cause I don't know if it goes LIVE to the actual internet for everyone                     | High     | There's no clear "are you sure?" vibe before something becomes public. I'd be terrified of accidentally publishing.                                                               |
| 20  | Copy & Labels             | The purple floating "AI" bubble is the ONE thing that looks fun/familiar but it's unlabeled — what does it even do?                                                 | Low      | This is the only button I actually _want_ to tap (AI = cool), but I have no idea what it does so I'm cautious.                                                                    |
| 21  | Accessibility & Inclusion | Sign-out button at bottom-left is overlapped by a dark circle avatar covering the first letter ("N" over "Sign out")                                                | Medium   | It looks glitchy/broken, which makes the whole thing feel unfinished and untrustworthy.                                                                                           |

### /admin/pages/authors (Authors)

**Gut feel: 3/5** — "A plain form, fine, but it just throws empty boxes at me with words like 'Slug' and 'Avatar asset ID' and no help text."

| #   | Category      | Finding                                                                   | Severity | Why this matters to me                                                                                                                                 |
| --- | ------------- | ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 22  | Copy & Labels | "Slug" — literally no idea what that is                                   | High     | A slug is a bug?? There's no placeholder example showing me what to type. I'd leave it blank and probably break it.                                    |
| 23  | Copy & Labels | "Avatar asset ID" instead of just "Profile picture" with an upload button | High     | On every app I use, a profile pic is tap-to-upload-a-photo. Asking me for an "asset ID" (a number? a code??) makes no sense. Where do I even get that. |
| 24  | Forms & Input | No placeholders or examples in any field, no hint which are required      | Medium   | The boxes are just empty. I don't know the format. Insta always shows me example text inside the box.                                                  |
| 25  | Forms & Input | No avatar preview / image picker — just a text field                      | Medium   | I can't see the photo I'm "adding". Feels like I'm filling a tax form, not making a profile.                                                           |

### /admin/pages/redirects (Redirects)

**Gut feel: 2/5** — "I genuinely don't know what a 'redirect' is or why I'd ever need this, and the dropdown has '301 permanent / 302 temporary' which means nothing to me."

| #   | Category        | Finding                                                                                                                         | Severity | Why this matters to me                                                                                                                         |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 26  | Copy & Labels   | The whole concept "Redirect Manager / Create and inspect builder redirects across page prefixes" is total jargon                | High     | I have no clue what this page is for. "Page prefixes"? I'd never come here, and if I landed here by accident I'd be confused about where I am. |
| 27  | Forms & Input   | Status dropdown "301 permanent / 302 temporary / 307 / 308" — random numbers                                                    | High     | Why are there numbers? Just say "Permanent" or "Temporary". The numbers make me think I'll pick wrong and break something.                     |
| 28  | Copy & Labels   | Empty table just shows column headers (OLD PATH / DESTINATION / STATUS...) with nothing below and no "nothing here yet" message | Medium   | Looks like it's loading forever or broken. A good empty state would say "No redirects yet".                                                    |
| 29  | Visual & Layout | "Old path" / "Destination" with placeholders like "/resources/old-page" assume I understand URL paths                           | Medium   | The "/" stuff looks like code. I don't write URLs by hand, I just tap links.                                                                   |

### /admin/pages/block-preview-audit (Block Preview Audit)

**Gut feel: 2/5** — "This is a giant never-ending scroll of repeated previews — it looks like a dev's test page, not something a person is supposed to use."

| #   | Category        | Finding                                                                                                               | Severity | Why this matters to me                                                                                                                                                          |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | Copy & Labels   | "Block preview audit / Compare every picker preview against the real resource-page render using mocked block content" | High     | "picker preview", "render", "mocked block content" — this is a sentence for programmers, not me. I'd bounce instantly.                                                          |
| 31  | Visual & Layout | Endlessly long page (like 18,000px tall) showing every block style over and over                                      | Medium   | The scroll never ends. On mobile especially this feels broken/infinite. I have no idea what I'm supposed to DO here — there are no buttons to actually use it. It's a dead end. |

---

## Blockers

1. **The Page Builder Editor is information overload (Issue #11).** Three dense columns and 80+ buttons on first load. As someone who only knows tap-and-scroll social apps, I cannot find a starting point. I would close the tab before creating anything.
2. **The editor's vocabulary is a foreign language (Issue #12).** "Governance", "Readiness", "Canonical URL", "Funnel stage", "Lifecycle", "Topic cluster" — too many unknown terms on one screen. Without a tutorial or plain-English labels, I literally cannot operate this.

---

## My Top 10 Issues

1. **Page Builder Editor is a wall of 80+ buttons across 3 columns** (Blocker) — I don't know where to even look or start.
2. **Editor is full of words I've never seen** — governance, canonical, funnel stage, lifecycle, topic cluster (Blocker).
3. **The giant SEO settings form with dozens of fields** (Critical) — the exact "50-option settings page" that makes me give up.
4. **Editor on mobile is basically unusable** (Critical) — I live on my phone and this is tiny pills + a cramped preview.
5. **"Save draft" button vs "auto-saves" text contradiction** (High) — I can't tell if my work is safe, that's stressful.
6. **"Copy editor link" vs "Copy public URL" — two same-looking buttons, no idea which is which** (High).
7. **"Publish" feels scary with no clear "this goes live to everyone" warning** (High) — I'm afraid of accidentally posting publicly.
8. **"Slug" and "Avatar asset ID" on the Authors form** (High) — make me upload a photo by tapping, don't ask me for an "ID".
9. **Redirects page + "301 permanent / 302 temporary" numbers** (High) — no clue what any of this means or why it exists.
10. **Jargon filter chips on the pages list** — "Governance / Readiness / Needs links / Metadata issues" (High) — looks like an error log, makes me feel dumb.

---

_File written by Zoe (Confused Teenager persona)._
