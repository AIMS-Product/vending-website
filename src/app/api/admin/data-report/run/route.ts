import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { sendDataReport } from "@/lib/services/data-report-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function hasValidCronSecret(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const expected = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  if (authorizationBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(authorizationBuffer, expectedBuffer);
}

const optionsSchema = z.object({
  period: z.enum(["day", "week"]).default("day"),
  /** Builds the report and returns it without sending: for a preview. */
  dryRun: z.coerce.boolean().optional(),
});

export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Report runner is not configured." },
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

  let options: z.infer<typeof optionsSchema>;
  try {
    const url = new URL(request.url);
    options = optionsSchema.parse({
      period: url.searchParams.get("period") ?? undefined,
      dryRun: url.searchParams.get("dryRun") ?? undefined,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    const result = await sendDataReport(options);
    return NextResponse.json({
      ok: result.sent || Boolean(options.dryRun),
      period: result.period,
      window: result.window,
      subject: result.subject,
      sent: result.sent,
      error: result.error,
      // The whole text, so a failed send is still readable in the response.
      text: result.report.text,
    });
  } catch (error) {
    console.error("data report runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Report runner failed." },
      { status: 500 },
    );
  }
}
