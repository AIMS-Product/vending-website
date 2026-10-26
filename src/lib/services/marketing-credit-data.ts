import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cachedCloseReads,
  fetchCloseDeals,
  type WinsCloseClient,
} from "@/lib/services/close-wins";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
import {
  type BookedLead,
  creditBySource,
  type CreditRow,
  type MarketingSource,
  type Touches,
} from "@/lib/services/marketing-credit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type Client = Pick<SupabaseClient<Database>, "from">;

const TIME_ZONE = "America/Los_Angeles";
const PAGE = 1000;

export type MarketingCredit =
  | { ok: true; from: string; to: string; rows: CreditRow[] }
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
    const rows = await load(client, deps.close ?? cachedCloseReads(), from, to);
    return { ok: true, from, to, rows };
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

/** Site lead tags that belong to another source's row, not "Site form". */
const NOT_SITE_FORM_TAG =
  /^(chatbot|newsletter|lead-magnet|internal-webinar|webinar-)/;
const LEAD_MAGNET_PATH = /^\/resources\//;

async function load(
  client: Client,
  close: WinsCloseClient,
  from: string,
  to: string,
): Promise<CreditRow[]> {
  const padFrom = `${from}T00:00:00-08:00`;
  const padTo = `${to}T23:59:59-07:00`;

  const [mirror, forms, chats, spine, deals] = await Promise.all([
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
    readAll<{
      email: string;
      source_path: string | null;
      entry_resource_tag: string | null;
      created_at: string;
    }>(
      (a, b) =>
        client
          .from("lead_submissions")
          .select("email,source_path,entry_resource_tag,created_at")
          .neq("lifecycle_status", "newsletter_subscribed")
          .or(
            `latest_qualification_form_id.is.null,latest_qualification_form_id.neq.${NEWSLETTER_FORM_ID}`,
          )
          .gte("created_at", padFrom)
          .lte("created_at", padTo)
          .range(a, b),
      "site forms",
    ),
    readAll<{ created_at: string }>(
      (a, b) =>
        client
          .from("chatbot_conversations")
          .select("created_at")
          .gte("created_at", padFrom)
          .lte("created_at", padTo)
          .gte("message_count", 2)
          .range(a, b),
      "chatbot conversations",
    ),
    // Webinar registrations and off-site lead magnet opt-ins (GHL forms), by day.
    readAll<{ channel: string; medium: string; leads: number | null }>(
      (a, b) =>
        client
          .from("channel_daily")
          .select("channel,medium,leads")
          .gte("day", from)
          .lte("day", to)
          .gt("leads", 0)
          .range(a, b),
      "registrations and opt-ins",
    ),
    fetchCloseDeals({ from, to, close, mirror: client }),
  ]);

  const inMonth = <T extends { created_at: string }>(rows: T[]) =>
    rows.filter((r) => {
      const d = pacificDay(r.created_at);
      return d >= from && d <= to;
    });

  const siteEmails = new Set<string>();
  const magnetEmails = new Set<string>();
  for (const f of inMonth(forms)) {
    const email = f.email.trim().toLowerCase();
    if (LEAD_MAGNET_PATH.test(f.source_path ?? "")) magnetEmails.add(email);
    else if (!NOT_SITE_FORM_TAG.test(f.entry_resource_tag ?? ""))
      siteEmails.add(email);
  }
  const spineLeads = (
    match: (r: { channel: string; medium: string }) => boolean,
  ) => spine.filter(match).reduce((s, r) => s + (r.leads ?? 0), 0);

  const entered: Partial<Record<MarketingSource, number>> = {
    Webinar: spineLeads((r) => r.channel === "Webinar"),
    "Site form": siteEmails.size,
    "Lead magnet":
      spineLeads((r) => r.medium === "lead-magnet") + magnetEmails.size,
    Chatbot: inMonth(chats).length,
  };

  const dealMirror = await readAll<MirrorRow>(
    (a, b) =>
      client
        .from("close_lead_funnel")
        .select(MIRROR_FIELDS)
        .in("lead_id", deals.length ? deals.map((d) => d.leadId) : ["-"])
        .range(a, b),
    "won leads in the Close mirror",
  );

  const booked = mirror.map((r) => toBooked(r, to));
  const dealLeads = new Map(
    dealMirror.map((r) => [r.lead_id, toBooked(r, to)]),
  );
  const touches = await readTouches(client, [
    ...booked.map((b) => b.email),
    ...dealMirror.map((r) => r.email),
  ]);
  return creditBySource(booked, deals, dealLeads, touches, entered);
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
