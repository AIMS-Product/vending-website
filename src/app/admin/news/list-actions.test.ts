import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  archivePostFromList,
  bulkArchivePostsFromList,
} from "@/app/admin/news/list-actions";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  // Next's redirect() throws NEXT_REDIRECT to halt execution; mirror that so the
  // action stops at the redirect call exactly as it would in production.
  redirect: vi.fn((location: string) => {
    const error = new Error(`NEXT_REDIRECT:${location}`) as Error & {
      location: string;
    };
    error.location = location;
    throw error;
  }),
  requireAdmin: vi.fn(),
  adminGetPostById: vi.fn(),
  adminUpdatePost: vi.fn(),
}));

async function expectRedirect(
  run: Promise<void>,
  location: string,
): Promise<void> {
  await expect(run).rejects.toMatchObject({ location });
}

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/services/news", () => ({
  adminGetPostById: mocks.adminGetPostById,
  adminUpdatePost: mocks.adminUpdatePost,
}));

const POST_ID = "11111111-1111-4111-8111-111111111111";
const POST_ID_2 = "22222222-2222-4222-8222-222222222222";

function listFormData(entries: Record<string, string | string[]>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const v of value) formData.append(key, v);
    } else {
      formData.append(key, value);
    }
  }
  return formData;
}

beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
  mocks.adminGetPostById.mockResolvedValue({
    id: POST_ID,
    slug: "throwaway",
    status: "draft",
  });
  mocks.adminUpdatePost.mockResolvedValue({ id: POST_ID, slug: "throwaway" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("archivePostFromList", () => {
  it("archives a post by setting status to archived, revalidates, and returns to the list", async () => {
    await expectRedirect(
      archivePostFromList(
        listFormData({ id: POST_ID, returnTo: "/admin/news?status=draft" }),
      ),
      "/admin/news?status=draft",
    );

    expect(mocks.adminUpdatePost).toHaveBeenCalledWith(POST_ID, {
      status: "archived",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/news");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/news");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/news/throwaway");
  });

  it("rejects a non-UUID id without calling the service", async () => {
    await expectRedirect(
      archivePostFromList(listFormData({ id: "not-a-uuid" })),
      "/admin/news?error=invalid-id",
    );

    expect(mocks.adminUpdatePost).not.toHaveBeenCalled();
  });

  it("redirects to an editor error state when the archive service throws", async () => {
    mocks.adminUpdatePost.mockRejectedValue(new Error("rpc failed"));

    await expectRedirect(
      archivePostFromList(listFormData({ id: POST_ID })),
      `/admin/news/${POST_ID}?error=archive`,
    );

    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/admin/news");
  });

  it("does not change status for a missing post", async () => {
    mocks.adminGetPostById.mockResolvedValue(null);

    await expectRedirect(
      archivePostFromList(listFormData({ id: POST_ID })),
      `/admin/news/${POST_ID}?error=archive`,
    );

    expect(mocks.adminUpdatePost).not.toHaveBeenCalled();
  });
});

describe("bulkArchivePostsFromList", () => {
  it("archives several posts, dedupes ids, revalidates, and reports the count", async () => {
    mocks.adminGetPostById
      .mockResolvedValueOnce({ id: POST_ID, slug: "a", status: "draft" })
      .mockResolvedValueOnce({ id: POST_ID_2, slug: "b", status: "published" });

    await expectRedirect(
      bulkArchivePostsFromList(
        listFormData({
          ids: [POST_ID, POST_ID_2, POST_ID],
          returnTo: "/admin/news?status=published",
        }),
      ),
      "/admin/news?status=published&archived=2",
    );

    expect(mocks.adminUpdatePost).toHaveBeenCalledTimes(2);
    expect(mocks.adminUpdatePost).toHaveBeenCalledWith(POST_ID, {
      status: "archived",
    });
    expect(mocks.adminUpdatePost).toHaveBeenCalledWith(POST_ID_2, {
      status: "archived",
    });
  });

  it("filters out non-UUID ids and bails when nothing valid is selected", async () => {
    await expectRedirect(
      bulkArchivePostsFromList(listFormData({ ids: ["bad", "also-bad"] })),
      "/admin/news?error=bulk-archive",
    );

    expect(mocks.adminUpdatePost).not.toHaveBeenCalled();
  });

  it("reports partial failures in the result banner", async () => {
    mocks.adminGetPostById.mockResolvedValue({
      id: POST_ID,
      slug: "a",
      status: "draft",
    });
    mocks.adminUpdatePost
      .mockResolvedValueOnce({ id: POST_ID, slug: "a" })
      .mockRejectedValueOnce(new Error("rpc failed"));

    await expectRedirect(
      bulkArchivePostsFromList(listFormData({ ids: [POST_ID, POST_ID_2] })),
      "/admin/news?archived=1&failed=1",
    );
  });
});
