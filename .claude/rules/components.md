---
paths:
  - "src/components/**/*.tsx"
---

# Component conventions

- Server Components by default. Add `"use client"` only when the component
  uses state, effects, browser APIs, or event handlers.
- Props interface declared at top of file, explicitly typed.
- Single responsibility — split sub-components if one file approaches
  100 lines.
- Use `cn()` from `@/lib/utils` for conditional class composition.
- Use `next/image` for all imagery — never `<img>`. Always set width/height
  or `fill` + `sizes`.
- Use `next/link` for all internal navigation.
- Section components live in `src/components/sections/` and represent
  a vertical band on a page (Hero, Testimonials, etc.).
- Layout chrome (Header, Footer, NavLink) lives in `src/components/site/`.
- Reusable primitives (Button, Card) live in `src/components/ui/`.
- Content data (copy strings, testimonial arrays) lives in
  `src/lib/content/` as typed modules — never inline-hardcoded in JSX.
