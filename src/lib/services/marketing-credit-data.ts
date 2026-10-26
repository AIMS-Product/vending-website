import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cachedCloseReads,
  fetchCloseDeals,
  type WinsCloseClient,
} from "@/lib/services/close-wins";
import {
  type BookedLead,
  chatFunnel,
  type ChatFunnel,
  creditBySource,
  type CreditRow,
  REACTIVATION,
  siteFormFunnel,
  type SiteFormFunnel,
  sourceOf,
  type Touches,
} from "@/lib/services/marketing-credit";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
import {
  selfBookedBreakdown,
  type SelfBookedBreakdown,
  type SelfBookedRow,
} from "@/lib/services/self-booked";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const TIME_ZONE = "America/Los_Angeles";
const PAGE = 1000;

export type MarketingCredit =
  | {
      ok: true;
      from: string;
      to: string;
      selfBooked: SelfBookedBreakdown;
      credit: CreditRow[];
      siteForms: SiteFormFunnel;
      chat: ChatFunnel;
      reactivation: {
        calls: number;
        assistedCalls: number;
        wins: number;
        assistedWins: number;
        assistedRevenue: number;
      };
    }
  | { ok: false; error: string };

const pacificDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });

async function readAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  what: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read ${what}.`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

type MirrorRow = {
  lead_id: string;
  email: string | null;
  entry_source: string | null;
  funnel: string | null;
  booked_by: string | null;
  first_sales_call_booked_date: string | null;
};

const MIRROR_FIELDS =
  "lead_id,email,entry_source,funnel,booked_by,first_sales_call_booked_date";

const toBooked = (r: MirrorRow, fallbackDay: string): BookedLead => ({
  leadId: r.lead_id,
  email: r.email,
  entrySource: r.entry_source,
  funnel: r.funnel,
  bookedBy: r.booked_by,
  bookedDay: r.first_sales_call_booked_date?.slice(0, 10) ?? fallbackDay,
});

/** Month to date, Pacific. Never throws: a failed read comes back as `ok: false`. */
export async function getMarketingCredit(
  deps: { client?: Client; close?: WinsCloseClient; now?: Date } = {},
): Promise<MarketingCredit> {
  try {
    const client = deps.client ?? createAdminClient();
    const to = pacificDay((deps.now ?? new Date()).toISOString());
    const from = `${to.slice(0, 7)}-01`;
    return await load(client, deps.close ?? cachedCloseReads(), from, to);
  } catch (error) {
    console.error("marketing credit failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Read failed.",
    };
  }
}

async function load(
  client: Client,
  close: WinsCloseClient,
  from: string,
  to: string,
): Promise<MarketingCredit> {
  const padFrom = `${from}T00:00:00-08:00`;
  const padTo = `${to}T23:59:59-07:00`;

  const [mirror, calendly, forms, chats, deals] = await Promise.all([
    readAll<MirrorRow>(
      (a, b) =>
        client
          .from("close_lead_funnel")
          .select(MIRROR_FIELDS)
          .gte("first_sales_call_booked_date", from)
          .lte("first_sales_call_booked_date", to)
          .range(a, b),
      "the Close mirror",
    ),
    readAll<SelfBookedRow & { created_at: string }>(
      (a, b) =>
        client
          .from("calendly_bookings")
          .select(
            "invitee_email,scheduled_event_name,utm_source,utm_medium,utm_content,lead_submission_id,raw_payload,created_at",
          )
          .eq("event_kind", "invitee.created")
          .gte("created_at", padFrom)
          .lte("created_at", padTo)
          .order("created_at", { ascending: true })
          .range(a, b),
      "Calendly bookings",
    ),
    readAll<{
      email: string;
      call_booked_at: string | null;
      booked_by_setter: string | null;
      call_status: string | null;
      created_at: string;
    }>(
      (a, b) =>
        client
          .from("lead_submissions")
          .select(
            "email,call_booked_at,booked_by_setter,call_status,created_at",
          )
          .neq("lifecycle_status", "newsletter_subscribed")
          .or(
            `latest_qualification_form_id.is.null,latest_qualification_form_id.neq.${NEWSLETTER_FORM_ID}`,
          )
          .gte("created_at", padFrom)
          .lte("created_at", padTo)
          .range(a, b),
      "site forms",
    ),
    readAll<{
      captured_email: string | null;
      call_booked_at: string | null;
      created_at: string;
      lead_submission_id: string | null;
    }>(
      (a, b) =>
        client
          .from("chatbot_conversations")
          .select("captured_email,call_booked_at,created_at,lead_submission_id")
          .gte("created_at", padFrom)
          .lte("created_at", padTo)
          .gte("message_count", 2)
          .range(a, b),
      "chatbot conversations",
    ),
    fetchCloseDeals({ from, to, close, mirror: client }),
  ]);

  const inMonth = <T extends { created_at: string }>(rows: T[]) =>
    rows.filter((r) => {
      const d = pacificDay(r.created_at);
      return d >= from && d <= to;
    });

  const dealMirror = await readAll<MirrorRow>(
    (a, b) =>
      client
        .from("close_lead_funnel")
        .select(MIRROR_FIELDS)
        .in("lead_id", deals.length ? deals.map((d) => d.leadId) : ["-"])
        .range(a, b),
    "won leads in the Close mirror",
  );

  // The chat's lead row says whether they booked later, and who booked it.
  const chatLeadIds = [
    ...new Set(chats.map((c) => c.lead_submission_id).filter(Boolean)),
  ] as string[];
  const chatLeads = new Map<
    string,
    { call_booked_at: string | null; booked_by_setter: string | null }
  >();
  for (let i = 0; i < chatLeadIds.length; i += 200) {
    const { data, error } = await client
      .from("lead_submissions")
      .select("id,call_booked_at,booked_by_setter")
      .in("id", chatLeadIds.slice(i, i + 200));
    if (error) throw new Error("Could not read chatbot leads.");
    for (const r of data ?? []) chatLeads.set(r.id, r);
  }

  const booked = mirror.map((r) => toBooked(r, to));
  const dealLeads = new Map(
    dealMirror.map((r) => [r.lead_id, toBooked(r, to)]),
  );
  const touches = await readTouches(client, [
    ...booked.map((b) => b.email),
    ...dealMirror.map((r) => r.email),
  ]);
  const byEmail = new Map(
    booked.map((b) => [b.email?.trim().toLowerCase() ?? "", b]),
  );

  const reactivationCalls = booked.filter((b) => b.funnel === REACTIVATION);
  const reactivationDeals = deals.filter((d) => d.funnel === REACTIVATION);
  const assistedDeals = reactivationDeals.filter((d) => {
    const lead = dealLeads.get(d.leadId);
    return (
      lead && sourceOf(lead, lead.bookedDay, touches) !== "No marketing touch"
    );
  });

  return {
    ok: true,
    from,
    to,
    selfBooked: selfBookedBreakdown(inMonth(calendly)),
    credit: creditBySource(booked, deals, dealLeads, touches),
    siteForms: siteFormFunnel(
      inMonth(forms).map((f) => ({
        email: f.email,
        callBookedAt: f.call_booked_at,
        bookedBySetter: f.booked_by_setter,
        callStatus: f.call_status,
      })),
      byEmail,
    ),
    chat: chatFunnel(
      inMonth(chats).map((c) => ({
        capturedEmail: c.captured_email,
        bookedInChat: Boolean(c.call_booked_at),
        leadBookedAt:
          chatLeads.get(c.lead_submission_id ?? "")?.call_booked_at ?? null,
        leadSetter:
          chatLeads.get(c.lead_submission_id ?? "")?.booked_by_setter ?? null,
      })),
    ),
    reactivation: {
      calls: reactivationCalls.length,
      assistedCalls: reactivationCalls.filter(
        (b) => sourceOf(b, b.bookedDay, touches) !== "No marketing touch",
      ).length,
      wins: reactivationDeals.length,
      assistedWins: assistedDeals.length,
      assistedRevenue: assistedDeals.reduce((s, d) => s + (d.value ?? 0), 0),
    },
  };
}

/** Every site form and chat for these addresses, by Pacific day, plus any named setter. */
async function readTouches(
  client: Client,
  rawEmails: Array<string | null>,
): Promise<Touches> {
  const emails = [
    ...new Set(
      rawEmails
        .map((e) => e?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  ];
  const forms = new Map<string, string[]>();
  const chats = new Map<string, string[]>();
  const setters = new Map<string, string>();
  const push = (m: Map<string, string[]>, email: string | null, at: string) => {
    const k = email?.trim().toLowerCase();
    if (k) m.set(k, [...(m.get(k) ?? []), pacificDay(at)]);
  };
  // ponytail: exact-case `in`, chunked; a mixed-case stored address misses.
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200);
    const [f, c] = await Promise.all([
      client
        .from("lead_submissions")
        .select("email,created_at,booked_by_setter")
        .in("email", chunk),
      client
        .from("chatbot_conversations")
        .select("captured_email,created_at")
        .in("captured_email", chunk),
    ]);
    if (f.error || c.error)
      throw new Error("Could not read marketing touches.");
    for (const r of f.data ?? []) {
      push(forms, r.email, r.created_at);
      const setter = r.booked_by_setter?.trim();
      if (setter) setters.set(r.email.trim().toLowerCase(), setter);
    }
    for (const r of c.data ?? []) push(chats, r.captured_email, r.created_at);
  }
  return { forms, chats, setters };
}
