# OSS Browser Verification

Date: 2026-06-09

## Goal

Exercise the SEO Page Builder assistant with Cerebras `gpt-oss-120b` through the
browser flow until create-page prompts produce matching SEO metadata and visible
page blocks.

## First 20-Intent Run

Evidence file: `/tmp/oss-page-builder-harness.json`

- 20 disposable draft pages were created through the admin editor flow.
- 13 scenarios passed immediately.
- 6 scenarios failed because the Cerebras request returned HTTP 429.
- 1 scenario generated blocks, but the harness did not count
  `universities` as matching `university`; generated copy still used the
  requested topic.
- Scenario 5 exposed a real local validation issue: Cerebras returned an SEO
  title longer than the editor's 80-character limit, so the chat mixed
  `Too big: expected string to have <=80 characters` into an otherwise
  successful page-body rebuild.

## Decisions And Fixes

- Keep the Cerebras option in the UI as a speed-test provider, but validate the
  actual request payload during browser proof so the provider selection is not
  assumed from visuals.
- Normalize AI metadata before applying it locally. Overlong title, slug, target
  keyword, SEO title, or meta description values are trimmed to the editor
  limits instead of failing the whole metadata tool call.
- Improve deterministic create-page fallback copy so it writes customer-facing
  draft text instead of placeholder instructions like `Use this section to
explain...`.
- Add topic-aware fallback context for campuses, warehouses, factories, offices,
  and gyms so fallback drafts still reflect the user's intent when the model
  only returns metadata.
- Treat `universities` / `university` as the same intent family in the browser
  harness.

## Rerun

Evidence file: `/tmp/oss-page-builder-rerun-harness.json`

The 8 failed or weak scenarios were rerun with fresh blank pages:

- micro markets vs vending machines for workplaces
- vending machine installation for warehouses
- how to choose vending products for staff rooms
- local vending machine supplier in Perth
- vending machines for universities
- vending services for factories
- how vending machine restocking works
- office coffee vending solutions

Result: 8/8 passed.

Each passing rerun verified:

- request provider was `cerebras`
- response status was HTTP 200
- no old chat history appeared on the new page
- no editor error text appeared
- no placeholder fallback copy appeared
- the assistant rebuilt the page body
- the hidden editor draft had at least 4 sections and 5 blocks
- generated draft text matched the requested intent terms

Representative in-app browser spot check:

- Page:
  `http://localhost:3000/admin/pages/0c306a45-bb1c-4bc7-bd7a-ef91572dbc50`
- Rendered 6 ready blocks for `office coffee vending solutions`.
- Assistant panel opened with no prior messages for that page.
- Cerebras provider could be selected in the visible provider selector.
