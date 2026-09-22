import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CloseMonthlyReport } from "./close-monthly-funnel-data";
import { buildCloseMonthlyFunnel } from "./close-monthly-funnel";
import { lastClosedMonth, monthOverMonthChecks } from "./data-audit-mom-checks";

const now = new Date("2026-09-22T12:30:00.000Z");

const fieldDefinitions = [
  { id: "cf_booked", name: "First Sales Call Booked Date" },
  { id: "cf_funnel", name: "Funnel Name DEAL (Opp)" },
];

const closeLead = (
  id: string,
  status: string,
  funnel: string,
  wonCents: number[] = [],
) => ({
  id,
  status_label: status,
  "custom.cf_funnel": funnel,
  opportunities: [
    ...wonCents.map((value) => ({ status_type: "won", value })),
    { status_type: "lost", value: 999_900 },
  ],
});

function fakeClose(leads: unknown[]) {
  return {
    listCustomFields: async () => ({ data: fieldDefinitions }),
    // Two pages, so the cursor loop is exercised.
    searchLeads: async (body: Record<string, unknown>) =>
      body.cursor
        ? { data: leads.slice(1), cursor: null }
        : { data: leads.slice(0, 1), cursor: "next" },
  } as never;
}

function fakeDb(leadRows: Array<Record<string, unknown>>) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "gte", "lte", "order"]) {
    chain[method] = () => chain;
  }
  chain.range = async () => ({ data: leadRows, error: null });
  return { from: () => chain } as unknown as Pick<
    SupabaseClient<Database>,
    "from"
  >;
}

const lead = (email: string, utm_source: string, day: string) => ({
  email,
  created_at: `${day}T15:00:00Z`,
  full_name: "Pat Buyer",
  lifecycle_status: null,
  utm_source,
  utm_medium: null,
  metadata: {},
});

/** The tab as it loads: two won YouTube calls in August, $5,997 and $3,000. */
function tab(leads: Map<string, number>): () => Promise<CloseMonthlyReport> {
  const call = (leadId: string, funnel: string, status: string) => ({
    leadId,
    funnel,
    status,
    bookedDate: "2026-08-10",
    showUp: "Yes",
    qualified: "Yes",
  });
  return async () => ({
    ok: true,
    from: "2026-01-01",
    to: "2026-09-22",
    mirrorSyncedAt: null,
    leadsError: null,
    funnel: buildCloseMonthlyFunnel({
      calls: [
        call("l1", "YouTube", "🏆 Closed / Won"),
        call("l2", "YouTube", "🏆 Closed / Won"),
        call("l3", "YouTube", "💔 Lost"),
      ],
      today: "2026-09-22",
      leads,
      leadsFrom: "2026-07-06",
      dealValueByLead: new Map([
        ["l1", 5997],
        ["l2", 3000],
      ]),
    }),
  });
}

const byCheck = (results: Awaited<ReturnType<typeof monthOverMonthChecks>>) =>
  Object.fromEntries(results.map((result) => [result.checkId, result]));

describe("lastClosedMonth", () => {
  it("is the calendar month before the one running", () => {
    expect(lastClosedMonth(now)).toMatchObject({
      key: "2026-08",
      from: "2026-08-01",
      exclusiveEnd: "2026-09-01",
    });
    expect(lastClosedMonth(new Date("2026-01-05T00:00:00Z")).key).toBe(
      "2025-12",
    );
  });
});

describe("month-over-month checks", () => {
  const closeLeads = [
    closeLead("l1", "🏆 Closed / Won", "YouTube", [599_700]),
    closeLead("l2", "🏆 Closed / Won", "YouTube", [300_000]),
    closeLead("l3", "💔 Lost", "YouTube"),
    // Won, but the tab leaves the quiz funnel out; so must the check.
    closeLead("l4", "🏆 Closed / Won", "LTF - Quiz Funnel", [100_000]),
  ];

  it("passes when the tab's won, revenue and leads match their sources", async () => {
    const results = byCheck(
      await monthOverMonthChecks(
        fakeDb([lead("a@buyers.test.io", "youtube", "2026-08-03")]),
        fakeClose(closeLeads),
        now,
        tab(new Map([["2026-08|YouTube", 1]])),
      ),
    );
    expect(results["mom-won"]).toMatchObject({
      status: "pass",
      ours: 2,
      source: 2,
    });
    expect(results["mom-revenue"]).toMatchObject({
      status: "pass",
      ours: 8997,
      source: 8997,
    });
    expect(results["mom-leads"]).toMatchObject({ status: "pass", ours: 0 });
    // A mismatch the other way proves the lead above was actually compared.
    const shownTwice = byCheck(
      await monthOverMonthChecks(
        fakeDb([lead("a@buyers.test.io", "youtube", "2026-08-03")]),
        fakeClose(closeLeads),
        now,
        tab(new Map([["2026-08|YouTube", 2]])),
      ),
    );
    expect(shownTwice["mom-leads"].detail).toContain(
      "YouTube: 1 stored, 2 shown",
    );
  });

  it("fails when Close holds a win the tab does not show", async () => {
    const results = byCheck(
      await monthOverMonthChecks(
        fakeDb([]),
        fakeClose([
          ...closeLeads,
          closeLead("l5", "🏆 Closed / Won", "Website", [200_000]),
        ]),
        now,
        tab(new Map()),
      ),
    );
    expect(results["mom-won"]).toMatchObject({ ours: 2, source: 3 });
    expect(results["mom-won"].status).not.toBe("pass");
    expect(results["mom-revenue"].status).not.toBe("pass");
  });

  // Production, 2026-08: seven Newsletter leads were stored but the grid had
  // no Mike Newsletter row that month (no call booked), so they showed nowhere.
  it("fails when stored leads have no cell on the grid", async () => {
    const results = byCheck(
      await monthOverMonthChecks(
        fakeDb([
          lead("a@buyers.test.io", "youtube", "2026-08-03"),
          lead("b@buyers.test.io", "newsletter", "2026-08-04"),
          lead("c@buyers.test.io", "trustpilot", "2026-08-05"),
        ]),
        fakeClose(closeLeads),
        now,
        tab(new Map([["2026-08|YouTube", 1]])),
      ),
    );
    expect(results["mom-leads"]).toMatchObject({ status: "fail", ours: 1 });
    expect(results["mom-leads"].detail).toContain(
      "Newsletter: 1 stored, 0 shown",
    );
    expect(results["mom-leads"].detail).toContain("by design");
  });

  it("reports nothing when Close is not configured", async () => {
    await expect(
      monthOverMonthChecks(fakeDb([]), null, now, tab(new Map())),
    ).resolves.toEqual([]);
  });
});
