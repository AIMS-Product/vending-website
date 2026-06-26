import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicLeadForm, type PublicLeadFormAction } from "./PublicLeadForm";
import { initialLeadActionState } from "@/app/lead-action-state";
import {
  emptyLeadAttribution,
  type LeadAttribution,
} from "@/lib/lead-attribution";

// PublicLeadForm calls useRouter() for the apply-success redirect; SSR has no
// app-router context, so provide a minimal mock. The redirect/panel decision
// itself is covered by resolveLeadSuccessTransition in lead-action-state.test.ts
// and exercised end-to-end by the Playwright browser gate.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const attribution: LeadAttribution = {
  ...emptyLeadAttribution("/resources/start-vending"),
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
  gclid: "test-gclid",
  fbclid: "",
  gbraid: "",
  wbraid: "",
  paid_platform: "google_ads",
  paid_source_key: "",
  campaign_id: "camp-1",
  campaign_name: "Campaign one",
  adset_id: "",
  adset_name: "",
  ad_group_id: "group-1",
  ad_group_name: "Ad group one",
  group_id: "",
  group_name: "",
  ad_id: "ad-1",
  ad_name: "Ad one",
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
    expect(html).toContain('name="gclid"');
    expect(html).toContain('value="test-gclid"');
    expect(html).toContain('name="ad_group_id"');
    expect(html).toContain('value="group-1"');
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

  it("renders only short contact fields for qualification intake", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        hiddenFields: {
          qualification_form_id: "form_1",
          qualification_completion_redirect_path: "/book-call",
          qualification_experiment_key: "post_submit",
          qualification_variant_key: "a",
        },
        idempotencyKey: "lead-qualification-short",
        intent: "qualification",
        submitLabel: "Continue",
      }),
    );

    expect(html).toContain("Name");
    expect(html).toContain("Email");
    expect(html).toContain("Phone");
    expect(html).toMatch(/Name[\s\S]*?\(required\)/);
    expect(html).toMatch(/Email[\s\S]*?\(required\)/);
    expect(html).toMatch(/Phone[\s\S]*?\(required\)/);
    expect(html).toContain('name="qualification_form_id"');
    expect(html).toContain('value="form_1"');
    expect(html).not.toContain("City");
    expect(html).not.toContain("State");
    expect(html).not.toContain("Business stage");
    expect(html).not.toContain("Available startup budget");
    expect(html).not.toContain("Launch timeline");
    expect(html).not.toContain("What are you trying to build?");
    expect(html).not.toContain("Message");
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

  it("shows a privacy assurance with a link to /privacy on the apply form", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-privacy",
        intent: "apply",
        submitLabel: "Apply now",
      }),
    );

    expect(html).toContain('href="/privacy"');
    expect(html).toContain("Privacy Policy");
    expect(html).toMatch(/By applying/);
    expect(html).toContain("We never sell your data");
  });

  it("shows privacy assurance with contact-appropriate copy on the contact form", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-contact-privacy",
        intent: "contact",
        submitLabel: "Send message",
      }),
    );

    expect(html).toContain('href="/privacy"');
    expect(html).toMatch(/By sending/);
    expect(html).toContain("We never sell your data");
  });

  it("marks optional fields with an (optional) suffix and leaves required fields unmarked", () => {
    const contactHtml = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-contact-optional",
        intent: "contact",
        submitLabel: "Send message",
      }),
    );

    // Contact: State is optional, so its visible label gains "(optional)".
    expect(contactHtml).toMatch(/State[\s\S]*?\(optional\)/);
    // Phone is optional on both forms.
    expect(contactHtml).toMatch(/Phone[\s\S]*?\(optional\)/);
    // Required fields do not get the optional suffix on their own label.
    expect(contactHtml).toMatch(/Email[\s\S]*?\(required\)/);

    const applyHtml = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-optional",
        intent: "apply",
        submitLabel: "Apply now",
      }),
    );

    // Apply: State is required, so it keeps the required marker, not optional.
    expect(applyHtml).toMatch(/State[\s\S]*?\(required\)/);
    // Apply: the message field is optional, so it gains "(optional)".
    expect(applyHtml).toMatch(
      /What are you trying to build\?[\s\S]*?\(optional\)/,
    );
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
