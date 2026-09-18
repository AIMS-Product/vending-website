import { describe, expect, it } from "vitest";
import { trailingSlashRedirectPath } from "./trailing-slash";

describe("trailingSlashRedirectPath", () => {
  it("redirects a trailing slash to the bare path", () => {
    expect(trailingSlashRedirectPath("/about/")).toBe("/about");
    expect(trailingSlashRedirectPath("/news/")).toBe("/news");
    expect(trailingSlashRedirectPath("/news/some-post/")).toBe(
      "/news/some-post",
    );
  });

  it("collapses repeated slashes and never redirects the root", () => {
    expect(trailingSlashRedirectPath("/about//")).toBe("/about");
    expect(trailingSlashRedirectPath("//")).toBe("/");
    expect(trailingSlashRedirectPath("/")).toBeNull();
  });

  it("leaves canonical paths alone", () => {
    expect(trailingSlashRedirectPath("/about")).toBeNull();
    expect(trailingSlashRedirectPath("/api/ph/e")).toBeNull();
  });
});
