import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { syncBitlyClicks } from "@/lib/services/bitly-click-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One Bitly request per link, bounded at 80 per run with a concurrency of 4.
// Comfortable inside 300s, and a cut-off run is safe: every write is an upsert
// keyed by (bitly_id, day), so the next run redoes it rather than doubling it.
export const maxDuration = 300;

function hasValidCronSecret(authorization: string | null, secret: string) {
  if (!authorization) return false;

  const expected = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  if (authorizationBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(authorizationBuffer, expectedBuffer);
}

/**
 * `days` widens the trailing window a run re-reads — pass a large value once to
 * backfill history, then let the cron keep the default rolling window.
 */
const optionsSchema = z.object({
  batchSize: z.coerce.number().int().positive().max(400).optional(),
  days: z.coerce.number().int().positive().max(400).optional(),
});

export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Bitly sync runner is not configured." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (!hasValidCronSecret(authorization, config.CRON_SECRET)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  if (!config.BITLY_ACCESS_TOKEN) {
    // Not an error: clicks are an optional stage of the funnel and the admin
    // reports them as "not connected" until a token exists.
    return NextResponse.json({
      ok: true,
      skipped: "BITLY_ACCESS_TOKEN is not set.",
    });
  }

  let options: z.infer<typeof optionsSchema>;
  try {
    const url = new URL(request.url);
    options = optionsSchema.parse({
      batchSize: url.searchParams.get("batchSize") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    });
  } catch (error) {
    console.error("bitly sync runner: invalid options", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    const result = await syncBitlyClicks(options);
    // Same rule as the GA4 runner: a run that reports green while links fail is
    // how bitly_link_clicks could sit at zero rows with nobody noticing. Each
    // write is an upsert keyed by (bitly_id, day), so the next run retries the
    // failed links rather than doubling the ones that worked.
    //
    // `invalid` links (malformed, or refused by Bitly with 404/403) do not turn
    // the run red one by one: no retry fixes them. But when EVERY link in the
    // batch is refused, the cause is the token or the account, not the links,
    // and that must not read green.
    const everyLinkRefused =
      result.scanned > 0 && result.invalid === result.scanned;
    const ok = result.failed === 0 && !everyLinkRefused;
    return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
  } catch (error) {
    console.error("bitly sync runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Bitly sync runner failed." },
      { status: 500 },
    );
  }
}
