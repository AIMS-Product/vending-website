/**
 * Proposed file in AIMS-Product/vending-website:
 * src/app/api/reporting/call-forecast/route.ts
 *
 * Read-only wrapper around the existing booking definition and attribution.
 * No new ingestion, classification, attribution policy, or database writes.
 */
import { NextResponse } from "next/server";
import { hasValidBearer } from "@/lib/bearer-auth";
import { config } from "@/lib/config";
import {
  attributionFor,
  readBookedMetric,
  REPORTING_TIME_ZONE,
} from "@/lib/services/booked-metrics";
import {
  fetchBookings,
  fetchFunnels,
} from "@/lib/services/booked-metrics-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const headers = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  if (!config.REPORTING_API_KEY) {
    return NextResponse.json(
      { ok: false, message: "Reporting API is not configured." },
      { status: 503, headers },
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
      { status: 401, headers },
    );
  }

  try {
    // Capture the day before the read. A request spanning Eastern midnight
    // returns the old day and the Mac rejects it, instead of misdating a result.
    const now = new Date();
    const day = now.toLocaleDateString("en-CA", {
      timeZone: REPORTING_TIME_ZONE,
    });
    const client = createAdminClient();
    const [bookings, funnels] = await Promise.all([
      fetchBookings(client, day),
      fetchFunnels(client),
    ]);
    if (bookings === null || funnels === null) {
      return NextResponse.json(
        { ok: false, message: "Bookings data could not be read." },
        { status: 503, headers },
      );
    }
    const input = { bookings, funnels, day, timeZone: REPORTING_TIME_ZONE };
    const metric = readBookedMetric("newBookedOn", input);
    const channels = attributionFor(input, {
      onlyClass: "new",
      excludeLaneTwo: true,
    });
    if (
      metric.value === null ||
      channels.reduce((sum, row) => sum + row.booked, 0) !== metric.value
    ) {
      return NextResponse.json(
        { ok: false, message: "Booking totals could not be reconciled." },
        { status: 503, headers },
      );
    }
    return NextResponse.json(
      {
        schemaVersion: 1,
        ok: true,
        day,
        timeZone: REPORTING_TIME_ZONE,
        basis: metric.metric.basis,
        metricKey: metric.metric.key,
        scope: "marketing",
        cancellationsIncluded: true,
        generatedAt: new Date().toISOString(),
        // Request time is not the upstream sync time. Never invent freshness.
        sourceUpdatedAt: null,
        total: metric.value,
        channels: channels.map(({ label, booked }) => ({ label, booked })),
        coverage: {
          unreviewed: metric.coverage.unreviewed,
          undatable: metric.coverage.undatable,
          noCloseMatch: metric.coverage.noCloseMatch,
          laneTwoExcluded: metric.coverage.laneTwoExcluded,
        },
      },
      { headers },
    );
  } catch {
    // No raw rows, credentials, exception messages, or PII in the API response.
    return NextResponse.json(
      { ok: false, message: "Booking report could not be built." },
      { status: 500, headers },
    );
  }
}
