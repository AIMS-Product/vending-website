import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the accessibility polish pass (the suite runs in a
 * node environment, so these read the files the way the landmarks tests do).
 */
const read = (file: string) =>
  readFileSync(path.resolve(__dirname, "..", file), "utf8");

describe("admin form labels", () => {
  const config = read("components/admin/ChatbotConfigForm.tsx");

  it("names every starter-question and quick-action field and its remove button", () => {
    expect(config).toContain("aria-label={`Starter question ${index + 1}`}");
    expect(config).toContain(
      "aria-label={`Remove starter question ${index + 1}`}",
    );
    expect(config).toContain("aria-label={`Quick action ${index + 1} label`}");
    expect(config).toContain("aria-label={`Quick action ${index + 1} link`}");
    expect(config).toContain("aria-label={`Remove quick action ${index + 1}`}");
  });

  it("labels the conversation search and the detail note and reason fields", () => {
    expect(read("components/admin/ChatbotConversationsManager.tsx")).toContain(
      'aria-label="Search conversations"',
    );
    const detail = read("components/admin/ChatbotConversationDetail.tsx");
    expect(detail).toContain('aria-labelledby="reviewer-note-title"');
    expect(detail).toContain('id="reviewer-note-title"');
    expect(detail).toContain('aria-label="Reason for hand-off"');
  });
});

describe("admin result messages are announced", () => {
  it("gives the lead-forwarding Banner a role by tone and uses defined ok tokens", () => {
    const src = read("components/admin/AdminLeadForwardingManager.tsx");
    expect(src).toMatch(/role=\{tone === "bad" \? "alert"/);
    expect(src).not.toContain("ui-good");
    expect(src).toContain("bg-ui-ok-fill");
  });

  it("marks CAC, media and AI builder errors as alerts", () => {
    expect(read("components/admin/CacPanels.tsx")).toMatch(
      /role=\{state\.status === "saved" \? "status" : "alert"\}/,
    );
    const media = read("components/admin/MediaLibraryManager.tsx");
    expect(media).toMatch(/role="alert"\s+className="rounded-lg bg-red-50/);
    expect(media).toContain(
      'role={state.status === "error" ? "alert" : "status"}',
    );
    expect(
      read("components/admin/seo-page-editor/AiBuilderAssistant.tsx"),
    ).toMatch(/role="alert"\s+className="rounded-ui-lg bg-ui-bad-fill/);
  });
});

describe("heading order", () => {
  it("does not open the admin shell with an h2 brand heading", () => {
    expect(read("components/admin/AdminShell.tsx")).not.toMatch(
      /<h2[^>]*>\s*Vendingpreneurs/,
    );
  });

  it("titles the block picker dialog with an h2", () => {
    const src = read("components/admin/seo-page-editor/BlockPicker.tsx");
    expect(src).not.toContain("<h4");
    expect(src).toMatch(/<h2\s+id="block-picker-title"/);
  });
});

describe("page title and contrast fixes", () => {
  it("gives /admin/pages/redirects a title and noindex", () => {
    const src = read("app/admin/pages/redirects/page.tsx");
    expect(src).toContain('title: "Redirects"');
    expect(src).toContain("index: false");
  });

  it("uses a white-text-safe fill for the support step badges", () => {
    const src = read("components/sections/SupportPage.tsx");
    expect(src).toContain("bg-brand-700");
    expect(src).not.toContain("bg-brand-600 flex size-8");
  });

  it("keeps admin subtle text and field borders above WCAG minimums", () => {
    const css = read("app/globals.css");
    expect(css).toContain("--ui-text-subtle: #67707e;");
    expect(css).toContain("--ui-field-border: #7c8492;");
    expect(read("components/admin/AdminUi.tsx")).toMatch(
      /adminInputClass =\s+"[^"]*border-ui-field-border/,
    );
  });
});

describe("motion control and scroll padding", () => {
  it("pauses all three looping animations when data-motion is paused", () => {
    const css = read("app/globals.css");
    for (const selector of [".brand-marquee", ".v2-marquee", ".v2-float"]) {
      expect(css).toContain(`html[data-motion="paused"] ${selector}`);
    }
    expect(css).toContain("scroll-padding-top: 6rem");
  });

  it("renders the partner strip's duplicate copy with empty alt text", () => {
    const src = read("components/sections/BrandStrip.tsx");
    expect(src).toContain("<MotionToggle />");
    expect(src).toContain('alt={index < partnerLogos.length ? logo.name : ""}');
  });

  it("moves focus to the video when a testimonial starts playing", () => {
    const src = read("components/ui/VideoCard.tsx");
    expect(src).toContain("videoRef.current?.focus()");
    expect(src).toContain("ref={videoRef}");
  });
});

describe("admin modal dialogs manage focus", () => {
  const files = [
    "app/admin/pages/redirects/RedirectRow.tsx",
    "components/admin/MediaPickerProvider.tsx",
    "components/admin/MediaLibraryManager.tsx",
    "components/admin/seo-page-editor/BlockPicker.tsx",
    "components/admin/seo-page-editor/BuilderEditorWalkthrough.tsx",
  ];

  it.each(files)("%s calls useModalFocus on its dialog", (file) => {
    const src = read(file);
    expect(src).toContain("useModalFocus(");
    expect(src).toMatch(/ref=\{(dialogRef)\}/);
  });

  it("closes the delete-redirect and walkthrough dialogs on Escape", () => {
    expect(read("app/admin/pages/redirects/RedirectRow.tsx")).toContain(
      'event.key === "Escape"',
    );
    const tour = read(
      "components/admin/seo-page-editor/BuilderEditorWalkthrough.tsx",
    );
    expect(tour).toContain('event.key === "Escape"');
    expect(tour).toContain('aria-labelledby="builder-walkthrough-title"');
  });
});
