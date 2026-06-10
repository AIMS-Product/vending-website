import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminRevisionPreviewPage from "./page";
import {
  adminGetSeoPageById,
  adminGetSeoPageRevision,
} from "@/lib/services/seo-pages";
import { requireAdmin } from "@/lib/supabase/auth";

vi.mock("@/lib/services/seo-pages", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/seo-pages")
  >("@/lib/services/seo-pages");
  return {
    ...actual,
    adminGetSeoPageById: vi.fn(),
    adminGetSeoPageRevision: vi.fn(),
  };
});

vi.mock("@/lib/supabase/auth", () => ({ requireAdmin: vi.fn() }));

vi.mock("@/components/sections/ResourcePageRenderer", () => ({
  ResourcePageRenderer: () => null,
}));

const content = {
  version: 1,
  sections: [
    {
      id: "s1",
      columns: [
        {
          id: "c1",
          blocks: [
            { id: "b1", type: "hero", props: { heading: "Hello world here" } },
          ],
        },
      ],
    },
  ],
};

describe("AdminRevisionPreviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue({
      user: { id: "admin_1", email: "a@example.com" },
      role: "super_admin",
    });
    vi.mocked(adminGetSeoPageById).mockResolvedValue({
      id: "page_1",
      title: "T",
      target_keyword: null,
      seo_title: null,
      meta_description: null,
      canonical_url: null,
    } as never);
  });

  it("shows a human revision label, Pacific-time, and a block/word context line", async () => {
    vi.mocked(adminGetSeoPageRevision).mockResolvedValue({
      id: "rev_1",
      revision_type: "manual_save",
      created_at: "2026-06-03T16:30:00.000Z",
      content_snapshot: content,
      seo_snapshot: {},
    } as never);

    const page = await AdminRevisionPreviewPage({
      params: Promise.resolve({ id: "page_1", revisionId: "rev_1" }),
    });
    const html = renderToStaticMarkup(page);

    // Human label, not the raw enum.
    expect(html).toContain("Manual save");
    expect(html).not.toContain("manual_save");
    // Pacific time (9:30 AM PDT for 16:30 UTC), not UTC's 4:30 PM.
    expect(html).toMatch(/9:30\s?AM/);
    // Context line from the snapshot.
    expect(html).toContain("1 block");
    expect(html).toMatch(/\d+ words?/);
  });
});
