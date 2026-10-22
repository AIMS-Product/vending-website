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

/** Calendar-date arithmetic avoids changing the Eastern day at UTC midnight or DST. */
function datesInWeek(day: string): string[] {
  const monday = new Date(`${day}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
}

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
    const weekDates = datesInWeek(day);
    const client = createAdminClient();
    const [bookings, funnels] = await Promise.all([
      fetchBookings(client, weekDates[0]),
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
    const dailyMetrics = weekDates.map((date) =>
      date > day
        ? null
        : date === day
          ? metric
          : readBookedMetric("newBookedOn", { ...input, day: date }),
    );
    if (
      dailyMetrics.some((result) => result !== null && result.value === null)
    ) {
      return NextResponse.json(
        { ok: false, message: "Weekly booking totals could not be verified." },
        { status: 503, headers },
      );
    }
    const week = {
      start: weekDates[0],
      end: weekDates[6],
      total: dailyMetrics.reduce(
        (sum, result) => sum + (result?.value ?? 0),
        0,
      ),
      days: weekDates.map((date, index) => ({
        date,
        total: dailyMetrics[index]?.value ?? null,
      })),
      coverage: {
        unreviewed: dailyMetrics.reduce(
          (sum, result) => sum + (result?.coverage.unreviewed ?? 0),
          0,
        ),
        // Undated rows cannot be assigned to any week. Report the source gap once.
        undatable: metric.coverage.undatable,
        noCloseMatch: dailyMetrics.reduce(
          (sum, result) => sum + (result?.coverage.noCloseMatch ?? 0),
          0,
        ),
        laneTwoExcluded: dailyMetrics.reduce(
          (sum, result) => sum + (result?.coverage.laneTwoExcluded ?? 0),
          0,
        ),
      },
    };
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
        week,
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
