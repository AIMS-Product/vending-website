import { describe, expect, it, vi } from "vitest";
import { adminDeleteNeverSavedSeoPageDraft } from "./seo-page-drafts";

const PAGE_ID = "11111111-1111-4111-8111-111111111111";

type RowResult = { data: unknown; error: unknown };

// Builds a fake Supabase client whose `from()` returns a chainable query that
// resolves to the configured row (seo_pages) or count (page_revisions).
function buildClient({
  row,
  rowError = null,
  count = 0,
  countError = null,
}: {
  row: RowResult["data"];
  rowError?: unknown;
  count?: number | null;
  countError?: unknown;
}) {
  // The delete chain re-asserts the floor conditions (.eq/.is) and is awaited
  // as a thenable, mirroring the real Supabase builder.
  const deleteBuilder: {
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    then: (resolve: (value: { error: null }) => void) => void;
  } = {
    eq: vi.fn(() => deleteBuilder),
    is: vi.fn(() => deleteBuilder),
    then: (resolve) => resolve({ error: null }),
  };
  const deleteEq = deleteBuilder.eq;
  const deleteIs = deleteBuilder.is;

  const seoPagesQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: rowError }),
    delete: vi.fn().mockReturnValue(deleteBuilder),
  };

  const revisionsQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ count, error: countError }),
  };

  const from = vi.fn((table: string) =>
    table === "page_revisions" ? revisionsQuery : seoPagesQuery,
  );

  return { from, seoPagesQuery, revisionsQuery, deleteEq, deleteIs };
}

describe("adminDeleteNeverSavedSeoPageDraft", () => {
  it("deletes a never-published draft with no revisions", async () => {
    const client = buildClient({
      row: {
        id: PAGE_ID,
        status: "draft",
        published_at: null,
        published_revision_id: null,
      },
      count: 0,
    });

    const result = await adminDeleteNeverSavedSeoPageDraft(PAGE_ID, {
      client: client as never,
    });

    expect(result).toEqual({ status: "deleted" });
    expect(client.seoPagesQuery.delete).toHaveBeenCalledTimes(1);
    // The DELETE itself re-asserts the never-saved floor, not just the check.
    expect(client.deleteEq).toHaveBeenCalledWith("id", PAGE_ID);
    expect(client.deleteEq).toHaveBeenCalledWith("status", "draft");
    expect(client.deleteIs).toHaveBeenCalledWith("published_at", null);
    expect(client.deleteIs).toHaveBeenCalledWith("published_revision_id", null);
  });

  it("refuses to delete a published page and never calls delete", async () => {
    const client = buildClient({
      row: {
        id: PAGE_ID,
        status: "published",
        published_at: "2026-06-01T00:00:00.000Z",
        published_revision_id: "rev_1",
      },
      count: 1,
    });

    const result = await adminDeleteNeverSavedSeoPageDraft(PAGE_ID, {
      client: client as never,
    });

    expect(result).toEqual({ status: "protected" });
    expect(client.seoPagesQuery.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete a draft that has revision history", async () => {
    const client = buildClient({
      row: {
        id: PAGE_ID,
        status: "draft",
        published_at: null,
        published_revision_id: null,
      },
      count: 3,
    });

    const result = await adminDeleteNeverSavedSeoPageDraft(PAGE_ID, {
      client: client as never,
    });

    expect(result).toEqual({ status: "protected" });
    expect(client.seoPagesQuery.delete).not.toHaveBeenCalled();
  });

  it("reports not_found when the row does not exist", async () => {
    const client = buildClient({ row: null, count: 0 });

    const result = await adminDeleteNeverSavedSeoPageDraft(PAGE_ID, {
      client: client as never,
    });

    expect(result).toEqual({ status: "not_found" });
    expect(client.seoPagesQuery.delete).not.toHaveBeenCalled();
  });
});
