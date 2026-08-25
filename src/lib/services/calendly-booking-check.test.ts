import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  escapeLikePattern,
  hasCalendlyBooking,
} from "./calendly-booking-check";

function buildClient(options: { rows?: unknown[]; error?: boolean } = {}) {
  const patterns: string[] = [];
  const from = vi.fn(() => {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      ilike: (_column: string, pattern: string) => {
        patterns.push(pattern);
        return chain;
      },
      limit: async () => ({
        data: options.error ? null : (options.rows ?? []),
        error: options.error ? { message: "boom" } : null,
      }),
    };
    return chain;
  });
  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    patterns,
  };
}

describe("hasCalendlyBooking", () => {
  it("is false when the lead has no booking", async () => {
    const { client } = buildClient({ rows: [] });
    await expect(
      hasCalendlyBooking(client, { id: "lead-1", email: "a@b.com" }),
    ).resolves.toBe(false);
  });

  it("is true when a booking row exists", async () => {
    const { client } = buildClient({ rows: [{ id: "book-1" }] });
    await expect(
      hasCalendlyBooking(client, { id: "lead-1", email: "a@b.com" }),
    ).resolves.toBe(true);
  });

  it("throws rather than guessing not-booked when the read fails", async () => {
    // Guessing "not booked" puts a lead who has already booked in front of a
    // rep, which is the trust-burning outcome both callers exist to avoid.
    const { client } = buildClient({ error: true });
    await expect(
      hasCalendlyBooking(client, { id: "lead-1", email: "a@b.com" }),
    ).rejects.toThrow(/bookings/i);
  });

  it("does not treat an underscore in an address as a wildcard", async () => {
    const { client, patterns } = buildClient({ rows: [] });
    await hasCalendlyBooking(client, {
      id: "lead-1",
      email: "john_doe@x.com",
    });
    // Unescaped, this would also match johnXdoe@x.com and silently suppress a
    // genuine follow-up.
    expect(patterns[0]).toBe("john\\_doe@x.com");
  });

  it("skips the email lookup entirely when there is no address", async () => {
    const { client, patterns } = buildClient({ rows: [] });
    await hasCalendlyBooking(client, { id: "lead-1", email: null });
    expect(patterns).toHaveLength(0);
  });
});

describe("escapeLikePattern", () => {
  it("neutralises both LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern("a_b%c")).toBe("a\\_b\\%c");
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
    expect(escapeLikePattern("plain@example.com")).toBe("plain@example.com");
  });
});
