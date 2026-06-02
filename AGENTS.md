<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:domain-cutover-rules -->

# Custom domain cutover status

The `vendingpreneurs.com` / `www.vendingpreneurs.com` custom domain is not
available to this repo yet. Until the user explicitly says domain access has
been granted or DNS has been cut over, do not treat current public-domain
behavior as an app-side blocker.

For launch or route-alignment work, verify localhost and available Vercel
deployment URLs. Record public custom-domain checks as post-cutover follow-up
instead of repeatedly raising legacy Webflow/Cloudflare responses.

<!-- END:domain-cutover-rules -->

<!-- BEGIN:admin-studio-design-rules -->

# Admin Studio and SEO Page Builder design contracts

Before changing `/admin` CMS UI, SEO Page Builder UI, editor controls, block editing, visual polish, or browser-facing admin workflows, read:

- `docs/design/admin-studio.md`
- `docs/design/page-builder.md`
- `docs/design/page-builder-blocks.md`
- `docs/design/visual-review-checklist.md`

These are execution contracts, not inspiration docs. Do not introduce UI that violates them without updating the relevant design contract in the same change.

The active product roadmap remains `docs/seo-page-builder/roadmap.md`; the design docs define how the admin/editor experience should be implemented and verified.

<!-- END:admin-studio-design-rules -->

<!-- BEGIN:feature-orchestrator-rules -->

# Feature Orchestrator flow

When work is being executed from a tracked feature graph under `plans/<feature-slug>/`,
keep the canonical workflow inside the `feature-orchestrator` skill. Use stage
skills only as explicit orchestrator stages, such as `feature-slice-worker`,
`feature-integrator`, or `feature-proof`, and do not switch to a standalone
implementation skill as the primary workflow for a graph node.

The orchestrator owns `plan.md` and `progress.md`. Worker evidence belongs under
`plans/<feature-slug>/agent-runs/` and should be integrated back into
`progress.md` only by the orchestrator stage.

<!-- END:feature-orchestrator-rules -->
