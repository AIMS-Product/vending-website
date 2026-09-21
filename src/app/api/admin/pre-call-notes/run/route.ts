import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/bearer-auth";
import { config } from "@/lib/config";
import { sweepPreCallNotes } from "@/lib/services/pre-call-note";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One Close list-notes call per upcoming call, plus a create. A busy hour is
// single digits, so this is nowhere near the ceiling; the generous limit is
// only so a Close slowdown does not truncate a sweep that cannot be retried
// after the calls it was for have started.
export const maxDuration = 300;

/**
 * Hourly: writes "what they watched" onto the Close lead of every call about
 * to start. See lib/services/pre-call-note.
 *
 * `?dryRun=1` counts what it would post without posting. `?hoursAhead=` widens
 * the window, which is how you backfill after a missed run — the marker check
 * means a wider window re-posts nothing.
 */
export async function GET(request: Request) {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (
    !hasValidBearer(request.headers.get("authorization"), config.CRON_SECRET)
  ) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const hoursAheadParam = Number(url.searchParams.get("hoursAhead"));
  const dryRun = ["1", "true"].includes(url.searchParams.get("dryRun") ?? "");

  try {
    const result = await sweepPreCallNotes({
      hoursAhead:
        Number.isFinite(hoursAheadParam) && hoursAheadParam > 0
          ? Math.min(hoursAheadParam, 24 * 14)
          : undefined,
      dryRun,
    });
    return NextResponse.json({ ok: true, dryRun, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Sweep failed.",
      },
      { status: 500 },
    );
  }
}
