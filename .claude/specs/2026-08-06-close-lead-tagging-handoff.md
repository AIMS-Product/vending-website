# Close lead tagging — state at 2026-08-06 handoff

## Done and live in production

Website leads write two Close fields on lead **create only**:

| Entry point              | Form ID          | Entry Source    | Resource Tag                                                     |
| ------------------------ | ---------------- | --------------- | ---------------------------------------------------------------- |
| Entrepreneur lead magnet | `2d3b9fbc-…`     | `Lead-Magnet`   | `lead-magnet-90-days` (roadmap), `lead-magnet-finance-templates` |
| Newsletter signup        | `7f5d8f76-…`     | `Lead-Magnet`   | `newsletter`                                                     |
| Apply / qualification    | `a1b2c3d4-…0001` | `Website-Apply` | `website-application`                                            |

Commits `9b1ab43`, `988d2e1`, `f6289ff`, `b7468fc` on `main`. Verified against
real leads in the production Close org, not just tests.

- `Website-Apply` was added as a new choice on the Entry Source field via the
  Close API. It did not exist before.
- **Recapture State and Ever Had Call are deliberately NOT written.** Close's
  Lane 2 reconciler owns them (Stephen, 2026-08-06). They were removed from the
  payload, config, env schema and `.env.example` so they are unreachable, and a
  config-layer test fails if the plumbing is re-added.
- Resource Tag values are an explicit map in `CLOSE_RESOURCE_TAGS`. An
  unrecognised magnet path sends **no** tag rather than inventing one inside the
  sales team's taxonomy.

`/admin/attribution` is a read-only diagnostics page that probes the live Close
account and reports, per field: configured in this environment, field ID exists,
correct lead/contact scope, and whether the value we send is an accepted choice.
A drift-guard test keeps it in sync with the Close config.

## Open

1. **Fill-if-empty for returning contacts.** We only tag on lead create, so
   someone already in Close who converts on a magnet gets no Entry Source. Kody
   wants the attribution added "without overwriting the original source" — fill
   only when blank. Needs a `getLead` on the Close client (only `getContact`
   exists) plus one extra API call per sync. Was waiting on Stephen; his reply
   did not address it. Tier 1 — use `safe-feature-slice`.
2. **~4 leads created 19:51–20:49 on 2026-08-06** carry `Hot-Inbound` / `No`
   that we wrote before the fix. Harmless if the Lane 2 reconciler overwrites
   them; needs clearing if it skips leads that already have values. Ask Stephen.
3. **ActiveCampaign sync** — untouched, uncommitted on branch
   `codex/activecampaign-sync` in worktree `/Users/adamwolfe/vending-website-activecampaign`.
   See `.claude/specs/2026-08-04-close-activecampaign-newsletter-sync.md`. Adam
   has login access and an API token. The branch is behind `main` and both sides
   edited `.env.example` and `src/lib/config.ts` — rebase first.

## Gotchas learned here

- **`vercel env pull` returns `""` for every sensitive variable**, even one set
  and working. Never conclude a variable is unset from it — this manufactured a
  false "empty `CLOSE_LEAD_STATUS_ID`" bug report. Verify by reading it from
  something running in that environment, such as `/admin/attribution`.
- Use `vercel env add NAME env --value "<v>" --force`. Never
  `printf '%s' "$V" | vercel env add …` — with no trailing newline the CLI stores
  an empty value and still reports success.
- Env changes need a fresh deploy: `vercel redeploy <url> --scope aimanagingservices`.
- Close returns custom fields on a lead keyed by **name**, not field ID, and its
  `custom.<id>:*` list filters do not actually filter — totals from them are junk.
- `/apply` is a 301 to `/contact`; `src/app/apply/` has no page.
