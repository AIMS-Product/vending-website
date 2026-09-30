import { describe, expect, it, vi } from "vitest";
import {
  INTAKE_FIELD_IDS,
  registerWebinarContact,
  saveWebinarIntake,
  SITE_REGISTRATION_TAG,
  SMS_CONSENT_FIELD_ID,
  UTM_FIELD_IDS,
  webinarEventTag,
  WebinarRegistrationError,
} from "./webinar-registration";

const person = {
  firstName: "Mary",
  lastName: "Berg",
  email: "mary@example.com",
  phone: "+15415550123",
  attribution: {
    utm_source: "meta",
    utm_content: "120251367443830338",
    utm_term: "",
    fbclid: "abc",
  },
  eventTag: "webinar-oct6",
};
const auth = {
  token: "pit-test",
  locationId: "loc1",
  sleep: async () => {},
  now: () => new Date("2026-10-01T15:00:00.000Z"),
};
const CONSENT = {
  id: SMS_CONSENT_FIELD_ID,
  field_value: "Yes, vendingpreneurs.com/masterclass 2026-10-01T15:00:00.000Z",
};

type Call = { method: string; url: string; body: unknown };

/** Scripted GHL: each route answers from the map; every call is recorded. */
function ghl(routes: {
  duplicate?: unknown;
  upsert?: unknown;
  rawBody?: Partial<Record<string, string>>;
  status?: Partial<Record<string, number[]>>;
}) {
  const calls: Call[] = [];
  const statusQueues = Object.fromEntries(
    Object.entries(routes.status ?? {}).map(([k, v]) => [k, [...(v ?? [])]]),
  );
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const method = init.method ?? "GET";
    const route = url.includes("/search/duplicate")
      ? "duplicate"
      : url.endsWith("/contacts/upsert")
        ? "upsert"
        : `${method} tags`;
    calls.push({
      method,
      url,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const status = statusQueues[route]?.shift() ?? 200;
    const raw = routes.rawBody?.[route];
    if (raw !== undefined) return new Response(raw, { status });
    const json =
      route === "duplicate"
        ? { contact: routes.duplicate ?? null }
        : route === "upsert"
          ? (routes.upsert ?? { new: true, contact: { id: "c1", tags: [] } })
          : { tags: [] };
    return new Response(JSON.stringify(json), { status });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe("webinarEventTag", () => {
  it("matches the tags on record, not zero-padded, roller month keys", () => {
    expect(webinarEventTag("October 6, 2026 at 7:30 PM CDT")).toBe(
      "webinar-oct6",
    );
    expect(webinarEventTag("September 8, 2026 Tuesday at 7:30 PM CDT")).toBe(
      "webinar-sept8",
    );
    expect(webinarEventTag("March 10, 2027 at 7:30 PM CST")).toBe(
      "webinar-march10",
    );
    expect(webinarEventTag("TBD")).toBeNull();
  });
});

describe("registerWebinarContact", () => {
  it("creates a new contact with source + UTMs, then adds the trigger tag", async () => {
    const { calls, fetchImpl } = ghl({});
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).resolves.toEqual({ outcome: "registered", contactId: "c1" });

    expect(calls.map((c) => `${c.method} ${c.url.split("?")[0]}`)).toEqual([
      "GET https://services.leadconnectorhq.com/contacts/search/duplicate",
      "POST https://services.leadconnectorhq.com/contacts/upsert",
      "DELETE https://services.leadconnectorhq.com/contacts/c1/tags",
      "POST https://services.leadconnectorhq.com/contacts/c1/tags",
    ]);
    const upsert = calls[1].body as Record<string, unknown>;
    expect(upsert).toMatchObject({
      locationId: "loc1",
      firstName: "Mary",
      lastName: "Berg",
      email: "mary@example.com",
      phone: "+15415550123",
      source: "Site Masterclass Registration",
    });
    // Tags never ride on the upsert: it would overwrite the contact's tags.
    expect(upsert).not.toHaveProperty("tags");
    // Blank UTMs are not sent, so they cannot blank earlier attribution.
    expect(upsert.customFields).toEqual([
      { id: UTM_FIELD_IDS.utm_source, field_value: "meta" },
      { id: UTM_FIELD_IDS.utm_content, field_value: "120251367443830338" },
      CONSENT,
    ]);
    expect(calls[3].body).toEqual({ tags: [SITE_REGISTRATION_TAG] });
  });

  it("never rewrites a returning contact's source, name or phone", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: {
        id: "c1",
        tags: ["webinar-sept29"],
        firstName: "Mary",
        lastName: "",
        phone: "+15415550000",
      },
    });
    await registerWebinarContact(person, { ...auth, fetchImpl });
    const upsert = calls[1].body as Record<string, unknown>;
    expect(upsert).not.toHaveProperty("source");
    expect(upsert).not.toHaveProperty("firstName");
    expect(upsert).not.toHaveProperty("phone");
    // Only fields the contact is missing are filled.
    expect(upsert.lastName).toBe("Berg");
  });

  it("does not send an empty last name", async () => {
    const { calls, fetchImpl } = ghl({});
    await registerWebinarContact(
      { ...person, lastName: "" },
      { ...auth, fetchImpl },
    );
    expect(calls[1].body).not.toHaveProperty("lastName");
  });

  it("strips spreadsheet formula prefixes", async () => {
    const { calls, fetchImpl } = ghl({});
    await registerWebinarContact(
      { ...person, attribution: { utm_campaign: "=HYPERLINK(1)" } },
      { ...auth, fetchImpl },
    );
    expect(
      (calls[1].body as { customFields: unknown[] }).customFields[0],
    ).toEqual({ id: UTM_FIELD_IDS.utm_campaign, field_value: "HYPERLINK(1)" });
  });

  it("always removes then adds the trigger tag, even when the upsert omits tags", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: { id: "c1", tags: [SITE_REGISTRATION_TAG] },
      upsert: { new: false, contact: { id: "c1" } },
    });
    await registerWebinarContact(person, { ...auth, fetchImpl });
    expect(calls.slice(2).map((c) => c.method)).toEqual(["DELETE", "POST"]);
    expect(calls[2].body).toEqual({ tags: [SITE_REGISTRATION_TAG] });
  });

  it("fails closed when the upsert lands on a different contact", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: { id: "c1", tags: [] },
      upsert: { new: false, contact: { id: "c2", tags: [] } },
    });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).rejects.toMatchObject({ step: "upsert", status: 409 });
    expect(calls.some((c) => c.url.includes("/tags"))).toBe(false);
  });

  it("never resends a write whose 2xx body is unreadable", async () => {
    const { calls, fetchImpl } = ghl({ rawBody: { upsert: "<html>" } });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).rejects.toMatchObject({ step: "upsert" });
    expect(calls.filter((c) => c.url.endsWith("/upsert"))).toHaveLength(1);
  });

  it("accepts an empty 2xx body on the tag calls", async () => {
    const { fetchImpl } = ghl({ rawBody: { "DELETE tags": "" } });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).resolves.toEqual({ outcome: "registered", contactId: "c1" });
  });

  it("does not re-trigger someone already registered for this event", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: { id: "c1", tags: ["webinar-registrant", "webinar-oct6"] },
    });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).resolves.toEqual({ outcome: "already-registered", contactId: "c1" });
    expect(calls).toHaveLength(1);
  });

  it("still registers when the event tag is unknown", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: { id: "c1", tags: ["webinar-oct6"] },
    });
    await expect(
      registerWebinarContact(
        { ...person, eventTag: null },
        { ...auth, fetchImpl },
      ),
    ).resolves.toEqual({ outcome: "registered", contactId: "c1" });
    expect(calls).toHaveLength(4);
  });

  it("retries one transient failure", async () => {
    const { calls, fetchImpl } = ghl({ status: { upsert: [502] } });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).resolves.toEqual({ outcome: "registered", contactId: "c1" });
    expect(calls.filter((c) => c.url.endsWith("/upsert"))).toHaveLength(2);
  });

  it("waits out a GHL burst limit, as long as GHL asks (capped)", async () => {
    const waits: number[] = [];
    const { calls, fetchImpl } = ghl({ status: { upsert: [429, 429] } });
    await expect(
      registerWebinarContact(person, {
        ...auth,
        fetchImpl,
        sleep: async (ms) => {
          waits.push(ms);
        },
      }),
    ).resolves.toEqual({ outcome: "registered", contactId: "c1" });
    expect(calls.filter((c) => c.url.endsWith("/upsert"))).toHaveLength(3);
    expect(waits).toEqual([1500, 1500]);
  });

  it("fails closed when GHL keeps failing, and never tags a contact it could not save", async () => {
    const { calls, fetchImpl } = ghl({ status: { upsert: [500, 500, 500] } });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).rejects.toBeInstanceOf(WebinarRegistrationError);
    expect(calls.some((c) => c.url.includes("/tags"))).toBe(false);
  });

  it("does not retry a 4xx", async () => {
    const { calls, fetchImpl } = ghl({ status: { "POST tags": [422] } });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).rejects.toMatchObject({ status: 422, step: "add-tag" });
    expect(
      calls.filter((c) => c.method === "POST" && c.url.includes("/tags")),
    ).toHaveLength(1);
  });

  it("fails closed when the upsert answer has no contact id", async () => {
    const { fetchImpl } = ghl({ upsert: { new: true } });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).rejects.toMatchObject({ step: "upsert" });
  });
});

describe("saveWebinarIntake", () => {
  const answers = {
    situation: "I have a full-time job and want to build side income",
    timeline: "Right now",
    income: "$56,000 - $90,000",
  };
  function put(statuses: number[] = []) {
    const calls: Call[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({
        method: init.method ?? "GET",
        url,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      return new Response("{}", { status: statuses.shift() ?? 200 });
    });
    return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
  }

  it("PUTs only the three intake custom fields onto the contact", async () => {
    const { calls, fetchImpl } = put();
    await saveWebinarIntake("c1", answers, { ...auth, fetchImpl });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toBe(
      "https://services.leadconnectorhq.com/contacts/c1",
    );
    expect(calls[0].body).toEqual({
      customFields: [
        { id: INTAKE_FIELD_IDS.situation, field_value: answers.situation },
        { id: INTAKE_FIELD_IDS.timeline, field_value: "Right now" },
        { id: INTAKE_FIELD_IDS.income, field_value: "$56,000 - $90,000" },
      ],
    });
  });

  it("retries a transient failure, never a 4xx", async () => {
    const retried = put([502]);
    await saveWebinarIntake("c1", answers, {
      ...auth,
      fetchImpl: retried.fetchImpl,
    });
    expect(retried.calls).toHaveLength(2);

    const refused = put([400]);
    await expect(
      saveWebinarIntake("c1", answers, {
        ...auth,
        fetchImpl: refused.fetchImpl,
      }),
    ).rejects.toMatchObject({ step: "intake", status: 400 });
    expect(refused.calls).toHaveLength(1);
  });

  it("fails closed after three transient failures", async () => {
    const { calls, fetchImpl } = put([500, 500, 500]);
    await expect(
      saveWebinarIntake("c1", answers, { ...auth, fetchImpl }),
    ).rejects.toBeInstanceOf(WebinarRegistrationError);
    expect(calls).toHaveLength(3);
  });
});
