import { NextResponse } from "next/server";
import { rejectUnlessCron, runFailed } from "@/lib/seo/cron-auth";
import {
  AI_ENGINES,
  syncSeoAi,
  type AiEngine,
} from "@/lib/services/seo-ai-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Up to ~62 live AI answers, eight at a time; the sync stops starting calls
// at 240s and keeps what it paid for.
export const maxDuration = 300;

/** `?engine=ai_mode|chatgpt|youtube` weekly (Mondays), `mentions` monthly. */
export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request, "SEO AI visibility");
  if (rejected) return rejected;
  const engine = new URL(request.url).searchParams.get("engine");
  if (!AI_ENGINES.includes(engine as AiEngine)) {
    return NextResponse.json(
      { ok: false, message: `engine must be one of ${AI_ENGINES.join(", ")}` },
      { status: 400 },
    );
  }
  try {
    const result = await syncSeoAi({ engine: engine as AiEngine });
    const failed = runFailed(result.connector);
    return NextResponse.json(
      { ok: !failed, ...result },
      { status: failed ? 500 : 200 },
    );
  } catch (error) {
    console.error("seo ai runner failed", {
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "SEO AI runner failed." },
      { status: 500 },
    );
  }
}
