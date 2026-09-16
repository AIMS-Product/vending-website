import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/bearer-auth";
import { config } from "@/lib/config";
import {
  ADMIN_ANALYTICS_RANGE_KEYS,
  isAdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import { kpiReportToCsv } from "@/lib/services/kpi-report";
import { getKpiTab } from "@/lib/services/kpi-report-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The KPI framework as JSON or CSV (`format=csv`), for the Google Sheet and
 * anyone else who wants the four tables without the admin UI. Same bearer key
 * as /api/reporting/channels.
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

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? "30d";
  if (!isAdminAnalyticsRangeKey(rangeParam)) {
    return NextResponse.json(
      {
        ok: false,
        message: `Unknown range. Use one of: ${ADMIN_ANALYTICS_RANGE_KEYS.join(", ")}, or custom:YYYY-MM-DD:YYYY-MM-DD.`,
      },
      { status: 400 },
    );
  }
  const range = rangeParam;
  const format = url.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { ok: false, message: "Unknown format. Use json or csv." },
      { status: 400 },
    );
  }

  try {
    const data = await getKpiTab({ range });
    if (format === "csv") {
      return new Response(kpiReportToCsv(data.report), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }
    return NextResponse.json(
      { ok: true, generatedAt: new Date().toISOString(), ...data },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("reporting api: kpi failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Report could not be built." },
      { status: 500 },
    );
  }
}
