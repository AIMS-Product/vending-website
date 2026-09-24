import { describe, expect, it } from "vitest";
import { NEWSLETTER_FORM_ID } from "@/lib/content/newsletter";
import { markNewsletterSubscription } from "./newsletter-session-lifecycle";
import { hashQualificationSessionToken } from "./qualification-sessions";

const NOW = new Date("2026-09-23T12:00:00.000Z");

// Just enough of the Supabase query builder for markNewsletterSubscription:
// every chain resolves to `result`, and updates are recorded per table.
function fakeClient() {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const rows: Record<string, unknown> = {
    qualification_sessions: {
      id: "session_1",
      lead_submission_id: "lead_1",
      form_id: NEWSLETTER_FORM_ID,
      session_token_hash: hashQualificationSessionToken("token"),
      status: "active",
      user_agent: "vitest",
      consent_source_attribution: {},
      expires_at: "2026-10-23T00:00:00.000Z",
    },
    qualification_answers: [
      {
        question_id: "email_consent",
        answer_value: true,
        question_snapshot: { label: "Email me The Route" },
      },
    ],
    close_sync_events: { id: "event_1" },
  };

  const client = {
    from(table: string) {
      const result = { data: rows[table] ?? null, error: null };
      const chain: Record<string, unknown> = {
        then: (resolve: (value: typeof result) => unknown) => resolve(result),
      };
      for (const method of [
        "select",
        "eq",
        "order",
        "insert",
        "maybeSingle",
        "single",
      ]) {
        chain[method] = () => chain;
      }
      chain.update = (patch: Record<string, unknown>) => {
        updates.push({ table, patch });
        return chain;
      };
      return chain;
    },
  };
  return { client: client as never, updates };
}

describe("markNewsletterSubscription", () => {
  it("records when the person subscribed, alongside the lifecycle status", async () => {
    const fake = fakeClient();

    await markNewsletterSubscription(
      {
        sessionToken: "token",
        newsletterFormId: NEWSLETTER_FORM_ID,
        requiredConsentQuestionId: "email_consent",
      },
      { client: fake.client, now: () => NOW },
    );

    const lead = fake.updates.find(
      (update) => update.table === "lead_submissions",
    );
    expect(lead?.patch).toMatchObject({
      lifecycle_status: "newsletter_subscribed",
      newsletter_subscribed_at: NOW.toISOString(),
    });
  });
});
