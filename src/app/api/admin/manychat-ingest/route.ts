import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import {
  ingestManychatEvent,
  ManychatIngestError,
} from "@/lib/services/manychat-ingest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** One event is a few hundred bytes. Anything bigger is not a flow event. */
const MAX_BODY_BYTES = 10_000;

function hasValidBearer(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const expected = `Bearer ${secret}`;
  const authorizationBuffer = Buffer.from(authorization);
  const expectedBuffer = Buffer.from(expected);
  if (authorizationBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(authorizationBuffer, expectedBuffer);
}

/**
 * Receiver for ManyChat flow "External Request" actions. One call per contact
 * per stage; see docs/marketing/manychat-ingest.md for the flow setup.
 */
export async function POST(request: Request) {
  if (!config.MANYCHAT_INGEST_SECRET) {
    return NextResponse.json(
      { ok: false, message: "ManyChat ingest is not configured." },
      { status: 503 },
    );
  }
  if (
    !hasValidBearer(
      request.headers.get("authorization"),
      config.MANYCHAT_INGEST_SECRET,
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
    const result = await ingestManychatEvent(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ManychatIngestError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }
    console.error("manychat ingest failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "ManyChat ingest failed." },
      { status: 500 },
    );
  }
}
