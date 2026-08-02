export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Collector for the report-only CSP.
 *
 * Browsers post here unauthenticated and unprompted, which makes two things
 * matter more than the reporting itself:
 *
 *  - **Log volume.** One popular page can produce a report per visitor per
 *    violation. Only the FIRST report of each distinct
 *    `directive → blocked host` pair is logged per server instance; the rest
 *    are counted and dropped. What is needed to build the enforcing policy is
 *    the set of distinct hosts, not the traffic volume behind them.
 *  - **Storage.** Nothing is written to the database. The set below lives in
 *    memory and dies with the instance, which is the correct lifetime for a
 *    temporary measurement — and means an unapplied migration, a schema
 *    change, or a flood can never touch real data from here.
 *
 * ponytail: per-instance dedupe, so a redeploy or a scale-out re-logs each
 * pair once. That is a handful of extra lines, not a flood.
 */
const seen = new Set<string>();

/** Bounded so a hostile poster cannot grow the set without limit. */
const MAX_DISTINCT_REPORTS = 500;

type CspReportBody = {
  "csp-report"?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const report = await parseReport(request);
  // Always 204: a collector that argues with the browser about the shape of
  // its report teaches us nothing and retries forever.
  if (!report) return new Response(null, { status: 204 });

  const key = `${report.directive} ${report.blocked}`;
  if (!seen.has(key) && seen.size < MAX_DISTINCT_REPORTS) {
    seen.add(key);
    console.warn("csp report-only violation", {
      directive: report.directive,
      blocked: report.blocked,
      documentUri: report.documentUri,
      distinctSoFar: seen.size,
    });
  }

  return new Response(null, { status: 204 });
}

async function parseReport(request: Request) {
  try {
    const body = (await request.json()) as CspReportBody | unknown[];
    // Legacy `application/csp-report` wraps a single report; the Reporting API
    // posts `application/reports+json`, an array whose entries carry `body`.
    const raw = Array.isArray(body)
      ? asRecord(asRecord(body[0])?.body)
      : asRecord((body as CspReportBody)["csp-report"]);
    if (!raw) return null;

    const directive =
      stringAt(raw, "effective-directive") ??
      stringAt(raw, "effectiveDirective") ??
      stringAt(raw, "violated-directive") ??
      stringAt(raw, "violatedDirective");
    const blocked =
      stringAt(raw, "blocked-uri") ?? stringAt(raw, "blockedURL") ?? null;
    if (!directive || !blocked) return null;

    return {
      directive,
      // Only the origin: a full URL carries query strings, and a page URL can
      // carry a qualification session token.
      blocked: originOf(blocked),
      documentUri: originOf(
        stringAt(raw, "document-uri") ?? stringAt(raw, "documentURL") ?? "",
      ),
    };
  } catch {
    return null;
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringAt(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** `inline`, `eval`, and `data` are reported as bare keywords, not URLs. */
function originOf(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value.slice(0, 100);
  }
}
