import { describe, expect, it, vi } from "vitest";

// The server action module pulls in server-only news services; the hook module
// only needs its type + the action reference, so mock the action to keep this a
// pure unit test of the payload/gate helpers.
vi.mock("@/app/admin/news/actions", () => ({
  autosaveNewsDraft: vi.fn(),
}));

import {
  buildNewsAutosaveFormData,
  newsAutosaveEnabled,
  type NewsAutosaveInput,
} from "./useNewsAutosave";

const base: NewsAutosaveInput = {
  postId: "11111111-1111-4111-8111-111111111111",
  status: "draft",
  title: "Campus Vending",
  slug: "campus-vending",
  excerpt: "A short excerpt.",
  body: "Body copy.",
  coverUrl: "https://cdn.example.com/x.jpg",
  coverAlt: "Cover alt",
};

describe("newsAutosaveEnabled (I5)", () => {
  it("is enabled only once a persisted row exists", () => {
    expect(newsAutosaveEnabled(base)).toBe(true);
    expect(newsAutosaveEnabled({ ...base, postId: null })).toBe(false);
    expect(newsAutosaveEnabled({ ...base, postId: "" })).toBe(false);
  });

  it("is draft-only — a published post's content is live, so never autosave it", () => {
    expect(newsAutosaveEnabled({ ...base, status: "published" })).toBe(false);
    expect(newsAutosaveEnabled({ ...base, status: "archived" })).toBe(false);
    expect(newsAutosaveEnabled({ ...base, status: "draft" })).toBe(true);
  });
});

describe("buildNewsAutosaveFormData (I5)", () => {
  it("carries every draft content field for the server action", () => {
    const formData = buildNewsAutosaveFormData(base);
    expect(formData.get("id")).toBe(base.postId);
    expect(formData.get("title")).toBe(base.title);
    expect(formData.get("slug")).toBe(base.slug);
    expect(formData.get("excerpt")).toBe(base.excerpt);
    expect(formData.get("body")).toBe(base.body);
    expect(formData.get("cover_url")).toBe(base.coverUrl);
    expect(formData.get("cover_alt")).toBe(base.coverAlt);
  });

  it("never carries a publish/status intent — autosave is draft-only", () => {
    const formData = buildNewsAutosaveFormData(base);
    // These are the fields that would let a background save change publication
    // state. Their absence is the invariant that guards the autosave incident.
    expect(formData.get("intent")).toBeNull();
    expect(formData.get("status")).toBeNull();
    expect(formData.get("published_at")).toBeNull();
  });
});
