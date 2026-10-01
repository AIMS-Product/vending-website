import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  armStallWatch,
  FormAction,
  GHL_FORM_STALL_MS,
  GhlFormLoading,
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
});
