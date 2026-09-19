import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runDataAudit } from "@/lib/services/data-audit-checks";
import {
  alertOnAuditFailure,
  storeAuditRun,
} from "@/lib/services/data-audit-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Thirteen checks, several of them one request per day of a window.
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
 * The nightly source check. Answers 200 with the verdicts even when checks
 * failed: the run itself succeeded, and a cron retry would not change a
 * number that genuinely disagrees with its source.
 */
export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Data audit runner is not configured." },
      { status: 503 },
    );
  }
  if (
    !hasValidCronSecret(
      request.headers.get("authorization"),
      config.CRON_SECRET,
    )
  ) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const run = await runDataAudit();
    const [stored, alerted] = await Promise.all([
      storeAuditRun(run),
      alertOnAuditFailure(run),
    ]);
    return NextResponse.json({
      ok: true,
      runAt: run.runAt,
      summary: run.summary,
      results: run.results,
      stored,
      alerted,
    });
  } catch (error) {
    console.error("data audit runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Data audit runner failed." },
      { status: 500 },
    );
  }
}
