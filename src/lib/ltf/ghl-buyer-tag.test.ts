import { describe, expect, it, vi } from "vitest";
import {
  PLAYBOOK_BUYER_TAG,
  tagPlaybookBuyer,
} from "@/lib/ghl/webinar-registration";
import { tagBuyerInGhl } from "@/lib/ltf/ghl-buyer-tag";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });
const opts = (fetchImpl: typeof fetch) => ({
  token: "t",
  locationId: "loc",
  fetchImpl,
  sleep: async () => {},
});

describe("tagPlaybookBuyer", () => {
  it("tags the contact GHL holds for the email", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ contact: { id: "c1" } }))
      .mockResolvedValueOnce(json({ tags: [PLAYBOOK_BUYER_TAG] }));
    expect(await tagPlaybookBuyer("a@b.co", opts(fetchImpl))).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toContain(
      "/contacts/search/duplicate?locationId=loc&email=a%40b.co",
    );
    expect(fetchImpl.mock.calls[1][0]).toContain("/contacts/c1/tags");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      tags: ["playbook-5-buyer"],
    });
  });

  it("never creates a contact for an email GHL does not know", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({ contact: null }));
    expect(await tagPlaybookBuyer("a@b.co", opts(fetchImpl))).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("tagBuyerInGhl", () => {
  const purchase = {
    sessionId: "cs_1",
    livemode: true,
    email: "A@B.co ",
    phone: null,
    name: null,
    amountCents: 500,
    currency: "usd",
  };

  it("skips Stripe test-mode purchases", async () => {
    const tag = vi.fn();
    await tagBuyerInGhl({ ...purchase, livemode: false }, tag);
    expect(tag).not.toHaveBeenCalled();
  });

  it("does nothing without GHL credentials, and never throws", async () => {
    const tag = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(tagBuyerInGhl(purchase, tag)).resolves.toBeUndefined();
    expect(tag).not.toHaveBeenCalled();
  });
});
