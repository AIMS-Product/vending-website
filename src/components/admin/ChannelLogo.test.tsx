import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { brandFor, ChannelLogo } from "./ChannelLogo";

const render = (label: string) =>
  renderToStaticMarkup(<ChannelLogo label={label} />);

describe("ChannelLogo", () => {
  it("resolves the most specific brand first", () => {
    expect(brandFor("Meta Ads")?.file).toBe("meta");
    expect(brandFor("Meta Ads")?.label).toBe("Meta Ads");
    expect(brandFor("Google Ads")?.file).toBe("google-ads");
    expect(brandFor("Google")?.file).toBe("google");
    expect(brandFor("Organic search")).toBeNull();
  });

  it("matches X only as a whole label, never as a letter", () => {
    expect(brandFor("X")?.file).toBe("x");
    expect(brandFor("Xxxxx")).toBeNull();
    expect(brandFor("Instagram DM")?.file).toBe("instagram");
  });

  it("renders a brand as its artwork file, labelled for screen readers", () => {
    const html = render("YouTube");
    expect(html).toContain('src="/admin/brands/youtube.svg"');
    expect(html).toContain('alt="YouTube"');
  });

  it("renders owned surfaces and Lane 2 as neutral glyphs, not brands", () => {
    expect(render("Website")).toContain("<svg");
    expect(render("Lane 2")).toContain("<svg");
    expect(render("Lane 2")).not.toContain("<img");
  });

  it("keeps an aligned slot for a label it does not know", () => {
    expect(render("Something new")).toContain("rounded-full");
  });

  it("ships a file for every brand it can name", () => {
    const dir = join(process.cwd(), "public", "admin", "brands");
    const labels = [
      "YouTube",
      "Instagram",
      "LinkedIn",
      "Meta",
      "Facebook",
      "Google Ads",
      "Google Analytics",
      "Google",
      "TikTok",
      "Trustpilot",
      "Braze",
      "Close",
      "ActiveCampaign",
      "Typeform",
      "Zoom",
      "Slack",
      "Calendly",
      "Bitly",
      "HubSpot",
      "Metricool",
      "Kit",
      "X",
    ];
    for (const label of labels) {
      const brand = brandFor(label);
      expect(brand, label).not.toBeNull();
      expect(existsSync(join(dir, `${brand!.file}.svg`)), label).toBe(true);
    }
  });
});
