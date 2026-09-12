import { describe, expect, it } from "vitest";
import {
  buildCalendlyDirectory,
  buildChatIndex,
  resolveChatTouch,
  repRole,
  resolveCallCredit,
  summarizeCallCredits,
  type CallCreditRow,
} from "./call-credit";

const CONNOR = "https://api.calendly.com/users/8533e44c";
const directory = buildCalendlyDirectory([
  {
    hosts: [
      {
        user: CONNOR,
        user_name: "Connor George",
        user_email: "connorgeorge@modern-amenities.com",
      },
    ],
  },
]);

describe("resolveCallCredit", () => {
  it("credits the rep Calendly says booked it, over any tag on the link", () => {
    const credit = resolveCallCredit(
      { scheduledByUri: CONNOR, utmSource: "youtube", utmMedium: "video" },
      directory,
    );

    expect(credit.kind).toBe("rep");
    expect(credit.who).toBe("Connor George");
    expect(credit.repUri).toBe(CONNOR);
  });

  it("names an unknown rep by id rather than dropping the booking", () => {
    // A rep who books calls but has never hosted one has no name in the
    // payloads. The count is still theirs.
    const credit = resolveCallCredit(
      {
        scheduledByUri: "https://api.calendly.com/users/6d68f528-ae85-4839",
        utmSource: null,
        utmMedium: null,
      },
      directory,
    );

    expect(credit.kind).toBe("rep");
    expect(credit.who).toBe("Calendly user 6d68f528");
  });

  it("credits a setter whose own tagged link was used", () => {
    // The other half of the fix: a setter who texts a link gets the same named
    // credit as one who books the call inside Calendly.
    const credit = resolveCallCredit(
      {
        scheduledByUri: null,
        utmSource: "setter",
        utmMedium: "text",
        utmContent: "connor-george",
      },
      directory,
    );

    expect(credit.kind).toBe("rep");
    expect(credit.who).toBe("Connor George");
  });

  it("refuses to invent a person from an unreadable setter tag", () => {
    const credit = resolveCallCredit(
      {
        scheduledByUri: null,
        utmSource: "setter",
        utmMedium: "text",
        utmContent: "a1b2c3d4-0000-4000-8000",
      },
      directory,
    );

    expect(credit.kind).toBe("untagged");
  });

  it("credits the chatbot only on its own tag", () => {
    expect(
      resolveCallCredit(
        { scheduledByUri: null, utmSource: "chatbot", utmMedium: "site_chat" },
        directory,
      ).kind,
    ).toBe("chatbot");
  });

  it("reads another tagged link as the lead booking themselves", () => {
    const credit = resolveCallCredit(
      {
        scheduledByUri: null,
        utmSource: "internal-webinar",
        utmMedium: "email",
      },
      directory,
    );

    expect(credit.kind).toBe("channel");
    expect(credit.who).toBe("Internal webinar");
  });

  it("falls back to Close's setter field, but only last", () => {
    // A tag on the link says how the booking was actually made; the Close field
    // is a note typed afterwards. It still beats knowing nothing.
    const viaClose = resolveCallCredit(
      {
        scheduledByUri: null,
        utmSource: null,
        utmMedium: null,
        closeSetter: "Pearl Sathekge",
      },
      directory,
    );
    expect(viaClose.kind).toBe("rep");
    expect(viaClose.who).toBe("Pearl Sathekge");

    const taggedLinkWins = resolveCallCredit(
      {
        scheduledByUri: null,
        utmSource: "youtube",
        utmMedium: "video",
        closeSetter: "Pearl Sathekge",
      },
      directory,
    );
    expect(taggedLinkWins.kind).toBe("channel");
  });

  it("says nothing is known rather than guessing on an untagged link", () => {
    const credit = resolveCallCredit(
      { scheduledByUri: null, utmSource: null, utmMedium: null },
      directory,
    );

    expect(credit.kind).toBe("untagged");
    expect(credit.who).toBe("No tag");
  });
});

describe("repRole", () => {
  it("reads the roster both ways and leaves the rest unclassified", () => {
    expect(repRole("Connor George")).toBe("setter");
    expect(repRole("stephen olivas")).toBe("not_setter");
    // A closer wrongly counted as a setter is the exact mistake this page
    // exists to stop, so an unknown name stays unknown.
    expect(repRole("Robin Perkins")).toBe("unclassified");
  });
});

describe("summarizeCallCredits", () => {
  it("counts per person and per kind, and flags unclassified reps", () => {
    const rows = [
      row(CONNOR, null),
      row(CONNOR, null),
      row("https://api.calendly.com/users/robin", null),
      row(null, "chatbot"),
      row(null, "youtube"),
      row(null, null),
    ];

    const summary = summarizeCallCredits(rows);

    expect(summary.total).toBe(6);
    expect(summary.byKind).toEqual({
      rep: 3,
      chatbot: 1,
      channel: 1,
      untagged: 1,
    });
    expect(summary.people[0]).toEqual({
      who: "Connor George",
      role: "setter",
      calls: 2,
    });
    expect(summary.unclassified).toEqual(["Calendly user robin"]);
    expect(summary.chatTouched).toBe(0);
  });
});

let seq = 0;
function row(
  scheduledByUri: string | null,
  utmSource: string | null,
): CallCreditRow {
  seq += 1;
  return {
    id: `booking-${seq}`,
    inviteeName: "Dana",
    inviteeEmail: "dana@example.com",
    calendar: "Vendingpreneurs Momentum - Next Steps",
    startAt: "2026-09-16T21:00:00.000Z",
    bookedAt: "2026-09-12T14:22:18.000Z",
    canceled: false,
    chat: null,
    leadSubmissionId: null,
    closeSetter: null,
    credit: resolveCallCredit(
      { scheduledByUri, utmSource, utmMedium: null },
      directory,
    ),
  };
}

describe("resolveChatTouch", () => {
  const index = buildChatIndex([
    {
      id: "68ead512",
      capturedEmail: "Mindfulobserveruc@gmail.com",
      createdAt: "2026-09-11T12:37:29.000Z",
    },
    {
      id: "later-chat",
      capturedEmail: "mindfulobserveruc@gmail.com",
      createdAt: "2026-09-20T09:00:00.000Z",
    },
  ]);

  it("finds the chat that came before the booking, whatever the casing", () => {
    const touch = resolveChatTouch(
      {
        inviteeEmail: "mindfulobserveruc@gmail.com",
        bookedAt: "2026-09-12T14:22:18.000Z",
        utmContent: null,
      },
      index,
    );

    expect(touch?.conversationId).toBe("68ead512");
    // The setter booked it; the chat is an earlier touch, not the booking.
    expect(touch?.bookedInChat).toBe(false);
  });

  it("ignores a chat that only happened after the call was booked", () => {
    const touch = resolveChatTouch(
      {
        inviteeEmail: "mindfulobserveruc@gmail.com",
        bookedAt: "2026-09-01T00:00:00.000Z",
        utmContent: null,
      },
      index,
    );

    expect(touch).toBeNull();
  });

  it("marks the chat as the booker when the booking carries its tag", () => {
    const touch = resolveChatTouch(
      {
        inviteeEmail: "mindfulobserveruc@gmail.com",
        bookedAt: "2026-09-12T14:22:18.000Z",
        utmContent: "68ead512",
      },
      index,
    );

    expect(touch?.bookedInChat).toBe(true);
  });
});
