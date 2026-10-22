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
    // Current scorecard week plus four completed Monday–Friday periods.
    const scorecardDates = Array.from({ length: 5 }, (_, index) => {
      const at = new Date(`${weekDates[0]}T12:00:00Z`);
      at.setUTCDate(at.getUTCDate() - (4 - index) * 7);
      return datesInWeek(at.toISOString().slice(0, 10)).slice(0, 5);
    });
    const client = createAdminClient();
    const [bookings, funnels] = await Promise.all([
      fetchBookings(client, scorecardDates[0][0]),
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
    const metrics = new Map([[day, metric]]);
    function period(dates: string[]) {
      const dailyMetrics = dates.map((date) => {
        if (date > day) return null;
        let result = metrics.get(date);
        if (!result) {
          result = readBookedMetric("newBookedOn", { ...input, day: date });
          metrics.set(date, result);
        }
        return result;
      });
      return {
        start: dates[0],
        end: dates[dates.length - 1],
        total: dailyMetrics.reduce(
          (sum, result) => sum + (result?.value ?? 0),
          0,
        ),
        days: dates.map((date, index) => ({
          date,
          total: dailyMetrics[index]?.value ?? null,
        })),
        coverage: {
          unreviewed: dailyMetrics.reduce(
            (sum, result) => sum + (result?.coverage.unreviewed ?? 0),
            0,
          ),
          // Undated rows cannot be assigned to a week. Report the source gap once.
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
    }
    // Preserve the original seven-day extension for older Mac clients.
    const week = period(weekDates);
    const scorecard = {
      weekdays: "monday-friday",
      timeZone: REPORTING_TIME_ZONE,
      weeks: scorecardDates.map(period),
    };
    if ([...metrics.values()].some((result) => result.value === null)) {
      return NextResponse.json(
        { ok: false, message: "Weekly booking totals could not be verified." },
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
        week,
        scorecard,
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
