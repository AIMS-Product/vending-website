import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import {
  ingestWebinarSnapshot,
  WebinarIngestError,
} from "@/lib/services/webinar-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** ~10 KB today. A payload past this is not a snapshot; refuse before parsing. */
const MAX_BODY_BYTES = 2_000_000;

function hasValidBearer(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const expected = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  if (authorizationBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(authorizationBuffer, expectedBuffer);
}

/**
 * Receiver for the vp-webinars snapshot push. Push, not pull, by decision:
 * this repo never holds Zoom, GHL, Close or Meta credentials.
 */
export async function POST(request: Request) {
  if (!config.WEBINAR_INGEST_SECRET) {
    return NextResponse.json(
      { ok: false, message: "Webinar ingest is not configured." },
      { status: 503 },
    );
  }
  if (
    !hasValidBearer(
      request.headers.get("authorization"),
      config.WEBINAR_INGEST_SECRET,
    )
  ) {
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
    const result = await ingestWebinarSnapshot(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof WebinarIngestError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    console.error("webinar ingest failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Webinar ingest failed." },
      { status: 500 },
    );
  }
}
