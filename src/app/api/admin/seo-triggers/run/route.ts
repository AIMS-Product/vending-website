import { NextResponse } from "next/server";
import { rejectUnlessCron, runFailed } from "@/lib/seo/cron-auth";
import { runSeoTriggers } from "@/lib/services/seo-trigger-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Weekly, Mondays, an hour after the rank pull. */
export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request, "SEO trigger");
  if (rejected) return rejected;
  try {
    const result = await runSeoTriggers();
    const failed = runFailed(result.connector);
    return NextResponse.json(
      { ok: !failed, ...result },
      { status: failed ? 500 : 200 },
    );
  } catch (error) {
    console.error("seo trigger runner failed", {
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "SEO trigger runner failed." },
      { status: 500 },
    );
  }
}
