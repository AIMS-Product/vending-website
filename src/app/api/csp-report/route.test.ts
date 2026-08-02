import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function reportRequest(body: unknown) {
  return new Request("https://www.vendingpreneurs.com/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": "application/csp-report" },
    body: JSON.stringify(body),
  });
}

function legacyReport(overrides: Record<string, string> = {}) {
  return {
    "csp-report": {
      "document-uri": "https://www.vendingpreneurs.com/qualify/secret-token",
      "effective-directive": "script-src",
      "blocked-uri": "https://tracker.example.com/loader.js?uid=abc",
      ...overrides,
    },
  };
}

describe("csp report collector", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The route's dedupe Set is module-level and deliberately outlives a single
    // request, so each case below uses a host the earlier ones did not.
    vi.restoreAllMocks();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("logs a distinct violation once and drops the repeats", async () => {
    const first = await POST(reportRequest(legacyReport()));
    const second = await POST(
      reportRequest(
        legacyReport({
          "blocked-uri": "https://tracker.example.com/loader.js?uid=different",
        }),
      ),
    );

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    // Same directive, same host — one line, however much traffic arrives.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "csp report-only violation",
      expect.objectContaining({
        directive: "script-src",
        blocked: "https://tracker.example.com",
      }),
    );
  });

  it("never logs the reporting page's full URL, which can carry a session token", async () => {
    await POST(
      reportRequest(
        legacyReport({ "blocked-uri": "https://fresh-host.example.com/x.js" }),
      ),
    );

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain("secret-token");
    expect(logged).toContain("https://www.vendingpreneurs.com");
  });

  it("reads the Reporting API array shape as well as the legacy wrapper", async () => {
    await POST(
      reportRequest([
        {
          type: "csp-violation",
          body: {
            documentURL: "https://www.vendingpreneurs.com/",
            effectiveDirective: "connect-src",
            blockedURL: "https://beacon.example.com/collect",
          },
        },
      ]),
    );

    expect(warn).toHaveBeenCalledWith(
      "csp report-only violation",
      expect.objectContaining({
        directive: "connect-src",
        blocked: "https://beacon.example.com",
      }),
    );
  });

  it("keeps bare keyword violations like inline and eval readable", async () => {
    await POST(
      reportRequest(
        legacyReport({
          "blocked-uri": "inline",
          "effective-directive": "style-src",
        }),
      ),
    );

    expect(warn).toHaveBeenCalledWith(
      "csp report-only violation",
      expect.objectContaining({ directive: "style-src", blocked: "inline" }),
    );
  });

  it("answers 204 for junk instead of arguing with the browser", async () => {
    const notJson = new Request(
      "https://www.vendingpreneurs.com/api/csp-report",
      { method: "POST", body: "<not json>" },
    );

    expect((await POST(notJson)).status).toBe(204);
    expect((await POST(reportRequest({ nothing: true }))).status).toBe(204);
    expect(warn).not.toHaveBeenCalled();
  });
});
