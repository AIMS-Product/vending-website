import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runNoBookAlertCron } from "@/lib/services/no-book-alert";

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
      { ok: false, message: "No-book alert runner is not configured." },
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
    const result = await runNoBookAlertCron();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("no-book alert runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "No-book alert runner failed." },
      { status: 500 },
    );
  }
}
