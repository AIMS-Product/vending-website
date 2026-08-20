import { describe, expect, it } from "vitest";
import {
  extractPlaylistVideoIds,
  planSync,
  slugFromTitle,
  uniqueSlug,
} from "./sync-youtube-case-studies.mjs";

describe("extractPlaylistVideoIds", () => {
  it("returns ids in document order without duplicates", () => {
    const html =
      '{"videoId":"aaaaaaaaaaa"}x{"videoId":"bbbbbbbbbbb"}y{"videoId":"aaaaaaaaaaa"}';
    expect(extractPlaylistVideoIds(html)).toEqual([
      "aaaaaaaaaaa",
      "bbbbbbbbbbb",
    ]);
  });

  it("returns nothing when the page shape changes", () => {
    // The caller turns an empty result into a hard error rather than treating
    // it as "the playlist is empty" — this locks in the empty return.
    expect(extractPlaylistVideoIds("<html>no state here</html>")).toEqual([]);
  });
});

describe("slugFromTitle", () => {
  it("kebab-cases and caps length", () => {
    expect(
      slugFromTitle("From Rock Bottom to $41K/Month… In Less Than a Year"),
    ).toBe("from-rock-bottom-to-41k-month-in-less");
  });

  it("drops apostrophes rather than turning them into separators", () => {
    expect(slugFromTitle("What His First 30 Days Really Looked Like")).toBe(
      "what-his-first-30-days-really-looked-like",
    );
    expect(slugFromTitle("He's Doing It")).toBe("hes-doing-it");
  });

  it("never returns an empty slug", () => {
    expect(slugFromTitle("!!!")).toBe("member-story");
  });
});

describe("uniqueSlug", () => {
  it("suffixes until free", () => {
    expect(uniqueSlug("joe", new Set(["joe", "joe-2"]))).toBe("joe-3");
  });
});

describe("planSync", () => {
  const existing = [
    {
      id: "1",
      slug: "musa-sadi",
      title: "Rewritten headline",
      youtube_video_id: "kb8ryBm6g9k",
    },
    {
      id: "2",
      slug: "blank-title",
      title: "  ",
      youtube_video_id: "co01wsvxJw8",
    },
  ];

  it("creates a draft stub for an unknown video", () => {
    const { creates } = planSync(
      [{ videoId: "brandnew123", title: "A New Story" }],
      existing,
    );
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({
      youtube_video_id: "brandnew123",
      status: "draft",
      member_name: "TBC",
      slug: "a-new-story",
    });
  });

  it("never overwrites an edited title", () => {
    // The whole point of the script: a re-run must not reset site copy back to
    // whatever the YouTube title happens to be today.
    const { updates, unchanged } = planSync(
      [{ videoId: "kb8ryBm6g9k", title: "Original YouTube Title" }],
      existing,
    );
    expect(updates).toHaveLength(0);
    expect(unchanged).toEqual([{ id: "1", slug: "musa-sadi" }]);
  });

  it("fills a title that is only whitespace", () => {
    const { updates } = planSync(
      [{ videoId: "co01wsvxJw8", title: "Months Without a Location" }],
      existing,
    );
    expect(updates).toEqual([
      {
        id: "2",
        slug: "blank-title",
        patch: { title: "Months Without a Location" },
      },
    ]);
  });

  it("does not collide slugs across several new videos", () => {
    const { creates } = planSync(
      [
        { videoId: "newvideo001", title: "Same Title" },
        { videoId: "newvideo002", title: "Same Title" },
      ],
      [],
    );
    expect(creates.map((row) => row.slug)).toEqual([
      "same-title",
      "same-title-2",
    ]);
  });
});
