import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signCalendarToken } from "@/lib/masterclass-session";
import { GET } from "./route";

const SECRET = "c".repeat(32);
const mocks = vi.hoisted(() => ({
  getMasterclassEvent: vi.fn(),
  config: {} as Record<string, string | undefined>,
}));
vi.mock("@/lib/config", () => ({
  config: mocks.config,
  publicConfig: { siteUrl: "https://www.vendingpreneurs.com" },
}));
vi.mock("@/lib/services/masterclass-event", () => ({
  getMasterclassEvent: mocks.getMasterclassEvent,
}));

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = JSON.stringify({
  client_email: "wallet@proj.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
});
const start = new Date(Date.now() + 2 * 86_400_000);
const get = (token: string) =>
  GET(
    new Request(`https://www.vendingpreneurs.com/masterclass/wallet/${token}`),
    {
      params: Promise.resolve({ token }),
    },
  );
const location = (r: Response) => r.headers.get("location") ?? "";
const claims = (url: string) =>
  JSON.parse(
    Buffer.from(url.split("/save/")[1].split(".")[1], "base64url").toString(),
  );

beforeEach(() => {
  Object.assign(mocks.config, {
    MASTERCLASS_CAL_SECRET: SECRET,
    GOOGLE_WALLET_ISSUER_ID: "3388000000023209914",
    GOOGLE_WALLET_SA_KEY: SA,
  });
  mocks.getMasterclassEvent.mockResolvedValue({
    startsAt: start.toISOString(),
  });
});

describe("GET /masterclass/wallet/<token>", () => {
  const token = () => signCalendarToken("abc123", start, SECRET)!;

  it("redirects to a Google save link for this contact and room, joining via our token route", async () => {
    const t = token();
    const r = await get(t);
    expect(r.status).toBe(302);
    expect(r.headers.get("cache-control")).toBe("no-store, private");
    const url = location(r);
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const obj = claims(url).payload.eventTicketObjects[0];
    expect(obj.id).toMatch(/^3388000000023209914\.vp_\d{12}_abc123$/);
    expect(obj.linksModuleData.uris[0].uri).toBe(
      `https://www.vendingpreneurs.com/masterclass/join/${t}`,
    );
  });

  it("sends tampered, earlier-room or unconfigured requests to the registration page", async () => {
    const home = "https://www.vendingpreneurs.com/masterclass";
    expect(location(await get(`${token().slice(0, -1)}x`))).toBe(home);
    const old = signCalendarToken(
      "abc123",
      new Date(start.getTime() - 7 * 86_400_000),
      SECRET,
    )!;
    expect(location(await get(old))).toBe(home);
    mocks.config.GOOGLE_WALLET_SA_KEY = undefined;
    expect(location(await get(token()))).toBe(home);
  });
});
