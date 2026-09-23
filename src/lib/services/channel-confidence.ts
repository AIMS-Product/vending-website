import {
  AI_CHANNEL,
  GHL_FORMS_CHANNEL,
  INSTAGRAM_DM_CHANNEL,
  LOW_TICKET_CHANNEL,
  REFERRAL_CHANNEL,
  SEARCH_CHANNEL,
  UNKNOWN_CHANNEL,
  WEBSITE_CHANNEL,
} from "@/lib/analytics/channel";
import {
  connectorLabel,
  isSkippedFormBooking,
  sumObserved,
  type ChannelFact,
  type MetricKey,
  type SyncHealthRow,
} from "@/lib/services/channel-report-rollup";

/**
 * "Is the data actually in here?" answered with numbers, not a green dot.
 *
 * Two views. Coverage: for every channel, which metrics a connector observed
 * in the range against which ones it should have, with the connector's own
 * health note as the cause when one is missing. Checks: the spine compared
 * with the tables it was built from (lead_submissions, webinar_events,
 * ga4_page_views), plus the population caveats a reader has to know before
 * trusting a rate. Every check prints both numbers it compared.
 */

export type CoverageKey = Extract<
  MetricKey,
  | "spend"
  | "impressions"
  | "clicks"
  | "visits"
  | "leads"
  | "contacts"
  | "booked"
>;

export const COVERAGE_KEYS: ReadonlyArray<{ key: CoverageKey; label: string }> =
  [
    { key: "spend", label: "Spend" },
    { key: "impressions", label: "Seen" },
    { key: "clicks", label: "Clicked" },
    { key: "visits", label: "Visits" },
    { key: "leads", label: "Leads" },
    { key: "contacts", label: "Registrations & contacts" },
    { key: "booked", label: "Booked" },
  ];

/** What each channel should be able to report, given the connectors built. */
const EXPECTED: Record<string, CoverageKey[]> = {
  Instagram: ["impressions", "visits", "leads"],
  Meta: ["impressions", "visits", "leads"],
  LinkedIn: ["impressions", "visits", "leads"],
  X: ["impressions", "visits", "leads"],
  TikTok: ["impressions", "visits", "leads"],
  YouTube: ["impressions", "clicks", "visits", "leads"],
  Webinar: ["spend", "contacts", "booked"],
  "Meta Ads": ["spend", "visits", "leads"],
  "Google Ads": ["spend", "visits", "leads"],
  Email: ["impressions", "clicks", "leads"],
  Newsletter: ["visits", "leads"],
  Chatbot: ["leads", "booked"],
  [INSTAGRAM_DM_CHANNEL]: ["clicks", "contacts", "booked"],
  [LOW_TICKET_CHANNEL]: ["visits", "leads", "booked"],
  [GHL_FORMS_CHANNEL]: ["contacts"],
  [WEBSITE_CHANNEL]: ["visits", "leads"],
  [SEARCH_CHANNEL]: ["visits", "leads"],
  [AI_CHANNEL]: ["visits"],
  [REFERRAL_CHANNEL]: ["visits"],
  [UNKNOWN_CHANNEL]: ["visits"],
};

/** Which connectors can fill each metric, for naming the cause of a gap. */
const METRIC_CONNECTORS: Record<CoverageKey, string[]> = {
  spend: ["metricool-ads"],
  impressions: [
    "metricool-posts",
    "metricool-ads",
    "youtube-analytics",
    "ghl-email",
  ],
  clicks: [
    "bitly-clicks",
    "metricool-posts",
    "metricool-ads",
    "ghl-email",
    "manychat-ingest",
  ],
  visits: ["ga4-visits"],
  leads: ["leads"],
  contacts: ["webinar-ingest", "ghl-forms", "manychat-ingest"],
  booked: ["leads", "webinar-ingest", "manychat-ingest"],
};

export type CoverageCell = {
  observed: boolean;
  expected: boolean;
  /** Why an expected metric is missing, from connector health. */
  cause: string | null;
};

export type CoverageRow = {
  channel: string;
  cells: Record<CoverageKey, CoverageCell>;
  gaps: number;
};

export type CheckStatus = "ok" | "warn" | "fail" | "info";

export type ConfidenceCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  /** Both numbers compared, or the list of channels concerned. */
  detail: string;
};

/** Counts read straight from the tables the spine was built from. */
export type SourceCounts = {
  /** Non-internal lead_submissions created in the range. */
  leadSubmissions: number | null;
  /** Sum of webinar_events.registrations for webinars dated in the range. */
  webinarRegistrations: number | null;
  /** Sum of ga4_page_views.sessions for days in the range. */
  ga4Sessions: number | null;
  /** calendly_bookings with status booked, created in the range. */
  calendlyBookings: number | null;
};

export type ConfidenceReport = {
  status: CheckStatus;
  checks: ConfidenceCheck[];
  coverage: CoverageRow[];
};

export function buildConfidence(
  facts: ChannelFact[],
  health: SyncHealthRow[],
  sources: SourceCounts,
): ConfidenceReport {
  const coverage = buildCoverage(facts, health);
  const checks = buildChecks(facts, sources, coverage);
  const worst = (["fail", "warn", "ok", "info"] as CheckStatus[]).find(
    (status) => checks.some((check) => check.status === status),
  );
  return { status: worst ?? "ok", checks, coverage };
}

function buildCoverage(
  facts: ChannelFact[],
  health: SyncHealthRow[],
): CoverageRow[] {
  const byChannel = new Map<string, ChannelFact[]>();
  for (const fact of facts) {
    const list = byChannel.get(fact.channel) ?? [];
    byChannel.set(fact.channel, [...list, fact]);
  }
  const unhealthy = new Map(
    health
      .filter((row) => row.status !== "ok")
      .map((row) => [row.connector, row]),
  );
  return [...byChannel.entries()]
    .map(([channel, rows]) => {
      const expected = new Set(EXPECTED[channel] ?? []);
      const cells = Object.fromEntries(
        COVERAGE_KEYS.map(({ key }) => {
          const observed = rows.some((row) => row[key] != null);
          const isExpected = expected.has(key);
          return [
            key,
            {
              observed,
              expected: isExpected,
              cause: isExpected && !observed ? causeFor(key, unhealthy) : null,
            },
          ];
        }),
      ) as Record<CoverageKey, CoverageCell>;
      const gaps = Object.values(cells).filter(
        (cell) => cell.expected && !cell.observed,
      ).length;
      return { channel, cells, gaps };
    })
    .sort((a, b) => b.gaps - a.gaps || a.channel.localeCompare(b.channel));
}

function causeFor(
  key: CoverageKey,
  unhealthy: Map<string, SyncHealthRow>,
): string {
  const culprits = METRIC_CONNECTORS[key]
    .map((connector) => unhealthy.get(connector))
    .filter((row): row is SyncHealthRow => Boolean(row));
  if (culprits.length === 0)
    return "Its data feed ran but sent nothing for this channel.";
  return culprits
    .map(
      (row) => `${connectorLabel(row.connector)}: ${STATUS_TEXT[row.status]}`,
    )
    .join("; ");
}

const STATUS_TEXT: Record<SyncHealthRow["status"], string> = {
  ok: "synced",
  empty: "running but sending no new data",
  skipped: "not connected",
  failed: "last run failed",
  stale: "out of date",
  never: "never ran",
};

/** A tag made only of punctuation, e.g. "_____" left in a template. */
const PLACEHOLDER_TAG = /^[^a-z0-9]+$/i;

/** Percent difference of spine against source; null when either is missing. */
function drift(spine: number | null, source: number | null): number | null {
  if (spine == null || source == null || source === 0) return null;
  return Math.round((Math.abs(spine - source) / source) * 1000) / 10;
}

function reconcile(
  id: string,
  label: string,
  spine: number | null,
  source: number | null,
  sourceName: string,
  tolerancePct: number,
): ConfidenceCheck {
  if (source == null) {
    return {
      id,
      label,
      status: "info",
      detail: `${sourceName.charAt(0).toUpperCase()}${sourceName.slice(1)} could not be read, so there is nothing to compare.`,
    };
  }
  const gap = drift(spine, source);
  const detail = `This tab shows ${fmt(spine)}; ${sourceName} show ${fmt(source)}${gap == null ? "" : ` (${gap}% apart)`}.`;
  const status: CheckStatus =
    gap == null
      ? "fail"
      : gap <= tolerancePct
        ? "ok"
        : gap <= tolerancePct * 5
          ? "warn"
          : "fail";
  return { id, label, status, detail };
}

function fmt(value: number | null): string {
  return value == null ? "nothing" : value.toLocaleString();
}

function buildChecks(
  facts: ChannelFact[],
  sources: SourceCounts,
  coverage: CoverageRow[],
): ConfidenceCheck[] {
  const sum = (rows: ChannelFact[], key: MetricKey) =>
    sumObserved(rows.map((row) => row[key]));
  const webinar = facts.filter((fact) => fact.channel === "Webinar");
  // Bookings the leads connector wrote: everything except the two programs
  // that report their own bookings (webinar-ingest, manychat-ingest).
  const siteBooked = facts.filter(
    (fact) =>
      fact.channel !== "Webinar" && fact.channel !== INSTAGRAM_DM_CHANNEL,
  );
  const checks: ConfidenceCheck[] = [
    reconcile(
      "leads",
      "Site leads match the lead records",
      // Every channel: `leads` holds only site leads (lead-definition).
      sum(facts, "leads"),
      sources.leadSubmissions,
      "the lead records",
      2,
    ),
    reconcile(
      "webinar",
      "Webinar registrations match the webinar records",
      sum(webinar, "contacts"),
      sources.webinarRegistrations,
      "the webinar registration records",
      2,
    ),
    reconcile(
      "visits",
      "Visits match GA4 sessions",
      sum(facts, "visits"),
      sources.ga4Sessions,
      "GA4 sessions",
      5,
    ),
    // Cohort basis differs (a lead's booking is credited to the lead's day),
    // so a wider tolerance than the lead check; it still catches a connector
    // that stopped writing bookings.
    reconcile(
      "booked",
      "Bookings match Calendly (linked to a lead or tagged)",
      sum(siteBooked, "booked"),
      sources.calendlyBookings,
      "Calendly bookings (not cancelled, linked to a lead or tagged)",
      10,
    ),
  ];

  const placeholder = facts.filter((fact) => PLACEHOLDER_TAG.test(fact.source));
  const placeholderBooked = sum(placeholder, "booked") ?? 0;
  const placeholderLeads = sum(placeholder, "leads") ?? 0;
  checks.push({
    id: "placeholder",
    label: "Links whose tags were never filled in",
    status: placeholderBooked + placeholderLeads > 0 ? "warn" : "ok",
    detail:
      placeholder.length === 0
        ? "None in range."
        : `${fmt(placeholderBooked)} bookings and ${fmt(placeholderLeads)} leads came from links tagged "${placeholder[0].source}": a template whose UTM blanks were never filled. Find the link and retag it; until then they sit under Unknown.`,
  });

  const missing = coverage.filter((row) => row.gaps > 0);
  checks.push({
    id: "coverage",
    label: "Every channel reports what it should",
    status: missing.length === 0 ? "ok" : "warn",
    detail:
      missing.length === 0
        ? "No expected metric is missing."
        : `${missing.length} ${missing.length === 1 ? "channel has" : "channels have"} gaps: ${missing
            .map((row) => `${row.channel} (${row.gaps} missing)`)
            .join(", ")}.`,
  });

  const visits = sum(facts, "visits");
  const unattributed = sum(
    facts.filter(
      (fact) =>
        fact.channel === UNKNOWN_CHANNEL || fact.channel === REFERRAL_CHANNEL,
    ),
    "visits",
  );
  const share =
    visits && unattributed != null
      ? Math.round((unattributed / visits) * 1000) / 10
      : null;
  checks.push({
    id: "unattributed",
    label: "Visits we cannot place",
    status: share == null ? "info" : share > 20 ? "warn" : "ok",
    detail:
      share == null
        ? "No visits observed."
        : `${fmt(unattributed)} of ${fmt(visits)} visits (${share}%) are Unknown or Referral.`,
  });

  const direct = sum(facts.filter(isSkippedFormBooking), "booked");
  checks.push({
    id: "direct",
    label: "Bookings that skipped the form",
    status: "info",
    detail:
      direct == null || direct === 0
        ? "None in range."
        : `${fmt(direct)} bookings came straight from a Calendly link without a lead form. They count as booked but never as a lead, so Book % leaves them out.`,
  });

  const offSite = coverage
    .map((row) => row.channel)
    .filter((channel) => {
      const rows = facts.filter((fact) => fact.channel === channel);
      const leads = sum(rows, "leads");
      const channelVisits = sum(rows, "visits");
      return leads != null && channelVisits != null && leads > channelVisits;
    });
  checks.push({
    id: "offsite",
    label: "Leads captured off our site",
    status: "info",
    detail:
      offSite.length === 0
        ? "Every channel's leads are within its visits."
        : `${offSite.join(", ")}: more leads than site visits, so those leads were captured elsewhere (GHL pages, ads lead forms). Lead % is measured only on the tagged site traffic.`,
  });

  return checks;
}
