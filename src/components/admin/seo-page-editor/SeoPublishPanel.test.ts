import { describe, expect, it } from "vitest";
import { editorPublishConfirmMessage } from "./editor-publish-confirmation";

describe("editorPublishConfirmMessage", () => {
  it("states that a draft will become visible at the public path", () => {
    expect(
      editorPublishConfirmMessage({
        isPublishedPage: false,
        routePrefix: "/resources",
        visibleSlug: "vending-in-college",
      }),
    ).toBe(
      "Publish this page?\n\nThis will make this draft visible at /resources/vending-in-college.",
    );
  });

  it("states that publishing changes replaces the live version", () => {
    expect(
      editorPublishConfirmMessage({
        isPublishedPage: true,
        routePrefix: "/blog",
        visibleSlug: "find-vending-machine-location",
      }),
    ).toBe(
      "Publish this page?\n\nThis will replace the current live version at /blog/find-vending-machine-location.",
    );
  });

  it("handles a missing slug without throwing", () => {
    expect(
      editorPublishConfirmMessage({
        isPublishedPage: false,
        routePrefix: "/resources",
        visibleSlug: "",
      }),
    ).toBe(
      "Publish this page?\n\nThis will make this draft visible at the public site.",
    );
  });
});
