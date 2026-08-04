import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CODED_ROUTE_PATHS } from "@/lib/page-builder/coded-route-paths";
import {
  NEWSLETTER_FORM_ID,
  NEWSLETTER_EMAIL_CONSENT_LABEL,
  NEWSLETTER_LEARN_OPTIONS,
  NEWSLETTER_META_DESCRIPTION,
  NEWSLETTER_PAGE_TITLE,
  NEWSLETTER_PULL_OPTIONS,
  NEWSLETTER_PROGRAM_UPDATES_CONSENT_LABEL,
  NEWSLETTER_QUESTION_IDS,
  NEWSLETTER_SMS_CONSENT_LABEL,
  newsletterPageContent,
} from "./newsletter";

describe("newsletter page content", () => {
  it("uses Kody's exact route metadata and is registered with the proxy", () => {
    expect(NEWSLETTER_PAGE_TITLE).toBe(
      "Sign Up for the Route | Vendingpreneurs Newsletter",
    );
    expect(NEWSLETTER_META_DESCRIPTION).toBe(
      "Get weekly insights, case studies, and musings on vending, ownership, and practical entrepreneurship from Mike Hoffmann and Anthony Kolodziej.",
    );
    expect(CODED_ROUTE_PATHS.has("/newsletter")).toBe(true);
  });

  it("keeps the decoded reference copy in typed content", () => {
    expect(newsletterPageContent.hero.heading).toBe(
      "Learn to Build Something That Earns Without You",
    );
    expect(newsletterPageContent.hero.body).toBe(
      "Weekly insights on vending, ownership, and practical entrepreneurship.",
    );
    expect(newsletterPageContent.experts.map((expert) => expert.name)).toEqual([
      "Anthony Kolodziej",
      "Mike Hoffmann",
    ]);
  });

  it("keeps the optional question values stable for stored answers", () => {
    expect(NEWSLETTER_PULL_OPTIONS.map((option) => option.value)).toEqual([
      "replace_job",
      "generational_wealth",
      "diversify_income",
      "life_event",
      "other",
    ]);
    expect(NEWSLETTER_LEARN_OPTIONS.map((option) => option.value)).toEqual([
      "getting_started",
      "machines_products",
      "locations",
      "financing",
      "legal",
    ]);
    expect(NEWSLETTER_FORM_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("stores exactly the consent copy shown to visitors", () => {
    const sql = readFileSync(
      new URL(
        "../../../supabase/migrations/20260804153000_seed_newsletter_signup_form.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const schemas = Array.from(
      sql.matchAll(/'(\{"version":1.*?\})'::jsonb/g),
      (match) =>
        JSON.parse(match[1]!.replaceAll("''", "'")) as {
          questions: Array<{ id: string; label: string }>;
        },
    );

    expect(schemas).toHaveLength(2);
    for (const schema of schemas) {
      const labels = Object.fromEntries(
        schema.questions.map((question) => [question.id, question.label]),
      );
      expect(labels[NEWSLETTER_QUESTION_IDS.emailConsent]).toBe(
        NEWSLETTER_EMAIL_CONSENT_LABEL,
      );
      expect(labels[NEWSLETTER_QUESTION_IDS.programUpdatesConsent]).toBe(
        NEWSLETTER_PROGRAM_UPDATES_CONSENT_LABEL,
      );
      expect(labels[NEWSLETTER_QUESTION_IDS.smsUpdatesConsent]).toBe(
        NEWSLETTER_SMS_CONSENT_LABEL,
      );
    }
  });
});
