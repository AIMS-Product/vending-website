import { describe, expect, it } from "vitest";
import { buildRouteHighlights } from "./route-highlights";

function source(overrides = {}) {
  return {
    prior_occupation: null,
    location_types: null,
    machine_count: null,
    location_count: null,
    months_to_result: null,
    ...overrides,
  };
}

describe("buildRouteHighlights", () => {
  it("returns nothing when the story carries none of the fields", () => {
    // The sidebar hides the card entirely rather than showing empty slots.
    expect(buildRouteHighlights(source())).toEqual([]);
  });

  it("omits missing fields instead of zero-filling them", () => {
    expect(
      buildRouteHighlights(source({ prior_occupation: "Teacher" })),
    ).toEqual([{ label: "Before vending", value: "Teacher" }]);
  });

  it("treats a zero count as a data gap, not a result", () => {
    // Regression guard: "0 machines" reads as a claim about the member.
    expect(
      buildRouteHighlights(
        source({ machine_count: 0, location_count: 0, months_to_result: 0 }),
      ),
    ).toEqual([]);
  });

  it("carries the numbers Kody asked for, in a stable order", () => {
    const highlights = buildRouteHighlights(
      source({
        prior_occupation: "Teacher",
        machine_count: 26,
        location_count: 22,
        months_to_result: 11,
        location_types: ["gym"],
      }),
    );
    expect(highlights).toEqual([
      { label: "Before vending", value: "Teacher" },
      { label: "Machines", value: "26" },
      { label: "Locations", value: "22" },
      { label: "Months in the program", value: "11 months" },
      { label: "Where they place", value: "Gym" },
    ]);
  });

  it("singularizes a one-month result", () => {
    expect(buildRouteHighlights(source({ months_to_result: 1 }))[0].value).toBe(
      "1 month",
    );
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

  it("ignores blank entries rather than rendering separators", () => {
    expect(
      buildRouteHighlights(
        source({ prior_occupation: "   ", location_types: ["", "  "] }),
      ),
    ).toEqual([]);
  });
});
