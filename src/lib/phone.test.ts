import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["415-555-0101", "+14155550101"],
    ["+1 (415) 555-0101", "+14155550101"],
    ["+44 7911 123456", "+447911123456"],
    // `00` is the international dialling prefix outside North America.
    ["0032 470 12 34 56", "+32470123456"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  // Production, Aug–Sep 2026: 12 leads dead-lettered because a national number
  // with its trunk `0` ("0907 812 1075") became "+09078121075", which no country
  // code matches, and Close failed the whole lead on it.
  it.each(["09078121075", "07496 123456", "0", "1", "tpeek@ryatech.us", ""])(
    "drops %s, which Close cannot parse",
    (input) => {
      expect(normalizePhone(input)).toBe("");
    },
  );
});
