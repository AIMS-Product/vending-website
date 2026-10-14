import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { syncYouTubePlayback } from "@/lib/services/youtube-playback-sync";
import {
  reportCronException,
  reportCronRunFailure,
} from "@/lib/observability/cron-failure";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One reports request per video (more for a multi-year backfill). The sync
// stops starting videos at 240s and the next run resumes from
// youtube_playback_sync_state, so the first nights backfill on their own.
export const maxDuration = 300;

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
      {
        ok: false,
        message: "YouTube playback sync runner is not configured.",
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

  try {
    const result = await syncYouTubePlayback();
    // A skipped connector (not configured) is fine; a failed one is not.
    const run = result.connector;
    const failed = Boolean(
      run.error && !run.error.startsWith("skipped:") && run.rowsWritten === 0,
    );
    if (failed)
      await reportCronRunFailure("youtube-playback-sync", run.connector);
    return NextResponse.json(
      { ok: !failed, ...result },
      { status: failed ? 500 : 200 },
    );
  } catch (error) {
    await reportCronException("youtube-playback-sync", error);
    console.error("youtube playback sync runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "YouTube playback sync runner failed." },
      { status: 500 },
    );
  }
}
