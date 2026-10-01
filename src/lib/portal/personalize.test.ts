import { describe, expect, it } from "vitest";
import { preCallResources } from "@/lib/content/pre-call-resources";
import { PORTAL_FIXTURES } from "./fixtures";
import { getPortalData } from "./get-portal-data";
import { dayKey, isDone, schedule, stepsFor } from "./journey";
import {
  bucketOccupation,
  objectionVideo,
  personaFor,
  testimonialFor,
  winTypesFor,
} from "./personalize";
import { PORTAL_OBJECTION_IDS, type PortalData } from "./types";

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

  it("swaps win categories after the call", () => {
    expect(winTypesFor("pre_call")).toContain("First machine live");
    expect(winTypesFor("post_call")).toContain("Revenue milestone");
  });
});

const NOW = new Date("2026-10-01T15:00:00Z"); // Thu Oct 1, 10am Central
const withCall = (data: PortalData, iso: string | null): PortalData => ({
  ...data,
  call: data.call ? { ...data.call, scheduledAt: iso } : null,
});

describe("journey", () => {
  it("every fixture has steps on every stage", () => {
    for (const data of Object.values(PORTAL_FIXTURES))
      expect(stepsFor(data).length).toBeGreaterThanOrEqual(3);
  });

  it("asks for intake only when occupation or ZIP is missing", () => {
    expect(
      stepsFor(PORTAL_FIXTURES.demo).some((s) => s.content === "intake"),
    ).toBe(false);
    expect(
      stepsFor(PORTAL_FIXTURES["demo-sparse"]).some(
        (s) => s.content === "intake",
      ),
    ).toBe(true);
  });

  it("lays steps on days counted back from the call", () => {
    const data = withCall(PORTAL_FIXTURES.demo, "2026-10-04T20:00:00Z"); // Sun Oct 4
    const days = schedule(stepsFor(data), data, NOW);
    expect(days.map((d) => d.key)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(days[0].isToday).toBe(true);
    expect(days.at(-1)?.isAnchor).toBe(true);
    expect(days.at(-1)?.stepKeys).toContain("call");
  });

  it("pulls overdue steps onto today instead of showing the past", () => {
    const data = withCall(PORTAL_FIXTURES.demo, "2026-10-02T20:00:00Z"); // tomorrow
    const days = schedule(stepsFor(data), data, NOW);
    expect(days[0].key).toBe(dayKey(NOW));
    expect(days[0].stepKeys).toEqual(
      expect.arrayContaining(["confirm-call", "watch-story", "see-map"]),
    );
  });

  it("starts today when the call time is unknown", () => {
    const data = PORTAL_FIXTURES["demo-sparse"];
    expect(schedule(stepsFor(data), data, NOW)[0].key).toBe("2026-10-01");
  });

  it("system steps complete from data, never from a tick", () => {
    const post = PORTAL_FIXTURES["demo-post"];
    const verify = stepsFor(post).find((s) => s.key === "verify")!;
    expect(isDone(verify, post, new Set(["verify"]))).toBe(false);
    expect(isDone(verify, { ...post, access: "verified" }, new Set())).toBe(
      true,
    );
  });
});

describe("access", () => {
  it("never sends the call summary before verification", async () => {
    const locked = await getPortalData("demo-post", { verified: false });
    expect(locked?.access).toBe("link");
    expect(locked?.callSummary).toBeNull();
    const open = await getPortalData("demo-post", { verified: true });
    expect(open?.access).toBe("verified");
    expect(open?.callSummary?.discussed.length).toBeGreaterThan(0);
  });

  it("unknown tokens resolve to nothing", async () => {
    expect(await getPortalData("nope", { verified: true })).toBeNull();
  });
});
