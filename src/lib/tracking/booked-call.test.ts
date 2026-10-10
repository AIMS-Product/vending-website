import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adsConversionCommand,
  BOOKED_CALL_KEY,
  bookingId,
  markBookedCall,
  reportMarkedBookedCall,
} from "./booked-call";

const forwardToGa4 = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tracking/ga4-forward", () => ({ forwardToGa4 }));

function fakeWindow() {
  const store = new Map<string, string>();
  const win = {
    dataLayer: [] as unknown[],
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  vi.stubGlobal("window", win);
  return win;
}

const URI =
  "https://api.calendly.com/scheduled_events/abc/invitees/1f2e3d4c-aaaa-bbbb";
const SEND_TO = "AW-18030483230/AbC_12-x";

describe("booked call conversion", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("uses the invitee UUID as the id and rejects junk", () => {
    expect(bookingId(URI)).toBe("1f2e3d4c-aaaa-bbbb");
    expect(bookingId(null)).toBeNull();
    expect(bookingId("https://x/<script>")).toBeNull();
  });

  it("only builds an Ads command for a well-formed send_to", () => {
    expect(adsConversionCommand("id-1", SEND_TO)).toEqual([
      "event",
      "conversion",
      { send_to: SEND_TO, transaction_id: "id-1" },
    ]);
    expect(adsConversionCommand("id-1", undefined)).toBeNull();
    expect(adsConversionCommand("id-1", "G-2SX78VE7VF")).toBeNull();
  });

  it("reports a marked booking exactly once", () => {
    const win = fakeWindow();
    markBookedCall(URI);
    reportMarkedBookedCall(SEND_TO);
    reportMarkedBookedCall(SEND_TO);
    expect(win.dataLayer).toHaveLength(2);
    expect(win.dataLayer[0]).toEqual({ event: "vp_call_booked" });
    expect(Array.from(win.dataLayer[1] as ArrayLike<unknown>)).toEqual([
      "event",
      "conversion",
      { send_to: SEND_TO, transaction_id: "1f2e3d4c-aaaa-bbbb" },
    ]);
    expect(win.sessionStorage.getItem(BOOKED_CALL_KEY)).toBeNull();
  });

  it("reports nothing on a visit without a booking", () => {
    const win = fakeWindow();
    reportMarkedBookedCall(SEND_TO);
    expect(win.dataLayer).toHaveLength(0);
  });
});
