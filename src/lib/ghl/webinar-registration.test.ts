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
  /** Answer to the by-phone lookup (made only when the email finds nobody). */
  duplicateByPhone?: unknown;
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
      ? url.includes("number=")
        ? "duplicate-phone"
        : "duplicate"
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
        : route === "duplicate-phone"
          ? { contact: routes.duplicateByPhone ?? null }
          : route === "upsert"
            ? (routes.upsert ?? { new: true, contact: { id: "c1", tags: [] } })
            : { tags: [] };
    return new Response(JSON.stringify(json), { status });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const upsertBody = (calls: Call[]) =>
  calls.find((c) => c.url.endsWith("/contacts/upsert"))?.body as Record<
    string,
    unknown
  >;

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
    ).resolves.toEqual({
      outcome: "registered",
      contactId: "c1",
      ownsContact: true,
    });

    expect(calls.map((c) => `${c.method} ${c.url.split("?")[0]}`)).toEqual([
      "GET https://services.leadconnectorhq.com/contacts/search/duplicate",
      "GET https://services.leadconnectorhq.com/contacts/search/duplicate",
      "POST https://services.leadconnectorhq.com/contacts/upsert",
      "DELETE https://services.leadconnectorhq.com/contacts/c1/tags",
      "POST https://services.leadconnectorhq.com/contacts/c1/tags",
    ]);
    const upsert = upsertBody(calls) as Record<string, unknown>;
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
    expect(calls.at(-1)?.body).toEqual({ tags: [SITE_REGISTRATION_TAG] });
  });

  it.each([
    [
      "email and phone both match",
      { email: "Mary@Example.com", phone: "(541) 555-0123" },
      true,
    ],
    [
      "phone only differs",
      { email: "mary@example.com", phone: "+15415550000" },
      false,
    ],
    ["stored phone blank", { email: "mary@example.com", phone: "" }, false],
    ["stored email missing", { phone: "+15415550123" }, false],
  ])(
    "owns an existing contact only if email AND phone match: %s",
    async (_l, stored, owns) => {
      for (const tags of [["webinar-oct6"], []]) {
        const { fetchImpl } = ghl({ duplicate: { id: "c1", tags, ...stored } });
        const result = await registerWebinarContact(person, {
          ...auth,
          fetchImpl,
        });
        expect(result.ownsContact).toBe(owns);
      }
    },
  );

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
    expect(upsertBody(calls)).not.toHaveProperty("lastName");
  });

  it("strips spreadsheet formula prefixes", async () => {
    const { calls, fetchImpl } = ghl({});
    await registerWebinarContact(
      { ...person, attribution: { utm_campaign: "=HYPERLINK(1)" } },
      { ...auth, fetchImpl },
    );
    expect(
      (upsertBody(calls) as { customFields: unknown[] }).customFields[0],
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
    ).resolves.toEqual({
      outcome: "registered",
      contactId: "c1",
      ownsContact: true,
    });
  });

  it("does not re-trigger someone already registered for this event", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: { id: "c1", tags: ["webinar-registrant", "webinar-oct6"] },
    });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).resolves.toEqual({
      outcome: "already-registered",
      contactId: "c1",
      ownsContact: false,
    });
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
    ).resolves.toEqual({
      outcome: "registered",
      contactId: "c1",
      ownsContact: false,
    });
    expect(calls).toHaveLength(4);
  });

  it("retries one transient failure", async () => {
    const { calls, fetchImpl } = ghl({ status: { upsert: [502] } });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).resolves.toEqual({
      outcome: "registered",
      contactId: "c1",
      ownsContact: true,
    });
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
    ).resolves.toEqual({
      outcome: "registered",
      contactId: "c1",
      ownsContact: true,
    });
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
  /** Scripted GHL contact read + write; statuses are per method. */
  function contact(
    customFields: { id: string; value: unknown }[] = [],
    status: { GET?: readonly number[]; PUT?: readonly number[] } = {},
    readBody?: string,
  ) {
    const calls: Call[] = [];
    const queues = {
      GET: [...(status.GET ?? [])],
      PUT: [...(status.PUT ?? [])],
    };
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      const method = (init.method ?? "GET") as "GET" | "PUT";
      calls.push({
        method,
        url,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      });
      const code = queues[method]?.shift() ?? 200;
      if (method === "GET") {
        return new Response(
          readBody ?? JSON.stringify({ contact: { id: "c1", customFields } }),
          { status: code },
        );
      }
      return new Response("{}", { status: code });
    });
    return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
  }
  const puts = (calls: Call[]) => calls.filter((c) => c.method === "PUT");

  it("fills all three fields on a contact with no answers, and nothing else", async () => {
    const { calls, fetchImpl } = contact([
      { id: "other", value: "x" },
      { id: INTAKE_FIELD_IDS.timeline, value: "" },
    ]);
    await expect(
      saveWebinarIntake("c1", answers, { ...auth, fetchImpl }),
    ).resolves.toEqual(["situation", "timeline", "income"]);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET https://services.leadconnectorhq.com/contacts/c1",
      "PUT https://services.leadconnectorhq.com/contacts/c1",
    ]);
    expect(calls[1].body).toEqual({
      customFields: [
        { id: INTAKE_FIELD_IDS.situation, field_value: answers.situation },
        { id: INTAKE_FIELD_IDS.timeline, field_value: "Right now" },
        { id: INTAKE_FIELD_IDS.income, field_value: "$56,000 - $90,000" },
      ],
    });
  });

  it("never overwrites an answer already on the contact, and fills the blank ones", async () => {
    const { calls, fetchImpl } = contact([
      { id: INTAKE_FIELD_IDS.situation, value: "Their own answer" },
      { id: INTAKE_FIELD_IDS.income, value: [] },
    ]);
    await expect(
      saveWebinarIntake("c1", answers, { ...auth, fetchImpl }),
    ).resolves.toEqual(["timeline", "income"]);
    expect(puts(calls)[0].body).toEqual({
      customFields: [
        { id: INTAKE_FIELD_IDS.timeline, field_value: "Right now" },
        { id: INTAKE_FIELD_IDS.income, field_value: "$56,000 - $90,000" },
      ],
    });
  });

  it("writes nothing when every answer is already on file", async () => {
    const { calls, fetchImpl } = contact(
      Object.values(INTAKE_FIELD_IDS).map((id) => ({ id, value: "on file" })),
    );
    await expect(
      saveWebinarIntake("c1", answers, { ...auth, fetchImpl }),
    ).resolves.toEqual([]);
    expect(puts(calls)).toHaveLength(0);
  });

  it("fails closed, writing nothing, when the contact cannot be read", async () => {
    for (const [status, body] of [
      [{ GET: [404] }, undefined],
      [{ GET: [500, 500, 500] }, undefined],
      [{}, "<html>"],
      [{}, JSON.stringify({ contact: { id: "c2", customFields: [] } })],
    ] as const) {
      const { calls, fetchImpl } = contact([], status, body);
      await expect(
        saveWebinarIntake("c1", answers, { ...auth, fetchImpl }),
      ).rejects.toMatchObject({ step: "intake-read" });
      expect(puts(calls)).toHaveLength(0);
    }
  });

  it("retries a transient write failure, never a 4xx", async () => {
    const retried = contact([], { PUT: [502] });
    await saveWebinarIntake("c1", answers, {
      ...auth,
      fetchImpl: retried.fetchImpl,
    });
    expect(puts(retried.calls)).toHaveLength(2);

    const refused = contact([], { PUT: [400] });
    await expect(
      saveWebinarIntake("c1", answers, {
        ...auth,
        fetchImpl: refused.fetchImpl,
      }),
    ).rejects.toMatchObject({ step: "intake", status: 400 });
    expect(puts(refused.calls)).toHaveLength(1);
  });

  it("fails closed after three transient write failures", async () => {
    const { calls, fetchImpl } = contact([], { PUT: [500, 500, 500] });
    await expect(
      saveWebinarIntake("c1", answers, { ...auth, fetchImpl }),
    ).rejects.toBeInstanceOf(WebinarRegistrationError);
    expect(puts(calls)).toHaveLength(3);
  });
});

describe("registerWebinarContact: a number another contact holds", () => {
  const victim = {
    id: "victim",
    email: "victim@example.com",
    phone: "+15415550123",
    tags: [],
  };

  it("registers the new email without the number and grants its own session", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: null,
      duplicateByPhone: victim,
      upsert: { new: true, contact: { id: "fresh", tags: [] } },
    });
    const result = await registerWebinarContact(person, { ...auth, fetchImpl });
    const upsert = calls.find((c) => c.url.endsWith("/contacts/upsert"));
    expect(upsert?.body).not.toHaveProperty("phone");
    expect(result).toMatchObject({ contactId: "fresh", ownsContact: true });
  });

  it("refuses when the upsert still lands on the number's owner", async () => {
    const { calls, fetchImpl } = ghl({
      duplicate: null,
      duplicateByPhone: victim,
      upsert: { new: false, contact: victim },
    });
    await expect(
      registerWebinarContact(person, { ...auth, fetchImpl }),
    ).rejects.toBeInstanceOf(WebinarRegistrationError);
    expect(calls.some((c) => c.url.includes("/tags"))).toBe(false);
  });

  it("does not look the number up when the email already matched", async () => {
    const mary = { ...victim, email: person.email };
    const { calls, fetchImpl } = ghl({
      duplicate: mary,
      upsert: { new: false, contact: mary },
    });
    await registerWebinarContact(person, { ...auth, fetchImpl });
    expect(calls.some((c) => c.url.includes("number="))).toBe(false);
  });
});
