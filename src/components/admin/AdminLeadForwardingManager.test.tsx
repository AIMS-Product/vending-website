import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminLeadForwardingManager } from "./AdminLeadForwardingManager";
import type {
  LeadForwardCaptureCounts,
  LeadForwardSettings,
} from "@/lib/services/lead-forward-settings";

vi.mock("@/app/admin/settings/lead-forwarding/actions", () => ({
  saveLeadForwarding: vi.fn(),
  sendLeadForwardTest: vi.fn(),
}));

const counts: LeadForwardCaptureCounts = {
  captureTypes: [
    { type: "booking", count: 479 },
    { type: "application", count: 44 },
    { type: "chat", count: 56 },
    { type: "lead_magnet", count: 25 },
    { type: "newsletter", count: 0 },
  ],
  trafficSources: [
    { source: "youtube", count: 170 },
    { source: "(none)", count: 174 },
  ],
  total: 604,
  days: 30,
};

const settings: LeadForwardSettings = {
  enabled: false,
  webhookUrl: null,
  captureTypes: ["booking", "application", "chat"],
  trafficSourceMode: "all",
  trafficSources: [],
  fieldIds: {},
  updatedAt: null,
  updatedBy: null,
};

function render(
  overrides: Partial<Parameters<typeof AdminLeadForwardingManager>[0]> = {},
) {
  return renderToStaticMarkup(
    <AdminLeadForwardingManager
      settings={settings}
      counts={counts}
      currentUserRole="super_admin"
      hasApiCredentials={false}
      {...overrides}
    />,
  );
}

describe("AdminLeadForwardingManager", () => {
  it("shows each capture type with its real volume", () => {
    const html = render();

    expect(html).toContain("Booking forms");
    expect(html).toContain("479");
    expect(html).toContain("Guide downloads");
    expect(html).toContain("25");
    expect(html).toContain("Newsletter signups");
  });

  it("totals only the selected capture types", () => {
    // booking 479 + application 44 + chat 56, with guide downloads excluded.
    expect(render()).toContain("579");
  });

  it("defaults to forwarding every traffic source", () => {
    const html = render();

    expect(html).toContain("Every traffic source");
    expect(html).toMatch(/<input type="radio"[^>]*checked=""[^>]*value="all"/);
    // The allowlist is hidden until it is chosen, so nothing implies that
    // unticked sources are being dropped today.
    expect(html).not.toContain("No source tag");
  });

  it("locks every control for an admin who is not a super admin", () => {
    const html = render({ currentUserRole: "admin" });

    expect(html).toContain("read-only for your account");
    expect(html).toContain("disabled");
  });

  it("says when the feed was last changed", () => {
    const html = render({
      settings: {
        ...settings,
        enabled: true,
        webhookUrl: "https://hooks.example.com/abc",
        updatedAt: "2026-09-22T17:00:00.000Z",
        updatedBy: "adam@modern-amenities.com",
      },
    });

    expect(html).toContain("adam@modern-amenities.com");
    expect(html).toContain("https://hooks.example.com/abc");
  });
});
