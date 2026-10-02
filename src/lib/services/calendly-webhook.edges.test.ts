import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseCalendlyEvent,
  verifyCalendlySignature,
} from "./calendly-webhook";

/**
 * Edge cases around `verifyCalendlySignature` and `parseCalendlyEvent` that
 * calendly-webhook.test.ts does not reach: the exact edges of the freshness
 * window, signature encodings, and header shapes. The signature is the only
 * authentication on the booking webhook, so each of these is a way in.
 */

const KEY = "whsec_edge_key";
const SIGNED_AT = 1_800_000_000;
const NOW = new Date(SIGNED_AT * 1000);

function sign(body: string, timestamp: string | number = SIGNED_AT, key = KEY) {
  return createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
}

const BODY = JSON.stringify({ event: "invitee.created" });

describe("freshness window edges", () => {
  const header = `t=${SIGNED_AT},v1=${sign(BODY)}`;

  it("accepts a delivery exactly five minutes old, and rejects one second older", () => {
    const exactly = new Date(NOW.getTime() + 5 * 60 * 1000);
    const oneSecondOver = new Date(NOW.getTime() + 5 * 60 * 1000 + 1000);

    expect(verifyCalendlySignature(BODY, header, KEY, exactly)).toBe(true);
    expect(verifyCalendlySignature(BODY, header, KEY, oneSecondOver)).toBe(
      false,
    );
  });

  it("applies the same window to a timestamp from the future", () => {
    const exactly = new Date(NOW.getTime() - 5 * 60 * 1000);
    const oneSecondOver = new Date(NOW.getTime() - 5 * 60 * 1000 - 1000);

    expect(verifyCalendlySignature(BODY, header, KEY, exactly)).toBe(true);
    expect(verifyCalendlySignature(BODY, header, KEY, oneSecondOver)).toBe(
      false,
    );
  });

  it.each([
    "1800000000.5",
    "-1800000000",
    "+1800000000",
    "1.8e9",
    " 1800000000",
    "",
  ])("rejects the timestamp %j even when it is signed", (timestamp) => {
    const signed = `t=${timestamp},v1=${sign(BODY, timestamp)}`;

    expect(verifyCalendlySignature(BODY, signed, KEY, NOW)).toBe(false);
  });
});

describe("signature encodings", () => {
  const good = sign(BODY);

  it("accepts upper-case hex, which decodes to the same bytes", () => {
    const header = `t=${SIGNED_AT},v1=${good.toUpperCase()}`;

    expect(verifyCalendlySignature(BODY, header, KEY, NOW)).toBe(true);
  });

  it.each([
    ["truncated", good.slice(0, 32)],
    ["one char short (odd length)", good.slice(0, -1)],
    ["a whole extra byte", `${good}00`],
    ["a single character", "a"],
    ["non-hex characters", "z".repeat(64)],
    [
      "the right length with the last byte flipped",
      `${good.slice(0, -2)}${good.endsWith("00") ? "01" : "00"}`,
    ],
  ])("rejects a signature that is %s", (_label, signature) => {
    expect(
      verifyCalendlySignature(BODY, `t=${SIGNED_AT},v1=${signature}`, KEY, NOW),
    ).toBe(false);
  });

  // Buffer.from(hex) silently drops a trailing odd nibble, so a correct
  // signature with ONE extra hex character appended decodes to the same 32
  // bytes and verifies. Not exploitable on its own (the caller still needs the
  // HMAC), but the verifier is more lenient than the format. Left as-is: the
  // webhook path is off limits for behaviour changes in this pass.
  it.fails(
    "rejects a correct signature with one extra trailing hex character",
    () => {
      expect(
        verifyCalendlySignature(BODY, `t=${SIGNED_AT},v1=${good}a`, KEY, NOW),
      ).toBe(false);
    },
  );

  it("does not let a signature for one body authenticate another, byte for byte", () => {
    const header = `t=${SIGNED_AT},v1=${good}`;

    expect(verifyCalendlySignature(`${BODY} `, header, KEY, NOW)).toBe(false);
    expect(
      verifyCalendlySignature(
        BODY.replace("created", "canceled"),
        header,
        KEY,
        NOW,
      ),
    ).toBe(false);
  });

  it("signs the raw bytes, so non-ASCII bodies verify", () => {
    const body = JSON.stringify({ name: "José Núñez 🥤" });
    const header = `t=${SIGNED_AT},v1=${sign(body)}`;

    expect(verifyCalendlySignature(body, header, KEY, NOW)).toBe(true);
  });

  it("accepts an empty body that was signed as empty", () => {
    expect(
      verifyCalendlySignature("", `t=${SIGNED_AT},v1=${sign("")}`, KEY, NOW),
    ).toBe(true);
  });

  it("binds the timestamp into the signature: moving t forward invalidates it", () => {
    const header = `t=${SIGNED_AT + 60},v1=${good}`;

    expect(
      verifyCalendlySignature(
        BODY,
        header,
        KEY,
        new Date(NOW.getTime() + 60_000),
      ),
    ).toBe(false);
  });
});

describe("header shapes", () => {
  const good = sign(BODY);

  it("tolerates spaces around the fields and either order", () => {
    expect(
      verifyCalendlySignature(BODY, `v1=${good}, t=${SIGNED_AT}`, KEY, NOW),
    ).toBe(true);
    expect(
      verifyCalendlySignature(BODY, `t=${SIGNED_AT} , v1=${good}`, KEY, NOW),
    ).toBe(true);
  });

  it.each([
    ["no timestamp", `v1=${good}`],
    ["no signature", `t=${SIGNED_AT}`],
    ["an empty signature", `t=${SIGNED_AT},v1=`],
    ["an empty timestamp", `t=,v1=${good}`],
    ["only the wrong scheme", `t=${SIGNED_AT},v0=${good}`],
    ["garbage", "not-a-signature"],
    ["an empty string", ""],
  ])("rejects a header with %s", (_label, header) => {
    expect(verifyCalendlySignature(BODY, header, KEY, NOW)).toBe(false);
  });

  it("reads the LAST v1 when a header repeats it: a valid one first does not save a bad one second", () => {
    const bad = "0".repeat(64);

    expect(
      verifyCalendlySignature(
        BODY,
        `t=${SIGNED_AT},v1=${good},v1=${bad}`,
        KEY,
        NOW,
      ),
    ).toBe(false);
    expect(
      verifyCalendlySignature(
        BODY,
        `t=${SIGNED_AT},v1=${bad},v1=${good}`,
        KEY,
        NOW,
      ),
    ).toBe(true);
  });

  it("fails closed with no key, whatever the header says", () => {
    expect(
      verifyCalendlySignature(
        BODY,
        `t=${SIGNED_AT},v1=${sign(BODY, SIGNED_AT, "")}`,
        "",
        NOW,
      ),
    ).toBe(false);
  });
});

describe("parseCalendlyEvent edges", () => {
  const base = {
    event: "invitee.created",
    payload: { uri: "https://api.calendly.com/scheduled_events/a/invitees/b" },
  };

  it("accepts only the two invitee event kinds", () => {
    expect(parseCalendlyEvent(base)?.eventKind).toBe("invitee.created");
    expect(
      parseCalendlyEvent({ ...base, event: "invitee.canceled" })?.eventKind,
    ).toBe("invitee.canceled");
    expect(
      parseCalendlyEvent({ ...base, event: "routing_form_submission.created" }),
    ).toBeNull();
    expect(
      parseCalendlyEvent({ ...base, event: "invitee_no_show.created" }),
    ).toBeNull();
  });

  it("requires a non-empty invitee uri, since it is the idempotency key", () => {
    expect(parseCalendlyEvent({ ...base, payload: { uri: "" } })).toBeNull();
    expect(parseCalendlyEvent({ ...base, payload: {} })).toBeNull();
  });

  it("turns every optional field into null, never undefined, when Calendly omits it", () => {
    const parsed = parseCalendlyEvent(base);

    expect(parsed).toMatchObject({
      inviteeName: null,
      inviteeEmail: null,
      cancelReason: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      scheduledEventUri: null,
      scheduledEventName: null,
      eventTypeUri: null,
      eventStartAt: null,
      eventEndAt: null,
      inviteeCreatedAt: null,
    });
  });

  it("tolerates explicit nulls and unknown extra fields", () => {
    const parsed = parseCalendlyEvent({
      ...base,
      surprise: true,
      payload: {
        ...base.payload,
        tracking: null,
        scheduled_event: null,
        cancellation: null,
        brand_new_field: { nested: 1 },
      },
    });

    expect(parsed?.utmSource).toBeNull();
    expect(parsed?.eventStartAt).toBeNull();
  });

  it("keeps the original body as rawPayload, extras included", () => {
    const body = { ...base, surprise: true };

    expect(parseCalendlyEvent(body)?.rawPayload).toBe(body);
  });

  it("reads the event type uri off the scheduled event, which is what calendar attribution keys on", () => {
    const parsed = parseCalendlyEvent({
      ...base,
      payload: {
        ...base.payload,
        scheduled_event: {
          event_type: "https://api.calendly.com/event_types/x",
        },
      },
    });

    expect(parsed?.eventTypeUri).toBe("https://api.calendly.com/event_types/x");
  });

  it.each([null, undefined, "string", 5, [], [base]])(
    "returns null for the non-object body %j",
    (value) => {
      expect(parseCalendlyEvent(value)).toBeNull();
    },
  );
});
