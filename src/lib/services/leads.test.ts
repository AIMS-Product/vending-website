import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LeadValidationError,
  submitLead,
  type LeadNotificationEnv,
  type SubmitLeadInput,
} from "./leads";
import type { Database } from "@/types/database";

const notificationEnv: LeadNotificationEnv = {
  RESEND_API_KEY: "re_test_key",
  LEAD_NOTIFICATION_TO: "ops@example.com",
  LEAD_NOTIFICATION_FROM: "Vendingpreneurs <leads@example.com>",
};

const validLead: SubmitLeadInput = {
  formType: "apply",
  idempotencyKey: "lead-key-1",
  fullName: " Jane Applicant ",
  email: "JANE@EXAMPLE.COM",
  phone: "555-0101",
  city: "Austin",
  stateRegion: "Texas",
  businessStage: "First location",
  budget: "$10k-$25k",
  timeline: "30 days",
  message: "I am ready to start.",
  sourcePath: "/book-a-call",
  landingPath: "/apply",
  referrer: "https://www.vendingpreneurs.com/book-a-call",
  sourcePageId: "11111111-1111-4111-8111-111111111111",
  sourcePageSlug: "start-vending",
  targetKeyword: "start vending business",
  sourceBlockId: "block_lead",
  sourceCtaTrackingName: "resource_lead_form",
  userAgent: "vitest",
  utmSource: "google",
  utmMedium: "cpc",
  utmCampaign: "spring",
};

function buildLeadClient({
  existing = null,
  insertError = null,
  updateError = null,
}: {
  existing?: Record<string, unknown> | null;
  insertError?: Record<string, unknown> | null;
  updateError?: Record<string, unknown> | null;
} = {}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: existing, error: null });
  const eqAfterSelect = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eqAfterSelect });

  const single = vi.fn().mockResolvedValue({
    data: {
      id: "lead-1",
      status: "received",
      notification_error: null,
      notification_sent_at: null,
    },
    error: insertError,
  });
  const selectAfterInsert = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });

  const eqAfterUpdate = vi.fn().mockResolvedValue({ error: updateError });
  const update = vi.fn().mockReturnValue({ eq: eqAfterUpdate });

  const from = vi.fn().mockReturnValue({ select, insert, update });

  return {
    client: { from } as unknown as Pick<SupabaseClient<Database>, "from">,
    mocks: {
      from,
      select,
      eqAfterSelect,
      maybeSingle,
      insert,
      selectAfterInsert,
      single,
      update,
      eqAfterUpdate,
    },
  };
}

describe("submitLead", () => {
  it("stores the audit row before sending notifications and marks success", async () => {
    const { client, mocks } = buildLeadClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await submitLead(validLead, {
      client,
      env: notificationEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-05-04T09:00:00.000Z"),
    });

    expect(result).toEqual({
      status: "accepted",
      leadId: "lead-1",
      duplicate: false,
      notificationStatus: "notified",
      notificationError: null,
    });

    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0],
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotency_key: "lead-key-1",
        form_type: "apply",
        status: "received",
        full_name: "Jane Applicant",
        email: "jane@example.com",
        source_path: "/book-a-call",
        source_page_id: "11111111-1111-4111-8111-111111111111",
        source_page_slug: "start-vending",
        target_keyword: "start vending business",
        source_block_id: "block_lead",
        source_cta_tracking_name: "resource_lead_form",
        utm_source: "google",
        metadata: expect.objectContaining({
          notification_email_configured: true,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test_key",
        }),
      }),
    );
    const emailBody = JSON.parse(
      fetchMock.mock.calls[0]?.[1]?.body as string,
    ) as { text: string };
    expect(emailBody.text).toContain("Form: apply");
    expect(emailBody.text).toContain("Name: Jane Applicant");
    expect(emailBody.text).toContain("Email: jane@example.com");
    expect(emailBody.text).toContain("State: Texas");
    expect(emailBody.text).toContain("Business stage: First location");
    expect(emailBody.text).toContain("Budget: $10k-$25k");
    expect(emailBody.text).toContain("Timeline: 30 days");
    expect(emailBody.text).toContain("Source CTA: resource_lead_form");
    expect(emailBody.text).toContain("Message:\nI am ready to start.");
    expect(mocks.update).toHaveBeenCalledWith({
      status: "notified",
      notification_attempted_at: "2026-05-04T09:00:00.000Z",
      notification_sent_at: "2026-05-04T09:00:00.000Z",
      notification_error: null,
    });
  });

  it("rejects malformed payloads before touching Supabase", async () => {
    const { client, mocks } = buildLeadClient();

    await expect(
      submitLead(
        { ...validLead, email: "not-an-email" },
        { client, env: notificationEnv },
      ),
    ).rejects.toBeInstanceOf(LeadValidationError);

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects apply leads without qualification fields before touching Supabase", async () => {
    const { client, mocks } = buildLeadClient();

    await expect(
      submitLead(
        {
          ...validLead,
          stateRegion: "",
          businessStage: "",
          budget: "",
          timeline: "",
        },
        { client, env: notificationEnv },
      ),
    ).rejects.toMatchObject({
      fieldErrors: {
        stateRegion: ["State is required."],
        businessStage: ["Business stage is required."],
        budget: ["Budget is required."],
        timeline: ["Timeline is required."],
      },
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows contact leads without application qualification fields", async () => {
    const { client, mocks } = buildLeadClient();
    const fetchMock = vi.fn();

    const result = await submitLead(
      {
        formType: "contact",
        idempotencyKey: "contact-key-1",
        fullName: "Contact Lead",
        email: "contact@example.com",
      },
      {
        client,
        env: {},
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );

    expect(result.status).toBe("accepted");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        form_type: "contact",
        state_region: null,
        business_stage: null,
        budget: null,
        timeline: null,
      }),
    );
  });

  it("sends Slack notifications with resource context after email succeeds", async () => {
    const { client, mocks } = buildLeadClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const result = await submitLead(validLead, {
      client,
      env: {
        ...notificationEnv,
        SLACK_WEBHOOK_URL: "https://hooks.slack.test/lead",
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-05-04T09:30:00.000Z"),
    });

    expect(result.notificationStatus).toBe("notified");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://hooks.slack.test/lead",
      expect.objectContaining({ method: "POST" }),
    );
    const slackBody = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as { text: string };
    expect(slackBody.text).toContain("*New application lead*");
    expect(slackBody.text).toContain("Jane Applicant <jane@example.com>");
    expect(slackBody.text).toContain("Source: /book-a-call");
    expect(slackBody.text).toContain("Resource: start-vending");
    expect(slackBody.text).toContain("CTA: resource_lead_form");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "notified" }),
    );
  });

  it("returns an existing lead for a duplicate idempotency key without notifying twice", async () => {
    const { client, mocks } = buildLeadClient({
      existing: {
        id: "lead-existing",
        status: "notified",
        notification_error: null,
        notification_sent_at: "2026-05-04T09:00:00.000Z",
      },
    });
    const fetchMock = vi.fn();

    const result = await submitLead(validLead, {
      client,
      env: notificationEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual({
      status: "accepted",
      leadId: "lead-existing",
      duplicate: true,
      notificationStatus: "notified",
      notificationError: null,
    });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("keeps the lead row when Resend returns a 5xx", async () => {
    const { client, mocks } = buildLeadClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("provider down", { status: 502 }));

    const result = await submitLead(validLead, {
      client,
      env: notificationEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-05-04T09:10:00.000Z"),
    });

    expect(mocks.insert).toHaveBeenCalled();
    expect(result.notificationStatus).toBe("notification_failed");
    expect(result.notificationError).toContain("502");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "notification_failed",
        notification_attempted_at: "2026-05-04T09:10:00.000Z",
        notification_sent_at: null,
        notification_error: expect.stringContaining("502"),
      }),
    );
  });

  it("stores the lead and records a notification failure when env is missing", async () => {
    const { client, mocks } = buildLeadClient();
    const fetchMock = vi.fn();

    const result = await submitLead(validLead, {
      client,
      env: {},
      fetchImpl: fetchMock as unknown as typeof fetch,
      now: () => new Date("2026-05-04T09:20:00.000Z"),
    });

    expect(result.notificationStatus).toBe("notification_failed");
    expect(result.notificationError).toBe(
      "Lead email notification is not configured.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "notification_failed",
        notification_error: "Lead email notification is not configured.",
      }),
    );
  });
});
