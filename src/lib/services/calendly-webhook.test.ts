import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseCalendlyEvent,
  verifyCalendlySignature,
} from "./calendly-webhook";

const SIGNING_KEY = "whsec_test_key";

function signatureHeader(
  body: string,
  {
    timestamp = "1700000000",
    key = SIGNING_KEY,
  }: { timestamp?: string; key?: string } = {},
) {
  const signature = createHmac("sha256", key)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyCalendlySignature", () => {
  it("accepts a valid signature", () => {
    const body = JSON.stringify({ event: "invitee.created" });
    const header = signatureHeader(body);

    expect(verifyCalendlySignature(body, header, SIGNING_KEY)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ event: "invitee.created" });
    const header = signatureHeader(body);
    const tamperedBody = JSON.stringify({ event: "invitee.canceled" });

    expect(verifyCalendlySignature(tamperedBody, header, SIGNING_KEY)).toBe(
      false,
    );
  });

  it("rejects a signature generated with the wrong key", () => {
    const body = JSON.stringify({ event: "invitee.created" });
    const header = signatureHeader(body, { key: "whsec_wrong_key" });

    expect(verifyCalendlySignature(body, header, SIGNING_KEY)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const body = JSON.stringify({ event: "invitee.created" });

    expect(verifyCalendlySignature(body, null, SIGNING_KEY)).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    const body = JSON.stringify({ event: "invitee.created" });

    expect(
      verifyCalendlySignature(body, "not-a-valid-header", SIGNING_KEY),
    ).toBe(false);
  });

  it("rejects when the signing key is empty", () => {
    const body = JSON.stringify({ event: "invitee.created" });
    const header = signatureHeader(body);

    expect(verifyCalendlySignature(body, header, "")).toBe(false);
  });
});

describe("parseCalendlyEvent", () => {
  it("parses an invitee.created event", () => {
    const payload = {
      event: "invitee.created",
      payload: {
        uri: "https://api.calendly.com/scheduled_events/abc/invitees/123",
        name: "Jane Applicant",
        email: "jane@example.com",
        tracking: {
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "spring",
          utm_term: "vending",
          utm_content: "hero",
        },
        scheduled_event: {
          uri: "https://api.calendly.com/scheduled_events/abc",
          name: "Discovery Call",
          start_time: "2026-08-01T15:00:00.000000Z",
          end_time: "2026-08-01T15:30:00.000000Z",
        },
      },
    };

    const result = parseCalendlyEvent(payload);

    expect(result).toEqual({
      eventKind: "invitee.created",
      inviteeUri: "https://api.calendly.com/scheduled_events/abc/invitees/123",
      inviteeName: "Jane Applicant",
      inviteeEmail: "jane@example.com",
      cancelReason: null,
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring",
      utmTerm: "vending",
      utmContent: "hero",
      scheduledEventUri: "https://api.calendly.com/scheduled_events/abc",
      scheduledEventName: "Discovery Call",
      eventStartAt: "2026-08-01T15:00:00.000000Z",
      eventEndAt: "2026-08-01T15:30:00.000000Z",
      rawPayload: payload,
    });
  });

  it("parses an invitee.canceled event", () => {
    const payload = {
      event: "invitee.canceled",
      payload: {
        uri: "https://api.calendly.com/scheduled_events/abc/invitees/123",
        name: "Jane Applicant",
        email: "jane@example.com",
        cancellation: {
          reason: "Schedule conflict",
        },
      },
    };

    const result = parseCalendlyEvent(payload);

    expect(result).toEqual({
      eventKind: "invitee.canceled",
      inviteeUri: "https://api.calendly.com/scheduled_events/abc/invitees/123",
      inviteeName: "Jane Applicant",
      inviteeEmail: "jane@example.com",
      cancelReason: "Schedule conflict",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      scheduledEventUri: null,
      scheduledEventName: null,
      eventStartAt: null,
      eventEndAt: null,
      rawPayload: payload,
    });
  });

  it("returns null for junk payloads", () => {
    expect(parseCalendlyEvent(null)).toBeNull();
    expect(parseCalendlyEvent({})).toBeNull();
    expect(
      parseCalendlyEvent({ event: "something.else", payload: {} }),
    ).toBeNull();
    expect(
      parseCalendlyEvent({ event: "invitee.created", payload: {} }),
    ).toBeNull();
  });
});
