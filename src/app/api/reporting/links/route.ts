import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/bearer-auth";
import { config } from "@/lib/config";
import { csvCell } from "@/lib/services/kpi-report";
import {
  getLinkRegistry,
  type RegistryLink,
} from "@/lib/services/marketing-links";
import { reportRouteError } from "@/lib/observability/route-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Read-only reporting API: every registry link with its funnel and results,
 * the replacement for the UTM master sheet. Same rows as /admin/links. JSON by
 * default, `?format=csv` for a sheet or a script. Bearer `REPORTING_API_KEY`.
 *
 * No PII: link tags and counts only.
 */
export async function GET(request: Request) {
  if (!config.REPORTING_API_KEY) {
    return NextResponse.json(
      { ok: false, message: "Reporting API is not configured." },
      { status: 503 },
    );
  }
  if (
    !hasValidBearer(
      request.headers.get("authorization"),
      config.REPORTING_API_KEY,
    )
  ) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { ok: false, message: "Unknown format. Use json or csv." },
      { status: 400 },
    );
  }

  try {
    const { links, statsFailed } = await getLinkRegistry();
    const rows = links.map(toRow);
    if (format === "csv") {
      return new Response(toCsv(rows), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    return NextResponse.json(
      { ok: true, generatedAt: new Date().toISOString(), statsFailed, rows },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    await reportRouteError("reporting-links", error);
    console.error("reporting api: links failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Links could not be read." },
      { status: 500 },
    );
  }
}

const COLUMNS = [
  "funnel_name",
  "owner",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "url",
  "bitly_url",
  "label",
  "imported",
  "leads",
  "booked",
  "calendar_bookings",
  "clicks",
  "last_lead_at",
  "funnel_set_by",
  "created_by",
  "created_at",
] as const;

type Row = Record<(typeof COLUMNS)[number], string | number | boolean | null>;

function toRow(link: RegistryLink): Row {
  return {
    funnel_name: link.funnel_name,
    owner: link.owner,
    utm_source: link.utm_source,
    utm_medium: link.utm_medium,
    utm_campaign: link.utm_campaign,
    utm_content: link.utm_content,
    utm_term: link.utm_term,
    url: link.url,
    bitly_url: link.bitly_url,
    label: link.label,
    imported: link.imported,
    // Null when the results read failed: unknown, never zero.
    leads: link.stats?.leads ?? null,
    booked: link.stats?.booked ?? null,
    calendar_bookings: link.stats?.calendarBookings ?? null,
    clicks: link.stats?.clicks ?? null,
    last_lead_at: link.stats?.lastLeadAt ?? null,
    funnel_set_by: link.funnel_set_by,
    created_by: link.created_by,
    created_at: link.created_at,
  };
}

/**
 * Tags arrive from public URLs, so a cell that a spreadsheet would run as a
 * formula is quoted as text first.
 */
function sheetSafe(value: string): string {
  return /^[=+@\t\r]/.test(value) ? `'${value}` : value;
}

function toCsv(rows: readonly Row[]): string {
  const lines = rows.map((row) =>
    COLUMNS.map((column) =>
      csvCell(sheetSafe(row[column] === null ? "" : String(row[column]))),
    ).join(","),
  );
  return `${[COLUMNS.join(","), ...lines].join("\n")}\n`;
}
