import { describe, expect, it } from "vitest";
import {
  describeTouchGap,
  resolveSetterTouch,
  type CloseActivity,
} from "./setter-touch";

const BOOKED_AT = "2026-09-12T14:00:00.000Z";
const isSetter = (name: string) =>
  ["Connor George", "Charlie Ingram"].includes(name);

function activity(over: Partial<CloseActivity> = {}): CloseActivity {
  return {
    _type: "Call",
    user_name: "Connor George",
    date_created: "2026-09-12T12:00:00.000Z",
    direction: "outbound",
    ...over,
  };
}

describe("resolveSetterTouch", () => {
  it("credits the last setter to call before the booking", () => {
    const touch = resolveSetterTouch(
      [
        activity({ date_created: "2026-09-11T09:00:00.000Z" }),
        activity({
          user_name: "Charlie Ingram",
          _type: "SMS",
          date_created: "2026-09-12T13:30:00.000Z",
        }),
      ],
      BOOKED_AT,
      isSetter,
    );

    expect(touch).toEqual({
      name: "Charlie Ingram",
      at: "2026-09-12T13:30:00.000Z",
      minutesBefore: 30,
    });
  });

  it("ignores anyone not on the setter roster", () => {
    // Closers call leads too, and a closer's call before a rebooking is not a
    // set. This is the whole reason Close activity was unusable before.
    const touch = resolveSetterTouch(
      [activity({ user_name: "Robin Perkins" })],
      BOOKED_AT,
      isSetter,
    );

    expect(touch).toBeNull();
  });

  it("ignores notes and emails, and anything after the booking", () => {
    expect(
      resolveSetterTouch([activity({ _type: "Note" })], BOOKED_AT, isSetter),
    ).toBeNull();
    expect(
      resolveSetterTouch([activity({ _type: "Email" })], BOOKED_AT, isSetter),
    ).toBeNull();
    expect(
      resolveSetterTouch(
        [activity({ date_created: "2026-09-12T14:30:00.000Z" })],
        BOOKED_AT,
        isSetter,
      ),
    ).toBeNull();
  });

  it("ignores a touch older than the window", () => {
    // A call a week before a booking did not cause it.
    expect(
      resolveSetterTouch(
        [activity({ date_created: "2026-09-05T12:00:00.000Z" })],
        BOOKED_AT,
        isSetter,
      ),
    ).toBeNull();
    // The window is a knob, not a law: a longer one takes the same call.
    expect(
      resolveSetterTouch(
        [activity({ date_created: "2026-09-05T12:00:00.000Z" })],
        BOOKED_AT,
        isSetter,
        24 * 14,
      ),
    ).not.toBeNull();
  });

  it("has nothing to say without a booking time", () => {
    expect(resolveSetterTouch([activity()], null, isSetter)).toBeNull();
  });
});

describe("describeTouchGap", () => {
  it("reads as a person would say it", () => {
    expect(describeTouchGap(35)).toBe("35m before they booked");
    expect(describeTouchGap(120)).toBe("2h before they booked");
    expect(describeTouchGap(60 * 30)).toBe("1d before they booked");
  });
});
