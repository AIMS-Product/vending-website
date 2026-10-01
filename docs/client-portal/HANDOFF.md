# Client Journey Portal: backend handoff (Dom)

Frontend is done and runs on fixtures. Route: `/portal/[token]` (noindex, no site chrome, `force-dynamic`).
Demo tokens: `demo` (pre-call), `demo-sparse` (name only), `demo-post`, `demo-won`, `demo-lost`.

## The contract

`src/lib/portal/types.ts` → `PortalData`. SteelTrap sends **facts only**. Persona match, case study,
testimonial, picked videos, wins categories, Next Steps and module order are all derived on this side
(`src/lib/portal/personalize.ts`), so no copy lives in SteelTrap.

Minimum viable payload: `{ token, stage, prospect: { firstName }, call: null, localMarket: null, callSummary: null, onboarding: null }`.

## What to wire (3 seams, nothing else)

| Seam                 | File                                | PRD event                                                                                                                                         |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read portal by token | `src/lib/portal/get-portal-data.ts` | all stages. Server-side fetch to SteelTrap, zod-parse into `PortalData`, keep the `demo*` fixture branch, return `null` for unknown/revoked token |
| Intake write         | `src/app/portal/[token]/actions.ts` | `intake.submitted`. Persist occupation/ZIP/goal, trigger VendScout + research GPT, then `revalidatePath`                                          |
| Confirm call         | `call.confirmUrl` in the payload    | confirm-your-call loop. Any URL; set `call.confirmed=true` once clicked                                                                           |

Field sources (PRD §10):

- `stage` ← SteelTrap people/deal status (booking.created → `pre_call`, Avoma summary published → `post_call`, deal.won → `won`, deal.lost → `lost`).
- `call.*` ← booking tool (time, rep name/title/photo).
- `localMarket` ← VendScout ranked locations (`lat/lng` optional; the plot needs them, the list does not) + research GPT (`brief`, `first90Days`).
- `callSummary` ← Avoma webhook → Claude customer-facing transform (PRD §7). Only send once published (review queue passed). `mainQuestionId` is one of `PORTAL_OBJECTION_IDS`.
- `onboarding` ← Skool invite, VendHub walkthrough, location search, coaching calendar URLs + `completed` step ids (`skool`, `walkthrough`, `location-search`, `coaching`).

Wins come straight from `wins.vendingpreneurs.com/api/wins` (1h cache); no backend work.

## Security notes

- Tokens must be unguessable (≥128-bit random), revocable, and never contain email/phone.
- The page shows name, call time, rep and call summary. Treat the token as a bearer secret.
- Unknown tokens render the site 404 (soft 404, same as `/qualify`).

## Open (PRD §12)

- Jess confirms persona → case study/testimonial mapping (`PERSONAS` in personalize.ts) and the new copy in `src/lib/content/portal.ts`.
- Tim Barnes' $90K is an in-month projection per its case-study review note; confirm before it leads a page.
- Call time renders in US Central; send a prospect timezone if needed.
