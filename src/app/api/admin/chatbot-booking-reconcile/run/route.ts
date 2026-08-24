import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { reconcileChatbotBookings } from "@/lib/chatbot/booking-reconcile";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The sweep is bounded at 500 Calendly requests; at realistic latency that
// alone can exceed a 60s ceiling on a wide lookback, and a cut-off run is
// wasted work even though it is safe (every write is idempotent, so the next
// run resumes). 300s is the platform default ceiling on every plan.
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
 * `dryRun` is parsed explicitly rather than with z.coerce.boolean(), which
 * coerces ANY non-empty string to true. `?dryRun=false` would have meant
 * dryRun: true, so asking for a real run would silently get a rehearsal.
 */
const bodySchema = z.object({
  lookbackDays: z.coerce.number().int().positive().optional(),
  dryRun: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true" || value === "1",
    ),
});

async function readOptions(request: Request) {
  const url = new URL(request.url);
  const raw = {
    lookbackDays: url.searchParams.get("lookbackDays") ?? undefined,
    dryRun: url.searchParams.get("dryRun") ?? undefined,
  };
  return bodySchema.parse(raw);
}

export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        message: "Chatbot booking reconcile runner is not configured.",
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

  let options: z.infer<typeof bodySchema>;
  try {
    options = await readOptions(request);
  } catch (error) {
    console.error("chatbot booking reconcile runner: invalid options", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    const result = await reconcileChatbotBookings(options);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("chatbot booking reconcile runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Chatbot booking reconcile runner failed." },
      { status: 500 },
    );
  }
}
