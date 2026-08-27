import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CHATBOT_CONFIG } from "./config";
import { buildBody, emailHandoff, handoffRecipients } from "./handoff-email";

const config = {
  ...DEFAULT_CHATBOT_CONFIG,
  leadRoutingEmails: "sales@example.com, setter@example.com",
  supportEmail: null,
};

function fakeClient(row: Record<string, unknown> | null) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      }),
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { client: client as never, updates };
}

const row = {
  id: "conv-1",
  captured_name: "Raul Guevara",
  captured_email: "raul@example.com",
  captured_phone: "2108422349",
  page_url: "/",
  created_at: "2026-08-27T14:22:00Z",
  messages: [
    {
      role: "user",
      content: "I want to pause my account",
      ts: "2026-08-27T14:22:00Z",
    },
    {
      role: "assistant",
      content: "I can connect you with support.",
      ts: "2026-08-27T14:22:30Z",
    },
  ],
};

describe("handoffRecipients", () => {
  it("routes support to the support inbox and everything else to lead routing", () => {
    expect(handoffRecipients("support", config)).toEqual([
      "jade@modern-amenities.com",
    ]);
    expect(handoffRecipients("callback", config)).toEqual([
      "sales@example.com",
      "setter@example.com",
    ]);
    expect(
      handoffRecipients("support", { ...config, supportEmail: "x@y.com" }),
    ).toEqual(["x@y.com"]);
  });

  it("never sends a sales hand-off nowhere", () => {
    expect(
      handoffRecipients("manual", { ...config, leadRoutingEmails: null }),
    ).toEqual(["jade@modern-amenities.com"]);
  });
});

describe("emailHandoff", () => {
  it("sends the transcript with reply-to the visitor and stamps the receipt", async () => {
    const send = vi.fn(async () => ({ ok: true as const }));
    const { client, updates } = fakeClient(row);
    const receipt = await emailHandoff(
      {
        conversationId: "conv-1",
        reason: "support",
        summary: "[support] Visitor wants to pause their account",
        triggeredBy: "Mia (site chat)",
      },
      { client, config, send, now: () => new Date("2026-08-27T14:23:00Z") },
    );
    expect(receipt).toEqual({
      sent: true,
      to: ["jade@modern-amenities.com"],
      at: "2026-08-27T14:23:00.000Z",
    });
    const call = (send.mock.calls as unknown[][])[0]![0] as {
      to: string[];
      subject: string;
      text: string;
      replyTo?: string[];
    };
    expect(call.replyTo).toEqual(["raul@example.com"]);
    expect(call.subject).toContain("Raul Guevara");
    expect(call.text).toContain("I want to pause my account");
    expect(call.text).toContain("/admin/chatbot/conversations/conv-1");
    expect(updates[0]).toMatchObject({
      handoff_emailed_at: "2026-08-27T14:23:00.000Z",
      handoff_emailed_to: "jade@modern-amenities.com",
      handoff_email_error: null,
    });
  });

  it("records the failure on the conversation instead of pretending", async () => {
    const send = vi.fn(async () => ({
      ok: false as const,
      error: "Resend rejected the chatbot email (422)",
    }));
    const { client, updates } = fakeClient(row);
    const receipt = await emailHandoff(
      {
        conversationId: "conv-1",
        reason: "callback",
        summary: "wants a call",
        triggeredBy: "Mia",
      },
      { client, config, send },
    );
    expect(receipt).toMatchObject({ sent: false });
    expect(updates[0]).toMatchObject({
      handoff_email_error: "Resend rejected the chatbot email (422)",
    });
  });
});

describe("buildBody", () => {
  it("labels turns with the visitor's name and Mia", () => {
    const text = buildBody({
      name: "Raul",
      email: null,
      phone: "210",
      pageUrl: null,
      startedAt: "2026-08-27T14:22:00Z",
      reason: "support",
      summary: "s",
      preferredWindow: null,
      triggeredBy: "t",
      conversationId: "c",
      messages: row.messages as never,
    });
    expect(text).toContain("Raul (");
    expect(text).toContain("Mia (");
    expect(text).toContain("No email on file");
  });
});
