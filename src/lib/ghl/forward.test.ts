import { describe, expect, it, vi } from "vitest";
import {
  buildGhlForwardEvent,
  buildGhlForwardPayload,
  forwardLeadToGhl,
  ghlForwardConfigured,
  ghlFormTypeFor,
  GhlForwardConfigError,
  GhlForwardError,
  ghlForwardPayloadSchema,
  queueGhlForward,
  resolveGhlForwardTarget,
  type GhlForwardInput,
} from "./forward";

const bookingLead: GhlForwardInput = {
  formType: "booking",
  fullName: "Mary Anne Van Der Berg",
  email: "mary@example.com",
  phone: "+15415550123",
  submittedAt: "2026-09-22T17:00:00.000Z",
  sourcePage: "/booking-youtube",
  utmSource: "youtube",
  utmMedium: "video",
  utmCampaign: "buy-first-machine",
  utmContent: "desc-link-1",
  gclid: null,
  fbclid: null,
};

const applicationLead: GhlForwardInput = {
  ...bookingLead,
  formType: "application",
  fullName: "Tom Ford",
  email: "tom@example.com",
  city: "Phoenix",
  stateRegion: "Arizona",
  businessStage: "Researching vending",
  budget: "$5k-$10k",
  timeline: "Immediately",
  message: "  ",
};

function buildFetch(status = 200, body = "{}") {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init: init ?? {} });
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => body,
      } as unknown as Response;
    },
  );
  return { fetchImpl, calls };
}

describe("buildGhlForwardPayload", () => {
  it("sends exactly the agreed contract and nothing else", () => {
    const payload = buildGhlForwardPayload(bookingLead);

    expect(Object.keys(payload).sort()).toEqual(
      [
        "budget",
        "business_stage",
        "city",
        "email",
        "fbclid",
        "first_name",
        "form_type",
        "gclid",
        "last_name",
        "message",
        "phone",
        "source_page",
        "state",
        "submitted_at",
        "timeline",
        "utm_campaign",
        "utm_content",
        "utm_medium",
        "utm_source",
        "utm_term",
      ].sort(),
    );
  });

  it("never carries session ids, referrers, landing urls or the user agent", () => {
    const serialized = JSON.stringify(
      buildGhlForwardPayload({
        ...applicationLead,
        // Fields a caller could plausibly pass by mistake are not in the input
        // type at all; this asserts nothing leaks through the values either.
        message: "vp_session_id d3face65 https://www.youtube.com/",
      }),
    );

    expect(serialized).not.toContain("user_agent");
    expect(serialized).not.toContain("attribution_session");
    expect(serialized).not.toContain("landing");
    expect(serialized).not.toContain("referrer");
    expect(serialized).not.toContain("close_lead_id");
  });

  it("keeps every application key present on a booking submission", () => {
    const payload = buildGhlForwardPayload(bookingLead);

    // GHL builds its field mapping from one sample request, so a key that
    // appeared only on application submissions would be unmappable.
    expect(payload.business_stage).toBeNull();
    expect(payload.budget).toBeNull();
    expect(payload.timeline).toBeNull();
    expect(payload.city).toBeNull();
    expect(payload.state).toBeNull();
    expect(payload.message).toBeNull();
  });

  it("splits the first token off the single name field", () => {
    expect(buildGhlForwardPayload(bookingLead).first_name).toBe("Mary");
    expect(buildGhlForwardPayload(bookingLead).last_name).toBe(
      "Anne Van Der Berg",
    );
    const single = buildGhlForwardPayload({ ...bookingLead, fullName: "Cher" });
    expect(single.first_name).toBe("Cher");
    expect(single.last_name).toBe("");
  });

  it("treats a whitespace-only value as absent", () => {
    expect(buildGhlForwardPayload(applicationLead).message).toBeNull();
  });

  it("produces a payload the drain will accept back", () => {
    expect(
      ghlForwardPayloadSchema.safeParse(buildGhlForwardPayload(bookingLead))
        .success,
    ).toBe(true);
  });
});

describe("ghlFormTypeFor", () => {
  it("never forwards a newsletter signup", () => {
    expect(ghlFormTypeFor("newsletter")).toBeNull();
    expect(ghlFormTypeFor("apply")).toBe("application");
    expect(ghlFormTypeFor("contact")).toBe("booking");
  });
});

describe("resolveGhlForwardTarget", () => {
  it("is off until credentials exist", () => {
    expect(ghlForwardConfigured({})).toBe(false);
    expect(ghlForwardConfigured({ WESCALE_GHL_TOKEN: "pit-x" })).toBe(false);
    expect(
      ghlForwardConfigured({
        WESCALE_GHL_TOKEN: "pit-x",
        WESCALE_GHL_LOCATION_ID: "loc1",
      }),
    ).toBe(true);
  });

  it("prefers the webhook when both are configured", () => {
    const target = resolveGhlForwardTarget({
      WESCALE_GHL_WEBHOOK_URL: "https://hooks.example.com/abc",
      WESCALE_GHL_TOKEN: "pit-x",
      WESCALE_GHL_LOCATION_ID: "loc1",
    });
    expect(target).toEqual({
      mode: "webhook",
      url: "https://hooks.example.com/abc",
    });
  });

  it("rejects malformed field ids rather than sending unmapped data", () => {
    expect(() =>
      resolveGhlForwardTarget({
        WESCALE_GHL_TOKEN: "pit-x",
        WESCALE_GHL_LOCATION_ID: "loc1",
        WESCALE_GHL_FIELD_IDS: "not json",
      }),
    ).toThrow(GhlForwardConfigError);
  });
});

describe("forwardLeadToGhl", () => {
  it("posts the payload verbatim to a webhook", async () => {
    const { fetchImpl, calls } = buildFetch();
    const payload = buildGhlForwardPayload(bookingLead);

    await forwardLeadToGhl(
      payload,
      { mode: "webhook", url: "https://hooks.example.com/abc" },
      fetchImpl,
    );

    expect(calls[0].url).toBe("https://hooks.example.com/abc");
    expect(JSON.parse(String(calls[0].init.body))).toEqual(payload);
  });

  it("upserts through the documented v2 contract", async () => {
    const { fetchImpl, calls } = buildFetch();

    await forwardLeadToGhl(
      buildGhlForwardPayload(applicationLead),
      {
        mode: "api",
        token: "pit-secret",
        locationId: "loc1",
        fieldIds: { utm_source: "cf_utm", budget: "cf_budget" },
      },
      fetchImpl,
    );

    const headers = calls[0].init.headers as Record<string, string>;
    expect(calls[0].url).toBe(
      "https://services.leadconnectorhq.com/contacts/upsert",
    );
    expect(headers.Version).toBe("2021-07-28");
    expect(headers.Authorization).toBe("Bearer pit-secret");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.locationId).toBe("loc1");
    expect(body.firstName).toBe("Tom");
    expect(body.city).toBe("Phoenix");
    // Only mapped fields travel: an id we were never given is not guessed at.
    expect(body.customFields).toEqual([
      { id: "cf_utm", key: "utm_source", field_value: "youtube" },
      { id: "cf_budget", key: "budget", field_value: "$5k-$10k" },
    ]);
  });

  it("throws on a non-2xx so the queue retries", async () => {
    const { fetchImpl } = buildFetch(401, "Invalid token");

    await expect(
      forwardLeadToGhl(
        buildGhlForwardPayload(bookingLead),
        { mode: "webhook", url: "https://hooks.example.com/abc" },
        fetchImpl,
      ),
    ).rejects.toBeInstanceOf(GhlForwardError);
  });
});

describe("queueGhlForward", () => {
  const client = (error: { code?: string; message?: string } | null) => {
    const inserted: unknown[] = [];
    return {
      inserted,
      supabase: {
        from: () => ({
          insert: (row: unknown) => {
            inserted.push(row);
            return {
              select: () => ({ single: async () => ({ error }) }),
            };
          },
        }),
      } as never,
    };
  };

  const input = {
    leadSubmissionId: "lead-1",
    formType: "contact" as const,
    nowIso: "2026-09-22T17:00:00.000Z",
    lead: bookingLead,
  };

  it("queues nothing at all until credentials are set", async () => {
    const { supabase, inserted } = client(null);
    await expect(queueGhlForward(supabase, input, { env: {} })).resolves.toBe(
      "disabled",
    );
    expect(inserted).toHaveLength(0);
  });

  it("skips a newsletter signup", async () => {
    const { supabase, inserted } = client(null);
    const result = await queueGhlForward(
      supabase,
      { ...input, formType: "newsletter" },
      { env: { WESCALE_GHL_WEBHOOK_URL: "https://hooks.example.com/abc" } },
    );
    expect(result).toBe("skipped");
    expect(inserted).toHaveLength(0);
  });

  it("queues one forward per lead, forever", async () => {
    const { supabase } = client(null);
    const result = await queueGhlForward(supabase, input, {
      env: { WESCALE_GHL_WEBHOOK_URL: "https://hooks.example.com/abc" },
    });
    expect(result).toBe("queued");

    const duplicate = client({ code: "23505" });
    await expect(
      queueGhlForward(duplicate.supabase, input, {
        env: { WESCALE_GHL_WEBHOOK_URL: "https://hooks.example.com/abc" },
      }),
    ).resolves.toBe("exists");
  });

  it("never fails the submit when the queue insert fails", async () => {
    const { supabase } = client({ code: "23514", message: "check violation" });
    await expect(
      queueGhlForward(supabase, input, {
        env: { WESCALE_GHL_WEBHOOK_URL: "https://hooks.example.com/abc" },
      }),
    ).resolves.toBe("failed");
  });
});

describe("buildGhlForwardEvent", () => {
  it("carries no Close ids and its own dedupe key", () => {
    const event = buildGhlForwardEvent({
      leadSubmissionId: "lead-1",
      payload: buildGhlForwardPayload(bookingLead),
      nowIso: "2026-09-22T17:00:00.000Z",
    });

    expect(event.event_type).toBe("ghl_forward");
    expect(event.dedupe_key).toBe("ghl_forward:lead-1");
    expect(event.close_lead_id).toBeNull();
    expect(event.close_contact_id).toBeNull();
    expect(event.status).toBe("pending");
  });
});
