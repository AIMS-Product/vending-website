import { describe, expect, it } from "vitest";
import {
  normalizeList,
  toCaseStudyRow,
  quoteIsRepeatedInBody,
  toImportEntry,
  validateEntries,
} from "./import-case-studies.mjs";

function entry(overrides = {}, file = "someone.json") {
  return {
    file,
    data: {
      slug: "someone",
      video_id: "abc123def",
      title: "A story",
      member_name: "Someone",
      body: "## Background\n\nText.",
      ...overrides,
    },
  };
}

describe("validateEntries", () => {
  it("accepts a well-formed entry", () => {
    const { valid, invalid } = validateEntries([entry()]);
    expect(invalid).toEqual([]);
    expect(valid).toHaveLength(1);
  });

  it("rejects a slug that does not match its filename", () => {
    const { invalid } = validateEntries([entry({ slug: "other" })]);
    expect(invalid[0]).toContain("does not match filename");
  });

  it("rejects a full YouTube URL where a bare id is required", () => {
    // The DB has a check constraint on this column; catching it here turns a
    // 500 at write time into a readable message before anything is sent.
    const { invalid } = validateEntries([
      entry({ video_id: "https://www.youtube.com/watch?v=abc123def" }),
    ]);
    expect(invalid[0]).toContain("not a bare YouTube id");
  });

  it("rejects duplicate slugs and video ids across the set", () => {
    const { invalid } = validateEntries([
      entry({}, "someone.json"),
      entry({ slug: "someone" }, "someone.json"),
    ]);
    expect(invalid.join(" ")).toContain("duplicate slug");
  });

  it("rejects a non-integer count rather than coercing it", () => {
    const { invalid } = validateEntries([entry({ machine_count: "18" })]);
    expect(invalid[0]).toContain("machine_count must be an integer");
  });

  it("rejects malformed stats", () => {
    const { invalid } = validateEntries([
      entry({ stats: [{ label: "Revenue", value: 41000 }] }),
    ]);
    expect(invalid[0]).toContain("stats must be an array");
  });

  it("reports a parse error without throwing", () => {
    const { valid, invalid } = validateEntries([
      { file: "broken.json", data: null, parseError: "Unexpected token" },
    ]);
    expect(valid).toEqual([]);
    expect(invalid[0]).toContain("Unexpected token");
  });
});

describe("toCaseStudyRow", () => {
  it("always imports as a draft", () => {
    // Revenue figures are unaudited. Nothing may go live without a human.
    expect(toCaseStudyRow(entry().data).status).toBe("draft");
  });

  it("maps video_id onto the youtube column and defaults attribution", () => {
    const row = toCaseStudyRow(entry().data);
    expect(row.youtube_video_id).toBe("abc123def");
    expect(row.quote_attribution).toBe("Someone");
  });

  it("keeps absent counts as null rather than zero", () => {
    const row = toCaseStudyRow(entry().data);
    expect(row.monthly_revenue_usd).toBeNull();
    expect(row.machine_count).toBeNull();
  });

  it("leaves related_slugs empty so the page falls back to recent stories", () => {
    expect(toCaseStudyRow(entry().data).related_slugs).toEqual([]);
  });

  it("does not put review notes on the row", () => {
    // review_notes is not a column; sending it would fail the insert.
    const { row, reviewNotes } = toImportEntry(
      entry({ review_notes: ["check the name"] }).data,
    );
    expect(row).not.toHaveProperty("review_notes");
    expect(reviewNotes).toEqual(["check the name"]);
  });
});

describe("normalizeList", () => {
  it("trims, lowercases, dedupes and drops empties", () => {
    expect(normalizeList([" Retiree ", "retiree", "", "Scaling"])).toEqual([
      "retiree",
      "scaling",
    ]);
  });

  it("returns an empty array for a non-array", () => {
    expect(normalizeList(undefined)).toEqual([]);
    expect(normalizeList("retiree")).toEqual([]);
  });
});

describe("quoteIsRepeatedInBody", () => {
  it("catches the pull quote repeated verbatim as a blockquote", () => {
    const quote =
      "I wanted to get out of corporate America before the age of fifty.";
    const body = `## Background\n\nText.\n\n> "${quote}"\n`;
    expect(quoteIsRepeatedInBody(quote, body)).toBe(true);
  });

  it("still catches it when the punctuation was cleaned differently", () => {
    const quote =
      "I wanted to get out of corporate America before the age of fifty.";
    const body =
      "## Background\n\n> I wanted to get out of corporate America — before the age of fifty!\n";
    expect(quoteIsRepeatedInBody(quote, body)).toBe(true);
  });

  it("leaves genuinely different quotes alone", () => {
    const quote =
      "I wanted to get out of corporate America before the age of fifty.";
    const body =
      '## Background\n\n> "It turned out to be the best decision we ever made as a family."\n';
    expect(quoteIsRepeatedInBody(quote, body)).toBe(false);
  });

  it("ignores a very short quote, where overlap is not meaningful", () => {
    expect(quoteIsRepeatedInBody("Do it.", '> "Do it."')).toBe(false);
  });
});
