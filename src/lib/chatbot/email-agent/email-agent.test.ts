import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  conversationFromRecipients,
  isAllowedRecipient,
  replyAddress,
  stripQuotedReply,
} from "./address";
import { verifySvixSignature } from "./svix";
import { checkCloseBeforeEmail } from "./close-gate";

vi.mock("@/lib/chatbot/close-note", () => ({ resolveCloseLeadId: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const ID = "004bf099-266d-441e-8527-e6d0c0ebfae3";

describe("signed reply address", () => {
  it("round-trips and rejects a forged or foreign address", () => {
    const address = replyAddress(ID, "s3cret");
    expect(conversationFromRecipients([`Mia <${address}>`], "s3cret")).toBe(ID);
    expect(conversationFromRecipients([address], "other")).toBeNull();
    expect(
      conversationFromRecipients(
        [`c-${ID}-0000000000000000@reply.vendingpreneurs.com`],
        "s3cret",
      ),
    ).toBeNull();
    expect(
      conversationFromRecipients(["test@reply.vendingpreneurs.com"], "s3cret"),
    ).toBeNull();
  });

  it("allowlist is exact and empty means nobody", () => {
    expect(
      isAllowedRecipient("Adam@Example.com", "adam@example.com, b@x.com"),
    ).toBe(true);
    expect(isAllowedRecipient("eve@example.com", "adam@example.com")).toBe(
      false,
    );
    expect(isAllowedRecipient("adam@example.com", undefined)).toBe(false);
  });

  it("keeps only the new text of a reply", () => {
    const text =
      "Thursday 2pm works\n\nOn Wed, Nov 4, 2026 at 5:00 PM Mia <x@y.com> wrote:\n> Hi Adam";
    expect(stripQuotedReply(text)).toBe("Thursday 2pm works");
  });
});

describe("svix signature", () => {
  const secret = `whsec_${Buffer.from("key-bytes").toString("base64")}`;
  const sign = (id: string, ts: string, body: string) =>
    createHmac("sha256", Buffer.from("key-bytes"))
      .update(`${id}.${ts}.${body}`)
      .digest("base64");

  it("accepts a valid signature and rejects tampering or replay", () => {
    const now = new Date("2026-11-04T20:00:00Z");
    const ts = String(Math.floor(now.getTime() / 1000));
    const body = '{"type":"email.received"}';
    const signature = `v1,${sign("msg_1", ts, body)}`;
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp: ts,
        signature,
        body,
        now,
      }),
    ).toBe(true);
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp: ts,
        signature,
        body: body + " ",
        now,
      }),
    ).toBe(false);
    const late = new Date(now.getTime() + 10 * 60_000);
    expect(
      verifySvixSignature({
        secret,
        id: "msg_1",
        timestamp: ts,
        signature,
        body,
        now: late,
      }),
    ).toBe(false);
  });
});

describe("Close check before email", () => {
  const now = () => new Date("2026-11-04T20:00:00Z");
  const close = (over: Record<string, unknown> = {}) => ({
    searchContactsByEmail: vi.fn().mockResolvedValue({ data: [] }),
    getLead: vi
      .fn()
      .mockResolvedValue({ id: "lead_1", custom: {}, opportunities: [] }),
    listLeadActivities: vi.fn().mockResolvedValue({ data: [] }),
    ...over,
  });
  const input = { conversationId: ID, email: "adam@example.com" };

  it("sends when nobody on the team has the lead", async () => {
    const out = await checkCloseBeforeEmail(input, {
      close: close() as never,
      resolveLeadId: async () => "lead_1",
      now,
    });
    expect(out.send).toBe(true);
  });

  it("stops when a setter called in the last 72h", async () => {
    const out = await checkCloseBeforeEmail(input, {
      close: close({
        listLeadActivities: vi.fn().mockResolvedValue({
          data: [
            {
              _type: "Call",
              user_name: "Connor",
              date_created: "2026-11-04T10:00:00Z",
            },
          ],
        }),
      }) as never,
      resolveLeadId: async () => "lead_1",
      now,
    });
    expect(out).toEqual({
      send: false,
      reason: expect.stringContaining("Connor"),
    });
  });

  it("stops on a booked date, an opportunity, or a Close outage", async () => {
    const booked = await checkCloseBeforeEmail(input, {
      close: close({
        getLead: vi.fn().mockResolvedValue({
          id: "lead_1",
          custom: { "First Sales Call Booked Date": "2026-11-05" },
          opportunities: [],
        }),
      }) as never,
      resolveLeadId: async () => "lead_1",
      now,
    });
    expect(booked.send).toBe(false);
    const opp = await checkCloseBeforeEmail(input, {
      close: close({
        getLead: vi
          .fn()
          .mockResolvedValue({ id: "lead_1", custom: {}, opportunities: [{}] }),
      }) as never,
      resolveLeadId: async () => "lead_1",
      now,
    });
    expect(opp.send).toBe(false);
    const down = await checkCloseBeforeEmail(input, {
      close: close({
        getLead: vi.fn().mockRejectedValue(new Error("503")),
      }) as never,
      resolveLeadId: async () => "lead_1",
      now,
    });
    expect(down).toEqual({ send: false, reason: "Close could not be checked" });
  });
});
