import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import { runNoBookFollowupCron } from "./no-book-followup";
import {
  bookingLink,
  buildFollowupEmail,
  calendarFor,
  skipReason,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from "./no-book-followup-plan";
import { THANK_YOU_LINKS } from "@/lib/qualification/thank-you-links";

vi.mock("server-only", () => ({}));

type LeadRow = Tables<"lead_submissions">;

const NOW = new Date("2026-10-26T18:00:00.000Z");

function lead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "lead-1",
    full_name: "Jane Doe",
    email: "jane@example.com",
    qualification_summary: { qualification_thank_you_state: "strong_fit" },
    metadata: {},
    call_booked_at: null,
    utm_source: "youtube",
    utm_medium: "video",
    utm_campaign: "fall",
    created_at: "2026-10-26T17:30:00.000Z",
    ...overrides,
  } as LeadRow;
}

describe("skipReason", () => {
  it("sends step 1 to a fresh unbooked lead", () => {
    const l = lead();
    expect(skipReason(l, [l], 1)).toBeNull();
  });

  it("stops on a booking, unsubscribe or explicit no recorded on ANY row of the person", () => {
    const l = lead();
    expect(
      skipReason(l, [l, lead({ id: "2", call_booked_at: "2026-10-27" })], 1),
    ).toBe("booked");
    expect(
      skipReason(
        l,
        [l, lead({ id: "2", metadata: { nbf_unsubscribed_at: "x" } })],
        1,
      ),
    ).toBe("unsubscribed");
    expect(
      skipReason(l, [lead({ qualification_summary: { consent: false } })], 1),
    ).toBe("declined_contact");
  });

  it("treats an unanswered consent (booking pages never ask) as not a no", () => {
    const l = lead({ qualification_summary: {} });
    expect(skipReason(l, [l], 1)).toBeNull();
  });

  it("skips disqualified leads", () => {
    const l = lead({
      qualification_summary: { qualification_band: "disqualify" },
    });
    expect(skipReason(l, [l], 1)).toBe("disqualified");
  });

  it("never sends a step twice to one person, even from a second form fill", () => {
    const second = lead({ id: "2" });
    expect(
      skipReason(
        second,
        [lead({ metadata: { nbf_step1_at: "x" } }), second],
        1,
      ),
    ).toBe("already_sent");
  });

  it("requires the previous step before step 2 or 3", () => {
    const l = lead();
    expect(skipReason(l, [l], 2)).toBe("previous_step_missing");
    const after1 = lead({ metadata: { nbf_step1_at: "x" } });
    expect(skipReason(after1, [after1], 2)).toBeNull();
  });
});

describe("links", () => {
  it("routes each fit state to the calendar the site offers it", () => {
    expect(
      calendarFor(
        lead({
          qualification_summary: {
            qualification_thank_you_state: "perfect_fit",
          },
        }),
      ),
    ).toBe(THANK_YOU_LINKS.lane1TopCalendlyUrl);
    expect(
      calendarFor(
        lead({
          qualification_summary: {
            qualification_thank_you_state: "good_potential",
          },
        }),
      ),
    ).toBe(THANK_YOU_LINKS.setterCalendlyUrl);
    expect(
      calendarFor(
        lead({
          qualification_summary: {
            qualification_thank_you_state: "not_right_time",
          },
        }),
      ),
    ).toBe(THANK_YOU_LINKS.setterCalendlyUrl);
    expect(calendarFor(lead({ qualification_summary: {} }))).toBe(
      THANK_YOU_LINKS.lane1CalendlyUrl,
    );
  });

  it("prefills the person and keeps their channel, marking only utm_content", () => {
    const url = new URL(bookingLink(lead(), 2));
    expect(url.searchParams.get("email")).toBe("jane@example.com");
    expect(url.searchParams.get("name")).toBe("Jane Doe");
    expect(url.searchParams.get("utm_source")).toBe("youtube");
    expect(url.searchParams.get("utm_campaign")).toBe("fall");
    expect(url.searchParams.get("utm_content")).toBe("nbf-step2");
  });

  it("signs unsubscribe links per address", () => {
    const t = unsubscribeToken("Jane@Example.com", "s3cret");
    expect(verifyUnsubscribeToken("jane@example.com", t, "s3cret")).toBe(true);
    expect(verifyUnsubscribeToken("other@example.com", t, "s3cret")).toBe(
      false,
    );
    expect(verifyUnsubscribeToken("jane@example.com", t, "other")).toBe(false);
  });
});

describe("buildFollowupEmail", () => {
  const links = {
    booking: "https://calendly.com/x?a=1&b=2",
    unsubscribe: "https://u",
    mailingAddress: "PO Box 1, Town, ST 00000",
  };

  it("carries the booking link, address and unsubscribe in both parts, with no dashes or claims", () => {
    for (const step of [1, 2, 3] as const) {
      const email = buildFollowupEmail(lead(), step, links);
      expect(email.text).toContain(links.booking);
      expect(email.text).toContain(links.mailingAddress);
      expect(email.text).toContain(links.unsubscribe);
      expect(email.html).toContain("https://calendly.com/x?a=1&amp;b=2");
      expect(`${email.subject}${email.text}`).not.toMatch(/[–—$]|\d+%/);
    }
  });

  it("falls back to a neutral greeting for an odd name", () => {
    expect(
      buildFollowupEmail(lead({ full_name: "<b>x</b>" }), 1, links).text,
    ).toContain("Hi there,");
  });
});

function fakeClient(options: {
  candidates: Partial<Record<1 | 2 | 3, LeadRow[]>>;
  history?: LeadRow[];
  bookings?: unknown[];
  historyError?: boolean;
}) {
  const updates: Array<{ id: unknown; metadata: Record<string, unknown> }> = [];
  const from = vi.fn((table: string) => {
    if (table === "calendly_bookings") {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        ilike: () => chain,
        limit: async () => ({ data: options.bookings ?? [], error: null }),
      };
      return chain;
    }
    let step: 1 | 2 | 3 | null = null;
    let isHistory = false;
    const chain: Record<string, unknown> = {
      select: (fields: string) => {
        isHistory = fields.startsWith("id,metadata");
        return chain;
      },
      is: (column: string) => {
        const m = /nbf_step(\d)_at/.exec(column);
        if (m) step = Number(m[1]) as 1 | 2 | 3;
        return chain;
      },
      not: () => chain,
      neq: () => chain,
      or: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      ilike: () => chain,
      limit: async () => {
        if (isHistory) {
          return options.historyError
            ? { data: null, error: { message: "boom" } }
            : { data: options.history ?? [], error: null };
        }
        return { data: (step && options.candidates[step]) ?? [], error: null };
      },
      update: (patch: { metadata: Record<string, unknown> }) => ({
        eq: async (_c: string, id: unknown) => {
          updates.push({ id, metadata: patch.metadata });
          return { error: null };
        },
      }),
    };
    return chain;
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    updates,
  };
}

const ON = {
  enabled: "true",
  mailingAddress: "PO Box 1",
  secret: "s",
  hasResend: true,
  now: () => NOW,
};

describe("runNoBookFollowupCron", () => {
  it("sends nothing unless switched on and fully configured", async () => {
    const { client } = fakeClient({ candidates: { 1: [lead()] } });
    const fetchImpl = vi.fn();
    for (const off of [
      { enabled: undefined },
      { enabled: "1" },
      { mailingAddress: "" },
      { secret: "" },
      { hasResend: false },
    ]) {
      const r = await runNoBookFollowupCron({
        ...ON,
        ...off,
        client,
        fetchImpl,
      });
      expect(r.enabled).toBe(false);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("emails an unbooked lead once and stamps the step", async () => {
    const l = lead();
    const { client, updates } = fakeClient({
      candidates: { 1: [l] },
      history: [l],
    });
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await runNoBookFollowupCron({ ...ON, client, fetchImpl });
    expect(r.sent[1]).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body.to).toEqual(["jane@example.com"]);
    expect(body.headers["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
    expect(updates[0].metadata.nbf_step1_at).toBe(NOW.toISOString());
  });

  it("does not email someone Calendly already shows as booked", async () => {
    const l = lead();
    const { client, updates } = fakeClient({
      candidates: { 1: [l] },
      history: [l],
      bookings: [{ id: "b" }],
    });
    const fetchImpl = vi.fn();
    const r = await runNoBookFollowupCron({ ...ON, client, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.skipped.booked).toBe(1);
    expect(updates[0].metadata.nbf_step1_at).toBe("skipped:booked");
  });

  it("holds off when history cannot be read", async () => {
    const { client, updates } = fakeClient({
      candidates: { 1: [lead()] },
      historyError: true,
    });
    const fetchImpl = vi.fn();
    const r = await runNoBookFollowupCron({ ...ON, client, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
    expect(updates).toHaveLength(0);
  });

  it("leaves a failed send unstamped so the next run retries", async () => {
    const l = lead();
    const { client, updates } = fakeClient({
      candidates: { 1: [l] },
      history: [l],
    });
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const r = await runNoBookFollowupCron({ ...ON, client, fetchImpl });
    expect(r.failed).toBe(1);
    expect(updates).toHaveLength(0);
  });

  it("sends one email per person when two rows share an address", async () => {
    const a = lead();
    const b = lead({ id: "lead-2", email: "JANE@example.com " });
    const { client } = fakeClient({
      candidates: { 1: [a, b] },
      history: [a, b],
    });
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await runNoBookFollowupCron({ ...ON, client, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
