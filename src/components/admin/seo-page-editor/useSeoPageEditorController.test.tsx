import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SeoReadinessFinding } from "@/lib/page-builder/seo-readiness";
import type { PublishBlockerChecklistItem } from "./publish-blocker-checklist";

// The controller renders inside the app router and calls server actions; both
// are external to the click-to-fix behavior under test, so they are mocked.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/app/admin/pages/actions", () => ({
  acceptAiSeoProposalBlocks: vi.fn(),
  autosaveSeoPageDraft: vi.fn(),
  createSeoPageDraftForEditor: vi.fn(),
  createSeoPagePreviewLink: vi.fn(),
  generateAiSeoPageProposal: vi.fn(),
  saveSeoPageDraftAndCreatePreviewLink: vi.fn(),
  saveSeoPage: vi.fn(),
}));

import {
  useSeoPageEditorController,
  type SeoPageEditorController,
} from "./useSeoPageEditorController";

// Render the hook once (SSR pass — effects don't run) and capture the
// controller so its focus helpers can be exercised against a faked DOM.
function renderController(): SeoPageEditorController {
  let editor: SeoPageEditorController | null = null;
  function Probe() {
    editor = useSeoPageEditorController({}, { current: null });
    return null;
  }
  renderToStaticMarkup(<Probe />);
  if (!editor) throw new Error("controller did not render");
  return editor;
}

// Fake DOM standing in for the SEO panel with the Readiness tab active: the
// Settings tab button exists, and the title field is mounted inside the
// hidden Settings tabpanel — focusing it is only meaningful once the tab has
// been activated (clicked).
function fakeSeoPanelDom() {
  const calls: string[] = [];
  let settingsRevealed = false;
  const settingsTabButton = {
    click: () => {
      settingsRevealed = true;
      calls.push("activate-settings-tab");
    },
  };
  const titleField = {
    scrollIntoView: () => calls.push("scroll:page-title-field"),
    focus: () =>
      calls.push(
        settingsRevealed
          ? "focus:page-title-field"
          : "focus-while-hidden:no-op",
      ),
  };

  vi.stubGlobal("document", {
    querySelector: (selector: string) =>
      selector === '[data-seo-panel-tab="settings"]' ? settingsTabButton : null,
    getElementById: (id: string) =>
      id === "page-title-field" ? titleField : null,
  });
  vi.stubGlobal("window", {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  });

  return { calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useSeoPageEditorController click-to-fix tab activation", () => {
  it("activates the Settings tab before focusing a settings-field blocker", () => {
    const editor = renderController();
    const { calls } = fakeSeoPanelDom();

    const blocker: PublishBlockerChecklistItem = {
      code: "missing_title",
      label: "Add a page title",
      detail: "Page title is missing.",
      target: { kind: "field", elementId: "page-title-field" },
    };
    editor.focusPublishBlocker(blocker);

    // Tab activated first, field scrolled + focused after — proving the field
    // is no longer focused while its tabpanel is hidden.
    expect(calls).toEqual([
      "activate-settings-tab",
      "scroll:page-title-field",
      "focus:page-title-field",
    ]);
  });

  it("activates the Settings tab before focusing a readiness-finding field", () => {
    const editor = renderController();
    const { calls } = fakeSeoPanelDom();

    const finding: SeoReadinessFinding = {
      code: "missing_title",
      category: "serp",
      severity: "blocker",
      path: "title",
      message: "Page title is missing.",
    };
    editor.focusSeoSetting(finding);

    expect(calls).toEqual([
      "activate-settings-tab",
      "scroll:page-title-field",
      "focus:page-title-field",
    ]);
  });

  it("stays a graceful no-op when the panel is collapsed (tab and field absent)", () => {
    const editor = renderController();
    vi.stubGlobal("document", {
      querySelector: () => null,
      getElementById: () => null,
    });
    vi.stubGlobal("window", {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      },
    });

    expect(() =>
      editor.focusPublishBlocker({
        code: "missing_title",
        label: "Add a page title",
        detail: "Page title is missing.",
        target: { kind: "field", elementId: "page-title-field" },
      }),
    ).not.toThrow();
  });
});
