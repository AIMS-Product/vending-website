import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { escapeLikePattern } from "@/lib/services/calendly-booking-check";
import {
  UNSUBSCRIBED_KEY,
  verifyUnsubscribeToken,
} from "@/lib/services/no-book-followup-plan";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Unsubscribe from the no-book follow-up emails.
 *
 * GET only shows a confirm button: mail scanners prefetch links, and a GET that
 * unsubscribed would opt people out nobody asked to. POST does the work, and is
 * also what Gmail/Yahoo one-click (List-Unsubscribe-Post) sends.
 */

function page(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Vendingpreneurs</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;color:#1a1a1a">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function readParams(url: string) {
  const params = new URL(url).searchParams;
  return { email: params.get("e") ?? "", token: params.get("t") ?? "" };
}

function isValid(email: string, token: string): boolean {
  const secret = config.CRON_SECRET;
  if (!secret || !email || !token) return false;
  return verifyUnsubscribeToken(email, token, secret);
}

export async function GET(request: Request) {
  const { email, token } = readParams(request.url);
  if (!isValid(email, token)) {
    return page("<p>This unsubscribe link is not valid.</p>", 400);
  }
  const action = `/api/email/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
  return page(
    `<p>Stop follow-up emails about your call request?</p><form method="post" action="${action}"><button type="submit" style="background:#1a56db;color:#fff;border:0;padding:12px 22px;border-radius:6px;font-size:16px;cursor:pointer">Unsubscribe</button></form>`,
  );
}

export async function POST(request: Request) {
  const { email, token } = readParams(request.url);
  if (!isValid(email, token)) {
    return page("<p>This unsubscribe link is not valid.</p>", 400);
  }

  const client = createAdminClient();
  const { data, error } = await client
    .from("lead_submissions")
    .select("id,metadata")
    .ilike("email", escapeLikePattern(email))
    .limit(50);
  if (error) {
    console.error("unsubscribe: could not read lead rows", {
      code: error.code,
    });
    return page("<p>Something went wrong. Please try the link again.</p>", 500);
  }

  const now = new Date().toISOString();
  const results = await Promise.all(
    (data ?? []).map((row) => {
      const existing =
        row.metadata &&
        typeof row.metadata === "object" &&
        !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, Json>)
          : {};
      return client
        .from("lead_submissions")
        .update({ metadata: { ...existing, [UNSUBSCRIBED_KEY]: now } as Json })
        .eq("id", row.id);
    }),
  );
  if (results.some((r) => r.error)) {
    console.error("unsubscribe: could not stamp every lead row");
    return page("<p>Something went wrong. Please try the link again.</p>", 500);
  }

  return page(
    "<p>Done. You will not get any more follow-up emails about your call request.</p>",
  );
}
