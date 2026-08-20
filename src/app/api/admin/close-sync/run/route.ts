import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminRunCloseSync } from "@/lib/close/sync";
import { config } from "@/lib/config";
import { prunePublicRequestHits } from "@/lib/public-rate-limit";
import { reconcileCloseBookings } from "@/lib/services/close-booking-reconcile";
import { ensureVpFormV3Published } from "@/lib/services/vp-form-v3-ensure";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function reconcileCloseBookingsSafely() {
  try {
    return await reconcileCloseBookings();
  } catch (error) {
    console.error("close booking reconcile failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

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
    // Piggybacked on the only cron this app already runs, rather than adding a
    // second schedule for one DELETE. Best-effort and never throws, so a prune
    // failure cannot fail the sync it rides along with.
    await prunePublicRequestHits();
    // Same best-effort pattern: publishes Form V2 (version 3 of the VP Lead
    // Capture form) if the database hasn't received it yet. The deploy
    // pipeline cannot reach Supabase to run the SQL migration, so the app —
    // which holds the service role — applies its own data migration here.
    // No-ops forever once applied; see vp-form-v3-ensure.ts.
    const formV3 = await ensureVpFormV3Published();
    const result = await adminRunCloseSync();
    // Mirrors "did this lead book a call" back from Close onto our lead rows.
    // Runs after the sync so leads created in this same pass already have a
    // close_lead_id to join on. Best-effort like the two calls above: the
    // funnel report going stale for two minutes must never fail the sync that
    // feeds the CRM.
    const bookings = await reconcileCloseBookingsSafely();
    return NextResponse.json({
      ok: true,
      formV3: formV3.status,
      bookings,
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
