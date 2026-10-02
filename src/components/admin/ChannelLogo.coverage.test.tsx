import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FLOW_CHANNELS } from "@/lib/analytics/channel-flow";
import {
  AI_CHANNEL,
  CHATBOT_CHANNEL,
  GHL_FORMS_CHANNEL,
  INSTAGRAM_DM_CHANNEL,
  LOW_TICKET_CHANNEL,
  SEARCH_CHANNEL,
  WEBSITE_CHANNEL,
} from "@/lib/analytics/channel";
import { GOAL_CHANNELS } from "@/lib/services/channel-targets";
import { ChannelLogo } from "./ChannelLogo";

/*
 * Every channel name an admin report prints carries its mark. Two checks:
 * the vocabularies the reports draw labels from all resolve to a real logo
 * or glyph (never the neutral dot), and any file that draws channel-coloured
 * rows or network names imports ChannelLogo.
 */

const isMarked = (label: string) =>
  !renderToStaticMarkup(<ChannelLogo label={label} />).includes("rounded-full");

describe("channel marks", () => {
  it("marks every channel name the reports print", () => {
    const labels = [
      // Named on screen in every report that lists channels.
      "Facebook",
      "Instagram",
      "LinkedIn",
      "TikTok",
      "X",
      "YouTube",
      "Webinar",
      "Chatbot",
      "Google",
      "Meta",
      "Email",
      "Newsletter",
      "ChatGPT",
      ...FLOW_CHANNELS.filter((c) => c.key !== "other").map((c) => c.label),
      ...GOAL_CHANNELS.map((c) => c.label),
      AI_CHANNEL,
      CHATBOT_CHANNEL,
      GHL_FORMS_CHANNEL,
      INSTAGRAM_DM_CHANNEL,
      LOW_TICKET_CHANNEL,
      SEARCH_CHANNEL,
      WEBSITE_CHANNEL,
    ];
    expect(labels.filter((label) => !isMarked(label))).toEqual([]);
  });

  it("uses ChannelLogo wherever channel rows or network names are drawn", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".tsx") && !path.includes(".test.")) {
          files.push(path);
        }
      }
    };
    walk(join(process.cwd(), "src/components/admin"));
    walk(join(process.cwd(), "src/app/admin"));
    const offenders = files.filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        /FLOW_COLORS\[|NETWORK_NAMES\[/.test(source) &&
        !source.includes("ChannelLogo")
      );
    });
    expect(offenders).toEqual([]);
  });
});
