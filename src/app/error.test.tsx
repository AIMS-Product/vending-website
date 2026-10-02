import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import ErrorPage from "./error";

describe("route error page", () => {
  const html = renderToStaticMarkup(
    createElement(ErrorPage, {
      error: Object.assign(new Error("boom"), { digest: "abc123" }),
      unstable_retry: () => {},
    }),
  );

  it("offers a retry and a way home", () => {
    expect(html).toContain("Try again");
    expect(html).toContain('href="/"');
  });

  it("links to the same secondary pages as the 404", () => {
    expect(html).toContain('href="/case-studies"');
    expect(html).toContain('href="/news"');
    expect(html).toContain('href="/about"');
  });

  it("shows the error reference and an uppercase H1", () => {
    expect(html).toContain("Reference: abc123");
    expect(html).toMatch(/<h1[^>]*uppercase/);
  });
});
