import "server-only";

import { config } from "@/lib/config";
import {
  buildCloseMonthlyFunnel,
  MONTHLY_FUNNEL_START,
  type CloseMonthlyFunnel,
} from "@/lib/services/close-monthly-funnel";
import type { CloseCall } from "@/lib/services/close-week-view";
import { getMonthlyLeads } from "@/lib/services/close-monthly-leads";
import { cachedCloseReads, fetchCloseDeals } from "@/lib/services/close-wins";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

export type CloseMonthlyReport =
  | {
      ok: true;
      funnel: CloseMonthlyFunnel;
      /** Newest `synced_at` in the mirror, so the page can date itself. */
      mirrorSyncedAt: string | null;
      /** Why the Leads column is missing, when it is. */
      leadsError: string | null;
      from: string;
      to: string;
    }
  | { ok: false; error: string };

/**
 * Every first call booked since `MONTHLY_FUNNEL_START`, with the deals won
 * off them, bucketed by month.
 *
 * Reads its own window rather than slicing the week view's eight weeks: this
 * one answers a different question and should not go wrong when that one's
 * length changes.
 *
 * Never throws. A failed read comes back as `ok: false`, because a grid of
 * zeros reads as a terrible year rather than a broken query.
 */
export async function getCloseMonthlyFunnel(
  input: { now?: Date; start?: string } = {},
): Promise<CloseMonthlyReport> {
  const today = (input.now ?? new Date()).toISOString().slice(0, 10);
  const start = input.start ?? MONTHLY_FUNNEL_START;
  const from = `${start}-01`;
  if (!config.CLOSE_API_KEY) {
    return { ok: false, error: "CLOSE_API_KEY is not set." };
  }
  const client = createAdminClient();
  try {
    const calls: CloseCall[] = [];
    let mirrorSyncedAt: string | null = null;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client
        .from("close_lead_funnel")
        .select(
          "lead_id,funnel,status_label,first_sales_call_booked_date,first_call_show_up,qualified,synced_at",
        )
        .gte("first_sales_call_booked_date", from)
        .lte("first_sales_call_booked_date", today)
        .order("lead_id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error)
        throw new Error(`close_lead_funnel read failed: ${error.message}`);
      for (const row of data ?? []) {
        if (!row.first_sales_call_booked_date) continue;
        calls.push({
          leadId: row.lead_id,
          funnel: row.funnel,
          status: row.status_label,
          bookedDate: row.first_sales_call_booked_date,
          showUp: row.first_call_show_up,
          qualified: row.qualified,
        });
        if (!mirrorSyncedAt || row.synced_at > mirrorSyncedAt) {
          mirrorSyncedAt = row.synced_at;
        }
      }
      if ((data ?? []).length < PAGE_SIZE) break;
    }

    // Revenue is the deal value carried by the leads Close calls won, so the
    // window has to cover every deal that could belong to a call in range.
    const deals = await fetchCloseDeals({
      from,
      to: today,
      close: cachedCloseReads(),
      mirror: client,
    });
    const dealValueByLead = new Map<string, number>();
    for (const deal of deals) {
      dealValueByLead.set(
        deal.leadId,
        (dealValueByLead.get(deal.leadId) ?? 0) + (deal.value ?? 0),
      );
    }

    // Close holds only people who booked, so form fills come from our own
    // table. A failure here must not take the grid down with it: the other
    // five columns are still true, and a missing Leads column says so.
    let leads: Awaited<ReturnType<typeof getMonthlyLeads>> | null = null;
    let leadsError: string | null = null;
    try {
      leads = await getMonthlyLeads(client, { from, to: today });
    } catch (error) {
      leadsError =
        error instanceof Error
          ? error.message
          : "lead_submissions read failed.";
      console.error("Monthly funnel leads read failed", error);
    }

    return {
      ok: true,
      funnel: buildCloseMonthlyFunnel({
        calls,
        today,
        start,
        leads: leads?.byFunnel,
        leadsFrom: leads?.from ?? null,
        dealValueByLead,
      }),
      mirrorSyncedAt,
      leadsError,
      from,
      to: today,
    };
  } catch (error) {
    console.error("Close monthly funnel read failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Close read failed.",
    };
  }
}
