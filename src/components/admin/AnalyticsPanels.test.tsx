import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyticsBreakdown } from "./AnalyticsPanels";

const pages = [
  { label: "/", count: 245, booked: 146 },
  { label: "/booking-youtube", count: 212, booked: 146 },
  { label: "(direct / unknown)", count: 11 },
];

function render(props: Parameters<typeof AnalyticsBreakdown>[0]) {
  return renderToStaticMarkup(<AnalyticsBreakdown {...props} />);
}

describe("AnalyticsBreakdown", () => {
  it("leaves labels as plain text by default", () => {
    const html = render({ title: "Leads by channel", rows: pages });

    expect(html).not.toContain("<a ");
  });

  /**
   * These rows are the pages themselves. Reading a number next to a path and
   * then having to retype that path into a browser to see what the page says
   * is the difference between a report somebody checks and one they trust on
   * faith.
   */
  it("links a path to the live page when asked", () => {
    const html = render({
      title: "Leads by page",
      rows: pages,
      linkPaths: true,
    });

    expect(html).toContain('href="/booking-youtube"');
    // A new tab: the reader is working through a list and should not lose it.
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("never links a label that is not a path", () => {
    const html = render({
      title: "Leads by page",
      rows: pages,
      linkPaths: true,
    });

    // The fallback bucket is a description, not somewhere to navigate.
    expect(html).not.toContain('href="(direct / unknown)"');
    // Two real paths, so exactly two links.
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  it("refuses a label that only looks like a path", () => {
    const html = render({
      title: "Leads by page",
      rows: [
        { label: "//evil.example.com", count: 3 },
        { label: "/\\evil.example.com", count: 2 },
        { label: "/real-page", count: 1 },
      ],
      linkPaths: true,
    });

    // A protocol-relative URL is an off-site link wearing a path's clothes.
    // It still renders as TEXT -- it just must never become an href.
    expect(html).not.toContain('href="//evil');
    expect(html).not.toContain('href="/\\\\evil');
    expect(html).toContain("//evil.example.com");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="/real-page"');
  });
});
