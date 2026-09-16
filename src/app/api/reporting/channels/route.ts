import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/bearer-auth";
import { config } from "@/lib/config";
import {
  ADMIN_ANALYTICS_RANGE_KEYS,
  isAdminAnalyticsRangeKey,
} from "@/lib/services/admin-analytics-range";
import { getChannelsTab } from "@/lib/services/channel-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Read-only reporting API: the Channels tab as JSON.
 *
 * Same numbers, same shape, same code path as /admin/analytics?tab=channels,
 * so a partner pulling the data or an agent pointed at this URL sees exactly
 * what the dashboard shows. Aggregates only; the spine has no PII by design.
 * Auth is a bearer `REPORTING_API_KEY`, separate from the cron secret so it
 * can be handed out and rotated on its own.
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
  const channel = url.searchParams.get("channel");

  try {
    const data = await getChannelsTab({ range, channel });
    return NextResponse.json(
      { ok: true, generatedAt: new Date().toISOString(), ...data },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("reporting api: channels failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : undefined,
    });
    return NextResponse.json(
      { ok: false, message: "Report could not be built." },
      { status: 500 },
    );
  }
}
