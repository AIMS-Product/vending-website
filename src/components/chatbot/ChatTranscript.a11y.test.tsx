import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatTranscript } from "./ChatTranscript";

const base = {
  personaName: "Mia",
  avatarUrl: null,
  brandColor: "#2a8fcc",
  messages: [],
  toolStatus: null,
};

describe("ChatTranscript announcements", () => {
  it("hides the in-flight streaming bubble from the live region", () => {
    const html = renderToStaticMarkup(
      <ChatTranscript {...base} streamingText="Partial rep" isWaiting />,
    );
    expect(html).toMatch(/<div aria-hidden="true">.*Partial rep/);
  });

  it("exposes the typing indicator as a status with readable text", () => {
    const html = renderToStaticMarkup(
      <ChatTranscript {...base} streamingText={null} isWaiting />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Mia is typing");
    expect(html).not.toContain("aria-label");
  });
});

describe("chat error and focus wiring", () => {
  const read = (file: string) =>
    readFileSync(path.resolve(__dirname, file), "utf8");

  it("announces send and capture errors as alerts", () => {
    expect(read("./ChatWidget.tsx")).toMatch(/role="alert"[^>]*>\s*\{error\}/);
    expect(read("./ChatCaptureForm.tsx")).toMatch(
      /role="alert"[^>]*>\s*\{error\}/,
    );
  });

  it("returns focus to the launcher on close and traps Tab on mobile", () => {
    const widget = read("./ChatWidget.tsx");
    expect(widget).toContain("launcherRef.current?.focus()");
    expect(widget).toContain("trapTabKey(event, panelRef.current)");
    expect(widget).toContain('aria-modal={isMobile ? "true" : "false"}');
    // Focus-on-open must not re-run when isMobile flips (phone rotation).
    expect(widget).toMatch(
      /if \(open\) panelRef\.current\?\.focus\(\);\s*\}, \[open\]\)/,
    );
  });
});
