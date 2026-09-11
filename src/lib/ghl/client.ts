import "server-only";

/**
 * Minimal read-only GoHighLevel v2 client.
 *
 * Every call is a GET. Endpoints and their required `Version` headers were
 * checked against the official OpenAPI files (gohighlevel/highlevel-api-docs,
 * 2026-09-11): workflows and forms take `2021-07-28`; the email campaign stats
 * endpoint lives in the v3 emails app and takes `v3`.
 *
 * GHL sits behind Cloudflare, which answers 1010/403 to a request with no real
 * `User-Agent`. A private integration token (`pit-...`) is the bearer.
 */

const BASE_URL = "https://services.leadconnectorhq.com";
const USER_AGENT =
  "vendingpreneurs-admin/1.0 (+https://www.vendingpreneurs.com)";
const PAGE_LIMIT = 100;
const RETRIES = 3;
/** Cloudflare's own 52x codes mean GHL's edge failed, never that we were wrong. */
const TRANSIENT_STATUS = new Set([
  408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524,
]);

export type GhlWorkflow = { id: string; name: string; status: string };

export type GhlEmailStats = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
};

export type GhlForm = { id: string; name: string };

export type GhlFormSubmission = {
  id: string;
  formId: string;
  /** ISO timestamp. */
  createdAt: string;
};

export type GhlClient = {
  listWorkflows(): Promise<GhlWorkflow[]>;
  fetchWorkflowEmailStats(workflowId: string): Promise<GhlEmailStats>;
  listForms(): Promise<GhlForm[]>;
  /** Every submission with createdAt in [startAt, endAt], dates as YYYY-MM-DD. */
  fetchFormSubmissions(range: {
    startAt: string;
    endAt: string;
  }): Promise<GhlFormSubmission[]>;
};

export class GhlApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GhlApiError";
  }
}

export function createGhlClient(options: {
  apiKey: string;
  locationId: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): GhlClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const { apiKey, locationId } = options;

  async function get<T>(path: string, version: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRIES; attempt += 1) {
      const response = await fetchImpl(`${BASE_URL}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Version: version,
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });
      const text = await response.text();
      if (response.ok) {
        return (text ? JSON.parse(text) : {}) as T;
      }
      // GHL reports an upstream gateway timeout as a 401 "Command timed out".
      const transient =
        TRANSIENT_STATUS.has(response.status) ||
        (response.status === 401 && /command timed out/i.test(text));
      lastError = new GhlApiError(
        `GHL ${response.status} on GET ${path}: ${text.slice(0, 200)}`,
        response.status,
      );
      if (!transient) throw lastError;
      await sleep(500 * 2 ** attempt);
    }
    throw lastError;
  }

  const query = (params: Record<string, string | number | undefined>) =>
    new URLSearchParams(
      Object.entries(params).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, String(value)]],
      ),
    ).toString();

  return {
    async listWorkflows() {
      const body = await get<{ workflows?: GhlWorkflow[] }>(
        `/workflows/?${query({ locationId })}`,
        "2021-07-28",
      );
      return (body.workflows ?? []).map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
      }));
    },

    async fetchWorkflowEmailStats(workflowId) {
      const body = await get<{ stats?: Partial<GhlEmailStats> }>(
        `/emails/locations/${encodeURIComponent(locationId)}/campaigns/stats/workflow-campaigns/${encodeURIComponent(workflowId)}`,
        "v3",
      );
      const stats = body.stats ?? {};
      return {
        sent: stats.sent ?? 0,
        delivered: stats.delivered ?? 0,
        opened: stats.opened ?? 0,
        clicked: stats.clicked ?? 0,
        replied: stats.replied ?? 0,
      };
    },

    async listForms() {
      const forms: GhlForm[] = [];
      for (let skip = 0; ; skip += PAGE_LIMIT) {
        const body = await get<{ forms?: GhlForm[]; total?: number }>(
          `/forms/?${query({ locationId, skip, limit: PAGE_LIMIT })}`,
          "2021-07-28",
        );
        const page = body.forms ?? [];
        forms.push(...page.map((form) => ({ id: form.id, name: form.name })));
        if (page.length < PAGE_LIMIT) return forms;
      }
    },

    async fetchFormSubmissions({ startAt, endAt }) {
      const submissions: GhlFormSubmission[] = [];
      for (let page = 1; ; page += 1) {
        const body = await get<{
          submissions?: GhlFormSubmission[];
          meta?: { nextPage?: number | null };
        }>(
          `/forms/submissions?${query({ locationId, startAt, endAt, page, limit: PAGE_LIMIT })}`,
          "2021-07-28",
        );
        const batch = body.submissions ?? [];
        submissions.push(
          ...batch.map((row) => ({
            id: row.id,
            formId: row.formId,
            createdAt: row.createdAt,
          })),
        );
        if (!body.meta?.nextPage || batch.length === 0) return submissions;
      }
    },
  };
}
