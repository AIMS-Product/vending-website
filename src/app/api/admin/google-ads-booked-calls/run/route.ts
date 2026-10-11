import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import {
  reportCronException,
  reportCronRunFailure,
} from "@/lib/observability/cron-failure";
import {
  loadBookedCallConversions,
  sendBookedCallsToWebhook,
} from "@/lib/services/google-ads-booked-calls";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function hasValidCronSecret(authorization: string | null, secret: string) {
  if (!authorization) return false;
  const given = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily: send booked calls from the last `days` (default 7: Close fills the
 * booked date a few days late sometimes) to the Zapier hook that uploads them
 * to Google Ads as "CRM - Booked Call". Re-sends are ignored by Google.
 */
const optionsSchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export async function GET(request: Request) {
  const secret = config.CRON_SECRET;
  const webhookUrl = config.GOOGLE_ADS_BOOKED_CALL_WEBHOOK_URL;
  if (!secret || !webhookUrl) {
    return NextResponse.json(
      { ok: false, message: "Booked call upload is not configured." },
      { status: 503 },
    );
  }
  if (!hasValidCronSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }
  const parsed = optionsSchema.safeParse({
    days: new URL(request.url).searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "days must be 1-90." },
      { status: 400 },
    );
  }

  try {
    const conversions = await loadBookedCallConversions(parsed.data.days);
    const { sent, failed } = await sendBookedCallsToWebhook(
      conversions,
      webhookUrl,
    );
    const ok = failed === 0;
    if (!ok) {
      await reportCronRunFailure(
        "google-ads-booked-calls",
        `${failed} of ${conversions.length} webhook posts failed`,
      );
    }
    return NextResponse.json(
      { ok, found: conversions.length, sent, failed },
      { status: ok ? 200 : 500 },
    );
  } catch (error) {
    await reportCronException("google-ads-booked-calls", error);
    console.error("google ads booked calls run failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Booked call upload failed." },
      { status: 500 },
    );
  }
}
