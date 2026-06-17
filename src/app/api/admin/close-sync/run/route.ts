import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminRunCloseSync } from "@/lib/close/sync";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      { ok: false, message: "Close sync runner is not configured." },
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
    const result = await adminRunCloseSync();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      synced: result.synced,
      failed: result.failed,
      deadLettered: result.deadLettered,
      needsReview: result.needsReview,
      skipped: result.skipped,
      errors: result.errors.map((error) => ({
        eventId: error.eventId,
        message: error.message,
      })),
    });
  } catch (error) {
    console.error("close sync runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Close sync runner failed." },
      { status: 500 },
    );
  }
}
