/**
 * The two-line read at the top of /admin/analytics: what happened, then what
 * moved enough to matter, problems first. Thresholds are deliberately coarse;
 * a 3% wobble is noise on a 30-day window, a 10% move is a conversation.
 */

type Pair = { now: number; before: number };

export type BriefingInput = {
  /** "Last 30 days", "This week", or a date span. */
  period: string;
  /** "the 30 days before", or the prior date span. */
  priorPhrase: string;
  leads: Pair | null;
  booked: Pair | null;
  revenue: (Pair & { deals: number }) | null;
  /** Show rate in percent (0-100). */
  showRate: Pair | null;
};

export type BriefingItem = { tone: "bad" | "good"; text: string };

export type Briefing = { headline: string; items: BriefingItem[] };

const MOVE_PCT = 10;
const MOVE_PTS = 2;
const MAX_ITEMS = 4;

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const count = (n: number) => n.toLocaleString("en-US");

function pct(p: Pair): number | null {
  return p.before > 0 ? ((p.now - p.before) / p.before) * 100 : null;
}

export function briefingOf(input: BriefingInput): Briefing {
  const { booked, revenue, leads, showRate, priorPhrase } = input;
  const parts: string[] = [];
  if (booked) {
    const d = pct(booked);
    parts.push(
      `${count(booked.now)} booked sales calls${d === null ? "" : ` (${d >= 0 ? "up" : "down"} ${Math.abs(Math.round(d))}% on ${priorPhrase})`}`,
    );
  }
  if (revenue) {
    parts.push(
      `${usd(revenue.now)} won from ${count(revenue.deals)} deal${revenue.deals === 1 ? "" : "s"}`,
    );
  }
  const headline = parts.length
    ? `${input.period}: ${parts.join(" and ")}.`
    : `${input.period}: no numbers could be read.`;

  const items: Array<BriefingItem & { weight: number }> = [];
  const judge = (label: string, p: Pair | null, fmt: (n: number) => string) => {
    if (!p) return;
    const d = pct(p);
    if (d === null || Math.abs(d) < MOVE_PCT) return;
    items.push({
      tone: d < 0 ? "bad" : "good",
      weight: Math.abs(d),
      text: `${label} ${d < 0 ? "down" : "up"} ${Math.abs(Math.round(d))}%: ${fmt(p.now)} against ${fmt(p.before)}.`,
    });
  };
  judge("Booked calls", booked, count);
  judge("Revenue won", revenue, usd);
  judge("Leads", leads, count);
  if (showRate) {
    const pts = showRate.now - showRate.before;
    if (Math.abs(pts) >= MOVE_PTS) {
      items.push({
        tone: pts < 0 ? "bad" : "good",
        weight: Math.abs(pts) * 5,
        text: `Show rate ${pts < 0 ? "down" : "up"} ${Math.abs(pts).toFixed(1)} points to ${showRate.now.toFixed(1)}%: ${pts < 0 ? "more booked calls are not turning up" : "more booked calls are turning up"}.`,
      });
    }
  }
  items.sort(
    (a, b) =>
      Number(b.tone === "bad") - Number(a.tone === "bad") ||
      b.weight - a.weight,
  );
  return {
    headline,
    items: items.slice(0, MAX_ITEMS).map(({ tone, text }) => ({ tone, text })),
  };
}
