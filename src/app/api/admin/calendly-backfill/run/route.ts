import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { reconcileChatbotBookings } from "@/lib/chatbot/booking-reconcile";
import { config } from "@/lib/config";
import { createCalendlyApiClient } from "@/lib/services/calendly-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * One-off Calendly history, one month at a time, through the same path the
 * daily sweep and the live webhook use. Every write upserts on invitee_uri, so
 * re-running a month repairs the rows it already wrote. `users` names the
 * Calendly members behind `invitee_scheduled_by` URIs the bookings never
 * carried a name for.
 */
function hasValidCronSecret(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const expected = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  if (authorizationBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(authorizationBuffer, expectedBuffer);
}

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionsSchema = z.object({
  from: isoDay.optional(),
  to: isoDay.optional(),
  /** Comma-separated Calendly user uuids to resolve to names. */
  users: z.string().optional(),
  dryRun: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true" || value === "1",
    ),
});

/** A month of events is well under this; it is a ceiling on a runaway walk. */
const BACKFILL_MAX_REQUESTS = 4000;

export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Calendly backfill runner is not configured." },
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
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      users: url.searchParams.get("users") ?? undefined,
      dryRun: url.searchParams.get("dryRun") ?? undefined,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    if (options.users) {
      const calendly = createCalendlyApiClient({
        token: config.CALENDLY_API_TOKEN,
      });
      const users = [];
      for (const id of options.users.split(",").filter(Boolean)) {
        try {
          users.push(await calendly.getUser(id));
        } catch (error) {
          users.push({
            uri: id,
            name: null,
            email: null,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return NextResponse.json({ ok: true, users });
    }
    if (!options.from) {
      return NextResponse.json(
        { ok: false, message: "Pass from=YYYY-MM-DD (and optionally to=)." },
        { status: 400 },
      );
    }
    const result = await reconcileChatbotBookings({
      from: options.from,
      to: options.to,
      dryRun: options.dryRun,
      maxRequests: BACKFILL_MAX_REQUESTS,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("calendly backfill runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Calendly backfill runner failed." },
      { status: 500 },
    );
  }
}
