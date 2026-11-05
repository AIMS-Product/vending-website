import { timingSafeEqual } from "node:crypto";
import {
  emailAgentEnabled,
  followUpCandidates,
  sendFollowUp,
  type FollowUpResult,
} from "@/lib/chatbot/email-agent/agent";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function bearerMatches(
  authorization: string | null,
  secret: string | undefined,
) {
  if (!authorization || !secret) return false;
  const given = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Sends the chat follow-up email. Cron (CRON_SECRET) or a manual run
 * (CHATBOT_EMAIL_RUN_SECRET). `?minAgeMinutes=` how long the chat has been
 * quiet (default 60), `?limit=` max sends per run (default 5).
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (
    !bearerMatches(authorization, config.CRON_SECRET) &&
    !bearerMatches(authorization, config.CHATBOT_EMAIL_RUN_SECRET)
  ) {
    return Response.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }
  if (!emailAgentEnabled()) {
    return Response.json({ ok: true, skipped: "email agent is off" });
  }
  const url = new URL(request.url);
  const minAgeMinutes = Math.max(
    0,
    Number(url.searchParams.get("minAgeMinutes") ?? 60) || 0,
  );
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5),
  );

  const ids = await followUpCandidates({ minAgeMinutes, limit });
  const results: FollowUpResult[] = [];
  for (const id of ids) {
    try {
      results.push(await sendFollowUp(id));
    } catch (error) {
      console.error("chatbot email agent: follow-up failed", {
        conversationId: id,
        error: error instanceof Error ? error.message : "unknown error",
      });
      results.push({ sent: false, conversationId: id, reason: "error" });
    }
  }
  return Response.json({ ok: true, results });
}
