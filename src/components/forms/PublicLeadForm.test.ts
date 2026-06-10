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

  it("offers a 'Not sure yet' choice in all three apply qualification selects", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-unsure",
        intent: "apply",
        submitLabel: "Apply now",
      }),
    );

    // One <option> per qualification select (stage, budget, timeline). Match
    // the rendered text node specifically; the value attribute also carries the
    // string, so a bare substring count would double up.
    const matches = html.match(/>Not sure yet</g) ?? [];
    expect(matches.length).toBe(3);
  });

  it("opts out of native validation so server field errors can render", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-novalidate",
        intent: "apply",
        submitLabel: "Apply now",
      }),
    );

    expect(html).toContain("novalidate");
  });

  it("shows inline errors and aria-invalid from a pre-populated error state", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-errorstate",
        intent: "apply",
        submitLabel: "Apply now",
        initialState: {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: {
            fullName: ["Name is required."],
            email: ["Enter a valid email."],
          },
        },
      }),
    );

    expect(html).toContain("Name is required.");
    expect(html).toContain("Enter a valid email.");
    expect(html).toContain('aria-invalid="true"');
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
