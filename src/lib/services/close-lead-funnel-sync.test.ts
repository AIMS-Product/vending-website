import { describe, expect, it, vi } from "vitest";
import {
  buildSearchBody,
  FIELD_LABELS,
  mapLead,
  resolveFieldIds,
  syncCloseLeadFunnel,
} from "./close-lead-funnel-sync";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/config", () => ({ config: { CLOSE_API_KEY: undefined } }));

const definitions = Object.entries(FIELD_LABELS).map(([key, name]) => ({
  id: `cf_${key}`,
  name,
  type: "text",
}));

describe("resolveFieldIds", () => {
  it("maps every label to its Close id, case-insensitively", () => {
    const ids = resolveFieldIds(
      definitions.map((d) => ({ ...d, name: d.name.toUpperCase() })),
    );
    expect(ids.bookedDate).toBe("cf_bookedDate");
    expect(ids.setter).toBe("cf_setter");
  });

  it("refuses to run without the booked-date or funnel field", () => {
    expect(() =>
      resolveFieldIds(definitions.filter((d) => d.id !== "cf_bookedDate")),
    ).toThrow(/First Sales Call Booked Date/);
  });
});

describe("buildSearchBody", () => {
  it("asks for leads whose first call was ever booked, with every field", () => {
    const body = buildSearchBody(resolveFieldIds(definitions), "abc");
    const query = body.query as { queries: Array<Record<string, unknown>> };
    expect(query.queries[0]).toEqual({
      type: "object_type",
      object_type: "lead",
    });
    expect(query.queries[1]).toMatchObject({
      field: { custom_field_id: "cf_bookedDate" },
      condition: { type: "exists" },
    });
    const fields = (body._fields as { lead: string[] }).lead;
    expect(fields).toContain("custom.cf_funnel");
    expect(fields).toContain("contacts");
    expect(body.cursor).toBe("abc");
  });
});

describe("mapLead", () => {
  const ids = resolveFieldIds(definitions);

  it("reads flattened custom keys, dates the call, lowercases the email", () => {
    const row = mapLead(
      {
        id: "lead_1",
        display_name: "Ada",
        status_label: "Call Booked",
        date_created: "2026-08-01T10:00:00+00:00",
        contacts: [{ emails: [{ email: " Ada@Example.com " }] }],
        "custom.cf_bookedDate": "2026-08-12T00:00:00+00:00",
        "custom.cf_funnel": "Internal Webinar",
        "custom.cf_showUp": "No",
      },
      ids,
      "2026-09-13T00:00:00.000Z",
    );
    expect(row).toMatchObject({
      lead_id: "lead_1",
      email: "ada@example.com",
      funnel: "Internal Webinar",
      first_sales_call_booked_date: "2026-08-12",
      first_call_show_up: "No",
      setter_name: null,
    });
  });

  it("accepts the nested custom shape too and drops a lead with no id", () => {
    const row = mapLead(
      { id: "lead_2", custom: { cf_funnel: "YouTube" } },
      ids,
      "2026-09-13T00:00:00.000Z",
    );
    expect(row?.funnel).toBe("YouTube");
    expect(row?.first_sales_call_booked_date).toBeNull();
    expect(mapLead({}, ids, "x")).toBeNull();
  });
});

describe("syncCloseLeadFunnel", () => {
  function fakeSupabase() {
    const upserts: unknown[][] = [];
    const runs: unknown[] = [];
    const client = {
      from(table: string) {
        return {
          upsert: async (rows: unknown[]) => {
            if (table !== "close_lead_funnel") throw new Error(table);
            upserts.push(rows);
            return { error: null };
          },
          insert: async (row: unknown) => {
            runs.push(row);
            return { error: null };
          },
        };
      },
    };
    return { client, upserts, runs };
  }

  it("walks every cursor page and upserts one row per lead", async () => {
    const pages = [
      { data: [{ id: "lead_a", "custom.cf_funnel": "YouTube" }], cursor: "p2" },
      { data: [{ id: "lead_b", "custom.cf_funnel": "Website" }], cursor: null },
    ];
    let call = 0;
    const close = {
      listCustomFields: async () => ({ data: definitions }),
      searchLeads: async (body: Record<string, unknown>) => {
        if (call === 1) expect(body.cursor).toBe("p2");
        return pages[call++]!;
      },
    };
    const { client, upserts, runs } = fakeSupabase();
    const outcome = await syncCloseLeadFunnel({
      client: client as never,
      close,
    });
    expect(outcome.error).toBeNull();
    expect(outcome.rowsWritten).toBe(2);
    expect(upserts.flat()).toHaveLength(2);
    expect(runs).toHaveLength(1);
  });

  it("upserts a lead once when the cursor walk reads it twice", async () => {
    // A lead updated mid-crawl shifts page in the newest-first sort and comes
    // back on a page we have already read. Before the dedupe this put two rows
    // with one lead_id into a single upsert and Postgres failed the whole run.
    const pages = [
      {
        data: [
          { id: "lead_a", "custom.cf_funnel": "YouTube" },
          { id: "lead_b", "custom.cf_funnel": "Website" },
        ],
        cursor: "p2",
      },
      {
        data: [{ id: "lead_a", "custom.cf_funnel": "Instagram" }],
        cursor: null,
      },
    ];
    let call = 0;
    const close = {
      listCustomFields: async () => ({ data: definitions }),
      searchLeads: async () => pages[call++]!,
    };
    const { client, upserts } = fakeSupabase();
    const outcome = await syncCloseLeadFunnel({
      client: client as never,
      close,
    });
    expect(outcome.error).toBeNull();
    expect(outcome.rowsWritten).toBe(2);
    const written = upserts.flat() as Array<{
      lead_id: string;
      funnel: string | null;
    }>;
    expect(written.map((row) => row.lead_id)).toEqual(["lead_a", "lead_b"]);
    // First seen wins: the newest-first walk saw YouTube before Instagram.
    expect(written[0]!.funnel).toBe("YouTube");
  });

  it("records a skipped run when Close is not configured", async () => {
    const { client, runs } = fakeSupabase();
    const outcome = await syncCloseLeadFunnel({
      client: client as never,
      close: null,
    });
    expect(outcome.error).toMatch(/^skipped:/);
    expect(runs).toHaveLength(1);
  });
});
