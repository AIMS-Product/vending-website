import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { syncMetricool } from "@/lib/services/metricool-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One brand-summary request per page and a month of posts upserted. A
// cut-off run is safe: every write is an upsert on the spine's primary key and
// every connector records its own run, so the next cron redoes it.
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
 * `days` widens every connector's window — pass a large value once to
 * backfill history, then let the cron keep each connector's default.
 */
const optionsSchema = z.object({
  days: z.coerce.number().int().positive().max(400).optional(),
});

export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Metricool sync runner is not configured." },
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
    console.error("metricool sync runner: invalid options", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    const result = await syncMetricool(options);
    // A skipped connector (not configured) is fine; a failed one is not.
    const run = result.connector;
    const failed = Boolean(
      run.error && !run.error.startsWith("skipped:") && run.rowsWritten === 0,
    );
    return NextResponse.json(
      { ok: !failed, ...result },
      { status: failed ? 500 : 200 },
    );
  } catch (error) {
    console.error("metricool sync runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Metricool sync runner failed." },
      { status: 500 },
    );
  }
}
