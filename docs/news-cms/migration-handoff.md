# News CMS Migration Handoff

_Slice 3b.10. Use this after the admin editor is deployed and magic-link auth
works for an allowlisted admin._

## Goal

Move the existing Webflow News archive into the custom Supabase-backed News CMS
without bulk-importing low-quality HTML. The chosen path is manual rewrite:
create each article in `/admin/news/new`, paste cleaned markdown, add a cover
image where useful, and publish once reviewed.

## Admin Flow

1. Sign in at `/admin/login` with an allowlisted email.
2. Open `/admin/news`.
3. Click **New post**.
4. Fill:
   - `Title`
   - `Slug` matching the old Webflow slug where possible
   - `Excerpt` under 240 characters
   - `Author` as `Mike` unless the article clearly says otherwise
   - Markdown body
   - Cover image URL/upload and alt text when available
5. Use the Preview tab to check headings, links, lists, and images.
6. Save as draft.
7. Publish only after checking the public article at `/news/<slug>`.

## Markdown Rules

- Use `##` for major sections and `###` for subsections.
- Keep links as normal markdown: `[label](https://example.com)`.
- Avoid pasting Webflow classes, inline styles, tracking scripts, embeds, or
  arbitrary HTML.
- Images are allowed, but every cover image needs meaningful alt text.
- If an old post has complex embedded content, leave a short editor note in the
  draft body and keep it unpublished until reviewed.

## Redirect Map Output

Track every migrated article in this shape for Slice 5:

| Old Webflow URL  | New URL               | Status          | Notes |
| ---------------- | --------------------- | --------------- | ----- |
| `/old-news-slug` | `/news/new-news-slug` | draft/published |       |

If an old slug is preserved exactly, the redirect can still be included for
canonical consistency, but it is low risk. If the slug changes, the redirect is
required before DNS cutover.

## Definition Of Done

- All existing News articles are represented as draft or published rows.
- Published rows render on `/news` and `/news/<slug>`.
- Draft rows remain admin-only.
- Redirect map is complete enough for Slice 5.
- Any article that could not be safely migrated is listed with a reason.
