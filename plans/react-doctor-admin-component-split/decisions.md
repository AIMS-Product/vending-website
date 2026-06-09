# React Doctor Admin Component Split Decisions

Last updated: 2026-06-09

## Safe Defaults

- Treat both React Doctor findings as true-positive maintainability warnings because each target component owns multiple logical UI sections and exceeds the rule threshold.
- Preserve behavior and visual structure; this is not a redesign.
- Keep `AdminShell` route-agnostic and keep its public API stable.
- Keep `AdminPagesPage` as the route data-fetching component and extract render-only list sections around it.
- Keep SEO pages list state in `src/lib/admin/seo-pages-list.ts`.
- Do not change server action behavior, form submission semantics, or pending-state labels from the existing archive/delete fix.
- Do not push, create a PR, trigger preview deployment, or release as part of this flow.

## External Rule Guidance

React Doctor rule guidance for `react-doctor/no-giant-component` says the rule fires on uppercase components whose function bodies span more than 300 source lines, and the fix is to extract logical sections into focused subcomponents while avoiding splits that obscure data flow.

## Blockers

None.
