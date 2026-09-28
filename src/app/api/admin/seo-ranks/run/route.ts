import { NextResponse } from "next/server";
import { rejectUnlessCron, runFailed } from "@/lib/seo/cron-auth";
import { syncSeoRanks } from "@/lib/services/seo-rank-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 62 to ~220 live SERP calls, six at a time, 5-15s each. A cut-off run is
// safe: snapshots upsert on (day, keyword) and the next run redoes the day.
export const maxDuration = 300;

/** Weekly, Mondays. `?full=1` pulls every tracked keyword and volumes now. */
export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request, "SEO rank");
  if (rejected) return rejected;
  const full = new URL(request.url).searchParams.get("full") === "1";
  try {
    const result = await syncSeoRanks({ full });
    const failed = runFailed(result.connector);
    return NextResponse.json(
      { ok: !failed, ...result },
      { status: failed ? 500 : 200 },
    );
  } catch (error) {
    console.error("seo rank runner failed", {
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "SEO rank runner failed." },
      { status: 500 },
    );
  }
}
