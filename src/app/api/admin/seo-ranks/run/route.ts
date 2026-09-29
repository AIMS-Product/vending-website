import { NextResponse } from "next/server";
import { rejectUnlessCron, runFailed } from "@/lib/seo/cron-auth";
import { syncSeoRanks } from "@/lib/services/seo-rank-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// 62 to ~224 live SERP calls, ten at a time. The sync writes each batch as
// it lands and stops starting batches at 240s, so a slow run keeps what it
// paid for and records itself as partial instead of being cut off silently.
export const maxDuration = 300;

/**
 * Weekly, Mondays. 13:00 collects finished SERPs and queues this week's;
 * 13:50 (`?collect=1`) only collects. `?full=1` queues every tracked keyword
 * and refreshes volumes now.
 */
export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request, "SEO rank");
  if (rejected) return rejected;
  const params = new URL(request.url).searchParams;
  const full = params.get("full") === "1";
  const collectOnly = params.get("collect") === "1";
  try {
    const result = await syncSeoRanks({ full, collectOnly });
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
