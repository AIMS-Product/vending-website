import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * The cron-runner gate every /api/admin/<job>/run route uses: 503 when
 * CRON_SECRET is unset, 401 unless the bearer matches in constant time.
 * Returns null when the request may proceed.
 */
export function rejectUnlessCron(
  request: Request,
  runner: string,
): NextResponse | null {
  if (!config.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, message: `${runner} runner is not configured.` },
      { status: 503 },
    );
  }
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${config.CRON_SECRET}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }
  return null;
}

/** A run that neither wrote nor skipped failed. */
export function runFailed(run: {
  rowsWritten: number;
  error: string | null;
}): boolean {
  return Boolean(
    run.error && !run.error.startsWith("skipped:") && run.rowsWritten === 0,
  );
}
