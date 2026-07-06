# Decisions — Admin UX Wave 3

2026-07-07 (orchestrator, safe defaults — user said "fix all of these"; no blocking product decisions):

1. **Dashboard content (I8):** per review spec — content live (published pages/posts + drafts), leads this week, needs-attention (failed Close syncs, failed/pending scheduled publishes). Read-only aggregation in a new admin-overview service. `/admin` stops 307-ing to /admin/pages (next.config.ts rule removed).
2. **Editor progressive disclosure (I11):** interpreted as one-contextual-panel-at-a-time on desktop (open blocks ⇒ SEO collapses, vice versa). Desktop default already canvas+SEO — unchanged. Rationale: review's "default to canvas + one contextual panel"; 3-column layout at xl squeezes preview below usability. Mobile already exclusive.
3. **Libraries (I10):** five summary cards + one Add per library + focused drawer per docs/design/admin-studio.md; existing server actions unchanged (UI-only restructure). Source→excerpt→claim order made visible.
4. **AdminShell landmark (I18):** sidebar aside moves outside main#main-content; visual grid unchanged. Bundled Overview nav entry deferred to N5 to keep W1 write sets disjoint.
5. **Browser gates run at integration by the orchestrator**, not by workers — one shared dev server/preview session; parallel workers grabbing it caused races in Wave 1/2.
6. **Persona re-run:** out of scope for this flow; offer after COMPLETE.
