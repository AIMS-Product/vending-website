import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicLeadForm, type PublicLeadFormAction } from "./PublicLeadForm";
import { initialLeadActionState } from "@/app/lead-action-state";
import type { LeadAttribution } from "@/lib/lead-attribution";

// PublicLeadForm calls useRouter() for the apply-success redirect; SSR has no
// app-router context, so provide a minimal mock. The redirect/panel decision
// itself is covered by resolveLeadSuccessTransition in lead-action-state.test.ts
// and exercised end-to-end by the Playwright browser gate.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const attribution: LeadAttribution = {
  source_path: "/resources/start-vending",
  landing_path: "/resources/start-vending",
  referrer: "",
  source_page_id: "page_1",
  source_page_slug: "start-vending",
  target_keyword: "start vending business",
  source_block_id: "block_lead",
  source_cta_tracking_name: "resource_lead_form",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
};

const action: PublicLeadFormAction = async () => initialLeadActionState;

describe("PublicLeadForm", () => {
  it("keeps application qualification fields visible in compact layout", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-compact-apply",
        intent: "apply",
        layout: "compact",
        submitLabel: "Apply now",
      }),
    );

    expect(html).toContain("Business stage");
    expect(html).toContain("Available startup budget");
    expect(html).toContain("Launch timeline");
    expect(html).toContain('name="source_page_slug"');
  });

  it("keeps compact contact forms lightweight", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-compact-contact",
        intent: "contact",
        layout: "compact",
        submitLabel: "Send",
      }),
    );

    expect(html).toContain("Name");
    expect(html).toContain("Email");
    expect(html).not.toContain("Business stage");
    expect(html).not.toContain("Available startup budget");
  });

  it("renders the live form (not a success panel) on first paint", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-contact-initial",
        intent: "contact",
        submitLabel: "Send message",
      }),
    );

    expect(html).toContain("<form");
    expect(html).toContain("Send message");
    expect(html).not.toContain("Message sent");
  });
});
