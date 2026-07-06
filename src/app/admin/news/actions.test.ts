import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  autosaveNewsDraft,
  savePost,
  type EditorActionState,
} from "@/app/admin/news/actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn((location: string) => {
    const error = new Error(`NEXT_REDIRECT:${location}`) as Error & {
      location: string;
    };
    error.location = location;
    throw error;
  }),
  requireAdmin: vi.fn(),
  adminGetPostById: vi.fn(),
  adminCreatePost: vi.fn(),
  adminUpdatePost: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/supabase/signed-upload", () => ({
  createSignedImageStorageUpload: vi.fn(),
}));
vi.mock("@/lib/services/news", () => ({
  adminGetPostById: mocks.adminGetPostById,
  adminCreatePost: mocks.adminCreatePost,
  adminUpdatePost: mocks.adminUpdatePost,
}));

const POST_ID = "11111111-1111-4111-8111-111111111111";
const idle: EditorActionState = { status: "idle" };

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function existingDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    slug: "old-slug",
    status: "published" as const,
    published_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
  mocks.adminGetPostById.mockResolvedValue(existingDraft());
  mocks.adminUpdatePost.mockResolvedValue(existingDraft());
});

afterEach(() => {
  vi.clearAllMocks();
});

// I13 -----------------------------------------------------------------------
describe("savePost slug validation (I13)", () => {
  it("normalizes a raw slug with spaces and punctuation before persisting", async () => {
    const result = await savePost(
      idle,
      formData({
        id: POST_ID,
        title: "Launch Day",
        slug: "Invalid Slug With Spaces!!",
        excerpt: "",
        body: "Body copy here.",
        cover_url: "",
        cover_alt: "",
        intent: "save",
      }),
    );

    expect(result).toEqual({ status: "saved", message: "Post saved." });
    expect(mocks.adminUpdatePost).toHaveBeenCalledWith(
      POST_ID,
      expect.objectContaining({ slug: "invalid-slug-with-spaces" }),
    );
  });

  it("rejects a slug that normalizes to empty with a clear field error", async () => {
    const result = await savePost(
      idle,
      formData({
        id: POST_ID,
        title: "Launch Day",
        slug: "!!!",
        excerpt: "",
        body: "Body copy here.",
        cover_url: "",
        cover_alt: "",
        intent: "save",
      }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/url-safe/i);
    expect(mocks.adminUpdatePost).not.toHaveBeenCalled();
  });

  it("leaves an already-valid slug unchanged (no regression)", async () => {
    await savePost(
      idle,
      formData({
        id: POST_ID,
        title: "Campus Vending",
        slug: "campus-vending-2026",
        excerpt: "",
        body: "Body copy here.",
        cover_url: "",
        cover_alt: "",
        intent: "save",
      }),
    );

    expect(mocks.adminUpdatePost).toHaveBeenCalledWith(
      POST_ID,
      expect.objectContaining({ slug: "campus-vending-2026" }),
    );
  });
});

// I5 ------------------------------------------------------------------------
describe("autosaveNewsDraft (I5)", () => {
  it("refuses to autosave a published post — its content is the live site", async () => {
    // News is single-source: public pages read body/slug straight off the row
    // when status is published, so a background write here would edit the live
    // site. The action must skip without calling adminUpdatePost.
    mocks.adminGetPostById.mockResolvedValue(
      existingDraft({ status: "published" }),
    );

    const result = await autosaveNewsDraft(
      formData({
        id: POST_ID,
        title: "Edited Title",
        slug: "edited-title",
        excerpt: "",
        body: "Edited body.",
        cover_url: "",
        cover_alt: "",
      }),
    );

    expect(result.status).toBe("skipped");
    expect(mocks.adminUpdatePost).not.toHaveBeenCalled();
  });

  it("writes draft content only and NEVER touches status or published_at", async () => {
    mocks.adminGetPostById.mockResolvedValue(
      existingDraft({ status: "draft", published_at: null }),
    );
    const result = await autosaveNewsDraft(
      formData({
        id: POST_ID,
        title: "Edited Title",
        slug: "edited-title",
        excerpt: "New excerpt.",
        body: "Edited body.",
        cover_url: "https://cdn.example.com/x.jpg",
        cover_alt: "Alt",
      }),
    );

    expect(result.status).toBe("saved");
    expect(mocks.adminUpdatePost).toHaveBeenCalledTimes(1);
    const [, patch] = mocks.adminUpdatePost.mock.calls[0];
    // The invariant that guards against the production autosave incident:
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("published_at");
    expect(patch).toMatchObject({
      title: "Edited Title",
      slug: "edited-title",
      body: "Edited body.",
    });
  });

  it("normalizes the slug the same way the manual save does", async () => {
    mocks.adminGetPostById.mockResolvedValue(
      existingDraft({ status: "draft", published_at: null }),
    );
    await autosaveNewsDraft(
      formData({
        id: POST_ID,
        title: "T",
        slug: "Draft Slug With Spaces!!",
        excerpt: "",
        body: "b",
        cover_url: "",
        cover_alt: "",
      }),
    );

    const [, patch] = mocks.adminUpdatePost.mock.calls[0];
    expect(patch.slug).toBe("draft-slug-with-spaces");
  });

  it("skips (non-destructively) when the id is missing — never creates a row", async () => {
    const result = await autosaveNewsDraft(
      formData({
        id: "",
        title: "T",
        slug: "t",
        excerpt: "",
        body: "b",
        cover_url: "",
        cover_alt: "",
      }),
    );

    expect(result.status).toBe("skipped");
    expect(mocks.adminUpdatePost).not.toHaveBeenCalled();
    expect(mocks.adminCreatePost).not.toHaveBeenCalled();
  });

  it("returns an honest error when the row is gone, without claiming saved", async () => {
    mocks.adminGetPostById.mockResolvedValue(null);

    const result = await autosaveNewsDraft(
      formData({
        id: POST_ID,
        title: "T",
        slug: "t",
        excerpt: "",
        body: "b",
        cover_url: "",
        cover_alt: "",
      }),
    );

    expect(result.status).toBe("error");
    expect(mocks.adminUpdatePost).not.toHaveBeenCalled();
  });

  it("surfaces a non-destructive error when the update throws", async () => {
    mocks.adminGetPostById.mockResolvedValue(
      existingDraft({ status: "draft", published_at: null }),
    );
    mocks.adminUpdatePost.mockRejectedValue(new Error("rpc failed"));

    const result = await autosaveNewsDraft(
      formData({
        id: POST_ID,
        title: "T",
        slug: "t",
        excerpt: "",
        body: "b",
        cover_url: "",
        cover_alt: "",
      }),
    );

    expect(result.status).toBe("error");
    if (result.status === "error") {
      // Honest failure copy: it must tell the user the work is NOT saved, never
      // imply success.
      expect(result.message.toLowerCase()).toContain("not saved");
    }
  });
});
