import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  config: {} as Record<string, string | undefined>,
  getMasterclassEvent: vi.fn(),
  reserve: vi.fn(),
  release: vi.fn(),
  send: vi.fn(),
  report: vi.fn(),
  walletConfig: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ config: mocks.config }));
vi.mock("@/lib/services/masterclass-event", () => ({
  getMasterclassEvent: mocks.getMasterclassEvent,
}));
vi.mock("@/lib/public-rate-limit", () => ({
  reservePublicRateLimit: mocks.reserve,
}));
vi.mock("@/lib/observability/cron-failure", () => ({
  reportCronException: mocks.report,
}));
vi.mock("@/lib/wallet/google-wallet", async () => ({
  ...(await vi.importActual<typeof import("@/lib/wallet/google-wallet")>(
    "@/lib/wallet/google-wallet",
  )),
  walletConfig: mocks.walletConfig,
  sendDueReminders: mocks.send,
}));

const call = (auth = "Bearer s3cret") =>
  GET(
    new Request("https://x/api/admin/wallet-reminders/run", {
      headers: { authorization: auth },
    }),
  );
// The live window is open for 20 minutes from the start.
const liveNow = () => new Date(Date.now() - 5 * 60_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.CRON_SECRET = "s3cret";
  mocks.walletConfig.mockReturnValue({
    issuerId: "1",
    clientEmail: "e",
    privateKey: "k",
  });
  mocks.getMasterclassEvent.mockResolvedValue({ startsAt: liveNow() });
  mocks.reserve.mockResolvedValue({ allowed: true, release: mocks.release });
  mocks.send.mockResolvedValue({
    reminder: "reminder_live",
    passes: 2,
    sent: 2,
    alreadySent: 0,
    failed: 0,
  });
});

describe("GET /api/admin/wallet-reminders/run", () => {
  it("rejects a missing or wrong cron secret", async () => {
    expect((await call("Bearer nope")).status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("claims room+reminder, then sends", async () => {
    const r = await call();
    expect(await r.json()).toMatchObject({ ok: true, sent: 2 });
    expect(mocks.reserve).toHaveBeenCalledWith("wallet_reminder_run", {
      ip: null,
      email: expect.stringMatching(/^1\.vp_masterclass_\d{12}:reminder_live$/),
    });
  });

  it("skips while another run holds the claim (no double notifications)", async () => {
    mocks.reserve.mockResolvedValue({ allowed: false, release: mocks.release });
    expect(await (await call()).json()).toMatchObject({
      skipped: "another run holds it",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("does not claim or call Google outside a reminder window", async () => {
    mocks.getMasterclassEvent.mockResolvedValue({
      startsAt: new Date(Date.now() + 5 * 3600e3).toISOString(),
    });
    expect(await (await call()).json()).toEqual({ ok: true, reminder: null });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  it("releases the claim and reports when the run fails, so the next tick retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockRejectedValue(new Error("Wallet object list failed: 500"));
    expect((await call()).status).toBe(500);
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.report).toHaveBeenCalledOnce();
  });

  it("reports partial failures but keeps the claim", async () => {
    mocks.send.mockResolvedValue({
      reminder: "reminder_live",
      passes: 3,
      sent: 2,
      alreadySent: 0,
      failed: 1,
    });
    expect(await (await call()).json()).toMatchObject({ ok: false, failed: 1 });
    expect(mocks.report).toHaveBeenCalledOnce();
    expect(mocks.release).not.toHaveBeenCalled();
  });
});
