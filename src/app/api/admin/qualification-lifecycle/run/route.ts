import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { adminRunQualificationLifecycle } from "@/lib/services/qualification-lifecycle";

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
      {
        ok: false,
        message: "Qualification lifecycle runner is not configured.",
      },
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
    const result = await adminRunQualificationLifecycle();
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      markedStale: result.markedStale,
      markedExpired: result.markedExpired,
      taskEventsCreated: result.taskEventsCreated,
      taskEventsSkipped: result.taskEventsSkipped,
      skipped: result.skipped,
      errors: result.errors.map((error) => ({
        sessionId: error.sessionId,
        message: error.message,
      })),
    });
  } catch (error) {
    console.error("qualification lifecycle runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Qualification lifecycle runner failed." },
      { status: 500 },
    );
  }
}
