import { describe, expect, it } from "vitest";
import { scrubPostHogEvent } from "./posthog-scrub";

const QS =
  "?email=a%40b.com&phone=5415550101&first_name=Ann&contact_id=abc&utm_source=x";
const PII = ["a%40b.com", "a@b.com", "5415550101", "Ann", "abc"];
const url = (path: string) => `https://www.vendingpreneurs.com${path}${QS}`;

describe("scrubPostHogEvent", () => {
  it("scrubs a first $pageview in every URL property, keeping utm_source", () => {
    const event = {
      event: "$pageview",
      properties: {
        $current_url: url("/masterclass"),
        $initial_current_url: url("/masterclass"),
        $referrer: url("/playbook"),
        $initial_referrer: url("/playbook"),
        $pathname: "/masterclass",
        utm_source: "x",
        nested: [{ href: url("/x") }],
      },
      $set: { $current_url: url("/masterclass") },
      $set_once: { $initial_current_url: url("/masterclass") },
    };
    const before = JSON.stringify(event);
    const out = scrubPostHogEvent(event);
    const json = JSON.stringify(out);
    for (const p of PII) expect(json).not.toContain(p);
    expect(out.properties.$current_url).toContain("utm_source=x");
    expect(out.$set_once.$initial_current_url).toContain("utm_source=x");
    expect(out.properties.$pathname).toBe("/masterclass");
    expect(JSON.stringify(event)).toBe(before);
  });

  it("scrubs a nested url param and ?first=", () => {
    const out = scrubPostHogEvent({
      properties: {
        $current_url:
          "https://x.test/r?next=%2Fm%3Femail%3Da%40b.com%26utm_source%3Dx",
        $referrer: "https://x.test/masterclass-confirmed?first=Ann",
      },
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain("a%40b.com");
    expect(json).not.toContain("Ann");
    expect(json).toContain("utm_source%3Dx");
  });
});
