import { describe, expect, it, vi } from "vitest";
import { createGhlClient, GhlApiError } from "./client";

type Handler = (url: string) => { status: number; body: unknown };

function buildFetch(handler: Handler) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      calls.push({ url, headers: init?.headers as Record<string, string> });
      const handled = handler(url);
      return {
        ok: handled.status >= 200 && handled.status < 300,
        status: handled.status,
        text: async () => JSON.stringify(handled.body),
      } as unknown as Response;
    },
  );
  return { fetchImpl, calls };
}

const client = (handler: Handler) => {
  const { fetchImpl, calls } = buildFetch(handler);
  return {
    calls,
    ghl: createGhlClient({
      apiKey: "pit-test",
      locationId: "loc1",
      fetchImpl,
      sleep: async () => {},
    }),
  };
};

describe("createGhlClient", () => {
  it("sends the bearer, a real User-Agent and the endpoint's Version header", async () => {
    const { ghl, calls } = client(() => ({
      status: 200,
      body: {
        workflows: [
          { id: "w1", name: "Webinar follow-up", status: "published" },
        ],
      },
    }));
    const workflows = await ghl.listWorkflows();
    expect(workflows).toEqual([
      { id: "w1", name: "Webinar follow-up", status: "published" },
    ]);
    expect(calls[0]?.url).toBe(
      "https://services.leadconnectorhq.com/workflows/?locationId=loc1",
    );
    expect(calls[0]?.headers).toMatchObject({
      Authorization: "Bearer pit-test",
      Version: "2021-07-28",
    });
    expect(calls[0]?.headers["User-Agent"]).toMatch(/vendingpreneurs/);
  });

  it("reads workflow email stats from the v3 emails endpoint", async () => {
    const { ghl, calls } = client(() => ({
      status: 200,
      body: {
        stats: {
          sent: 10,
          delivered: 9,
          opened: 4,
          clicked: 2,
          replied: 1,
          openRate: 44,
        },
      },
    }));
    expect(await ghl.fetchWorkflowEmailStats("w1")).toEqual({
      sent: 10,
      delivered: 9,
      opened: 4,
      clicked: 2,
      replied: 1,
    });
    expect(calls[0]?.url).toBe(
      "https://services.leadconnectorhq.com/emails/locations/loc1/campaigns/stats/workflow-campaigns/w1",
    );
    expect(calls[0]?.headers.Version).toBe("v3");
  });

  it("walks form submission pages until meta.nextPage is null", async () => {
    const { ghl, calls } = client((url) => {
      const page = new URL(url).searchParams.get("page");
      return page === "1"
        ? {
            status: 200,
            body: {
              submissions: [
                {
                  id: "s1",
                  formId: "f1",
                  createdAt: "2026-09-10T01:00:00.000Z",
                },
              ],
              meta: { total: 2, currentPage: 1, nextPage: 2 },
            },
          }
        : {
            status: 200,
            body: {
              submissions: [
                {
                  id: "s2",
                  formId: "f1",
                  createdAt: "2026-09-11T01:00:00.000Z",
                },
              ],
              meta: { total: 2, currentPage: 2, nextPage: null },
            },
          };
    });
    const rows = await ghl.fetchFormSubmissions({
      startAt: "2026-09-09",
      endAt: "2026-09-11",
    });
    expect(rows.map((row) => row.id)).toEqual(["s1", "s2"]);
    expect(calls).toHaveLength(2);
    expect(new URL(calls[0]!.url).searchParams.get("startAt")).toBe(
      "2026-09-09",
    );
  });

  it("retries Cloudflare 52x and gives up on a real 4xx", async () => {
    let attempts = 0;
    const flaky = client(() => {
      attempts += 1;
      return attempts < 3
        ? { status: 520, body: "" }
        : { status: 200, body: { forms: [], total: 0 } };
    });
    expect(await flaky.ghl.listForms()).toEqual([]);
    expect(attempts).toBe(3);

    const denied = client(() => ({
      status: 403,
      body: { message: "Forbidden" },
    }));
    await expect(denied.ghl.listForms()).rejects.toBeInstanceOf(GhlApiError);
    expect(denied.calls).toHaveLength(1);
  });
});
