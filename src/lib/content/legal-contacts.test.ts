import { describe, expect, it } from "vitest";
import { privacy } from "./privacy";
import { spamPolicy } from "./spam-policy";
import { terms } from "./terms";
import type { LegalDoc } from "./legal";

/**
 * Contact details on legal pages have to actually work. `modernamenities.com`
 * (no hyphen) has no MX and no A record — it was published on /terms and
 * /privacy for six addresses, including the ones for data-deletion and
 * privacy-rights requests, so those requests had nowhere to land.
 */
const DEAD_DOMAINS = ["modernamenities.com"];

const ALLOWED_DOMAINS = new Set([
  "vendingpreneurs.com",
  "modern-amenities.com",
]);

function textOf(doc: LegalDoc): string {
  return doc.sections
    .flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.kind === "ul" ? block.items.map((i) => i.text) : [block.text],
      ),
    )
    .join(" ");
}

const docs: ReadonlyArray<[string, LegalDoc]> = [
  ["terms", terms],
  ["privacy", privacy],
  ["spam-policy", spamPolicy],
];

describe.each(docs)("%s contact details", (_name, doc) => {
  const text = textOf(doc);

  it("names no domain that cannot receive mail", () => {
    for (const dead of DEAD_DOMAINS) {
      expect(text).not.toContain(`@${dead}`);
    }
  });

  it("sends every contact address to a domain we control", () => {
    const emails = text.match(/[\w.%-]+@[\w.-]+\.[a-z]{2,}/gi) ?? [];
    for (const email of emails) {
      expect(ALLOWED_DOMAINS.has(email.split("@")[1].toLowerCase())).toBe(true);
    }
  });
});

describe("spam policy", () => {
  // CAN-SPAM wants a real postal address, and two legal pages naming
  // different ones is worse than either alone.
  it("publishes the same postal address as the privacy policy", () => {
    const address = "91302 Coburg Industrial Way, Coburg, OR 97408";
    expect(textOf(privacy)).toContain(address);
    expect(textOf(spamPolicy)).toContain(address);
  });

  it("routes abuse reports to a Vendingpreneurs mailbox", () => {
    expect(textOf(spamPolicy)).toContain("support@vendingpreneurs.com");
  });
});
