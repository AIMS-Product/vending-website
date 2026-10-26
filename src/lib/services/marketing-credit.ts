import { assistTouch, type AssistTouch } from "@/lib/services/self-booked";

/**
 * Marketing credit: every source traced from the first touch to the close, on
 * both paths: the person booked (and bought) on their own, or a setter or the
 * Reactivation scrapers picked them up after marketing brought them in.
 * Pure; `marketing-credit-data.ts` loads the rows.
 *
 * Source is the touch that came first in Close (Entry Source), except that a
 * chat on or before the booked day makes it a Chatbot call: the chat is the
 * last thing that happened on our side before the booking.
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
  /** Setter name recorded on the person's site lead row. */
  setters: ReadonlyMap<string, string>;
};

const key = (email: string | null) => email?.trim().toLowerCase() ?? "";

export function sourceOf(
  lead: Pick<BookedLead, "email" | "entrySource">,
  day: string,
  touches: Touches,
): MarketingSource {
  const k = key(lead.email);
  if ((touches.chats.get(k) ?? []).some((d) => d <= day)) return "Chatbot";
  return (
    assistTouch({
      entrySource: lead.entrySource,
      bookedDay: day,
      formDays: touches.forms.get(k) ?? [],
      chatDays: [],
    }) ?? "No marketing touch"
  );
}

/** Reactivated: Reactivation Scrapers, a Lane 2 / Social DMs booking, or a named setter on the lead. */
export function setterBooked(lead: BookedLead, touches: Touches): boolean {
  return (
    lead.funnel === REACTIVATION ||
    SETTER_BOOKERS.has(lead.bookedBy ?? "") ||
    touches.setters.has(key(lead.email))
  );
}

export type PathSplit = { self: number; reactivated: number };

export type CreditRow = {
  source: MarketingSource;
  /** Registrations, form fills, opt-ins or chats this period. Null = not measured. */
  entered: number | null;
  booked: PathSplit;
  won: PathSplit;
  revenue: PathSplit;
};

export type Deal = { leadId: string; value: number | null; dateWon: string };

const split = (): PathSplit => ({ self: 0, reactivated: 0 });

export function creditBySource(
  booked: readonly BookedLead[],
  deals: readonly Deal[],
  dealLeads: ReadonlyMap<string, BookedLead>,
  touches: Touches,
  entered: Partial<Record<MarketingSource, number>> = {},
): CreditRow[] {
  const rows = new Map<MarketingSource, CreditRow>(
    SOURCE_ORDER.map((source) => [
      source,
      {
        source,
        entered: entered[source] ?? null,
        booked: split(),
        won: split(),
        revenue: split(),
      },
    ]),
  );
  for (const lead of booked) {
    const row = rows.get(sourceOf(lead, lead.bookedDay, touches))!;
    row.booked[setterBooked(lead, touches) ? "reactivated" : "self"] += 1;
  }
  for (const deal of deals) {
    const lead = dealLeads.get(deal.leadId);
    // A buyer with no first call on record (an LTF purchase) has no source
    // and was never reactivated.
    const source = lead
      ? sourceOf(lead, lead.bookedDay, touches)
      : "No marketing touch";
    const path = lead && setterBooked(lead, touches) ? "reactivated" : "self";
    const row = rows.get(source)!;
    row.won[path] += 1;
    row.revenue[path] += deal.value ?? 0;
  }
  return SOURCE_ORDER.map((s) => rows.get(s)!);
}

export const both = (s: PathSplit) => s.self + s.reactivated;

/** Column sums across rows, for the total row and the KPI strip. */
export function sumRows(rows: readonly CreditRow[]) {
  const add = (pick: (r: CreditRow) => PathSplit): PathSplit => ({
    self: rows.reduce((s, r) => s + pick(r).self, 0),
    reactivated: rows.reduce((s, r) => s + pick(r).reactivated, 0),
  });
  return {
    entered: rows.reduce((s, r) => s + (r.entered ?? 0), 0),
    booked: add((r) => r.booked),
    won: add((r) => r.won),
    revenue: add((r) => r.revenue),
  };
}
