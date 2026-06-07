# Decisions: website-builder-round-2-feedback

## Confirmed Decisions

- 2026-06-05: Treat the Google Doc "Website Builder Notes" Round 2 section as a new follow-up intake over `plans/website-builder-feedback-v2/`, not as a reopening of completed V2 graph nodes.
- 2026-06-05: Do not perform a browser image-upload write while this checkout points at Supabase project `aacisvhkmsaabqdvdmmf` unless the user explicitly approves the throwaway media asset write or provides a confirmed non-production target.
- 2026-06-05: Use rendered browser evidence for spacing, block expansion, upload, and other UI claims before changing implementation.
- 2026-06-05: User approved creating and cleaning up one generated throwaway media asset for S4 browser upload verification.
- 2026-06-05: Use `http://localhost:3000` rather than `http://127.0.0.1:3000` for hydrated Next dev browser checks in this repo; `127.0.0.1` reproduced inert client controls due dev websocket/origin behavior.
- 2026-06-05: Public author pages should use canonical path `/authors/{slug}`. If legacy `/blog/author/{slug}` links exist or are introduced by older templates, redirect them to `/authors/{slug}` rather than keeping two canonical author URL shapes.
- 2026-06-05: Analytics/reporting v1 should use a narrow contract: `page_published`, `page_updated`, `lead_submitted`, and `content_review_due`. Backend is the source of truth; GTM/dataLayer may consume browser-side events where useful. Content-review triggers are limited to manual review date / review due date for v1.

## Safe Defaults

- Keep rich text constrained to approved rich-text nodes. Do not add arbitrary HTML editing.
- Keep body-copy authoring in the page canvas wherever practical, in line with the page-builder design contract.
- Use proposal/review flows for AI document-to-block mapping. Imported or AI-mapped content should not publish automatically.
- Prefer internal, root-relative links for manual internal-link insertion and preserve existing link-suggestion behavior.
- Keep screenshots and verification evidence out of release-train commits unless the user explicitly asks to preserve screenshot artifacts in the repo.
- Keep public author profiles separate from admin users; author routing should not expose admin account identity or permissions.
- Read public author profile pages through a server-only safe-field loader for v1 instead of widening anonymous table RLS in the same slice.
- Defer Search Console changes, conversion drops, stale traffic, and automated research cues until those data sources are wired and their consumers are defined.

## Open Questions

None.

## Rejected Options

- Do not treat public spacing as broken from code inspection alone; browser proof showed the final public render is structurally spaced.
- Do not upload a real or personal file for verification; any upload test should use a generated disposable image only after approval.
- Do not collapse the new Round 2 work into `plans/website-builder-feedback-v2/`, which is already complete with blocked follow-up.
