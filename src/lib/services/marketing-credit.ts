import { assistTouch, type AssistTouch } from "@/lib/services/self-booked";

/**
 * Marketing credit: which booked calls and wins marketing started, and who
 * finished the booking (the person themselves, or a setter after marketing had
 * already warmed them up). Pure; `marketing-credit-data.ts` loads the rows.
 *
 * Jess and Adam, 2026-10-26: "see which booked calls came from marketing
 * efforts ... how many form fills get a call and then book a call."
 */

export type MarketingSource = AssistTouch | "No marketing touch";

export const SOURCE_ORDER: readonly MarketingSource[] = [
  "Webinar",
  "Site form",
  "Lead magnet",
  "Chatbot",
  "No marketing touch",
];

export const REACTIVATION = "Reactivation Scrapers";
const SETTER_BOOKERS = new Set(["Lane 2", "Social DMs"]);

export type BookedLead = {
  leadId: string;
  email: string | null;
  entrySource: string | null;
  funnel: string | null;
  bookedBy: string | null;
  bookedDay: string;
};

export type Touches = {
  forms: ReadonlyMap<string, readonly string[]>;
  chats: ReadonlyMap<string, readonly string[]>;
  /** Close/Calendly setter name recorded on the person's site lead row. */
  setters: ReadonlyMap<string, string>;
};

const key = (email: string | null) => email?.trim().toLowerCase() ?? "";

export function sourceOf(
  lead: Pick<BookedLead, "email" | "entrySource">,
  day: string,
  touches: Touches,
): MarketingSource {
  const k = key(lead.email);
  return (
    assistTouch({
      entrySource: lead.entrySource,
      bookedDay: day,
      formDays: touches.forms.get(k) ?? [],
      chatDays: touches.chats.get(k) ?? [],
    }) ?? "No marketing touch"
  );
}

/** A setter booked it: Reactivation, a Lane 2 / Social DMs booking, or a named setter on the lead. */
export function setterBooked(lead: BookedLead, touches: Touches): boolean {
  return (
    lead.funnel === REACTIVATION ||
    SETTER_BOOKERS.has(lead.bookedBy ?? "") ||
    touches.setters.has(key(lead.email))
  );
}

export type CreditRow = {
  source: MarketingSource;
  booked: number;
  themselves: number;
  bySetter: number;
  won: number;
  revenue: number;
};

export type Deal = { leadId: string; value: number | null; dateWon: string };

export function creditBySource(
  booked: readonly BookedLead[],
  deals: readonly Deal[],
  dealLeads: ReadonlyMap<string, BookedLead>,
  touches: Touches,
): CreditRow[] {
  const rows = new Map<MarketingSource, CreditRow>(
    SOURCE_ORDER.map((source) => [
      source,
      { source, booked: 0, themselves: 0, bySetter: 0, won: 0, revenue: 0 },
    ]),
  );
  for (const lead of booked) {
    const row = rows.get(sourceOf(lead, lead.bookedDay, touches))!;
    row.booked += 1;
    if (setterBooked(lead, touches)) row.bySetter += 1;
    else row.themselves += 1;
  }
  for (const deal of deals) {
    const lead = dealLeads.get(deal.leadId);
    const day = lead?.bookedDay ?? deal.dateWon;
    const row = rows.get(
      lead ? sourceOf(lead, day, touches) : "No marketing touch",
    )!;
    row.won += 1;
    row.revenue += deal.value ?? 0;
  }
  return SOURCE_ORDER.map((s) => rows.get(s)!);
}

export type SiteFormLead = {
  email: string;
  callBookedAt: string | null;
  bookedBySetter: string | null;
  callStatus: string | null;
};

export type SiteFormFunnel = {
  filled: number;
  bookedThemselves: number;
  bookedBySetter: ReadonlyArray<{ setter: string; count: number }>;
  notBooked: ReadonlyArray<{ status: string; count: number }>;
};

/** Strips Close's emoji prefixes: "🆕 New" -> "New". */
const statusLabel = (s: string | null) => {
  const label = s?.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  if (!label) return "Not in Close yet";
  return label === "close_lead_missing" ? "Not found in Close" : label;
};

const tally = (values: string[]) =>
  [
    ...values.reduce(
      (m, v) => m.set(v, (m.get(v) ?? 0) + 1),
      new Map<string, number>(),
    ),
  ]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

/**
 * One person per address: a booking on any of their rows counts, and the
 * setter named on any row is the one who booked it.
 */
export function siteFormFunnel(
  leads: readonly SiteFormLead[],
  mirror: ReadonlyMap<string, BookedLead>,
): SiteFormFunnel {
  const people = new Map<string, SiteFormLead>();
  for (const lead of leads) {
    const k = key(lead.email);
    if (!k) continue;
    const seen = people.get(k);
    people.set(k, {
      email: k,
      callBookedAt: seen?.callBookedAt ?? lead.callBookedAt,
      bookedBySetter: seen?.bookedBySetter ?? lead.bookedBySetter,
      callStatus: lead.callStatus ?? seen?.callStatus ?? null,
    });
  }
  let themselves = 0;
  const setters: string[] = [];
  const statuses: string[] = [];
  for (const person of people.values()) {
    if (!person.callBookedAt) {
      statuses.push(statusLabel(person.callStatus));
      continue;
    }
    const m = mirror.get(person.email);
    const setter =
      person.bookedBySetter?.trim() ||
      (m?.funnel === REACTIVATION ? "Reactivation team" : null) ||
      (m && SETTER_BOOKERS.has(m.bookedBy ?? "") ? m.bookedBy : null);
    if (setter) setters.push(setter);
    else themselves += 1;
  }
  return {
    filled: people.size,
    bookedThemselves: themselves,
    bookedBySetter: tally(setters).map(({ label, count }) => ({
      setter: label,
      count,
    })),
    notBooked: tally(statuses).map(({ label, count }) => ({
      status: label,
      count,
    })),
  };
}

export type ChatRow = {
  capturedEmail: string | null;
  bookedInChat: boolean;
  leadBookedAt: string | null;
  leadSetter: string | null;
};

export type ChatFunnel = {
  chats: number;
  gaveEmail: number;
  bookedInChat: number;
  bookedLaterThemselves: number;
  bookedLaterBySetter: number;
};

export function chatFunnel(chats: readonly ChatRow[]): ChatFunnel {
  const result: ChatFunnel = {
    chats: chats.length,
    gaveEmail: 0,
    bookedInChat: 0,
    bookedLaterThemselves: 0,
    bookedLaterBySetter: 0,
  };
  for (const chat of chats) {
    if (chat.capturedEmail) result.gaveEmail += 1;
    if (chat.bookedInChat) result.bookedInChat += 1;
    else if (chat.leadBookedAt && chat.leadSetter)
      result.bookedLaterBySetter += 1;
    else if (chat.leadBookedAt) result.bookedLaterThemselves += 1;
  }
  return result;
}
