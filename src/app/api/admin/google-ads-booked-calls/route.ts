import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { loadBookedCallConversions } from "@/lib/services/google-ads-booked-calls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function hasValidBearer(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const given = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Booked calls with a Google click id, for the Google Ads Script that uploads
 * them as "CRM - Booked Call" offline conversions. `?days=` (1-90, default 7)
 * is how far back booked dates go. Same secret as the reporting ingest.
 */
export async function GET(request: Request) {
  const secret = config.GOOGLE_ADS_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "Google Ads sync is not configured." },
      { status: 503 },
    );
  }
  if (!hasValidBearer(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }
  const days = Number(new URL(request.url).searchParams.get("days") ?? "7");
  if (!Number.isFinite(days)) {
    return NextResponse.json(
      { ok: false, message: "days must be a number." },
      { status: 400 },
    );
  }
  try {
    const conversions = await loadBookedCallConversions(days);
    return NextResponse.json({ ok: true, conversions });
  } catch (error) {
    console.error("google ads booked calls failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Could not read booked calls." },
      { status: 500 },
    );
  }
}
