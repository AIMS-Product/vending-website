import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthorProfilesPage from "./page";
import { adminListAuthorProfiles } from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";

vi.mock("./actions", () => ({
  createAuthorProfile: vi.fn(),
}));

vi.mock("@/lib/services/seo-pages", () => ({
  adminListAuthorProfiles: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: vi.fn(),
}));

describe("AuthorProfilesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      user: { id: "admin_1", email: "admin@example.com" },
      role: "super_admin",
    });
    vi.mocked(adminListAuthorProfiles).mockResolvedValue([]);
  });

  it("does not read author profiles until admin auth has succeeded", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("redirect to login"));

    await expect(
      AuthorProfilesPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect to login");

    expect(adminListAuthorProfiles).not.toHaveBeenCalled();
  });
});
