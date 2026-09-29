import { describe, expect, it } from "vitest";
import { answerRow, hostsOf, mentionRow, youtubeRow } from "./seo-ai-sync";

const vp = new Set(["n9vUTOG-L7Y"]);

describe("seo ai rows", () => {
  it("records who an answer cites and whether it names VP", () => {
    const row = answerRow(
      "2026-09-28",
      "chatgpt",
      {
        query: "Best Vending Coaching",
        refs: [
          "https://www.upflip.com/academy?utm_source=chatgpt.com",
          "https://www.youtube.com/watch?v=n9vUTOG-L7Y",
          "not a url",
        ],
        text: '{"markdown":"Vendingpreneurs, run by Mike Hoffman, ..."}',
      },
      vp,
    );
    expect(row).toMatchObject({
      query: "best vending coaching",
      cites_site: false,
      cites_youtube: true,
      mentions_vp: true,
      cited_hosts: ["upflip.com", "youtube.com"],
    });
  });

  it("marks a site citation only for a real VP host", () => {
    expect(hostsOf(["https://courses.vendingpreneurs.com/x"])).toEqual([
      "courses.vendingpreneurs.com",
    ]);
    expect(
      answerRow(
        "d",
        "ai_mode",
        {
          query: "q",
          refs: ["https://vendingpreneurs.com.evil.io/"],
          text: "",
        },
        vp,
      ).cites_site,
    ).toBe(false);
  });

  it("ranks the first VP video on YouTube", () => {
    const row = youtubeRow(
      "d",
      "k",
      [
        { rank: 1, videoId: "other", channelId: null, title: "x" },
        { rank: 4, videoId: "n9vUTOG-L7Y", channelId: null, title: "y" },
      ],
      vp,
    );
    expect(row).toMatchObject({
      vp_position: 4,
      cites_youtube: true,
      engine: "youtube",
    });
    expect(youtubeRow("d", "k", [], vp).vp_position).toBeNull();
  });

  it("files an LLM mention under its model", () => {
    expect(
      mentionRow("d", {
        platform: "google",
        model: "google_ai_overview",
        question: "How much?",
        refs: ["https://www.vendingpreneurs.com/a"],
      }),
    ).toMatchObject({
      engine: "mention:google_ai_overview",
      query: "how much?",
      cites_site: true,
    });
  });
});
