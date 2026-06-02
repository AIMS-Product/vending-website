import { describe, expect, it, vi, beforeEach } from "vitest";
import { createAuthorProfile } from "./actions";

const mocks = vi.hoisted(() => ({
  adminCreateAuthorProfile: vi.fn(),
  redirect: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/seo-pages", () => ({
  adminCreateAuthorProfile: mocks.adminCreateAuthorProfile,
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

describe("createAuthorProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin_1" } });
  });

  it("redirects with the validation error message when author creation fails", async () => {
    mocks.adminCreateAuthorProfile.mockRejectedValue(
      new Error("Author slug is required."),
    );
    const formData = new FormData();
    formData.set("displayName", "Mike Hoffman");
    formData.set("slug", " --- ");

    await createAuthorProfile(formData);

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/admin/pages/authors?error=Author%20slug%20is%20required.",
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
