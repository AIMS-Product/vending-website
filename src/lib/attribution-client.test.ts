import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emitAttributionEvent,
  emitPopupConversionIfAttributed,
  markPopupCtaClicked,
} from "./attribution-client";
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

describe("popup conversion attribution", () => {
  function fakeStorage(seed: Record<string, string> = {}) {
    const store = new Map(Object.entries(seed));
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      _store: store,
    };
  }

  const storedSession = JSON.stringify({
    version: 1,
    vp_session_id: "vp-session-1",
  });

  function stubWindow(sessionSeed: Record<string, string> = {}) {
    const sessionStorage = fakeStorage(sessionSeed);
    vi.stubGlobal("window", {
      sessionStorage,
      localStorage: fakeStorage({ vp_attr: storedSession }),
      location: { pathname: "/contact" },
    });
    return sessionStorage;
  }

  it("emits popup_converted once for a marked popup CTA, then clears the marker", async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    const sessionStorage = stubWindow();

    markPopupCtaClicked("exit-apply");
    emitPopupConversionIfAttributed({ lead_intent: "contact" });
    emitPopupConversionIfAttributed({ lead_intent: "contact" });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    const payload = JSON.parse(await blob.text());
    expect(payload.event_type).toBe("popup_converted");
    expect(payload.properties.popup_id).toBe("exit-apply");
    expect(payload.properties.lead_intent).toBe("contact");
    expect(payload.properties.page_path).toBe("/contact");
    expect(sessionStorage._store.size).toBe(0);
  });

  it("does nothing when no popup CTA was marked", () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    stubWindow();

    emitPopupConversionIfAttributed();

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("clears a malformed marker without emitting", () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    const sessionStorage = stubWindow({ vp_popup_cta: "not json{" });

    emitPopupConversionIfAttributed();

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(sessionStorage._store.size).toBe(0);
  });
});
