import { describe, expect, it } from "vitest";
import { collapseToLeads, lookbackStart } from "./lead-definition";

type Row = {
  email: string;
  created_at: string;
  full_name: string;
  lifecycle_status?: string | null;
  call_booked_at?: string | null;
  source_path?: string;
};

const row = (
  email: string,
  created_at: string,
  extra: Partial<Row> = {},
): Row => ({ email, created_at, full_name: "Pat Buyer", ...extra });

describe("collapseToLeads", () => {
  it("counts one person twice in one week as one lead, keeping the first row", () => {
    const leads = collapseToLeads([
      row("pat@buyer.com", "2026-08-02T10:00:00Z", {
        source_path: "/book-now",
      }),
      row("Pat@Buyer.com ", "2026-08-01T10:00:00Z", {
        source_path: "/contact",
      }),
    ]);
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ source_path: "/contact" });
  });

  it("folds a booking made from the repeat row onto the lead", () => {
    const [lead] = collapseToLeads([
      row("pat@buyer.com", "2026-08-01T10:00:00Z", { call_booked_at: null }),
      row("pat@buyer.com", "2026-08-03T10:00:00Z", {
        call_booked_at: "2026-08-03T11:00:00Z",
        lifecycle_status: "qualified",
      }),
    ]);
    expect(lead.call_booked_at).toBe("2026-08-03T11:00:00Z");
    expect(lead.lifecycle_status).toBe("qualified");
  });

  it("counts the same person again after a gap longer than 30 days", () => {
    const leads = collapseToLeads([
      row("pat@buyer.com", "2026-07-01T10:00:00Z"),
      row("pat@buyer.com", "2026-08-15T10:00:00Z"),
    ]);
    expect(leads).toHaveLength(2);
  });

  it("chains: each repeat extends the 30 days", () => {
    const leads = collapseToLeads([
      row("pat@buyer.com", "2026-07-01T10:00:00Z"),
      row("pat@buyer.com", "2026-07-25T10:00:00Z"),
      row("pat@buyer.com", "2026-08-20T10:00:00Z"),
    ]);
    expect(leads).toHaveLength(1);
  });

  it("drops newsletter signups and internal rows unless internal is asked for", () => {
    const rows = [
      row("reader@buyer.com", "2026-08-01T10:00:00Z", {
        lifecycle_status: "newsletter_subscribed",
      }),
      row("test@example.com", "2026-08-01T10:00:00Z"),
      row("pat@buyer.com", "2026-08-01T10:00:00Z"),
    ];
    expect(collapseToLeads(rows)).toHaveLength(1);
    expect(collapseToLeads(rows, { includeInternal: true })).toHaveLength(2);
  });

  it("does not modify its input", () => {
    const first = row("pat@buyer.com", "2026-08-01T10:00:00Z", {
      call_booked_at: null,
    });
    collapseToLeads([
      first,
      row("pat@buyer.com", "2026-08-02T10:00:00Z", {
        call_booked_at: "2026-08-02T11:00:00Z",
      }),
    ]);
    expect(first.call_booked_at).toBeNull();
  });

  it("looks back 30 days", () => {
    expect(lookbackStart("2026-08-31T00:00:00.000Z").toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });
});
