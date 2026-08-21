import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { runChatbotLearningPass } from "@/lib/chatbot/learning/run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      { ok: false, message: "Chatbot learning runner is not configured." },
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
    const result = await runChatbotLearningPass();
    return NextResponse.json({
      ok: result.ok,
      conversationsScanned: result.conversationsScanned,
      recordsWritten: result.recordsWritten,
      cases: result.cases,
      followUpTasks: result.followUpTasks,
      knowledgeSuggestions: result.knowledgeSuggestions,
      insights: result.insights,
      siteRecommendations: result.siteRecommendations,
      error: result.error,
    });
  } catch (error) {
    console.error("chatbot learning runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Chatbot learning runner failed." },
      { status: 500 },
    );
  }
}
