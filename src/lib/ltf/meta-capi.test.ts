import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { capiPurchaseEvent, sendMetaPurchase } from "@/lib/ltf/meta-capi";

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const purchase = {
  sessionId: "cs_live_abc",
  livemode: true,
  email: "Buyer@Example.com ",
  phone: "+1 (555) 010-2030",
  name: "Jane Q Buyer",
  amountCents: 500,
  currency: "usd",
};

describe("capiPurchaseEvent", () => {
  it("hashes normalized identity and dedupes on the session id", () => {
    const e = capiPurchaseEvent(
      purchase,
      "https://x/thanks",
      { fbp: "fb.1.1.2" },
      1_700_000_000_000,
    );
    expect(e.event_id).toBe("cs_live_abc");
    expect(e.user_data.em).toEqual([sha("buyer@example.com")]);
    expect(e.user_data.ph).toEqual([sha("15550102030")]);
    expect(e.user_data.fn).toEqual([sha("jane")]);
    expect(e.user_data.ln).toEqual([sha("buyer")]);
    expect(e.user_data.fbp).toBe("fb.1.1.2");
    expect(e.custom_data).toMatchObject({ value: 5, currency: "USD" });
    expect(JSON.stringify(e)).not.toContain("example.com");
  });
});

describe("sendMetaPurchase", () => {
  it("never sends Stripe test-mode purchases", async () => {
    const fetchImpl = vi.fn();
    await sendMetaPurchase(
      { ...purchase, livemode: false },
      "https://x",
      undefined,
      fetchImpl,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
