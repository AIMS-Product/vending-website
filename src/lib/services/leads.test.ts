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
