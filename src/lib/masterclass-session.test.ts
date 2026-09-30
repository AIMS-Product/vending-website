import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  signMasterclassSession,
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
