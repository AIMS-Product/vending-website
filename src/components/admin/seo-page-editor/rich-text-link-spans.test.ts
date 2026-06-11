import { describe, expect, it } from "vitest";
import {
  buildParagraphLinkNode,
  isSafeLinkHrefInput,
  paragraphHref,
  paragraphLinkText,
} from "./rich-text-link-spans";

const HREF = "/resources/example";

function expectSpans(
  result: ReturnType<typeof buildParagraphLinkNode>,
): { text: string; href?: string }[] {
  if (!result.ok) throw new Error(`expected ok result, got ${result.error}`);
  if (!("spans" in result.node)) {
    throw new Error("expected a spans paragraph node");
  }
  return result.node.spans;
}

describe("buildParagraphLinkNode", () => {
  it("links a substring in the middle of the paragraph (before/link/after)", () => {
    const result = buildParagraphLinkNode({
      text: "Read our vending guide today.",
      href: HREF,
      linkText: "vending guide",
    });

    expect(expectSpans(result)).toEqual([
      { text: "Read our " },
      { text: "vending guide", href: HREF },
      { text: " today." },
    ]);
  });

  it("links a substring at the start without emitting an empty leading span", () => {
    const result = buildParagraphLinkNode({
      text: "Vending guide for beginners.",
      href: HREF,
      linkText: "Vending guide",
    });

    expect(expectSpans(result)).toEqual([
      { text: "Vending guide", href: HREF },
      { text: " for beginners." },
    ]);
  });

  it("links a substring at the end without emitting an empty trailing span", () => {
    const result = buildParagraphLinkNode({
      text: "Read the vending guide",
      href: HREF,
      linkText: "vending guide",
    });

    expect(expectSpans(result)).toEqual([
      { text: "Read the " },
      { text: "vending guide", href: HREF },
    ]);
  });

  it("links only the first occurrence, case-sensitively", () => {
    const result = buildParagraphLinkNode({
      text: "Guide notes: guide one, guide two.",
      href: HREF,
      linkText: "guide",
    });

    expect(expectSpans(result)).toEqual([
      { text: "Guide notes: " },
      { text: "guide", href: HREF },
      { text: " one, guide two." },
    ]);
  });

  it("stays within the 40-span schema cap", () => {
    const result = buildParagraphLinkNode({
      text: "a b c",
      href: HREF,
      linkText: "b",
    });

    expect(expectSpans(result).length).toBeLessThanOrEqual(40);
  });

  it("reports link_text_not_found and produces no node when the substring is absent", () => {
    const result = buildParagraphLinkNode({
      text: "Read our vending guide today.",
      href: HREF,
      linkText: "Vending Guide",
    });

    expect(result).toEqual({ ok: false, error: "link_text_not_found" });
  });

  it("falls back to the whole-paragraph link when link text is empty (legacy behavior)", () => {
    const result = buildParagraphLinkNode({
      text: "Read our vending guide today.",
      href: HREF,
      linkText: "",
    });

    expect(expectSpans(result)).toEqual([
      { text: "Read our vending guide today.", href: HREF },
    ]);
  });

  it("returns a plain text paragraph when href is empty (link removed)", () => {
    const result = buildParagraphLinkNode({
      text: "Read our vending guide today.",
      href: "",
      linkText: "vending guide",
    });

    expect(result).toEqual({
      ok: true,
      node: { type: "paragraph", text: "Read our vending guide today." },
    });
  });

  it("rejects unsafe hrefs and produces no node", () => {
    for (const href of [
      "javascript:alert(1)",
      "//evil.example.com",
      "ftp://example.com",
      "resources/relative",
    ]) {
      expect(
        buildParagraphLinkNode({ text: "Some text", href, linkText: "Some" }),
      ).toEqual({ ok: false, error: "unsafe_href" });
    }
  });
});

describe("isSafeLinkHrefInput", () => {
  it("accepts empty, root-relative, and http(s) values", () => {
    expect(isSafeLinkHrefInput("")).toBe(true);
    expect(isSafeLinkHrefInput("/resources/example")).toBe(true);
    expect(isSafeLinkHrefInput("https://example.com")).toBe(true);
    expect(isSafeLinkHrefInput("http://example.com")).toBe(true);
  });

  it("rejects protocol-relative and non-http schemes", () => {
    expect(isSafeLinkHrefInput("//evil.example.com")).toBe(false);
    expect(isSafeLinkHrefInput("javascript:alert(1)")).toBe(false);
  });
});

describe("paragraph link state derivation", () => {
  it("derives href and link text from a split paragraph", () => {
    const node = {
      type: "paragraph" as const,
      spans: [
        { text: "Read our " },
        { text: "vending guide", href: HREF },
        { text: " today." },
      ],
    };

    expect(paragraphHref(node)).toBe(HREF);
    expect(paragraphLinkText(node)).toBe("vending guide");
  });

  it("treats a whole-paragraph link as empty link text", () => {
    const node = {
      type: "paragraph" as const,
      spans: [{ text: "Read our vending guide today.", href: HREF }],
    };

    expect(paragraphHref(node)).toBe(HREF);
    expect(paragraphLinkText(node)).toBe("");
  });

  it("returns empty strings for plain paragraphs", () => {
    const node = { type: "paragraph" as const, text: "Plain text." };

    expect(paragraphHref(node)).toBe("");
    expect(paragraphLinkText(node)).toBe("");
  });
});
