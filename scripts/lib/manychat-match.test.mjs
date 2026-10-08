import { describe, expect, it } from "vitest";
import { handleSignal, nameSignal, personalLinkIds, pickMatch, scoreCandidate } from "./manychat-match.mjs";

const lead = { display_name: "José Ramírez", email: "jramirez88@gmail.com" };
const contact = (over = {}) => ({
  id: 111,
  name: "Jose Ramirez",
  ig_username: "jramirez_vends",
  subscribed: "2026-07-01T10:00:00-07:00",
  ig_last_interaction: "2026-07-09T12:00:00-07:00",
  tags: [],
  ...over,
});
const ctx = (ids = []) => ({ linkedIds: new Set(ids), bookedOn: "2026-07-10" });

describe("manychat match evidence", () => {
  it("matches names across accents and middle names, not first name alone", () => {
    expect(nameSignal("José Ramírez", "jose a ramirez")).toBe(true);
    expect(nameSignal("José Ramírez", "Jose Smith")).toBe(false);
    expect(nameSignal("Jose", "Jose")).toBe(false);
  });

  it("matches a handle to the email local part or first+last", () => {
    expect(handleSignal(lead, contact())).toBe(true);
    expect(handleSignal({ display_name: "Ann Lee", email: "x@y.com" }, contact({ ig_username: "annlee.vending" }))).toBe(true);
    expect(handleSignal(lead, contact({ ig_username: "vendqueen" }))).toBe(false);
  });

  it("confirms on two signals, keeps one signal as single", () => {
    expect(scoreCandidate(lead, contact(), ctx()).level).toBe("confirmed"); // name + handle
    const nameOnly = contact({ ig_username: "vendqueen" });
    expect(scoreCandidate(lead, nameOnly, ctx()).level).toBe("single");
    expect(scoreCandidate(lead, nameOnly, ctx(["111"])).signals).toEqual(["link", "name"]);
  });

  it("needs the contact in the booking conversation, not just a name and handle", () => {
    const quiet = contact({ ig_last_interaction: "2026-03-01T00:00:00Z" }); // months before booking
    expect(scoreCandidate(lead, quiet, ctx()).level).toBe("single");
    const tagged = contact({ ig_last_interaction: "2026-03-01T00:00:00Z", tags: [{ name: "🟢 Call Booked" }] });
    expect(scoreCandidate(lead, tagged, ctx()).level).toBe("confirmed");
    // Activity alone never confirms a bare name.
    expect(scoreCandidate(lead, contact({ ig_username: "vendqueen" }), ctx()).level).toBe("single");
  });

  it("never matches a contact who subscribed after the booking", () => {
    const late = contact({ subscribed: "2026-08-01T00:00:00Z" });
    expect(scoreCandidate(lead, late, ctx(["111"])).level).toBe("after");
  });

  it("keeps a link id only when one person booked with it, and only on DM sources", () => {
    const b = (email, id, source = "instagram") => ({ invitee_email: email, utm_campaign: id, utm_source: source });
    const map = personalLinkIds([
      b("A@x.com", "1234567"),
      b("a@x.com", "1234567"), // same person twice
      b("b@x.com", "7654321"),
      b("c@x.com", "7654321"), // reused link: dropped
      b("d@x.com", "1111111", "google"), // Google campaign id, not ManyChat
      b("e@x.com", "book-call"),
    ]);
    expect([...map.keys()]).toEqual(["a@x.com"]);
    expect([...map.get("a@x.com")]).toEqual(["1234567"]);
  });

  it("treats two different confirmed contacts as a conflict", () => {
    const a = { id: "1", level: "confirmed", signals: [] };
    const b = { id: "2", level: "confirmed", signals: [] };
    expect(pickMatch([a, b]).level).toBe("conflict");
    expect(pickMatch([a, a]).level).toBe("confirmed");
    expect(pickMatch([{ id: "3", level: "single" }, { id: "4", level: "single" }]).level).toBe("ambiguous");
  });
});
