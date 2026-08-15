# mikehoffmann.co — Entrepreneurship Collective

A standalone newsletter funnel for Mike Hoffmann. It lives in this repository
for convenience but is **its own Vercel project** with its own domain, its own
deploys, and no runtime dependency on the Vendingpreneurs app: no Supabase, no
Close, no Sentry, no cron.

```
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Deploying

The Vercel project builds this directory only.

| Setting        | Value                  |
| -------------- | ---------------------- |
| Root Directory | `apps/mike-newsletter` |
| Framework      | Next.js                |
| Build command  | `next build` (default) |

Pushes to `main` publish to production; every other branch gets a preview URL.
Point `mikehoffmann.co` and `www.mikehoffmann.co` at the project in Vercel →
Domains once a deployment looks right.

## Connecting signups

`src/lib/subscribe.ts` is an adapter over three backends. The first one that is
fully configured wins:

1. **beehiiv** — `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID`
2. **Kit / ConvertKit** — `KIT_API_KEY` + `KIT_FORM_ID`
3. **Webhook** — `SUBSCRIBE_WEBHOOK_URL`, posts
   `{ email, source, publication, submitted_at }`

With none of them set the form shows an explicit "signups aren't connected
yet" message. That is deliberate: a subscriber told they're on the list who
then never hears from us is worse than a visible error on a site nobody has
pointed a domain at yet. **Set one before the domain goes live.**

Each submission carries a `source` (`hero` or `closing`) so you can see which
block on the page converts.

## Design

Cream, near-black, and one blue — `--accent: #1f72a5`, carried over from the
Vendingpreneurs brand scale. The orange, the ink borders, and the hard offset
shadows of the Vendingpreneurs public site are deliberately absent: this is a
publication masthead, not a conversion-brutalist landing page. Headings are set
in Source Serif 4, body copy in Inter.

Tokens live in `src/app/globals.css`. One filled control per screen — the
subscribe button. Everything else is a hairline or a bordered surface.

## Copy

All of it is in `src/lib/content.ts`. Editing copy should never mean touching a
component.

## Images

Reused from the Vendingpreneurs site under `public/`:

| File                            | Used by                        |
| ------------------------------- | ------------------------------ |
| `images/mike-hoffmann.webp`     | Hero portrait                  |
| `images/hero.avif`              | Issue 01 card (vending)        |
| `images/accelerator.avif`       | Issue 02 card (beyond vending) |
| `images/why.avif`               | Straight From the Field        |
| `images/cta.avif`               | Closing CTA band texture       |
| `logos/*`                       | "Ideas featured across" row    |
