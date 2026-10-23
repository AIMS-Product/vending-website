import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
  chicagoIso,
  dueReminder,
  inWalletRollout,
  roomClassId,
  saveUrl,
  sendDueReminders,
  ticketObjectId,
  ticketPayload,
  walletConfig,
} from "./google-wallet";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const SA = JSON.stringify({
  client_email: "wallet@proj.iam.gserviceaccount.com",
  private_key: PEM,
});
const cfg = walletConfig({
  GOOGLE_WALLET_ISSUER_ID: "3388000000023209914",
  GOOGLE_WALLET_SA_KEY: SA,
})!;
const START = "2026-11-04T01:30:00.000Z"; // Tue Nov 3, 7:30 PM CST
const input = {
  startsAt: START,
  contactId: "abcDEF123",
  joinUrl: "https://www.vendingpreneurs.com/masterclass/join/tok",
  siteUrl: "https://www.vendingpreneurs.com",
};
const MIN = 60_000;
const at = (minutesFromStart: number) =>
  new Date(Date.parse(START) + minutesFromStart * MIN);

describe("walletConfig", () => {
  it("needs a numeric issuer and a JSON key with email + private key", () => {
    expect(cfg.clientEmail).toBe("wallet@proj.iam.gserviceaccount.com");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(walletConfig({ GOOGLE_WALLET_SA_KEY: SA })).toBeNull();
    expect(
      walletConfig({
        GOOGLE_WALLET_ISSUER_ID: "abc",
        GOOGLE_WALLET_SA_KEY: SA,
      }),
    ).toBeNull();
    expect(
      walletConfig({
        GOOGLE_WALLET_ISSUER_ID: "1",
        GOOGLE_WALLET_SA_KEY: "{bad",
      }),
    ).toBeNull();
    expect(
      walletConfig({
        GOOGLE_WALLET_ISSUER_ID: "1",
        GOOGLE_WALLET_SA_KEY: "{}",
      }),
    ).toBeNull();
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });
});

describe("inWalletRollout", () => {
  it("is off by default, all-in at 100, stable per contact, ~share in between", () => {
    expect(inWalletRollout("x", undefined)).toBe(false);
    expect(inWalletRollout("x", "0")).toBe(false);
    expect(inWalletRollout("x", "100")).toBe(true);
    expect(inWalletRollout("x", "garbage")).toBe(false);
    const ids = Array.from({ length: 2000 }, (_, i) => `c${i}`);
    const share =
      ids.filter((id) => inWalletRollout(id, "10")).length / ids.length;
    expect(share).toBeGreaterThan(0.07);
    expect(share).toBeLessThan(0.13);
    expect(ids.map((id) => inWalletRollout(id, "10"))).toEqual(
      ids.map((id) => inWalletRollout(id, "10")),
    );
  });
});

describe("ticketPayload", () => {
  const p = ticketPayload(cfg, input);
  const cls = p.eventTicketClasses[0];
  const obj = p.eventTicketObjects[0];

  it("is one class per room and one object per contact per room", () => {
    expect(cls.id).toBe("3388000000023209914.vp_masterclass_202611040130");
    expect(obj.id).toBe("3388000000023209914.vp_202611040130_abcDEF123");
    expect(obj.classId).toBe(cls.id);
    expect(roomClassId(cfg.issuerId, "2026-11-11T01:30:00Z")).not.toBe(cls.id);
    expect(ticketObjectId(cfg.issuerId, START, "other")).not.toBe(obj.id);
  });

  it("shows the room in Chicago time and joins through our token route", () => {
    expect(cls.dateTime.start).toBe("2026-11-03T19:30:00-06:00");
    expect(obj.linksModuleData.uris[0].uri).toBe(input.joinUrl);
    expect(cls.logo.sourceUri.uri).toBe(
      "https://www.vendingpreneurs.com/images/wallet/google-logo.png",
    );
  });

  it("carries no personal data beyond the opaque contact id", () => {
    const json = JSON.stringify(p);
    expect(json).not.toMatch(/@|ticketHolderName|phone|email/i);
  });
});

describe("chicagoIso", () => {
  it("handles both sides of daylight saving", () => {
    expect(chicagoIso(new Date("2026-10-28T00:30:00Z"))).toBe(
      "2026-10-27T19:30:00-05:00",
    );
    expect(chicagoIso(new Date("2026-11-04T01:30:00Z"))).toBe(
      "2026-11-03T19:30:00-06:00",
    );
  });
});

describe("saveUrl", () => {
  it("is an RS256 JWT Google can verify with the service account's key", () => {
    const url = saveUrl(cfg, input, new Date("2026-11-01T00:00:00Z"));
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const [h, c, sig] = url
      .slice("https://pay.google.com/gp/v/save/".length)
      .split(".");
    const ok = createVerify("RSA-SHA256")
      .update(`${h}.${c}`)
      .verify(publicKey, sig, "base64url");
    expect(ok).toBe(true);
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({
      iss: cfg.clientEmail,
      aud: "google",
      typ: "savetowallet",
      origins: ["https://www.vendingpreneurs.com"],
    });
    expect(claims.payload.eventTicketObjects[0].id).toBe(
      "3388000000023209914.vp_202611040130_abcDEF123",
    );
  });
});

describe("dueReminder", () => {
  it("opens each window once and is quiet between them", () => {
    expect(dueReminder(START, at(-24 * 60 - 1))).toBeNull();
    expect(dueReminder(START, at(-24 * 60))?.id).toBe("reminder_24h");
    expect(dueReminder(START, at(-23 * 60 - 1))?.id).toBe("reminder_24h");
    expect(dueReminder(START, at(-23 * 60))).toBeNull();
    expect(dueReminder(START, at(-61))).toBeNull();
    expect(dueReminder(START, at(-60))?.id).toBe("reminder_1h");
    expect(dueReminder(START, at(-40))).toBeNull();
    expect(dueReminder(START, at(0))?.id).toBe("reminder_live");
    expect(dueReminder(START, at(19))?.id).toBe("reminder_live");
    expect(dueReminder(START, at(20))).toBeNull();
  });
});

type Call = { url: string; init?: RequestInit };
function fakeGoogle(
  pages: unknown[],
  { addStatus = 200, listStatus = 200 } = {},
) {
  const calls: Call[] = [];
  let page = 0;
  const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.startsWith("https://oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "tok" });
    }
    if (u.includes("/addMessage"))
      return new Response("{}", { status: addStatus });
    return Response.json(pages[page++] ?? {}, { status: listStatus });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe("sendDueReminders", () => {
  it("does nothing (not even a token) outside a window", async () => {
    const g = fakeGoogle([]);
    const run = await sendDueReminders(cfg, START, {
      fetchImpl: g.fetchImpl,
      now: at(-300),
    });
    expect(run).toMatchObject({ reminder: null, sent: 0 });
    expect(g.calls).toHaveLength(0);
  });

  it("notifies every active pass once, across pages, skipping ones already sent", async () => {
    const g = fakeGoogle([
      {
        resources: [
          { id: "a", state: "active" }, // how Google really answers
          { id: "b", state: "ACTIVE", messages: [{ id: "reminder_1h" }] },
          { id: "c", state: "expired" },
        ],
        pagination: { nextPageToken: "p2" },
      },
      {
        resources: [
          { id: "d", state: "ACTIVE", messages: [{ id: "reminder_24h" }] },
        ],
      },
    ]);
    const run = await sendDueReminders(cfg, START, {
      fetchImpl: g.fetchImpl,
      now: at(-55),
    });
    expect(run).toEqual({
      reminder: "reminder_1h",
      passes: 3,
      sent: 2,
      alreadySent: 1,
      failed: 0,
    });
    const lists = g.calls.filter((c) => c.url.includes("eventTicketObject?"));
    expect(lists[0].url).toContain(
      `classId=${encodeURIComponent("3388000000023209914.vp_masterclass_202611040130")}`,
    );
    expect(lists[1].url).toContain("token=p2");
    const adds = g.calls.filter((c) => c.url.includes("/addMessage"));
    expect(adds.map((c) => c.url.split("/").at(-2))).toEqual(["a", "d"]);
    expect(JSON.parse(String(adds[0].init?.body))).toEqual({
      message: expect.objectContaining({
        id: "reminder_1h",
        messageType: "TEXT_AND_NOTIFY",
      }),
    });
  });

  it("treats a room with no saved passes (no class yet) as nothing to send", async () => {
    const g = fakeGoogle([{ error: {} }], { listStatus: 404 });
    const run = await sendDueReminders(cfg, START, {
      fetchImpl: g.fetchImpl,
      now: at(5),
    });
    expect(run).toMatchObject({ reminder: "reminder_live", passes: 0 });
  });

  it("counts a network error on one pass and still sends the next", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    let adds = 0;
    const fetchImpl = (async (url: string | URL) => {
      const u = String(url);
      if (u.startsWith("https://oauth2"))
        return Response.json({ access_token: "t" });
      if (u.includes("/addMessage")) {
        adds += 1;
        if (adds === 1) throw new TypeError("fetch failed");
        return new Response("{}");
      }
      return Response.json({ resources: [{ id: "a" }, { id: "b" }] });
    }) as unknown as typeof fetch;
    const run = await sendDueReminders(cfg, START, { fetchImpl, now: at(5) });
    expect(run).toMatchObject({ passes: 2, sent: 1, failed: 1 });
    expect(err).toHaveBeenCalledWith("[wallet] reminder not sent", {
      reminder: "reminder_live",
      status: "TypeError",
    });
    err.mockRestore();
  });

  it("counts a failed pass and keeps going; a failed list throws", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const g = fakeGoogle([{ resources: [{ id: "a" }, { id: "b" }] }], {
      addStatus: 429,
    });
    const run = await sendDueReminders(cfg, START, {
      fetchImpl: g.fetchImpl,
      now: at(5),
    });
    expect(run).toMatchObject({ sent: 0, failed: 2 });
    const bad = fakeGoogle([{}], { listStatus: 500 });
    await expect(
      sendDueReminders(cfg, START, { fetchImpl: bad.fetchImpl, now: at(5) }),
    ).rejects.toThrow("Wallet object list failed: 500");
    err.mockRestore();
  });
});
