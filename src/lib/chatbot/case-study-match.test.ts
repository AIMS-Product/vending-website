import { describe, expect, it } from "vitest";
import { matchCaseStudy } from "./case-study-match";
import { CASE_STUDY_SUMMARIES } from "./site-knowledge";

const slugFor = (situation: string, objection?: string, exclude?: string[]) =>
  matchCaseStudy({ situation, objection, excludeSlugs: exclude })?.slug ?? null;

describe("matchCaseStudy", () => {
  it("only ever returns a real case study", () => {
    const slugs = new Set(CASE_STUDY_SUMMARIES.map((s) => s.slug));
    for (const situation of [
      "I'm a teacher",
      "retired cop",
      "stay at home mom of three",
      "I drive a truck",
    ]) {
      const slug = slugFor(situation);
      expect(slug === null || slugs.has(slug)).toBe(true);
    }
  });

  it("matches on what the visitor actually said", () => {
    expect(slugFor("I'm a stay at home mom with two kids")).toBe(
      "madison-6-locations",
    );
    expect(slugFor("I'm retired and bored")).toBe("joe-retiree-route");
    expect(slugFor("I was a police officer for 20 years")).toBe("manuel-duval");
    expect(slugFor("I work as a nurse and have a full-time job")).toBe(
      "mallerie-rouch",
    );
  });

  it("prefers the member who had the same worry", () => {
    const withSpouse = matchCaseStudy({
      situation: "I work in corporate sales",
      objection: "spouse",
    });
    expect(withSpouse?.tags).toContain("objection-spouse");
  });

  it("never repeats a story already shared", () => {
    const first = slugFor("I'm retired");
    const second = slugFor("I'm retired", undefined, [first as string]);
    expect(second).not.toBe(first);
  });

  it("matches on a worry alone", () => {
    expect(
      matchCaseStudy({ situation: "not sure", objection: "spouse" })?.tags,
    ).toContain("objection-spouse");
    expect(slugFor("not sure", "made-up")).toBeNull();
  });

  it("returns null when nothing they said maps to any member", () => {
    expect(slugFor("hello")).toBeNull();
    expect(slugFor("")).toBeNull();
  });

  it("carries what the card needs, with no cost figure", () => {
    const match = matchCaseStudy({ situation: "I'm a teacher" });
    expect(match).toMatchObject({
      memberName: expect.any(String),
      priorBackground: expect.any(String),
      headlineResult: expect.any(String),
      url: expect.stringMatching(/^\/case-studies\//),
    });
  });
});
