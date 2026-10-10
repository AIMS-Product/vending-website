import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import {
  GoogleAdsIngestError,
  ingestGoogleAdsBatch,
} from "@/lib/services/google-ads-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** 2,000 rows of ad copy and metrics stay well under this. */
const MAX_BODY_BYTES = 4_000_000;

function hasValidBearer(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const given = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Receiver for the Google Ads Script in scripts/google-ads/sync.js. One call
 * per report batch; rows upsert on (report, row_key) so reruns are safe.
 */
export async function POST(request: Request) {
  const secret = config.GOOGLE_ADS_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "Google Ads ingest is not configured." },
      { status: 503 },
    );
  }
  if (!hasValidBearer(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, message: "Payload too large." },
      { status: 413 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { ok: false, message: "Body is not JSON." },
      { status: 400 },
    );
  }

  try {
    const result = await ingestGoogleAdsBatch(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof GoogleAdsIngestError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    console.error("google ads ingest failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Google Ads ingest failed." },
      { status: 500 },
    );
  }
}
