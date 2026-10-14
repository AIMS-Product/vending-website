import { describe, expect, it } from "vitest";
import {
  CALENDAR_TOKEN_TTL_AFTER_START_MS,
  SESSION_TTL_MS,
  signCalendarToken,
  signMasterclassSession,
  verifyCalendarToken,
  verifyMasterclassSession,
} from "./masterclass-session";

const SECRET = "s".repeat(32);
const NOW = new Date("2026-10-01T15:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("masterclass session cookie", () => {
  it("round-trips a contact id", () => {
    const value = signMasterclassSession("abc123XYZ", SECRET, NOW);
    expect(value).not.toBeNull();
    expect(verifyMasterclassSession(value, SECRET, later(1000))).toBe(
      "abc123XYZ",
    );
  });

  it("rejects a tampered contact id, expiry or signature", () => {
    const value = signMasterclassSession("abc123", SECRET, NOW)!;
    const [id, exp, sig] = value.split(".");
    for (const forged of [
      `abc124.${exp}.${sig}`,
      `${id}.${Number(exp) + 1}.${sig}`,
      `${id}.${exp}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`,
      `${id}.${exp}.`,
      `${id}.${exp}`,
      `${id}..${sig}`,
    ]) {
      expect(verifyMasterclassSession(forged, SECRET, NOW)).toBeNull();
    }
  });

  it("rejects an expired cookie", () => {
    const value = signMasterclassSession("abc123", SECRET, NOW);
    expect(
      verifyMasterclassSession(value, SECRET, later(SESSION_TTL_MS - 1)),
    ).toBe("abc123");
    expect(
      verifyMasterclassSession(value, SECRET, later(SESSION_TTL_MS)),
    ).toBeNull();
  });

  it("rejects a cookie signed with another secret", () => {
    const value = signMasterclassSession("abc123", "t".repeat(32), NOW);
    expect(verifyMasterclassSession(value, SECRET, NOW)).toBeNull();
  });

  it("rejects a missing cookie or a missing / short secret", () => {
    expect(verifyMasterclassSession(undefined, SECRET, NOW)).toBeNull();
    expect(verifyMasterclassSession("", SECRET, NOW)).toBeNull();
    const value = signMasterclassSession("abc123", SECRET, NOW);
    expect(verifyMasterclassSession(value, undefined, NOW)).toBeNull();
    expect(signMasterclassSession("abc123", undefined, NOW)).toBeNull();
    expect(signMasterclassSession("abc123", "short", NOW)).toBeNull();
  });

  it("never signs an id that could break the cookie or the GHL path", () => {
    expect(signMasterclassSession("a.b", SECRET, NOW)).toBeNull();
    expect(signMasterclassSession("../x", SECRET, NOW)).toBeNull();
    expect(signMasterclassSession("", SECRET, NOW)).toBeNull();
  });
});

describe("calendar token", () => {
  const START = new Date("2026-10-21T00:30:00Z");

  it("verifies until a day after the room starts", () => {
    const token = signCalendarToken("abc123", START, SECRET);
    const day = CALENDAR_TOKEN_TTL_AFTER_START_MS;
    expect(verifyCalendarToken(token, SECRET, NOW)).toEqual({
      contactId: "abc123",
      expiresAt: START.getTime() + day,
    });
    expect(
      verifyCalendarToken(token, SECRET, new Date(START.getTime() + day)),
    ).toBeNull();
  });

  it("rejects a tampered contact id or signature", () => {
    const token = signCalendarToken("abc123", START, SECRET)!;
    expect(
      verifyCalendarToken(token.replace("abc123", "abc124"), SECRET, NOW),
    ).toBeNull();
    expect(
      verifyCalendarToken(`${token.slice(0, -1)}A`, SECRET, NOW),
    ).toBeNull();
    expect(verifyCalendarToken(token, "t".repeat(32), NOW)).toBeNull();
  });

  it("is never interchangeable with a session cookie", () => {
    const session = signMasterclassSession("abc123", SECRET, NOW);
    const token = signCalendarToken("abc123", START, SECRET);
    expect(verifyCalendarToken(session, SECRET, NOW)).toBeNull();
    expect(verifyMasterclassSession(token, SECRET, NOW)).toBeNull();
  });

  it("is not minted without a usable secret or a GHL-shaped id", () => {
    expect(signCalendarToken("abc123", START, undefined)).toBeNull();
    expect(signCalendarToken("a.b", START, SECRET)).toBeNull();
  });
});
