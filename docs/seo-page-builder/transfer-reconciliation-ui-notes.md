# Transfer Reconciliation UI Notes

Captured while reviewing `codex/transfer-reconciliation-preview` in the local browser.

## Fix Notes

- Admin action confirmation is clipped inside the row action popover. Render it as a real dialog layer instead of inside the table action menu.
- Public live page briefly shows a large loading state before content appears. Check whether the public resource route is doing unnecessary client-side loading.
- Editor canvas and panes can look cramped after readiness field jumps at the current desktop viewport.
- Publish panel sticky area visually covers part of the green "Next required step" card while scrolling.
- Non-YouTube video fallback shows a large blank framed area for an internal link. Render a clean link/card fallback or require an embeddable URL before showing the video frame.
- YouTube first click loads the embedded player, then YouTube still shows its own play overlay. Product decision: acceptable iframe behavior or attempt more direct playback.
- Duplicate slug errors appear in too many places at once. Prefer one primary error and a field-level slug error.
- Block preview audit is useful, but picker previews are much smaller than actual renders. Consider a zoom or open-preview affordance if this page is for human review.
- Draft-only public resource URLs correctly return not found, but the not-found page is an unstyled default screen. Consider a branded resource 404 if users may hit unpublished or retired URLs.
- Revision preview works, but the header label still says raw `publish` instead of a friendlier `Published` or the stored revision label.
