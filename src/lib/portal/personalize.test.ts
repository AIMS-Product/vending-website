import { describe, expect, it } from "vitest";
import { preCallResources } from "@/lib/content/pre-call-resources";
import { PORTAL_FIXTURES } from "./fixtures";
import {
  bucketOccupation,
  moduleOrder,
  nextSteps,
  objectionVideo,
  personaFor,
  testimonialFor,
  winTypesFor,
} from "./personalize";
import { PORTAL_OBJECTION_IDS } from "./types";

describe("bucketOccupation", () => {
  it.each([
    ["High school teacher", "employed"],
    ["Registered nurse", "employed"],
    ["Owner of a marketing agency", "self_employed"],
    ["Realtor", "self_employed"],
    ["Laid off software engineer", "between_jobs"],
    ["Just moved to Denver for my spouse", "relocated"],
    ["Stay-at-home mom of three", "family"],
    ["", "default"],
    [null, "default"],
    ["Astronaut", "default"],
  ])("%s -> %s", (occupation, persona) => {
    expect(bucketOccupation(occupation)).toBe(persona);
  });
});

describe("persona content", () => {
  it("every persona resolves a real case study, testimonial and video", () => {
    for (const occupation of [
      "teacher",
      "agency owner",
      "laid off",
      "relocated",
      "my wife and kids",
      null,
    ]) {
      const persona = personaFor(occupation);
      expect(persona.caseStudy.videoId).toBeTruthy();
      expect(testimonialFor(persona)).not.toBeNull();
      expect(objectionVideo(persona.objectionId).embedId).toBeTruthy();
    }
  });

  it("objection ids mirror the pre-call videos exactly", () => {
    expect([...PORTAL_OBJECTION_IDS]).toEqual(
      preCallResources.items.map((item) => item.id),
    );
  });
});

describe("moduleOrder", () => {
  it("defaults when there is no goal", () => {
    expect(moduleOrder("pre_call", null)).toEqual([
      "local",
      "people",
      "wins",
      "faq",
      "resources",
    ]);
  });
  it("moves the goal's module under the hero", () => {
    expect(
      moduleOrder("pre_call", "Worried about the cost and financing")[0],
    ).toBe("faq");
  });
  it("keeps the stage module pinned first", () => {
    expect(
      moduleOrder("post_call", "find locations near me").slice(0, 2),
    ).toEqual(["summary", "local"]);
  });
});

describe("nextSteps", () => {
  it("renders a spine for every fixture, never empty", () => {
    for (const data of Object.values(PORTAL_FIXTURES)) {
      expect(nextSteps(data).length).toBeGreaterThanOrEqual(3);
    }
  });
  it("marks a confirmed call done and onboarding progress done", () => {
    const pre = {
      ...PORTAL_FIXTURES.demo,
      call: { ...PORTAL_FIXTURES.demo.call!, confirmed: true },
    };
    expect(nextSteps(pre)[0].done).toBe(true);
    expect(
      nextSteps(PORTAL_FIXTURES["demo-won"]).find((s) => s.id === "skool")
        ?.done,
    ).toBe(true);
  });
  it("swaps win categories after the call", () => {
    expect(winTypesFor("pre_call")).toContain("First machine live");
    expect(winTypesFor("post_call")).toContain("Revenue milestone");
  });
});
