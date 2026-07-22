---
paths:
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
---

# Page conventions

- Pages are thin — they import and compose section components from
  `@/components/sections/`. No business logic, no data fetching here
  (push data fetching into `@/lib/services/`).
- Each route exports `metadata` (or `generateMetadata`) — never hardcode
  `<head>` tags, never skip metadata.
- Marketing pages render under the root layout's Header/Footer (do not
  re-render layout chrome inside pages).
- Apply Now / Contact CTAs link to `/contact` (the VP apply funnel: VSL +
  qualification quiz). The old `/apply` slug 301-redirects there. Do not
  inline form HTML in marketing pages.
- All visible copy on a marketing page must trace back to a typed entry
  in `src/lib/content/` — this keeps copy reviewable as data.
