import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { syncCloseMeetings } from "@/lib/services/close-meetings-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// ~300 Close meeting pages (the whole org) and a few batches of lead origin
// reads. A cut-off run writes nothing and is recorded as failed, so the
// next hourly cron retries the full crawl.
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
      { ok: false, message: "Close meetings sync is not configured." },
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
    const run = await syncCloseMeetings();
    const failed = Boolean(run.error && !run.error.startsWith("skipped:"));
    return NextResponse.json(
      { ok: !failed, run },
      { status: failed ? 500 : 200 },
    );
  } catch (error) {
    console.error("close meetings sync failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Close meetings sync failed." },
      { status: 500 },
    );
  }
}
