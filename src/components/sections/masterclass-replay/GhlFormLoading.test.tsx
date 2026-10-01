import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  armStallWatch,
  FormAction,
  GHL_FORM_STALL_MS,
  GhlFormLayer,
  GhlFormLoading,
  isGhlOrigin,
  trackGhlForm,
  watchForStall,
} from "./GhlFormLoading";

const HREF =
  "https://api.leadconnectorhq.com/widget/form/0vrICJhXXOmSC9aGHj3P?utm_source=meta&utm_campaign=replay";

describe("watchForStall", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits 15s before reporting a stalled form", () => {
    const onStall = vi.fn();
    watchForStall(onStall);
    vi.advanceTimersByTime(GHL_FORM_STALL_MS - 1);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(GHL_FORM_STALL_MS).toBe(15_000);
  });

  it("never fires once cancelled (form loaded or unmounted)", () => {
    const onStall = vi.fn();
    const cancel = watchForStall(onStall);
    vi.advanceTimersByTime(GHL_FORM_STALL_MS - 1000);
    cancel();
    vi.advanceTimersByTime(GHL_FORM_STALL_MS * 2);
    expect(onStall).not.toHaveBeenCalled();
  });
});

describe("armStallWatch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("offers no fallback while the iframe has not mounted, however long", () => {
    const onStall = vi.fn();
    const cancel = armStallWatch({ loaded: false, mounted: false, onStall });
    vi.advanceTimersByTime(GHL_FORM_STALL_MS * 4);
    expect(cancel).toBeUndefined();
    expect(onStall).not.toHaveBeenCalled();
    // Not mounted means no stall, so the action stays the spinner.
    const html = renderToStaticMarkup(
      createElement(FormAction, {
        stalled: onStall.mock.calls.length > 0,
        href: HREF,
      }),
    );
    expect(html).not.toContain("Open the application");
  });

  it("still offers the fallback once a mounted iframe stalls", () => {
    const onStall = vi.fn();
    armStallWatch({ loaded: false, mounted: true, onStall });
    vi.advanceTimersByTime(GHL_FORM_STALL_MS - 1);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
    const html = renderToStaticMarkup(
      createElement(FormAction, {
        stalled: onStall.mock.calls.length > 0,
        href: HREF,
      }),
    );
    expect(html).toContain("Open the application");
  });

  it("never arms once the form has loaded", () => {
    const onStall = vi.fn();
    expect(
      armStallWatch({ loaded: true, mounted: true, onStall }),
    ).toBeUndefined();
    vi.advanceTimersByTime(GHL_FORM_STALL_MS * 2);
    expect(onStall).not.toHaveBeenCalled();
  });
});

describe("trackGhlForm", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // A stand-in iframe (an EventTarget with a style) and page window.
  const setup = (shown = true) => {
    const frame = Object.assign(new EventTarget(), { style: { height: "" } });
    const messages = new EventTarget();
    const onLoaded = vi.fn();
    const onStall = vi.fn();
    const stop = trackGhlForm({
      frame,
      messages,
      isShown: () => shown,
      onLoaded,
      onStall,
    });
    return { frame, messages, onLoaded, onStall, stop };
  };
  const ghlMessage = (origin = "https://api.leadconnectorhq.com") =>
    new MessageEvent("message", { origin, data: "[iFrameResizerChild]Ready" });

  it("treats a blocked iframe's bare `load` as no form: the fallback still comes", () => {
    const { frame, onLoaded, onStall } = setup();
    // GHL blocked: the aborted navigation fires `load` over a blank frame.
    frame.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(GHL_FORM_STALL_MS - 1);
    expect(onStall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onStall).toHaveBeenCalledTimes(1);
    expect(onLoaded).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(
      createElement(FormAction, { stalled: true, href: HREF }),
    );
    expect(html).toContain("Open the application");
  });

  it("marks the form loaded on a GHL message, and never offers the fallback", () => {
    const { frame, messages, onLoaded, onStall } = setup();
    frame.dispatchEvent(new Event("load"));
    messages.dispatchEvent(ghlMessage());
    vi.advanceTimersByTime(150);
    expect(onLoaded).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(GHL_FORM_STALL_MS * 2);
    expect(onStall).not.toHaveBeenCalled();
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("counts form_embed.js sizing the iframe as loaded", () => {
    const { frame, onLoaded, onStall } = setup();
    frame.style.height = "787px";
    vi.advanceTimersByTime(150);
    expect(onLoaded).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(GHL_FORM_STALL_MS);
    expect(onStall).not.toHaveBeenCalled();
  });

  it("ignores messages from other origins", () => {
    const { messages, onLoaded, onStall } = setup();
    messages.dispatchEvent(ghlMessage("https://challenges.cloudflare.com"));
    messages.dispatchEvent(ghlMessage("null"));
    vi.advanceTimersByTime(GHL_FORM_STALL_MS);
    expect(onLoaded).not.toHaveBeenCalled();
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("waits for the reveal before fading, and a late form still clears the fallback", () => {
    let shown = false;
    const frame = { style: { height: "" } };
    const messages = new EventTarget();
    const onLoaded = vi.fn();
    const onStall = vi.fn();
    trackGhlForm({
      frame,
      messages,
      isShown: () => shown,
      onLoaded,
      onStall,
    });
    vi.advanceTimersByTime(GHL_FORM_STALL_MS);
    expect(onStall).toHaveBeenCalledTimes(1);
    messages.dispatchEvent(ghlMessage());
    vi.advanceTimersByTime(600);
    expect(onLoaded).not.toHaveBeenCalled();
    shown = true;
    vi.advanceTimersByTime(150);
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("stops listening once cleaned up (unmount)", () => {
    const { messages, onLoaded, onStall, stop } = setup();
    stop();
    messages.dispatchEvent(ghlMessage());
    vi.advanceTimersByTime(GHL_FORM_STALL_MS * 2);
    expect(onLoaded).not.toHaveBeenCalled();
    expect(onStall).not.toHaveBeenCalled();
  });
});

describe("isGhlOrigin", () => {
  it("accepts GHL's form hosts only", () => {
    expect(isGhlOrigin("https://api.leadconnectorhq.com")).toBe(true);
    expect(isGhlOrigin("https://link.msgsndr.com")).toBe(true);
    expect(isGhlOrigin("https://leadconnectorhq.com.evil.example")).toBe(false);
    expect(isGhlOrigin("https://evilleadconnectorhq.com")).toBe(false);
    expect(isGhlOrigin("http://api.leadconnectorhq.com")).toBe(false);
    expect(isGhlOrigin("null")).toBe(false);
  });
});

describe("FormAction", () => {
  it("shows the spinner label while the form is loading", () => {
    const html = renderToStaticMarkup(
      createElement(FormAction, { stalled: false, href: HREF }),
    );
    expect(html).toContain("Loading your application");
    expect(html).not.toContain("<a");
  });

  it("offers the GHL form in a new tab, UTMs intact, once stalled", () => {
    const html = renderToStaticMarkup(
      createElement(FormAction, { stalled: true, href: HREF }),
    );
    expect(html).not.toContain("Loading your application");
    expect(html).toContain(`href="${HREF.replace(/&/g, "&amp;")}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain("Open the application");
    expect(html).toContain("(opens in a new tab)");
  });
});

describe("GhlFormLoading", () => {
  it("renders the loading state first, hidden from assistive tech", () => {
    const html = renderToStaticMarkup(
      createElement(GhlFormLoading, {
        iframeId: "inline-x",
        fallbackHref: HREF,
      }),
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Loading your application");
    expect(html).not.toContain("Open the application");
  });

  it("drops the skeleton once stalled: one line, then the link straight under it", () => {
    const html = renderToStaticMarkup(
      createElement(GhlFormLayer, { loaded: false, stalled: true, href: HREF }),
    );
    expect(html).not.toContain("data-ghl-skeleton");
    expect(html).not.toContain("Loading your application");
    expect(html).toContain("data-ghl-fallback");
    expect(html).toContain("The application didn&#x27;t load here.");
    expect(html).toContain("Open the application");
    // In flow (not absolute), so the slot can shrink to the panel.
    expect(html).not.toContain("absolute");
    expect(html.indexOf("didn&#x27;t load here")).toBeLessThan(
      html.indexOf("Open the application"),
    );
  });

  it("keeps the skeleton while loading, and a late form fades the panel", () => {
    const loading = renderToStaticMarkup(
      createElement(GhlFormLayer, {
        loaded: false,
        stalled: false,
        href: HREF,
      }),
    );
    expect(loading).toContain("data-ghl-skeleton");
    expect(loading).not.toContain("data-ghl-fallback");
    const late = renderToStaticMarkup(
      createElement(GhlFormLayer, { loaded: true, stalled: true, href: HREF }),
    );
    expect(late).toContain("opacity-0");
    expect(late).not.toContain("data-ghl-fallback");
  });
});
