import { timingSafeEqual } from "node:crypto";
import {
  emailAgentEnabled,
  followUpCandidates,
  handOffQuietLeads,
  pollInboundEmails,
  sendFollowUp,
  type FollowUpResult,
} from "@/lib/chatbot/email-agent/agent";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
 * Answers new email replies (polled from Resend), then sends the chat
 * follow-up email. Cron (CRON_SECRET) or a manual run
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
  // How long a chat must be quiet before its follow-up: ?minAgeMinutes=, else
  // CHATBOT_EMAIL_FOLLOWUP_MINUTES, else 60.
  const minAgeMinutes = Math.max(
    0,
    Number(
      url.searchParams.get("minAgeMinutes") ??
        config.CHATBOT_EMAIL_FOLLOWUP_MINUTES ??
        60,
    ) || 0,
  );
  const limit = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("limit") ?? 5) || 5),
  );

  // Fetch past `limit`: a chat the Close check skips leaves no trace, so a
  // fixed top-5 would be re-picked every minute and block everyone behind it.
  // ponytail: skipped chats are re-checked each run (bounded by MAX_CHECKS and
  // the 7-day window); a persistent skip stamp column if Close load matters.
  const MAX_CHECKS = 20;
  const ids = await followUpCandidates({ minAgeMinutes, limit: MAX_CHECKS });
  const results: FollowUpResult[] = [];
  for (const id of ids) {
    if (results.filter((r) => r.sent).length >= limit) break;
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
  // Replies first: answering someone mid-thread matters more than a new follow-up.
  let inbound: Awaited<ReturnType<typeof pollInboundEmails>> = [];
  try {
    inbound = await pollInboundEmails();
  } catch (error) {
    console.error("chatbot email agent: inbound poll failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
  // Threads that ended without a booking go to the lead's setter (hot list + task).
  let handedOff: Awaited<ReturnType<typeof handOffQuietLeads>> = [];
  try {
    handedOff = await handOffQuietLeads({ limit: 5 });
  } catch (error) {
    console.error("chatbot email agent: quiet hand-off failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
  if (ids.length > 0 || inbound.length > 0 || handedOff.length > 0) {
    // Counts only, no addresses: what each run did, readable in Vercel logs.
    const tally = (reasons: string[]) =>
      reasons.reduce<Record<string, number>>(
        (acc, r) => ({ ...acc, [r]: (acc[r] ?? 0) + 1 }),
        {},
      );
    console.info("chatbot email agent: run", {
      candidates: ids.length,
      followUps: tally(results.map((r) => (r.sent ? "sent" : r.reason))),
      inbound: tally(
        inbound.map((r) =>
          "reason" in r && r.reason ? String(r.reason) : "handled",
        ),
      ),
      handedToSetter: tally(handedOff.map((h) => h.kind)),
    });
  }
  return Response.json({ ok: true, inbound, results, handedOff });
}
