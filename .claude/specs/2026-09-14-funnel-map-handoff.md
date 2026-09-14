# Funnel map tab — handoff, 2026-09-14

/ admin/analytics?tab=map. Five commits, **all local, none pushed**:

| commit    | what                                                         |
| --------- | ------------------------------------------------------------ |
| `da51429` | the tab, the service, the GHL detail                         |
| `bdbd4a2` | first flow-chart draw                                        |
| `4a72686` | orthogonal edges, buses, logos                               |
| `c6809a6` | journey bands; **deleted the canvas (wrong call)**           |
| `06f5c02` | canvas restored as `FunnelMapCanvas`, members terminal added |

Suite green at each: 2,395 tests, tsc and eslint clean.

## Shape

`FunnelMapTab` (`FunnelMapPanel.tsx`) renders three things, in order:

1. **`FunnelMapCanvas`** — the spatial map. Coordinates live in
   `funnel-map-graph.ts`; HTML boxes positioned over one SVG that draws only
   the edges. Orthogonal routing with two buses (six sources into a trunk into
   the link; eleven connectors into two lanes into one riser). One crossing is
   left and it is topological.
2. **`FunnelJourney`** (`FunnelMapDiagram.tsx`) — four bands: what goes out,
   the Seen→Won spine with carry-over shares, what each step means, where the
   numbers come from.
3. **`GhlSection`** — the GoHighLevel detail that has no home elsewhere.

Data: `getFunnelMap` in `src/lib/services/funnel-map.ts` wraps `getChannelsTab`
so the map and the Channels tab cannot disagree, plus one `ghl_email_stats`
read. Tests in `funnel-map.test.ts`, including a 1,200-row regression for the
PostgREST page cap.

## Verifying without an admin session

Admin login blocks localhost, so the tab was verified by rendering it against
live prod into a standalone file:

1. Build the CSS — Tailwind utilities are not all in any one served chunk:
   `node -e` through `@tailwindcss/postcss` over `src/app/globals.css` → `/tmp/map.css`.
2. A throwaway `funnel-map.live.test.tsx` renders `FunnelMapTab` with a
   service-role client and writes `/tmp/funnel-map.html`.
3. `cp -R public/admin/brands /tmp/brands` and rewrite `src="/admin/brands/`
   to `src="brands/` — **`/admin/*` static files are behind the admin
   redirect**, so logos 404 in any external preview. They are fine in the app.
4. `browser-harness` → `new_tab("file:///tmp/funnel-map.html")` →
   `capture_screenshot(path=..., max_dim=1000)`.

Delete the live test before committing; it is not a real test.

## Open

- **Rotate `GHL_API_KEY`.** The `pit-…` token has been pasted into chat twice.
  Live in `.env.local` line 55 and Vercel prod. New value into those two places
  only.
- **`close-lead-funnel` connector fails every run**: `ON CONFLICT DO UPDATE
command cannot affect row a second time` — duplicate keys inside one batch.
  Writes 0 rows. Needs dedupe before upsert.
- **Push.** Five commits waiting. Prod is `www.vendingpreneurs.com/admin/analytics?tab=map`.
- **GHL email links carry no UTMs** — 63 workflows, 155,410 lifetime sends,
  zero attributable leads. Tagging job in GHL, not a code job.

## Decided, do not relitigate

- Both views stay. The map is the picture, the bands are the numbers.
- Post-sale (Mighty Networks, VendHub) is **one dashed terminal box, unmeasured**.
  Brief is top and middle of the sales process only.
- Shares print raw from `ofPreviousPct`, unrounded, to match the Channels tab.
- No react-flow, no Figma embed, no new dependency.
