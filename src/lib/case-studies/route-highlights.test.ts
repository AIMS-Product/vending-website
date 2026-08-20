import { describe, expect, it } from "vitest";
import { buildRouteHighlights } from "./route-highlights";

function source(overrides = {}) {
  return {
    prior_occupation: null,
    location_types: null,
    ...overrides,
  };
}

describe("buildRouteHighlights", () => {
  it("returns nothing when the story carries none of the fields", () => {
    // The sidebar hides the card entirely rather than showing empty slots.
    expect(buildRouteHighlights(source())).toEqual([]);
  });

  it("omits missing fields instead of zero-filling them", () => {
    const highlights = buildRouteHighlights(
      source({ prior_occupation: "Teacher" }),
    );
    expect(highlights).toEqual([{ label: "Before vending", value: "Teacher" }]);
  });

  it("humanizes and joins location types", () => {
    expect(
      buildRouteHighlights(
        source({ location_types: ["retirement-community", "office"] }),
      )[0],
    ).toEqual({
      label: "Where they place",
      value: "Retirement community · Office",
    });
  });

  it("ignores blank and empty entries rather than rendering separators", () => {
    expect(
      buildRouteHighlights(
        source({ prior_occupation: "   ", location_types: ["", "  "] }),
      ),
    ).toEqual([]);
  });

  it("carries no number StatsStrip already shows", () => {
    // Regression guard for the duplication this replaced: time-to-result was
    // rendering here AND in the strip under the video on the same story.
    const labels = buildRouteHighlights(
      source({ prior_occupation: "Teacher", location_types: ["gym"] }),
    ).map((highlight) => highlight.label);
    expect(labels).toEqual(["Before vending", "Where they place"]);
  });
});
