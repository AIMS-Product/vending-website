import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialLeadActionState } from "@/app/lead-action-state";
import type { LeadAttribution } from "@/lib/lead-attribution";
import {
  NEWSLETTER_LEARN_OPTIONS,
  NEWSLETTER_PULL_OPTIONS,
} from "@/lib/content/newsletter";
import {
  NewsletterSignupForm,
  type NewsletterSignupAction,
} from "./NewsletterSignupForm";

const attribution: LeadAttribution = {
  source_path: "/newsletter",
  landing_path: "/newsletter",
  referrer: "",
  first_landing_url: "https://vendingpreneurs.com/newsletter",
  first_landing_path: "/newsletter",
  first_referrer: "",
  first_touch_at: "2026-08-04T22:00:00.000Z",
  latest_landing_url: "https://vendingpreneurs.com/newsletter",
  latest_landing_path: "/newsletter",
  latest_referrer: "",
  latest_touch_at: "2026-08-04T22:00:00.000Z",
  vp_session_id: "vp-newsletter-session",
  source_page_id: "coded:newsletter",
  source_page_slug: "newsletter",
  target_keyword: "",
  source_block_id: "newsletter_signup",
  source_cta_tracking_name: "newsletter-signup-form",
  clicked_href: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  gclid: "",
  fbclid: "",
  gbraid: "",
  wbraid: "",
  paid_platform: "",
  paid_source_key: "",
  campaign_id: "",
  campaign_name: "",
  adset_id: "",
  adset_name: "",
  ad_group_id: "",
  ad_group_name: "",
  group_id: "",
  group_name: "",
  ad_id: "",
  ad_name: "",
};

const action: NewsletterSignupAction = async () => initialLeadActionState;
const started = {
  status: "success" as const,
  message: "You're in. Two quick questions.",
  leadId: "lead_1",
  sessionToken: "newsletter-token",
};

describe("NewsletterSignupForm", () => {
  it("renders only name, email, and truthful opt-ins in stage 1", () => {
    const html = renderToStaticMarkup(
      createElement(NewsletterSignupForm, {
        action,
        finishAction: action,
        attribution,
        idempotencyKey: "newsletter-key",
      }),
    );

    expect(html).toContain('id="newsletter-signup-step-1"');
    expect(html).toContain('data-form-step="1"');
    expect(html).toContain('name="full_name"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="newsletter_email_consent"');
    expect(html).toContain('name="program_updates_consent"');
    expect(html).toContain("Join The Route — free");
    expect(html).not.toContain('name="phone"');
    expect(html).not.toContain('name="pull_to_launch"');
    expect(html).not.toContain('name="learn_most"');
  });

  it("swaps to optional phone and newsletter questions using only the token", () => {
    const html = renderToStaticMarkup(
      createElement(NewsletterSignupForm, {
        action,
        finishAction: action,
        attribution,
        idempotencyKey: "newsletter-key",
        initialState: started,
        initialSubmittedValues: { email: "jordan@example.com" },
      }),
    );

    expect(html).toContain('id="newsletter-signup-step-2"');
    expect(html).toContain('data-form-step="2"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('name="session_token"');
    expect(html).toContain('value="newsletter-token"');
    expect(html).not.toContain("lead_1");
    expect(html).toContain('name="phone"');
    expect(html).toContain('name="sms_updates_consent"');
    expect(html).toContain('name="pull_to_launch"');
    expect(html).toContain('name="learn_most"');
    for (const option of [
      ...NEWSLETTER_PULL_OPTIONS,
      ...NEWSLETTER_LEARN_OPTIONS,
    ]) {
      expect(html).toContain(`value="${option.value}"`);
      expect(html).toContain(option.label.replaceAll("&", "&amp;"));
    }
  });

  it("preserves multi-select answers and phone when stage 2 fails", () => {
    const html = renderToStaticMarkup(
      createElement(NewsletterSignupForm, {
        action,
        finishAction: action,
        attribution,
        idempotencyKey: "newsletter-key",
        initialState: started,
        initialFinishState: {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: { phone: ["Add a phone number for text updates."] },
        },
        initialSubmittedValues: {
          email: "jordan@example.com",
          phone: "555-0199",
          pull_to_launch: ["replace_job", "diversify_income"],
          learn_most: ["locations"],
        },
      }),
    );

    expect(html).toContain("Add a phone number for text updates.");
    expect(html).toContain('value="555-0199"');
    expect(html).toContain('checked="" value="replace_job"');
    expect(html).toContain('checked="" value="diversify_income"');
    expect(html).toContain('checked="" value="locations"');
  });

  it("renders an in-place success panel after stage 2", () => {
    const html = renderToStaticMarkup(
      createElement(NewsletterSignupForm, {
        action,
        finishAction: action,
        attribution,
        idempotencyKey: "newsletter-key",
        initialState: started,
        initialFinishState: {
          status: "success",
          message: "Welcome to The Route.",
          leadId: "lead_1",
        },
      }),
    );

    expect(html).not.toContain("<form");
    expect(html).toContain('role="status"');
    expect(html).toContain("You&#x27;re on The Route");
    expect(html).toContain("Watch your inbox");
  });
});
