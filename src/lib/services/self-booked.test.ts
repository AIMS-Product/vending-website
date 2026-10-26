import { describe, expect, it } from "vitest";
import {
  assistTouch,
  selfBookedBreakdown,
  surfaceOf,
  type SelfBookedRow,
} from "./self-booked";

// "Vendingpreneurs Consultation Call" is reviewed as class "new" in calendly-event-types.json.
const NEW_CALL = "Vendingpreneurs Consultation Call";

function row(overrides: Partial<SelfBookedRow> = {}): SelfBookedRow {
  return {
    invitee_email: "a@example.com",
    scheduled_event_name: NEW_CALL,
    utm_source: null,
    utm_medium: null,
    utm_content: null,
    lead_submission_id: null,
    raw_payload: null,
    ...overrides,
  };
}

describe("surfaceOf", () => {
  it("credits each marketing surface", () => {
    expect(
      surfaceOf(
        row({ utm_source: "internal-webinar", utm_medium: "during-night-of" }),
      ),
    ).toBe("Webinar");
    expect(
      surfaceOf(
        row({
          utm_source: "chatbot",
          utm_medium: "site_chat",
          lead_submission_id: "l",
        }),
      ),
    ).toBe("Chatbot");
    expect(
      surfaceOf(
        row({
          utm_source: "youtube",
          utm_content: "nbf-step2",
          lead_submission_id: "l",
        }),
      ),
    ).toBe("Follow-up email");
    expect(
      surfaceOf(row({ utm_source: "youtube", lead_submission_id: "l" })),
    ).toBe("Site form");
    expect(surfaceOf(row({ utm_source: "google" }))).toBe(
      "Other marketing link",
    );
    expect(surfaceOf(row({ utm_source: "_____", utm_medium: "_____" }))).toBe(
      "No tag",
    );
  });

  it("leaves setter and DM links to sales", () => {
    for (const medium of ["setter", "pearl", "dm", "Setter"]) {
      expect(
        surfaceOf(
          row({
            utm_source: "mike-ig",
            utm_medium: medium,
            lead_submission_id: "l",
          }),
        ),
      ).toBeNull();
    }
  });

  it("counts only reviewed new-call event types", () => {
    expect(
      surfaceOf(row({ scheduled_event_name: "Vendingpreneurs Follow-Up" })),
    ).toBeNull();
    expect(
      surfaceOf(row({ scheduled_event_name: "Some Unreviewed Calendar" })),
    ).toBeNull();
  });
});

describe("selfBookedBreakdown", () => {
  it("counts each person once, by their first self-booking", () => {
    const result = selfBookedBreakdown([
      row({ invitee_email: "A@example.com", utm_source: "internal-webinar" }),
      row({ invitee_email: "a@example.com", utm_source: "chatbot" }),
      row({ invitee_email: "b@example.com", utm_medium: "setter" }),
      row({ invitee_email: "b@example.com", lead_submission_id: "l" }),
    ]);
    expect(result.total).toBe(2);
    expect(result.bySurface.Webinar).toBe(1);
    expect(result.bySurface["Site form"]).toBe(1);
    expect(result.bySurface.Chatbot).toBe(0);
  });
});

describe("assistTouch", () => {
  const base = {
    entrySource: null,
    bookedDay: "2026-10-10",
    formDays: [],
    chatDays: [],
  };

  it("reads Close's entry source first", () => {
    expect(assistTouch({ ...base, entrySource: "Webinar" })).toBe("Webinar");
    expect(assistTouch({ ...base, entrySource: "Lead-Magnet" })).toBe(
      "Lead magnet",
    );
    expect(assistTouch({ ...base, entrySource: "Typeform" })).toBe("Site form");
    expect(assistTouch({ ...base, entrySource: "Rep-Outbound" })).toBeNull();
  });

  it("counts a site form or chat only on or before the booked day", () => {
    expect(
      assistTouch({
        ...base,
        entrySource: "Rep-Outbound",
        formDays: ["2026-10-10"],
      }),
    ).toBe("Site form");
    expect(assistTouch({ ...base, formDays: ["2026-10-11"] })).toBeNull();
    expect(assistTouch({ ...base, chatDays: ["2026-10-01"] })).toBe("Chatbot");
  });
});
