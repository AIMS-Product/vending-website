import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

// A throwaway self-signed cert, made per run, stands in for Apple's chain.
let cert = "";
let key = "";
beforeAll(() => {
  const dir = mkdtempSync(path.join(tmpdir(), "wallet-"));
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=wallet test",
      "-keyout",
      path.join(dir, "k.pem"),
      "-out",
      path.join(dir, "c.pem"),
    ],
    { stdio: "ignore" },
  );
  cert = readFileSync(path.join(dir, "c.pem"), "utf8");
  key = readFileSync(path.join(dir, "k.pem"), "utf8");
});

const start = new Date(Date.now() + 2 * 86_400_000);
const get = (token: string) =>
  GET(
    new Request(
      `https://www.vendingpreneurs.com/masterclass/wallet/${token}/apple`,
    ),
    { params: Promise.resolve({ token }) },
  );
const location = (r: Response) => r.headers.get("location") ?? "";

/** pass.json out of the .pkpass zip (local file headers, deflate or stored). */
function passJson(zip: Buffer) {
  let at = 0;
  while (zip.readUInt32LE(at) === 0x04034b50) {
    const method = zip.readUInt16LE(at + 8);
    const size = zip.readUInt32LE(at + 18);
    const nameLen = zip.readUInt16LE(at + 26);
    const extraLen = zip.readUInt16LE(at + 28);
    const name = zip.toString("utf8", at + 30, at + 30 + nameLen);
    const body = zip.subarray(
      at + 30 + nameLen + extraLen,
      at + 30 + nameLen + extraLen + size,
    );
    if (name === "pass.json") {
      return JSON.parse(
        (method === 8 ? inflateRawSync(body) : body).toString(),
      );
    }
    at += 30 + nameLen + extraLen + size;
  }
  throw new Error("pass.json not found");
}

beforeEach(() => {
  Object.assign(mocks.config, {
    MASTERCLASS_CAL_SECRET: SECRET,
    APPLE_WALLET_PASS_TYPE_ID: "pass.com.vendingpreneurs.webinar",
    APPLE_WALLET_TEAM_ID: "Q3C7UD3995",
    APPLE_WALLET_SIGNER_CERT: Buffer.from(cert).toString("base64"),
    APPLE_WALLET_SIGNER_KEY: Buffer.from(key).toString("base64"),
    APPLE_WALLET_WWDR: cert,
  });
  mocks.getMasterclassEvent.mockResolvedValue({
    startsAt: start.toISOString(),
  });
});

describe("GET /masterclass/wallet/<token>/apple", () => {
  const token = () => signCalendarToken("abc123", start, SECRET)!;

  it("returns a signed pass for this contact and room, with no PII and our join route", async () => {
    const t = token();
    const r = await get(t);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/vnd.apple.pkpass");
    expect(r.headers.get("cache-control")).toBe("no-store, private");
    const pass = passJson(Buffer.from(await r.arrayBuffer()));
    expect(pass.passTypeIdentifier).toBe("pass.com.vendingpreneurs.webinar");
    expect(pass.teamIdentifier).toBe("Q3C7UD3995");
    expect(pass.serialNumber).toBe(`vp_${start.getTime()}_abc123`);
    expect(pass.eventTicket.backFields[0].value).toBe(
      `https://www.vendingpreneurs.com/masterclass/join/${t}`,
    );
    expect(JSON.stringify(pass)).not.toMatch(/@|phone/i);
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
    mocks.config.APPLE_WALLET_SIGNER_KEY = undefined;
    expect(location(await get(token()))).toBe(home);
  });
});
