import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cachedCloseReads,
  fetchCloseDeals,
  type WinsCloseClient,
} from "@/lib/services/close-wins";
import type { ReportSourceBlock } from "@/lib/services/data-report";
import {
  ASSIST_TOUCHES,
  assistTouch,
  type AssistTouch,
  selfBookedBreakdown,
  type SelfBookedRow,
  SURFACES,
} from "@/lib/services/self-booked";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const REACTIVATION = "Reactivation Scrapers";
const PAGE = 1000;

const count = (n: number) => n.toLocaleString("en-US");
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

async function readAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error("self-booked report: read failed");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/** Pacific day of an ISO timestamp, the report's day boundary. */
const pacificDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });

/**
 * The two marketing-owned blocks for the EOD/EOW email: first calls people
 * booked themselves through our surfaces (window and month to date), and the
 * Reactivation calls and wins marketing touched first (month to date).
 * Never throws: a read failure prints as a note, not as zero.
 */
export async function selfBookedBlocks(
  client: Client,
  window: { from: string; to: string },
  close?: WinsCloseClient,
): Promise<ReportSourceBlock[]> {
  const monthStart = `${window.to.slice(0, 7)}-01`;
  try {
    const [selfBooked, assists] = await Promise.all([
      selfBookedBlock(client, window, monthStart),
      assistBlock(client, monthStart, window.to, close ?? cachedCloseReads()),
    ]);
    return [selfBooked, assists];
  } catch (error) {
    console.error("self-booked report failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return [
      {
        label: "Self-booked first calls",
        note: "Could not be read; see the server log.",
        values: [],
      },
    ];
  }
}

async function selfBookedBlock(
  client: Client,
  window: { from: string; to: string },
  monthStart: string,
): Promise<ReportSourceBlock> {
  const start = monthStart < window.from ? monthStart : window.from;
  // Day bounds padded a day each side, then cut on the Pacific day below.
  const rows = await readAll<SelfBookedRow & { created_at: string }>((a, b) =>
    client
      .from("calendly_bookings")
      .select(
        "invitee_email,scheduled_event_name,utm_source,utm_medium,utm_content,lead_submission_id,raw_payload,created_at",
      )
      .eq("event_kind", "invitee.created")
      .gte("created_at", `${start}T00:00:00-08:00`)
      .lte("created_at", `${window.to}T23:59:59-07:00`)
      .order("created_at", { ascending: true })
      .range(a, b),
  );
  const inRange = (from: string) =>
    rows.filter((r) => {
      const day = pacificDay(r.created_at);
      return day >= from && day <= window.to;
    });
  const now = selfBookedBreakdown(inRange(window.from));
  const mtd = selfBookedBreakdown(inRange(monthStart));
  return {
    label: "Self-booked first calls (marketing owns these)",
    note: "First sales calls the person booked themselves on our calendar. Setter and DM links left out.",
    values: [
      { label: "This report", value: count(now.total) },
      { label: "Month to date", value: count(mtd.total) },
      ...SURFACES.filter((s) => mtd.bySurface[s] > 0).map((s) => ({
        label: `MTD ${s}`,
        value: count(mtd.bySurface[s]),
      })),
    ],
  };
}

type MirrorRow = {
  lead_id: string;
  email: string | null;
  entry_source: string | null;
  funnel: string | null;
  first_sales_call_booked_date: string | null;
};

async function assistBlock(
  client: Client,
  from: string,
  to: string,
  close: WinsCloseClient,
): Promise<ReportSourceBlock> {
  const booked = await readAll<MirrorRow>((a, b) =>
    client
      .from("close_lead_funnel")
      .select("lead_id,email,entry_source,funnel,first_sales_call_booked_date")
      .eq("funnel", REACTIVATION)
      .gte("first_sales_call_booked_date", from)
      .lte("first_sales_call_booked_date", to)
      .range(a, b),
  );

  const deals = (
    await fetchCloseDeals({ from, to, close, mirror: client })
  ).filter((d) => d.funnel === REACTIVATION);
  const dealLeads = await readAll<MirrorRow>((a, b) =>
    client
      .from("close_lead_funnel")
      .select("lead_id,email,entry_source,funnel,first_sales_call_booked_date")
      .in("lead_id", deals.length ? deals.map((d) => d.leadId) : ["-"])
      .range(a, b),
  );
  const byLead = new Map(dealLeads.map((r) => [r.lead_id, r]));

  const emails = [
    ...new Set(
      [...booked, ...dealLeads]
        .map((r) => r.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];
  const touches = await touchDays(client, emails);

  const touchOf = (row: MirrorRow | undefined, fallbackDay: string) => {
    const email = row?.email?.trim().toLowerCase() ?? "";
    return assistTouch({
      entrySource: row?.entry_source ?? null,
      bookedDay: row?.first_sales_call_booked_date?.slice(0, 10) ?? fallbackDay,
      formDays: touches.forms.get(email) ?? [],
      chatDays: touches.chats.get(email) ?? [],
    });
  };

  const callTouches = booked.map((r) => touchOf(r, to));
  const assistedCalls = callTouches.filter(Boolean).length;
  const wonAssisted = deals.filter((d) =>
    touchOf(byLead.get(d.leadId), d.dateWon),
  );
  const byTouch = new Map<AssistTouch, number>();
  for (const t of callTouches) if (t) byTouch.set(t, (byTouch.get(t) ?? 0) + 1);

  return {
    label: "Marketing assists on Reactivation (month to date)",
    note: "Reactivation calls and wins where the person came in through a webinar, lead magnet, site form or chatbot before the call was booked. Credit stays with sales; this is the warm touch behind it.",
    values: [
      {
        label: "Calls assisted",
        value: `${count(assistedCalls)} of ${count(booked.length)}`,
      },
      {
        label: "Wins assisted",
        value: `${count(wonAssisted.length)} of ${count(deals.length)}`,
      },
      {
        label: "Revenue assisted",
        value: dollars(wonAssisted.reduce((s, d) => s + (d.value ?? 0), 0)),
      },
      ...ASSIST_TOUCHES.filter((t) => byTouch.get(t)).map((t) => ({
        label: `Calls via ${t}`,
        value: count(byTouch.get(t) ?? 0),
      })),
    ],
  };
}

/** Pacific days of each address's site forms and chatbot chats. */
async function touchDays(client: Client, emails: string[]) {
  const forms = new Map<string, string[]>();
  const chats = new Map<string, string[]>();
  const add = (
    map: Map<string, string[]>,
    email: string | null,
    at: string,
  ) => {
    const key = email?.trim().toLowerCase();
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), pacificDay(at)]);
  };
  // ponytail: exact-case `in` on the address, chunked. Mixed-case addresses in
  // lead_submissions miss; ilike per address if the undercount ever shows.
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const [f, c] = await Promise.all([
      client
        .from("lead_submissions")
        .select("email,created_at")
        .in("email", chunk),
      client
        .from("chatbot_conversations")
        .select("captured_email,created_at")
        .in("captured_email", chunk),
    ]);
    if (f.error || c.error)
      throw new Error("self-booked report: touch read failed");
    for (const r of f.data ?? []) add(forms, r.email, r.created_at);
    for (const r of c.data ?? []) add(chats, r.captured_email, r.created_at);
  }
  return { forms, chats };
}
