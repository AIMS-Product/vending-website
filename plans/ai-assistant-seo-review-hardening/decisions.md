# Decisions: ai-assistant-seo-review-hardening

## Confirmed Decisions

- 2026-06-09: The chat assistant is the generative page builder. It may create,
  edit, rebuild, or add blocks when the user asks for page content changes.
- 2026-06-09: The SEO assistant action should review the current draft's SEO
  quality and readiness. It should not be another default path for generating
  page blocks.
- 2026-06-09: Cerebras remains a selectable speed-test provider for the chat
  builder, but local editor validation remains the source of truth.

## Safe Defaults

- Use the existing deterministic readiness engine for the first SEO review
  surface. Do not add another AI-backed SEO-analysis API until the deterministic
  review UX is clear.
- Keep source-bound AI proposal backend code in place for now, but remove it
  from the visible assistant flow unless explicitly reintroduced later.
- Normalize AI tool inputs before local schema parsing so provider-specific
  schema gaps do not leak raw validation errors into the chat.
- Keep all draft edits local to editor state. Do not save, publish, delete, or
  mutate live records during AI chat operations.

## Open Questions

- None blocking this slice.

## Rejected Options

- Keep both "chat builds pages" and "SEO generates draft blocks" visible in the
  same assistant. This confuses the product model.
- Replace deterministic readiness with a new AI SEO reviewer in this slice. That
  would increase provider risk before the UX is proven.
