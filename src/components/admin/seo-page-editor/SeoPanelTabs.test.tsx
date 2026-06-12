import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeoPanelTabs } from "./SeoPanelTabs";

function renderTabs() {
  return renderToStaticMarkup(
    <SeoPanelTabs
      tabs={[
        { id: "readiness", label: "Readiness", content: <p>Findings</p> },
        { id: "settings", label: "Settings", content: <p>Fields</p> },
      ]}
    />,
  );
}

/** Returns the opening tag of each role="tab" button, in document order. */
function tabButtonTags(html: string): string[] {
  return html.match(/<button\b[^>]*\brole="tab"[^>]*>/g) ?? [];
}

describe("SeoPanelTabs", () => {
  it("renders a stable data-seo-panel-tab hook on every tab button", () => {
    // The controller's click-to-fix flows (focusPublishBlocker /
    // focusSeoSetting) activate the Settings tab through this attribute, so a
    // blocker pointing at a field inside the hidden Settings tabpanel can
    // reveal it before focusing.
    const html = renderTabs();
    const tags = tabButtonTags(html);

    expect(tags).toHaveLength(2);
    expect(tags[0]).toContain('data-seo-panel-tab="readiness"');
    expect(tags[1]).toContain('data-seo-panel-tab="settings"');
  });

  it("keeps the WAI tab pattern: first tab selected with roving tabindex", () => {
    const html = renderTabs();
    const [readinessTab, settingsTab] = tabButtonTags(html);

    expect(readinessTab).toContain('aria-selected="true"');
    expect(readinessTab).toContain('tabindex="0"');
    expect(settingsTab).toContain('aria-selected="false"');
    expect(settingsTab).toContain('tabindex="-1"');
  });

  it("keeps inactive panels mounted but hidden (fields are never dropped)", () => {
    const html = renderTabs();
    const panels = html.match(/<div\b[^>]*\brole="tabpanel"[^>]*>/g) ?? [];

    expect(panels).toHaveLength(2);
    expect(panels[0]).not.toContain("hidden");
    expect(panels[1]).toContain("hidden");
    // The hidden Settings panel content is still in the DOM.
    expect(html).toContain("Fields");
  });
});
