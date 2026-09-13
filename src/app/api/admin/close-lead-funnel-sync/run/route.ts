import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { syncCloseLeadFunnel } from "@/lib/services/close-lead-funnel-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// A few dozen Close search pages and a few thousand upserted rows. A cut-off
// run is safe: every write is an upsert on the lead id and the run is
// recorded either way, so the next hourly cron finishes the job.
export const maxDuration = 300;

function hasValidCronSecret(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const expected = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  if (authorizationBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(authorizationBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Close lead funnel sync is not configured." },
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

  try {
    const run = await syncCloseLeadFunnel();
    const failed = Boolean(run.error && !run.error.startsWith("skipped:"));
    return NextResponse.json(
      { ok: !failed, run },
      { status: failed ? 500 : 200 },
    );
  } catch (error) {
    console.error("close lead funnel sync failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Close lead funnel sync failed." },
      { status: 500 },
    );
  }
}
