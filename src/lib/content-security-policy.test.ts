import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicyReportOnly,
  CSP_REPORT_PATH,
} from "./content-security-policy";
import { securityHeaders } from "./security-headers";

function directive(name: string) {
  const found = contentSecurityPolicyReportOnly
    .split("; ")
    .find((part) => part.startsWith(`${name} `));
  return found?.slice(name.length + 1) ?? null;
}

describe("content security policy", () => {
  it("ships report-only and never as the enforcing header", () => {
    const keys = securityHeaders.map((header) => header.key);
    expect(keys).toContain("Content-Security-Policy-Report-Only");
    // Promoting this is a deliberate change with its own verification. If this
    // ever fails, someone turned enforcement on — check the report log first.
    expect(keys).not.toContain("Content-Security-Policy");
  });

  it("points reports at the collector route that exists", () => {
    expect(directive("report-uri")).toBe(CSP_REPORT_PATH);
    expect(CSP_REPORT_PATH).toBe("/api/csp-report");
  });

  it("allows the tag loaders the site actually embeds", () => {
    const scriptSrc = directive("script-src") ?? "";
    for (const host of [
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://cm.vendingpreneurs.ai",
      "https://js.hs-scripts.com",
      "https://fast.vidalytics.com",
      "https://t.rightmessage.com",
      "https://widget.manychat.com",
      "https://wisepops.net",
    ]) {
      expect(scriptSrc).toContain(host);
    }
  });

  it("frames only YouTube, Calendly, and the tag fallbacks", () => {
    const frameSrc = directive("frame-src") ?? "";
    expect(frameSrc).toContain("https://www.youtube-nocookie.com");
    expect(frameSrc).toContain("https://calendly.com");
    // Subdomain wildcards are fine; a bare `*` or `https:` would let any
    // origin frame content into the page.
    expect(frameSrc.split(" ")).not.toContain("*");
    expect(frameSrc.split(" ")).not.toContain("https:");
  });

  it("keeps the directives that cost nothing to enforce strict", () => {
    // These have no third-party dependency, so a report against any of them is
    // a real finding rather than a missing allowlist entry.
    expect(directive("object-src")).toBe("'none'");
    expect(directive("base-uri")).toBe("'self'");
    expect(directive("form-action")).toBe("'self'");
    expect(directive("frame-ancestors")).toBe("'self'");
  });

  it("does not wildcard script-src, which would make the report meaningless", () => {
    const scriptSrc = directive("script-src") ?? "";
    expect(scriptSrc).not.toMatch(/(^| )https:( |$)/);
    expect(scriptSrc).not.toContain("*");
  });
});
