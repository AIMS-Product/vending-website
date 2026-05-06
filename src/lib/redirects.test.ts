import { describe, expect, it } from "vitest";
import { resolveRedirectDestination } from "./redirects";

function request(url: string) {
  return {
    url,
    nextUrl: new URL(url),
  };
}

describe("resolveRedirectDestination", () => {
  it("preserves incoming query params when the destination has none", () => {
    const destination = resolveRedirectDestination(
      request("https://example.com/resources/old?utm_source=google"),
      "/resources/new",
    );

    expect(destination.toString()).toBe(
      "https://example.com/resources/new?utm_source=google",
    );
  });

  it("keeps an explicit destination query untouched", () => {
    const destination = resolveRedirectDestination(
      request("https://example.com/resources/old?utm_source=google"),
      "/resources/new?source=archive",
    );

    expect(destination.toString()).toBe(
      "https://example.com/resources/new?source=archive",
    );
  });
});
