import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { syncGa4PageViews } from "@/lib/services/ga4-page-view-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Two runReport pages cover the whole 196-day history, so even a backfill is a
// few seconds. A cut-off run is safe: every write is an upsert on the day's
// grain, so the next run redoes it rather than doubling it.
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
 * backfill history, then let the cron keep the default 3-day window that
 * catches GA4's ~48h of late revisions.
 */
const optionsSchema = z.object({
  days: z.coerce.number().int().positive().max(400).optional(),
});

export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "GA4 sync runner is not configured." },
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

  let options: z.infer<typeof optionsSchema>;
  try {
    const url = new URL(request.url);
    options = optionsSchema.parse({
      days: url.searchParams.get("days") ?? undefined,
    });
  } catch (error) {
    console.error("ga4 sync runner: invalid options", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    // Not configured is not an error: visits fall back to lead_page_views and
    // the result says connected: false.
    const result = await syncGa4PageViews(options);
    return NextResponse.json(
      { ok: result.failed === 0, ...result },
      { status: result.failed === 0 ? 200 : 500 },
    );
  } catch (error) {
    console.error("ga4 sync runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "GA4 sync runner failed." },
      { status: 500 },
    );
  }
}
