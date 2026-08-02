import { describe, expect, it, vi } from "vitest";
import {
  checkPublicRateLimit,
  prunePublicRequestHits,
  requestIp,
  type PublicRateLimitDeps,
} from "./public-rate-limit";

type RateLimitClient = NonNullable<PublicRateLimitDeps["client"]>;

type Hit = {
  action: string;
  ip: string | null;
  email_hash: string | null;
  occurred_at: string;
};

/**
 * A fake that actually evaluates the filters rather than recording the call
 * shape: the window bound and the IP-or-email `or` are the whole point of this
 * module, and a fake that answers a fixed count would pass with either of them
 * missing.
 */
function fakeClient(rows: Hit[] = []) {
  const state = { rows, inserts: [] as Hit[], deleted: 0 };

  function matcher() {
    let predicates: Array<(row: Hit) => boolean> = [];
    const chain = {
      eq(column: keyof Hit, value: string) {
        predicates.push((row) => row[column] === value);
        return chain;
      },
      gte(column: keyof Hit, value: string) {
        predicates.push((row) => String(row[column]) >= value);
        return chain;
      },
      lt(column: keyof Hit, value: string) {
        predicates.push((row) => String(row[column]) < value);
        return chain;
      },
      or(filter: string) {
        // PostgREST `or=(a.eq.1,b.eq.2)`: any term may match.
        const terms = filter.split(",").map((term) => {
          // Only the first two dots are separators — the value is an IPv4
          // address or a hex digest and keeps its own.
          const parts = term.split(".");
          const column = parts[0] as keyof Hit;
          const value = parts.slice(2).join(".");
          return (row: Hit) => row[column] === value;
        });
        predicates.push((row) => terms.some((term) => term(row)));
        return chain;
      },
      matched() {
        return state.rows.filter((row) =>
          predicates.every((predicate) => predicate(row)),
        );
      },
      reset() {
        predicates = [];
      },
    };
    return chain;
  }

  const client = {
    from(table: string) {
      if (table !== "public_request_hits") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select(_columns: string, options?: { count?: string; head?: boolean }) {
          const chain = matcher();
          return Object.assign(chain, {
            then(
              resolve: (value: {
                count: number | null;
                error: null;
              }) => unknown,
            ) {
              return resolve({
                count: options?.count ? chain.matched().length : null,
                error: null,
              });
            },
          });
        },
        insert(row: Hit) {
          state.inserts.push(row);
          state.rows.push(row);
          return Promise.resolve({ error: null });
        },
        delete() {
          const chain = matcher();
          return Object.assign(chain, {
            then(resolve: (value: { error: null }) => unknown) {
              const doomed = chain.matched();
              state.deleted = doomed.length;
              state.rows = state.rows.filter((row) => !doomed.includes(row));
              return resolve({ error: null });
            },
          });
        },
      };
    },
  } as unknown as RateLimitClient;

  return { state, client };
}

const NOW = new Date("2026-08-01T12:00:00.000Z");
const now = () => NOW;

function hit(overrides: Partial<Hit> = {}): Hit {
  return {
    action: "lead_submit",
    ip: "203.0.113.9",
    email_hash: null,
    occurred_at: NOW.toISOString(),
    ...overrides,
  };
}

describe("checkPublicRateLimit", () => {
  it("allows a request below the limit and records it", async () => {
    const fake = fakeClient();

    const allowed = await checkPublicRateLimit(
      "lead_submit",
      { ip: "203.0.113.9", email: "jane@example.com" },
      { client: fake.client, now },
    );

    expect(allowed).toBe(true);
    expect(fake.state.inserts).toHaveLength(1);
    // The address itself never reaches the table.
    expect(fake.state.inserts[0]?.email_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(fake.state.inserts[0])).not.toContain("jane@");
  });

  it("blocks once the window is full and does not record the blocked attempt", async () => {
    const fake = fakeClient(Array.from({ length: 8 }, () => hit()));

    const allowed = await checkPublicRateLimit(
      "lead_submit",
      { ip: "203.0.113.9", email: "jane@example.com" },
      { client: fake.client, now },
    );

    expect(allowed).toBe(false);
    expect(fake.state.inserts).toHaveLength(0);
  });

  it("counts a repeat email from a fresh IP, so rotating the network buys nothing", async () => {
    const earlier = Array.from({ length: 7 }, () =>
      hit({ ip: "198.51.100.1", email_hash: null }),
    );
    const fake = fakeClient([...earlier]);
    // The eighth attempt fits, and its row reveals the hash this address
    // produces — the earlier seven were the same person, so backfill it.
    await checkPublicRateLimit(
      "lead_submit",
      { ip: "198.51.100.1", email: "jane@example.com" },
      { client: fake.client, now },
    );
    const emailHash = fake.state.inserts[0]?.email_hash ?? null;
    expect(emailHash).not.toBeNull();
    for (const row of earlier) row.email_hash = emailHash;

    const allowed = await checkPublicRateLimit(
      "lead_submit",
      { ip: "192.0.2.55", email: "JANE@example.com" },
      { client: fake.client, now },
    );

    expect(allowed).toBe(false);
  });

  it("ignores hits that fell out of the window", async () => {
    const stale = new Date(NOW.getTime() - 11 * 60 * 1000).toISOString();
    const fake = fakeClient(
      Array.from({ length: 20 }, () => hit({ occurred_at: stale })),
    );

    const allowed = await checkPublicRateLimit(
      "lead_submit",
      { ip: "203.0.113.9", email: null },
      { client: fake.client, now },
    );

    expect(allowed).toBe(true);
  });

  it("does not spend one action's budget on another", async () => {
    const fake = fakeClient(
      Array.from({ length: 20 }, () => hit({ action: "attribution_event" })),
    );

    const allowed = await checkPublicRateLimit(
      "lead_submit",
      { ip: "203.0.113.9", email: null },
      { client: fake.client, now },
    );

    expect(allowed).toBe(true);
  });

  it("fails open when the table is missing, so a submit is never lost to the limiter", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              or: () =>
                Promise.resolve({
                  count: null,
                  error: {
                    message: 'relation "public_request_hits" does not exist',
                  },
                }),
            }),
          }),
        }),
      }),
    } as unknown as RateLimitClient;

    const allowed = await checkPublicRateLimit(
      "lead_submit",
      { ip: "203.0.113.9", email: "jane@example.com" },
      { client: broken, now },
    );

    expect(allowed).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("allows a request that carries neither an IP nor an email rather than keying on nothing", async () => {
    const fake = fakeClient(Array.from({ length: 50 }, () => hit()));

    const allowed = await checkPublicRateLimit(
      "lead_submit",
      { ip: null, email: "" },
      { client: fake.client, now },
    );

    expect(allowed).toBe(true);
    expect(fake.state.inserts).toHaveLength(0);
  });
});

describe("prunePublicRequestHits", () => {
  it("drops hits past the 24-hour retention window and keeps the rest", async () => {
    const old = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString();
    const fake = fakeClient([
      hit({ occurred_at: old }),
      hit({ occurred_at: old }),
      hit(),
    ]);

    await prunePublicRequestHits({ client: fake.client, now });

    expect(fake.state.deleted).toBe(2);
  });
});

describe("requestIp", () => {
  it("prefers x-real-ip and otherwise takes the first forwarded hop", () => {
    expect(requestIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
    expect(
      requestIp(new Headers({ "x-forwarded-for": "203.0.113.9, 70.0.0.1" })),
    ).toBe("203.0.113.9");
    expect(requestIp(new Headers())).toBeNull();
  });
});
