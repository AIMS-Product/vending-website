import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { reportCronException } from "@/lib/observability/cron-failure";
import { reservePublicRateLimit } from "@/lib/public-rate-limit";
import { rejectUnlessCron } from "@/lib/seo/cron-auth";
import { getMasterclassEvent } from "@/lib/services/masterclass-event";
import {
  dueReminder,
  roomClassId,
  sendDueReminders,
  walletConfig,
} from "@/lib/wallet/google-wallet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Every 5 minutes: if a wallet reminder (day before, 1 hour before, live) is
 * due for the current masterclass room, add it to every saved Google Wallet
 * pass for that room. Each pass gets each reminder once (by message id).
 * Spec: .claude/specs/2026-10-23-google-wallet-pass.md.
 */
export async function GET(request: Request) {
  const rejected = rejectUnlessCron(request, "Wallet reminder");
  if (rejected) return rejected;
  const cfg = walletConfig(config);
  if (!cfg)
    return NextResponse.json({ ok: true, skipped: "wallet not configured" });
  const event = await getMasterclassEvent();
  if (!event.startsAt) {
    return NextResponse.json({ ok: true, skipped: "no upcoming room" });
  }
  const now = new Date();
  const due = dueReminder(event.startsAt, now);
  if (!due) return NextResponse.json({ ok: true, reminder: null });
  // Google keeps duplicate message ids, so two overlapping runs would both
  // notify. One claim per room+reminder (4 min, under the 5-min cron); it is
  // released on a failed run so the next tick retries, and fails closed.
  const claim = await reservePublicRateLimit("wallet_reminder_run", {
    ip: null,
    email: `${roomClassId(cfg.issuerId, event.startsAt)}:${due.id}`,
  });
  if (!claim.allowed) {
    return NextResponse.json({ ok: true, skipped: "another run holds it" });
  }
  try {
    const run = await sendDueReminders(cfg, event.startsAt, { now });
    if (run.failed > 0) {
      await reportCronException(
        "wallet-reminders",
        new Error(`${run.failed} of ${run.passes} wallet reminders not sent`),
      );
    }
    return NextResponse.json({ ok: run.failed === 0, ...run });
  } catch (error) {
    await claim.release();
    await reportCronException("wallet-reminders", error);
    console.error("wallet reminder runner failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { ok: false, message: "Wallet reminder runner failed." },
      { status: 500 },
    );
  }
}
