import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appleAuthToken,
  appleSerial,
  appleStage,
} from "@/lib/wallet/apple-wallet";
import { DELETE, GET, POST } from "./route";

const SECRET = "c".repeat(32);
const PT = "pass.com.vendingpreneurs.webinar";
const mocks = vi.hoisted(() => ({
  config: {} as Record<string, string | undefined>,
  register: vi.fn(),
  unregister: vi.fn(),
  updated: vi.fn(),
}));
vi.mock("@/lib/config", () => ({
  config: mocks.config,
  publicConfig: { siteUrl: "https://www.vendingpreneurs.com" },
}));
vi.mock("@/lib/wallet/apple-wallet-service", () => ({
  registerDevice: mocks.register,
  unregisterDevice: mocks.unregister,
  updatedSerials: mocks.updated,
}));

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

const startMs = Date.now() + 2 * 86_400_000;
const serial = appleSerial(startMs, "abc123");
const auth = (s = serial) => ({
  authorization: `ApplePass ${appleAuthToken(s, SECRET)}`,
});
const req = (
  method: string,
  p: string,
  headers: Record<string, string> = {},
  body?: unknown,
) =>
  new Request(`https://www.vendingpreneurs.com/api/wallet/apple/v1/${p}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (p: string) => ({
  params: Promise.resolve({ path: p.split("?")[0].split("/") }),
});
const PUSH = { pushToken: "a1b2c3d4e5f6a7b8c9d0" };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.config, {
    MASTERCLASS_CAL_SECRET: SECRET,
    APPLE_WALLET_PASS_TYPE_ID: PT,
    APPLE_WALLET_TEAM_ID: "Q3C7UD3995",
    APPLE_WALLET_SIGNER_CERT: cert,
    APPLE_WALLET_SIGNER_KEY: key,
    APPLE_WALLET_WWDR: cert,
  });
  mocks.register.mockResolvedValue("created");
  mocks.unregister.mockResolvedValue(undefined);
});

describe("Apple pass web service", () => {
  const regPath = `devices/dev1/registrations/${PT}/${serial}`;

  it("registers a phone with a valid token (201, then 200 when known)", async () => {
    expect(
      (await POST(req("POST", regPath, auth(), PUSH), ctx(regPath))).status,
    ).toBe(201);
    expect(mocks.register).toHaveBeenCalledWith({
      deviceLibraryId: "dev1",
      serial,
      pushToken: PUSH.pushToken,
    });
    mocks.register.mockResolvedValue("exists");
    expect(
      (await POST(req("POST", regPath, auth(), PUSH), ctx(regPath))).status,
    ).toBe(200);
  });

  it("refuses a missing, wrong or other-pass token, a wrong pass type and a bad body", async () => {
    expect(
      (await POST(req("POST", regPath, {}, PUSH), ctx(regPath))).status,
    ).toBe(401);
    expect(
      (
        await POST(
          req("POST", regPath, { authorization: "ApplePass nope" }, PUSH),
          ctx(regPath),
        )
      ).status,
    ).toBe(401);
    const other = appleSerial(startMs, "zzz999");
    expect(
      (await POST(req("POST", regPath, auth(other), PUSH), ctx(regPath)))
        .status,
    ).toBe(401);
    const wrongType = `devices/dev1/registrations/pass.other/${serial}`;
    expect(
      (await POST(req("POST", wrongType, auth(), PUSH), ctx(wrongType))).status,
    ).toBe(401);
    expect(
      (
        await POST(
          req("POST", regPath, auth(), { pushToken: "<script>" }),
          ctx(regPath),
        )
      ).status,
    ).toBe(400);
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("unregisters only with a valid token", async () => {
    expect((await DELETE(req("DELETE", regPath), ctx(regPath))).status).toBe(
      401,
    );
    expect(
      (await DELETE(req("DELETE", regPath, auth()), ctx(regPath))).status,
    ).toBe(200);
    expect(mocks.unregister).toHaveBeenCalledWith("dev1", serial);
  });

  it("serves the latest pass to its holder, 304 when unchanged, 401 otherwise", async () => {
    const p = `passes/${PT}/${serial}`;
    const r = await GET(req("GET", p, auth()), ctx(p));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/vnd.apple.pkpass");
    const lm = r.headers.get("last-modified")!;
    expect(
      (await GET(req("GET", p, { ...auth(), "if-modified-since": lm }), ctx(p)))
        .status,
    ).toBe(304);
    expect((await GET(req("GET", p), ctx(p))).status).toBe(401);
  });

  it("lists changed serials for a phone, 204 when none", async () => {
    const p = `devices/dev1/registrations/${PT}`;
    mocks.updated.mockResolvedValue({ serials: [serial], lastUpdated: 5 });
    const r = await GET(req("GET", `${p}?passesUpdatedSince=1`), ctx(p));
    expect(await r.json()).toEqual({
      serialNumbers: [serial],
      lastUpdated: "5",
    });
    expect(mocks.updated).toHaveBeenCalledWith("dev1", 1, expect.any(Number));
    mocks.updated.mockResolvedValue({ serials: [], lastUpdated: 5 });
    expect((await GET(req("GET", p), ctx(p))).status).toBe(204);
  });

  it("answers 500, not success, when storage fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.register.mockRejectedValue(new Error("db down"));
    expect(
      (await POST(req("POST", regPath, auth(), PUSH), ctx(regPath))).status,
    ).toBe(500);
  });
});

describe("appleStage", () => {
  const H = 3_600_000;
  it("moves saved -> 24h -> 1h -> live at the reminder times", () => {
    expect(appleStage(startMs, startMs - 25 * H).stage.id).toBe("saved");
    expect(appleStage(startMs, startMs - 24 * H).stage.id).toBe("reminder_24h");
    expect(appleStage(startMs, startMs - H + 1).stage.id).toBe("reminder_1h");
    expect(appleStage(startMs, startMs).stage.id).toBe("reminder_live");
    expect(appleStage(startMs, startMs - H).since).toBe(startMs - H);
  });
});
