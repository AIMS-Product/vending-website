import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkPublicRateLimit,
  reservePublicRateLimit,
  type PublicRateLimitAction,
  type PublicRateLimitDeps,
} from "./public-rate-limit";

/**
 * Characterization of `reservePublicRateLimit` (insert first, then count) and
 * of the per-action budgets. The existing public-rate-limit.test.ts covers the
 * check-then-insert path; the reserve path guards the admin login and the
 * outbound mailer and had no test at all.
 */

type RateLimitClient = NonNullable<PublicRateLimitDeps["client"]>;

type Hit = {
  id: number;
  action: string;
  ip: string | null;
  email_hash: string | null;
  occurred_at: string;
};

type FakeOptions = {
  insertError?: string;
  countError?: string;
  deleteError?: string;
  /** Throw from `.from()` itself, like an unreachable database. */
  throwOnFrom?: boolean;
};

function fakeClient(seed: Hit[] = [], options: FakeOptions = {}) {
  const state = { rows: [...seed], nextId: 1000, deletedIds: [] as number[] };

  const client = {
    from(table: string) {
      if (options.throwOnFrom) throw new Error("db unreachable");
      expect(table).toBe("public_request_hits");
      return {
        insert(row: Omit<Hit, "id">) {
          const inserted = options.insertError
            ? null
            : { ...row, id: state.nextId++ };
          if (inserted) state.rows.push(inserted);
          const result = {
            data: inserted ? { id: inserted.id } : null,
            error: options.insertError
              ? { message: options.insertError }
              : null,
          };
          return {
            select: () => ({ single: () => Promise.resolve(result) }),
            then: (resolve: (value: unknown) => unknown) => resolve(result),
          };
        },
        select() {
          const predicates: Array<(row: Hit) => boolean> = [];
          const chain = {
            eq(column: keyof Hit, value: unknown) {
              predicates.push((row) => row[column] === value);
              return chain;
            },
            gte(column: keyof Hit, value: string) {
              predicates.push((row) => String(row[column]) >= value);
              return chain;
            },
            or(filter: string) {
              const terms = filter.split(",").map((term) => {
                const parts = term.split(".");
                const column = parts[0] as keyof Hit;
                const value = parts.slice(2).join(".");
                return (row: Hit) => row[column] === value;
              });
              predicates.push((row) => terms.some((term) => term(row)));
              return chain;
            },
            then(resolve: (value: unknown) => unknown) {
              if (options.countError) {
                return resolve({
                  count: null,
                  error: { message: options.countError },
                });
              }
              return resolve({
                count: state.rows.filter((row) =>
                  predicates.every((predicate) => predicate(row)),
                ).length,
                error: null,
              });
            },
          };
          return chain;
        },
        delete() {
          return {
            eq(_column: string, id: number) {
              if (options.deleteError) {
                return Promise.resolve({
                  error: { message: options.deleteError },
                });
              }
              state.deletedIds.push(id);
              state.rows = state.rows.filter((row) => row.id !== id);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  } as unknown as RateLimitClient;

  return { state, client };
}

const NOW = new Date("2026-08-01T12:00:00.000Z");
const now = () => NOW;
const IP = "203.0.113.9";

function seedHits(count: number, overrides: Partial<Hit> = {}): Hit[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    action: "lead_submit",
    ip: IP,
    email_hash: null,
    occurred_at: NOW.toISOString(),
    ...overrides,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reservePublicRateLimit", () => {
  it("inserts its own row first, then counts the window including that row", async () => {
    const { state, client } = fakeClient(seedHits(7));

    const reservation = await reservePublicRateLimit(
      "lead_submit",
      { ip: IP },
      { client, now },
    );

    // 7 existing + ours = 8 = the lead_submit budget: still allowed, because
    // the over-budget test is `count > max`, not `>=`.
    expect(reservation.allowed).toBe(true);
    expect(state.rows).toHaveLength(8);
  });

  it("refuses the request over budget and deletes its own row, not anyone else's", async () => {
    const { state, client } = fakeClient(seedHits(8));

    const reservation = await reservePublicRateLimit(
      "lead_submit",
      { ip: IP },
      { client, now },
    );

    expect(reservation.allowed).toBe(false);
    // The refused attempt must not eat the budget for the next window.
    expect(state.rows).toHaveLength(8);
    expect(state.deletedIds).toEqual([1000]);
    // A refusal hands back a no-op release: nothing further to refund.
    await reservation.release();
    expect(state.deletedIds).toEqual([1000]);
  });

  it("release() refunds the reservation once and only once", async () => {
    const { state, client } = fakeClient();

    const reservation = await reservePublicRateLimit(
      "lead_submit",
      { ip: IP },
      { client, now },
    );
    expect(state.rows).toHaveLength(1);

    await reservation.release();
    await reservation.release();

    expect(state.rows).toHaveLength(0);
    expect(state.deletedIds).toEqual([1000]);
  });

  it("allows a request with neither IP nor email without touching the database", async () => {
    const from = vi.fn();
    const client = { from } as unknown as RateLimitClient;

    const reservation = await reservePublicRateLimit(
      "lead_submit",
      { ip: null, email: "   " },
      { client, now },
    );

    expect(reservation.allowed).toBe(true);
    expect(from).not.toHaveBeenCalled();
    await expect(reservation.release()).resolves.toBeUndefined();
  });

  it("counts a repeat email from a fresh IP against the same budget", async () => {
    // Email is stored as a digest; seed by reserving once so the digest is
    // whatever the module computes.
    const { state, client } = fakeClient();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ok = await reservePublicRateLimit(
        "masterclass_register",
        { ip: `198.51.100.${attempt + 1}`, email: "Buyer@Example.com " },
        { client, now },
      );
      expect(ok.allowed).toBe(true);
    }

    const sixth = await reservePublicRateLimit(
      "masterclass_register",
      { ip: "198.51.100.200", email: "buyer@example.com" },
      { client, now },
    );

    expect(sixth.allowed).toBe(false);
    expect(state.rows).toHaveLength(5);
    // The address itself is never stored.
    expect(JSON.stringify(state.rows)).not.toContain("example.com");
  });

  it("ignores hits older than the action's window", async () => {
    const stale = new Date(NOW.getTime() - 11 * 60 * 1000).toISOString();
    const { client } = fakeClient(seedHits(20, { occurred_at: stale }));

    const reservation = await reservePublicRateLimit(
      "lead_submit",
      { ip: IP },
      { client, now },
    );

    expect(reservation.allowed).toBe(true);
  });

  it("does not spend one action's budget on another", async () => {
    const { client } = fakeClient(seedHits(8, { action: "lead_submit" }));

    const reservation = await reservePublicRateLimit(
      "attribution_event",
      { ip: IP },
      { client, now },
    );

    expect(reservation.allowed).toBe(true);
  });

  it("fails CLOSED when the insert fails, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient([], { insertError: "relation missing" });

    const reservation = await reservePublicRateLimit(
      "chatbot_resource_email",
      { ip: IP },
      { client, now },
    );

    expect(reservation.allowed).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "public rate limit reserve failed closed",
      expect.objectContaining({ action: "chatbot_resource_email" }),
    );
  });

  it("fails CLOSED when the count fails, and refunds the row it just wrote", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { state, client } = fakeClient([], { countError: "timeout" });

    const reservation = await reservePublicRateLimit(
      "chatbot_resource_email",
      { ip: IP },
      { client, now },
    );

    expect(reservation.allowed).toBe(false);
    expect(state.rows).toHaveLength(0);
    expect(state.deletedIds).toEqual([1000]);
  });

  it("fails CLOSED when the database is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient([], { throwOnFrom: true });

    const reservation = await reservePublicRateLimit(
      "chatbot_resource_email",
      { ip: IP },
      { client, now },
    );

    expect(reservation.allowed).toBe(false);
  });

  it("never throws from release(); a failed refund is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient([], { deleteError: "network" });

    const reservation = await reservePublicRateLimit(
      "lead_submit",
      { ip: IP },
      { client, now },
    );
    await expect(reservation.release()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      "public rate limit release failed",
      expect.objectContaining({ action: "lead_submit", error: "network" }),
    );
  });
});

/**
 * The budgets themselves, pinned: the largest number of requests one IP gets
 * through inside a window. A change to any of these is a policy change and
 * should show up in review as an edit to this table.
 */
describe("per-action budgets (requests admitted per window, one IP)", () => {
  const BUDGETS: Array<[PublicRateLimitAction, number]> = [
    ["lead_submit", 8],
    ["masterclass_register_ip", 30],
    ["masterclass_register", 5],
    ["masterclass_register_phone", 5],
    ["masterclass_intake", 10],
    ["qualification_intake", 12],
    ["attribution_event", 60],
    ["chatbot_chat", 60],
    ["chatbot_lead", 10],
    ["chatbot_new_conversation", 15],
    ["chatbot_history", 60],
    ["chatbot_quick_action", 20],
    ["chatbot_booked", 10],
    ["chatbot_resource_email", 4],
    ["admin_login_ip", 20],
    ["admin_login_email", 30],
    ["admin_login_guest", 30],
    ["admin_password_reset_ip", 10],
    ["admin_password_reset_email", 10],
  ];

  it.each(BUDGETS)("%s admits exactly %i, then blocks", async (action, max) => {
    const { client } = fakeClient();
    let admitted = 0;
    for (let attempt = 0; attempt < max + 3; attempt += 1) {
      if (await checkPublicRateLimit(action, { ip: IP }, { client, now })) {
        admitted += 1;
      }
    }
    expect(admitted).toBe(max);
  });

  it("covers every action the module defines", async () => {
    // A new action added to LIMITS without a row above fails here, which is
    // the prompt to decide its budget on purpose.
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("./public-rate-limit.ts", import.meta.url),
        "utf8",
      ),
    );
    const block = source.slice(
      source.indexOf("const LIMITS = {"),
      source.indexOf("} as const;"),
    );
    const defined = [...block.matchAll(/^ {2}(\w+): \{ windowMs/gm)].map(
      (match) => match[1],
    );
    expect(defined.sort()).toEqual(BUDGETS.map(([action]) => action).sort());
  });
});
