import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// SitePopup reads the current route; targeting is tested through pickPopup
// directly, so usePathname is mocked to keep the module importable in node.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { PopupCard, wireTrigger, type TriggerWindow } from "./SitePopup";
import {
  isFrequencyCapped,
  pickPopup,
  popupFrequencyKey,
  safePopupHref,
  type Popup,
} from "@/lib/content/popups";

function popup(overrides: Partial<Popup> = {}): Popup {
  return {
    id: "test-popup",
    active: true,
    trigger: "IMMEDIATE",
    triggerThreshold: null,
    targetUrlPatterns: [],
    excludeUrlPatterns: [],
    includeHomepage: false,
    excludeHomepage: false,
    frequency: "always",
    eyebrow: null,
    headline: "Headline",
    body: "Body copy.",
    primaryCta: { label: "Go", href: "/contact" },
    secondaryCta: null,
    featuredValue: null,
    offerCode: null,
    dismissText: null,
    accentColor: null,
    ...overrides,
  };
}

/** Fake window: one listener map shared by window and document. */
function fakeWin(
  metrics = { scrollTop: 0, scrollHeight: 2000, clientHeight: 1000 },
) {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const add = (type: string, listener: (event: MouseEvent) => void) => {
    const set = listeners.get(type) ?? new Set();
    set.add(listener as (event: unknown) => void);
    listeners.set(type, set);
  };
  const remove = (type: string, listener: (event: MouseEvent) => void) => {
    listeners.get(type)?.delete(listener as (event: unknown) => void);
  };
  const win: TriggerWindow = {
    addEventListener: add,
    removeEventListener: remove,
    document: {
      addEventListener: add,
      removeEventListener: remove,
      documentElement: metrics,
    },
  };
  const dispatch = (type: string, event?: unknown) => {
    for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
  };
  return { win, dispatch, metrics };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("wireTrigger", () => {
  it("fires IMMEDIATE synchronously", () => {
    const fire = vi.fn();
    wireTrigger(popup(), fire, fakeWin().win);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("fires TIME_ON_PAGE after the threshold, not before", () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    wireTrigger(
      popup({ trigger: "TIME_ON_PAGE", triggerThreshold: 5 }),
      fire,
      fakeWin().win,
    );
    vi.advanceTimersByTime(4999);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("does not fire TIME_ON_PAGE after cleanup", () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    const cleanup = wireTrigger(
      popup({ trigger: "TIME_ON_PAGE", triggerThreshold: 5 }),
      fire,
      fakeWin().win,
    );
    cleanup();
    vi.advanceTimersByTime(10_000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("fires SCROLL_DEPTH only once the depth percent is reached", () => {
    const { win, dispatch, metrics } = fakeWin();
    const fire = vi.fn();
    wireTrigger(
      popup({ trigger: "SCROLL_DEPTH", triggerThreshold: 50 }),
      fire,
      win,
    );
    metrics.scrollTop = 400; // 40% of the 1000px scrollable range
    dispatch("scroll");
    expect(fire).not.toHaveBeenCalled();
    metrics.scrollTop = 500; // 50%
    dispatch("scroll");
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("fires EXIT_INTENT only when the pointer leaves the top of the viewport", () => {
    const { win, dispatch } = fakeWin();
    const fire = vi.fn();
    wireTrigger(popup({ trigger: "EXIT_INTENT" }), fire, win);
    dispatch("mouseout", { clientY: 200, relatedTarget: null });
    dispatch("mouseout", { clientY: -1, relatedTarget: {} });
    expect(fire).not.toHaveBeenCalled();
    dispatch("mouseout", { clientY: -1, relatedTarget: null });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("resets IDLE_TIME on activity", () => {
    vi.useFakeTimers();
    const { win, dispatch } = fakeWin();
    const fire = vi.fn();
    wireTrigger(
      popup({ trigger: "IDLE_TIME", triggerThreshold: 10 }),
      fire,
      win,
    );
    vi.advanceTimersByTime(9000);
    dispatch("keydown");
    vi.advanceTimersByTime(9000);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);
  });
});

describe("pickPopup URL targeting", () => {
  const targeted = popup({
    id: "targeted",
    targetUrlPatterns: ["/case-studies"],
  });

  it("matches a path containing a target pattern", () => {
    expect(pickPopup("/case-studies/route-one", [targeted])?.id).toBe(
      "targeted",
    );
  });

  it("does not match a path outside the target patterns", () => {
    expect(pickPopup("/about", [targeted])).toBeNull();
  });

  it("matches every page when patterns are empty, except /admin", () => {
    const everywhere = popup({ id: "everywhere" });
    expect(pickPopup("/about", [everywhere])?.id).toBe("everywhere");
    expect(pickPopup("/admin/popups", [everywhere])).toBeNull();
  });

  it("never shows on conversion surfaces, even when explicitly targeted", () => {
    const everywhere = popup({ id: "everywhere" });
    for (const path of [
      "/contact",
      "/thank-you",
      "/thank-you-for-applying",
      "/qualify/session-token",
      "/newsletter",
      "/booking-meta",
      "/book-my-advisory-call-l1-topcl",
      "/schedule-your-call-ig",
      "/apply",
    ]) {
      expect(pickPopup(path, [everywhere])).toBeNull();
      // Explicit targeting cannot override the exclusion.
      const targetedAtFunnel = popup({
        id: "targeted-funnel",
        targetUrlPatterns: [path],
      });
      expect(pickPopup(path, [targetedAtFunnel])).toBeNull();
    }
  });

  it("skips inactive popups unless previewing", () => {
    const inactive = popup({ id: "inactive", active: false });
    expect(pickPopup("/", [inactive])).toBeNull();
    expect(pickPopup("/", [inactive], { preview: true })?.id).toBe("inactive");
  });
});

// Kody, 2026-08-11: carve pages out of a broad rule, and decide the homepage
// separately because no substring can single it out.
describe("pickPopup exclusions", () => {
  it("keeps a broad popup off an excluded page", () => {
    const everywhere = popup({
      id: "everywhere",
      excludeUrlPatterns: ["/news"],
    });
    expect(pickPopup("/about", [everywhere])?.id).toBe("everywhere");
    expect(pickPopup("/news", [everywhere])).toBeNull();
    expect(pickPopup("/news/some-article", [everywhere])).toBeNull();
  });

  it("lets an exclusion beat an explicit target", () => {
    const conflicted = popup({
      id: "conflicted",
      targetUrlPatterns: ["/case-studies"],
      excludeUrlPatterns: ["/case-studies/route-one"],
    });
    expect(pickPopup("/case-studies", [conflicted])?.id).toBe("conflicted");
    expect(pickPopup("/case-studies/route-one", [conflicted])).toBeNull();
  });

  it("does not let an exclusion pattern leak into other pages", () => {
    const excluded = popup({ id: "excluded", excludeUrlPatterns: ["/news"] });
    expect(pickPopup("/newsletter-archive", [excluded])).toBeNull();
    expect(pickPopup("/case-studies", [excluded])?.id).toBe("excluded");
  });
});

describe("pickPopup homepage targeting", () => {
  it("reaches the homepage when the popup targets every page", () => {
    expect(pickPopup("/", [popup({ id: "everywhere" })])?.id).toBe(
      "everywhere",
    );
  });

  it("leaves the homepage alone when specific pages are listed", () => {
    const targeted = popup({
      id: "targeted",
      targetUrlPatterns: ["/case-studies"],
    });
    expect(pickPopup("/", [targeted])).toBeNull();
  });

  it("adds the homepage back when it is ticked alongside a page list", () => {
    const both = popup({
      id: "both",
      targetUrlPatterns: ["/case-studies"],
      includeHomepage: true,
    });
    expect(pickPopup("/", [both])?.id).toBe("both");
    expect(pickPopup("/case-studies", [both])?.id).toBe("both");
    expect(pickPopup("/about", [both])).toBeNull();
  });

  it("keeps a show-everywhere popup off the homepage when excluded", () => {
    const notHome = popup({ id: "not-home", excludeHomepage: true });
    expect(pickPopup("/", [notHome])).toBeNull();
    expect(pickPopup("/about", [notHome])?.id).toBe("not-home");
  });

  it("resolves a contradictory pair by excluding, like every other rule", () => {
    const contradictory = popup({
      id: "contradictory",
      targetUrlPatterns: ["/case-studies"],
      includeHomepage: true,
      excludeHomepage: true,
    });
    expect(pickPopup("/", [contradictory])).toBeNull();
  });

  it("still cannot be targeted by typing a slash, which matches nothing extra", () => {
    // Every path contains "/", so this used to mean "every page" while reading
    // like "the homepage". It now selects the homepage only because of the
    // checkbox, and a bare "/" pattern behaves like the every-page default.
    const slash = popup({ id: "slash", targetUrlPatterns: ["/"] });
    expect(pickPopup("/", [slash])).toBeNull();
    expect(pickPopup("/about", [slash])?.id).toBe("slash");
  });
});

describe("isFrequencyCapped", () => {
  const now = 1_700_000_000_000;
  const stored = (value: string | null) => () => value;

  it("caps session popups once the session key exists", () => {
    const p = popup({ frequency: "session" });
    expect(isFrequencyCapped(p, stored(null), now)).toBe(false);
    expect(isFrequencyCapped(p, stored("1"), now)).toBe(true);
  });

  it("caps once_per_day popups for 24h from the stored timestamp", () => {
    const p = popup({ frequency: "once_per_day" });
    expect(isFrequencyCapped(p, stored(String(now - 60_000)), now)).toBe(true);
    expect(
      isFrequencyCapped(p, stored(String(now - 2 * 86_400_000)), now),
    ).toBe(false);
  });

  it("never caps always popups", () => {
    const p = popup({ frequency: "always" });
    expect(isFrequencyCapped(p, stored("1"), now)).toBe(false);
  });

  it("keys storage by popup id", () => {
    expect(popupFrequencyKey("exit-apply")).toContain("exit-apply");
  });
});

describe("PopupCard rendering", () => {
  it("renders an accessible dialog with presence-gated optional fields", () => {
    const html = renderToStaticMarkup(
      <PopupCard
        popup={popup({
          eyebrow: "Before you go",
          secondaryCta: { label: "Case studies", href: "/case-studies" },
          featuredValue: { label: "Free", value: "Roadmap", note: null },
          offerCode: "VP-LAUNCH",
          dismissText: "No thanks",
          accentColor: "#f47b3b",
        })}
        onClose={() => {}}
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    for (const text of [
      "Before you go",
      "Case studies",
      "Roadmap",
      "VP-LAUNCH",
      "No thanks",
    ])
      expect(html).toContain(text);
  });

  it("omits optional fields that are null", () => {
    const html = renderToStaticMarkup(
      <PopupCard popup={popup()} onClose={() => {}} />,
    );
    expect(html).toContain("Headline");
    expect(html).not.toContain('uppercase">Before');
    expect(html).not.toContain("border-dashed");
  });

  it("drops CTAs with unsafe hrefs", () => {
    const html = renderToStaticMarkup(
      <PopupCard
        popup={popup({
          primaryCta: { label: "Evil", href: "javascript:alert(1)" },
        })}
        onClose={() => {}}
      />,
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Evil");
  });
});

describe("safePopupHref", () => {
  it("allows relative paths and http/https/mailto/tel", () => {
    for (const href of [
      "/contact",
      "https://vendingpreneurs.com",
      "mailto:team@vendingpreneurs.com",
      "tel:+15555550100",
    ])
      expect(safePopupHref(href)).toBe(href);
  });

  it("rejects protocol-relative and script URLs", () => {
    expect(safePopupHref("//evil.com")).toBeNull();
    expect(safePopupHref("javascript:alert(1)")).toBeNull();
  });
});
