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

    expect(html).toContain("First name");
    expect(html).toContain("Last name");
    expect(html).toContain("Email");
    expect(html).toContain("Phone");
    expect(html).toContain('name="first_name"');
    expect(html).toContain('name="last_name"');
    expect(html).toMatch(/First name[\s\S]*?\(required\)/);
    expect(html).toMatch(/Last name[\s\S]*?\(required\)/);
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

  it("does not render inline qualification fields unless inlineQualification is set", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-qualification-noinline",
        intent: "qualification",
        submitLabel: "See if I qualify",
      }),
    );

    expect(html).not.toContain('name="consent_updates"');
    expect(html).not.toContain('name="consent_contact"');
    expect(html).not.toContain('name="timeline"');
    expect(html).not.toContain('name="invest"');
  });

  it("renders the consent checkboxes and timeline/invest dropdowns inline", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-inline-fields",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "See if I qualify",
      }),
    );

    expect(html).toContain('name="consent_updates"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Email me the guide and vending resources.");
    expect(html).toContain('name="consent_contact"');
    expect(html).toContain(
      "I agree to receive calls and texts about my request. Msg rates may apply.",
    );
    expect(html).toContain('name="timeline"');
    expect(html).toContain(
      "When do you want your first machine placed and earning?",
    );
    expect(html).toContain(">As soon as possible<");
    expect(html).toContain('name="invest"');
    expect(html).toContain("How much are you ready to invest?");
    expect(html).toContain(">$15,000+<");
    // Not part of the inline qualification funnel.
    expect(html).not.toContain("City");
    expect(html).not.toContain("Business stage");
  });

  it("shows inline errors for the consent and timeline/invest fields from a pre-populated error state", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-inline-errors",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "See if I qualify",
        initialState: {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: {
            consent_updates: ["Consent is required."],
            consent_contact: ["Consent is required."],
            timeline: ["Timeline is required."],
            invest: ["Investment amount is required."],
          },
        },
      }),
    );

    // Every failed field is listed in the top summary with an anchor.
    expect(html).toMatch(/4 problems with your qualification step/);
    expect(html).toContain('href="#lead-consent_updates"');
    expect(html).toContain('href="#lead-consent_contact"');
    expect(html).toContain('href="#lead-timeline"');
    expect(html).toContain('href="#lead-invest"');
    // Inline per-field error text also renders.
    const consentErrorCount = (html.match(/Consent is required\./g) ?? [])
      .length;
    expect(consentErrorCount).toBeGreaterThanOrEqual(2);
  });

  it("renders the fit result panel inline on a scored qualification success (no navigation)", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-inline-success",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "See if I qualify",
        initialState: {
          status: "success",
          message: "Thanks — here's your fit.",
          leadId: "lead_1",
          qualification: { thankYouState: "perfect_fit", score: 100 },
        },
      }),
    );

    expect(html).not.toContain("<form");
    expect(html).toContain('data-qualification-state="perfect_fit"');
    expect(html).toContain('data-qualification-score="100"');
    // Call-worthy bands book inline (per Kody, 2026-08-07): the band's
    // calendar replaces the fit message, so the visitor books in place.
    expect(html).not.toContain("You&#x27;re a perfect fit for vending.");
    expect(html).toMatch(/<iframe[^>]+src="https:\/\/calendly\.com\/[^"]+"/);
    expect(html).toContain("embed_type=Inline");
    // Perfect fit books the Lane 1 top-closer consultation.
    expect(html).toContain("cvr6-cfd-zgd/vendingpreneurs-consultation-call");
  });

  it("routes a not_right_time result to the roadmap download with a book-a-call subtext", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-inline-nrt",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "See if I qualify",
        initialState: {
          status: "success",
          message: "Thanks — here's your fit.",
          leadId: "lead_2",
          qualification: { thankYouState: "not_right_time", score: 20 },
        },
      }),
    );

    expect(html).toContain('data-qualification-state="not_right_time"');
    // Primary CTA downloads the roadmap PDF (Kody's Drive file).
    expect(html).toContain("Download your free 90-Day Vending Roadmap");
    expect(html).toContain("drive.google.com/uc?export=download");
    expect(html).toContain("1iORHjmg_UzU3tr5EKcEBp8XIQ-8qoNSm");
    // Subtext note + book-a-call fallback to the setter/quick-discovery call.
    expect(html).toContain("Think you&#x27;re ready?");
    expect(html).toContain("cvsd-wxt-cvb/vendingpreneurs-quick-discovery");
  });

  it("renders a divider between the consent checks and the qualifying questions", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-inline-divider",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "See if I qualify",
      }),
    );

    expect(html).toContain('data-testid="qualification-divider"');
  });

  // --- Two-stage inline funnel -------------------------------------------
  // Passing `finishAction` splits the inline qualification form: stage 1 is
  // contact + consents (the lead is captured there), stage 2 swaps in the
  // timeline/invest questions in the same card. Every other caller — including
  // inlineQualification without a finishAction — keeps the one-shot form.
  // See .claude/specs/2026-07-28-two-stage-inline-contact-form.md.
  const finishAction: PublicLeadFormAction = async () => initialLeadActionState;

  const stageOneStarted = {
    status: "success" as const,
    message: "Continue to the questions.",
    leadId: "lead_stage_one",
    sessionToken: "raw_stage_token",
  };

  it("keeps the qualifying questions out of stage 1 when a finishAction is set", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-two-stage-one",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "Submit",
      }),
    );

    // Contact + both consents are collected up front — consent is what makes
    // the lead contactable, so it cannot sit behind a second submit.
    expect(html).toContain('name="first_name"');
    expect(html).toContain('name="last_name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('name="consent_updates"');
    expect(html).toContain('name="consent_contact"');
    // The questions belong to stage 2.
    expect(html).not.toContain('name="timeline"');
    expect(html).not.toContain('name="invest"');
    // The divider separated the consents from the questions; they are no
    // longer adjacent, so it goes.
    expect(html).not.toContain('data-testid="qualification-divider"');
  });

  it("swaps the contact fields for the questions once stage 1 has started", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-two-stage-two",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "Submit",
        initialState: stageOneStarted,
        initialSubmittedValues: { email: "buyer@example.com" },
      }),
    );

    // Same card, new fields — no navigation, no page load.
    expect(html).toContain("<form");
    expect(html).toContain('name="timeline"');
    expect(html).toContain(
      "When do you want your first machine placed and earning?",
    );
    expect(html).toContain('name="invest"');
    expect(html).toContain("How much are you ready to invest?");
    // The stage-1 fields are gone.
    expect(html).not.toContain('name="first_name"');
    expect(html).not.toContain('name="last_name"');
    expect(html).not.toContain('name="consent_updates"');
    expect(html).not.toContain('name="consent_contact"');
    expect(html).not.toContain('type="email"');
    // Stage 2 identifies the session by token only — never by lead id.
    expect(html).toContain('name="session_token"');
    expect(html).toContain('value="raw_stage_token"');
    expect(html).not.toContain("lead_stage_one");
  });

  // --- /book-now: stage 1, then straight to the setter calendar -----------
  // Kody, 2026-08-10. Same stage 1 as the scored funnel (so the lead is still
  // persisted, consented and synced), but no questions and no scoring — the
  // calendar takes the card as soon as stage 1 succeeds.
  it("replaces stage 2 with the booking calendar when bookingEmbedUrl is set", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-book-now",
        intent: "qualification",
        inlineQualification: true,
        bookingEmbedUrl:
          "https://calendly.com/d/cvsd-wxt-cvb/vendingpreneurs-quick-discovery",
        submitLabel: "Submit",
        initialState: stageOneStarted,
        initialSubmittedValues: {
          email: "buyer@example.com",
          full_name: "Casey Buyer",
        },
      }),
    );

    // The setter calendar, opened on the date picker and prefilled so the
    // Calendly booking webhook still joins back to this lead.
    expect(html).toMatch(/<iframe[^>]+src="https:\/\/calendly\.com\/[^"]+"/);
    expect(html).toContain("cvsd-wxt-cvb/vendingpreneurs-quick-discovery");
    expect(html).toContain("embed_type=Inline");
    expect(html).toContain("Casey+Buyer");
    expect(html).toContain("buyer%40example.com");
    // No scoring questions, and no second form to submit.
    expect(html).not.toContain('name="timeline"');
    expect(html).not.toContain('name="invest"');
    expect(html).not.toContain("<form");
  });

  it("still collects both consents before showing the booking calendar", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        hiddenFields: { qualification_form_id: "form_1" },
        idempotencyKey: "lead-book-now-stage-1",
        intent: "qualification",
        inlineQualification: true,
        bookingEmbedUrl:
          "https://calendly.com/d/cvsd-wxt-cvb/vendingpreneurs-quick-discovery",
        submitLabel: "Submit",
      }),
    );

    expect(html).toContain('name="consent_updates"');
    expect(html).toContain('name="consent_contact"');
    // The calendar only appears after stage 1 succeeds.
    expect(html).not.toContain("<iframe");
  });

  it("shows who stage 2 is continuing for", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        idempotencyKey: "lead-two-stage-who",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "Submit",
        initialState: stageOneStarted,
        initialSubmittedValues: { email: "buyer@example.com" },
      }),
    );

    expect(html).toContain("buyer@example.com");
  });

  it("preserves the chosen answers when stage 2 fails validation", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        idempotencyKey: "lead-two-stage-error",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "Submit",
        initialState: stageOneStarted,
        initialFinishState: {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: { invest: ["Investment amount is required."] },
        },
        initialSubmittedValues: {
          email: "buyer@example.com",
          timeline: "few_weeks",
        },
      }),
    );

    // Still on stage 2, with the error surfaced...
    expect(html).toContain("Investment amount is required.");
    expect(html).toContain('href="#lead-invest"');
    // ...and the answer the visitor already picked still selected.
    expect(html).toContain('<option value="few_weeks" selected="">');
  });

  it("renders the fit result from the stage-2 action state", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        idempotencyKey: "lead-two-stage-result",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "Submit",
        initialState: stageOneStarted,
        initialFinishState: {
          status: "success",
          message: "Thanks — here's your fit.",
          leadId: "lead_stage_one",
          qualification: { thankYouState: "strong_fit", score: 70 },
        },
      }),
    );

    expect(html).not.toContain("<form");
    expect(html).toContain('data-qualification-state="strong_fit"');
    expect(html).toContain('data-qualification-score="70"');
  });

  it("does not advance to stage 2 when the start action returns no token", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        finishAction,
        attribution,
        idempotencyKey: "lead-two-stage-notoken",
        intent: "qualification",
        inlineQualification: true,
        submitLabel: "Submit",
        initialState: {
          status: "success",
          message: "Captured.",
          leadId: "lead_no_token",
        },
      }),
    );

    expect(html).toContain('name="first_name"');
    expect(html).not.toContain('name="timeline"');
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
