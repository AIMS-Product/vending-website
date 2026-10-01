import type { Event } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import {
  SENTRY_PII_PARAMS,
  scrubBreadcrumb,
  scrubEvent,
  scrubUrl,
} from "./sentry-scrub";

describe("SENTRY_PII_PARAMS", () => {
  it("covers every identifying param the funnel links carry", () => {
    for (const key of [
      "email",
      "phone",
      "first_name",
      "last_name",
      "name",
      "full_name",
      "first",
    ]) {
      expect(SENTRY_PII_PARAMS).toContain(key);
    }
  });
});

describe("scrubUrl", () => {
  it("filters PII values and keeps every other param", () => {
    expect(
      scrubUrl(
        "https://vendingpreneurs.com/playbook?utm_source=fb&email=a%40b.com&phone=%2B15551234567&full_name=Ann+Lee#top",
      ),
    ).toBe(
      "https://vendingpreneurs.com/playbook?utm_source=fb&email=[Filtered]&phone=[Filtered]&full_name=[Filtered]#top",
    );
  });

  it("filters ?first= on the confirmed page", () => {
    expect(scrubUrl("/masterclass-confirmed?first=Adam")).toBe(
      "/masterclass-confirmed?first=[Filtered]",
    );
  });

  it("filters a bare query string and is case-insensitive on keys", () => {
    expect(scrubUrl("EMAIL=a@b.com&name=Ann&utm_medium=x")).toBe(
      "EMAIL=[Filtered]&name=[Filtered]&utm_medium=x",
    );
  });

  it("filters inside a span description", () => {
    expect(scrubUrl("GET /playbook?first_name=Ann&last_name=Lee")).toBe(
      "GET /playbook?first_name=[Filtered]&last_name=[Filtered]",
    );
  });

  it("leaves params that only contain a PII key as a suffix", () => {
    expect(scrubUrl("/x?firstname_hint=1&myemail=2&first_seen=3")).toBe(
      "/x?firstname_hint=1&myemail=2&first_seen=3",
    );
  });

  it("leaves a URL without PII unchanged", () => {
    const url = "https://vendingpreneurs.com/contact?utm_source=google";
    expect(scrubUrl(url)).toBe(url);
  });
});

describe("scrubBreadcrumb", () => {
  it("scrubs fetch urls and navigation from/to without mutating", () => {
    const crumb = {
      category: "navigation",
      data: {
        from: "/masterclass?email=a@b.com",
        to: "/masterclass-confirmed?first=Ann",
        status_code: 200,
      },
    };
    const out = scrubBreadcrumb(crumb);
    expect(out.data).toEqual({
      from: "/masterclass?email=[Filtered]",
      to: "/masterclass-confirmed?first=[Filtered]",
      status_code: 200,
    });
    expect(crumb.data.from).toBe("/masterclass?email=a@b.com");
  });
});

describe("scrubEvent", () => {
  it("scrubs request url, query string, spans and trace data", () => {
    const event: Event = {
      transaction: "GET /playbook?email=a@b.com",
      request: {
        url: "https://vendingpreneurs.com/playbook?email=a@b.com&utm_source=x",
        query_string: [
          ["email", "a@b.com"],
          ["utm_source", "x"],
        ],
        headers: { Referer: "https://x.test/?phone=555" },
      },
      spans: [
        {
          span_id: "1",
          trace_id: "t",
          start_timestamp: 0,
          description: "GET /masterclass-confirmed?first=Ann",
          data: { "url.full": "https://x.test/?last_name=Lee", count: 2 },
        },
      ],
      contexts: {
        trace: {
          span_id: "1",
          trace_id: "t",
          data: { "http.query": "?full_name=Ann+Lee" },
        },
      },
    };
    const out = scrubEvent(event);
    expect(out.transaction).toBe("GET /playbook?email=[Filtered]");
    expect(out.request?.url).toBe(
      "https://vendingpreneurs.com/playbook?email=[Filtered]&utm_source=x",
    );
    expect(out.request?.query_string).toEqual([
      ["email", "[Filtered]"],
      ["utm_source", "x"],
    ]);
    expect(out.request?.headers?.Referer).toBe(
      "https://x.test/?phone=[Filtered]",
    );
    expect(out.spans?.[0]?.description).toBe(
      "GET /masterclass-confirmed?first=[Filtered]",
    );
    expect(out.spans?.[0]?.data).toEqual({
      "url.full": "https://x.test/?last_name=[Filtered]",
      count: 2,
    });
    expect(out.contexts?.trace?.data).toEqual({
      "http.query": "?full_name=[Filtered]",
    });
    // Input untouched.
    expect(event.request?.url).toContain("a@b.com");
  });

  it("scrubs an object query string", () => {
    const out = scrubEvent({
      request: { query_string: { phone: "555", page: "2" } },
    });
    expect(out.request?.query_string).toEqual({
      phone: "[Filtered]",
      page: "2",
    });
  });

  it("passes an event with nothing to scrub through", () => {
    const event: Event = { message: "boom" };
    expect(scrubEvent(event)).toEqual(event);
  });
});

describe("scrubEvent, every field", () => {
  const dirty =
    "https://x.test/p?email=a%40b.com&phone=5415550101&utm_source=x";
  const event: Event = {
    message: `failed at ${dirty}`,
    logentry: { message: "bad %s", params: [dirty] },
    exception: { values: [{ type: "Error", value: `GET ${dirty} 500` }] },
    extra: { list: [{ url: dirty }, [dirty]], deep: { a: { b: dirty } } },
    tags: { page: dirty },
    contexts: { app: { url: dirty } },
    breadcrumbs: [{ message: dirty, data: { to: dirty, arr: [dirty] } }],
    request: { url: dirty, headers: { Referer: dirty } },
  };

  it("leaves no PII in any field and does not mutate the input", () => {
    const before = JSON.stringify(event);
    const out = scrubEvent(event);
    const json = JSON.stringify(out);
    for (const p of ["a%40b.com", "5415550101"]) expect(json).not.toContain(p);
    expect(json).toContain("utm_source=x");
    expect(JSON.stringify(event)).toBe(before);
  });

  it("scrubs encoded and nested-url variants", () => {
    expect(scrubUrl("/r?next=%2Fm%3Femail%3Da%40b.com%26utm_source%3Dx")).toBe(
      "/r?next=%2Fm%3Femail%3D[Filtered]%26utm_source%3Dx",
    );
  });
});
