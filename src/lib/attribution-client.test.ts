import { afterEach, describe, expect, it, vi } from "vitest";
import { emitAttributionEvent } from "./attribution-client";
import type { AttributionSession } from "./attribution-session";

const session = {
  vp_session_id: "vp-session-1",
  utm_source: "newsletter",
  utm_medium: "",
} as AttributionSession;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("emitAttributionEvent", () => {
  it("posts the event payload via sendBeacon with session properties compacted", async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });

    emitAttributionEvent("popup_shown", session, {
      popup_id: "exit-apply",
      empty_property: "",
    });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/attribution/events");
    const payload = JSON.parse(await blob.text());
    expect(payload.event_type).toBe("popup_shown");
    expect(payload.vp_session_id).toBe("vp-session-1");
    expect(payload.external_id).toMatch(
      /^vending-website:popup_shown:vp-session-1:/,
    );
    expect(payload.properties.popup_id).toBe("exit-apply");
    expect(payload.properties.utm_source).toBe("newsletter");
    // compact() drops empty values so the downstream ingest never sees blanks
    expect(payload.properties).not.toHaveProperty("empty_property");
    expect(payload.properties).not.toHaveProperty("utm_medium");
  });

  it("falls back to fetch keepalive when sendBeacon is unavailable", () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    emitAttributionEvent("popup_dismissed", session, {
      popup_id: "exit-apply",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/attribution/events",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });
});
