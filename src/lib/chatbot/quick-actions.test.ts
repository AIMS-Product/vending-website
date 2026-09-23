import { describe, expect, it } from "vitest";
import { quickActionBehavior } from "./quick-actions";

/**
 * The live config row still stores plain URLs (Book a call -> /book-now,
 * Free 90-day roadmap -> /resources/roadmap). These are resolved to in-chat
 * behaviour here so no config migration or admin edit is needed.
 */
describe("quickActionBehavior", () => {
  it("opens the in-chat calendar for the booking page", () => {
    expect(quickActionBehavior("/book-now")).toEqual({ type: "calendar" });
    expect(quickActionBehavior("/book-now/")).toEqual({ type: "calendar" });
    expect(quickActionBehavior("/book-now?utm_source=x")).toEqual({
      type: "calendar",
    });
    expect(
      quickActionBehavior("https://www.vendingpreneurs.com/book-now"),
    ).toEqual({ type: "calendar" });
  });

  it("shows the roadmap in chat instead of the gated form", () => {
    expect(quickActionBehavior("/resources/roadmap")).toEqual({
      type: "resource",
      key: "roadmap",
    });
    expect(quickActionBehavior("/resources/roadmap-thank-you")).toEqual({
      type: "resource",
      key: "roadmap",
    });
  });

  it("shows the finance sheet in chat too", () => {
    expect(quickActionBehavior("/resources/finance-templates")).toEqual({
      type: "resource",
      key: "finance_templates",
    });
  });

  it("leaves every other action as a plain link", () => {
    expect(quickActionBehavior("/case-studies")).toEqual({ type: "link" });
    expect(quickActionBehavior("/resources/roadmapper")).toEqual({
      type: "link",
    });
    expect(quickActionBehavior("https://example.com/book-now")).toEqual({
      type: "link",
    });
    expect(quickActionBehavior("not a url at all ::")).toEqual({
      type: "link",
    });
  });
});
