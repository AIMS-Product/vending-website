import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminCreateApprovedClaim,
  adminCreateCtaPreset,
  adminCreateProofItem,
  adminCreateSourceDocument,
  adminCreateSourceExcerpt,
  adminListPageBuilderLibraries,
} from "./page-builder-libraries";
import type { Database } from "@/types/database";

type LibraryClient = Pick<SupabaseClient<Database>, "from">;

function listSelect(data: unknown, error: unknown = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ order });
  return { table: { select }, mocks: { select, order } };
}

function insertSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { table: { insert }, mocks: { insert, select, single } };
}

function buildClient(...tables: unknown[]) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
  } as unknown as LibraryClient & { from: ReturnType<typeof vi.fn> };
}

describe("page builder library service", () => {
  it("lists every reusable library in updated order", async () => {
    const proofItems = listSelect([{ id: "proof_1" }]);
    const ctaPresets = listSelect([{ id: "cta_1" }]);
    const sourceDocuments = listSelect([{ id: "doc_1" }]);
    const sourceExcerpts = listSelect([{ id: "excerpt_1" }]);
    const approvedClaims = listSelect([{ id: "claim_1" }]);
    const client = buildClient(
      proofItems.table,
      ctaPresets.table,
      sourceDocuments.table,
      sourceExcerpts.table,
      approvedClaims.table,
    );

    await expect(adminListPageBuilderLibraries({ client })).resolves.toEqual({
      proofItems: [{ id: "proof_1" }],
      ctaPresets: [{ id: "cta_1" }],
      sourceDocuments: [{ id: "doc_1" }],
      sourceExcerpts: [{ id: "excerpt_1" }],
      approvedClaims: [{ id: "claim_1" }],
    });

    expect(client.from).toHaveBeenNthCalledWith(1, "proof_items");
    expect(client.from).toHaveBeenNthCalledWith(2, "cta_presets");
    expect(client.from).toHaveBeenNthCalledWith(3, "source_documents");
    expect(client.from).toHaveBeenNthCalledWith(4, "source_excerpts");
    expect(client.from).toHaveBeenNthCalledWith(5, "approved_claims");
    for (const table of [
      proofItems,
      ctaPresets,
      sourceDocuments,
      sourceExcerpts,
      approvedClaims,
    ]) {
      expect(table.mocks.order).toHaveBeenCalledWith("updated_at", {
        ascending: false,
      });
    }
  });

  it("creates CTA presets with constrained hrefs and style presets", async () => {
    const created = { id: "cta_1", label: "Apply now" };
    const insert = insertSingle(created);
    const client = buildClient(insert.table);

    await expect(
      adminCreateCtaPreset(
        {
          label: "Apply now",
          href: "/apply",
          stylePreset: "secondary",
          trackingName: "apply_now",
        },
        { client },
      ),
    ).resolves.toBe(created);

    expect(insert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Apply now",
        href: "/apply",
        style_preset: "secondary",
        tracking_name: "apply_now",
      }),
    );

    await expect(
      adminCreateCtaPreset(
        {
          label: "Bad",
          href: "javascript:alert(1)",
          stylePreset: "primary",
          trackingName: "bad",
        },
        { client },
      ),
    ).rejects.toThrow("CTA href must be a relative path or approved URL.");

    await expect(
      adminCreateCtaPreset(
        {
          label: "Bad style",
          href: "/apply",
          stylePreset: "danger",
          trackingName: "bad_style",
        },
        { client },
      ),
    ).rejects.toThrow("CTA style preset is invalid.");
  });

  it("requires rights notes before approving reusable proof", async () => {
    const insert = insertSingle({ id: "proof_1" });
    const client = buildClient(insert.table);

    await expect(
      adminCreateProofItem(
        {
          kind: "testimonial",
          body: "The program helped me launch.",
          sourceRightsNotes: "Approved testimonial rights.",
          approved: true,
        },
        { client },
      ),
    ).resolves.toEqual({ id: "proof_1" });

    expect(insert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "testimonial",
        body: "The program helped me launch.",
        source_rights_notes: "Approved testimonial rights.",
        approved: true,
      }),
    );

    await expect(
      adminCreateProofItem(
        {
          kind: "testimonial",
          body: "Missing rights.",
          sourceRightsNotes: "",
          approved: true,
        },
        { client },
      ),
    ).rejects.toThrow("Approved proof requires source and rights notes.");

    await expect(
      adminCreateProofItem(
        {
          kind: "bad_kind",
          body: "Invalid kind.",
          approved: false,
        },
        { client },
      ),
    ).rejects.toThrow("Proof kind is invalid.");
  });

  it("creates source documents, approved excerpts, and approved claims", async () => {
    const docInsert = insertSingle({ id: "doc_1" });
    const excerptInsert = insertSingle({ id: "excerpt_1" });
    const claimInsert = insertSingle({ id: "claim_1" });
    const client = buildClient(
      docInsert.table,
      excerptInsert.table,
      claimInsert.table,
    );
    const now = () => new Date("2026-05-07T01:02:03.000Z");

    await adminCreateSourceDocument(
      {
        title: "Operations notes",
        sourceType: "paste",
        body: "Approved operating source.",
        tags: ["ops"],
        createdBy: "admin_1",
      },
      { client },
    );
    await adminCreateSourceExcerpt(
      {
        sourceDocumentId: "doc_1",
        excerpt: "Operators should validate locations before install.",
        topicTags: ["locations"],
        approved: true,
        approvedBy: "admin_1",
      },
      { client, now },
    );
    await adminCreateApprovedClaim(
      {
        claim: "Location validation reduces launch risk.",
        claimType: "operations",
        sourceExcerptId: "excerpt_1",
        usageNotes: "Use on operations pages.",
        riskLevel: "medium",
        approvedBy: "admin_1",
      },
      { client, now },
    );

    expect(docInsert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Operations notes",
        source_type: "paste",
        body: "Approved operating source.",
        tags: ["ops"],
        created_by: "admin_1",
      }),
    );
    expect(excerptInsert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_document_id: "doc_1",
        approved: true,
        approved_by: "admin_1",
        approved_at: "2026-05-07T01:02:03.000Z",
      }),
    );
    expect(claimInsert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        claim: "Location validation reduces launch risk.",
        claim_type: "operations",
        source_excerpt_id: "excerpt_1",
        usage_notes: "Use on operations pages.",
        risk_level: "medium",
        approved_by: "admin_1",
        approved_at: "2026-05-07T01:02:03.000Z",
      }),
    );
  });

  it("does not retain approver metadata for draft source excerpts", async () => {
    const excerptInsert = insertSingle({ id: "excerpt_1" });
    const client = buildClient(excerptInsert.table);

    await adminCreateSourceExcerpt(
      {
        sourceDocumentId: "doc_1",
        excerpt: "Draft source excerpt.",
        topicTags: ["draft"],
        approved: false,
        approvedBy: "admin_1",
      },
      { client, now: () => new Date("2026-05-07T01:02:03.000Z") },
    );

    expect(excerptInsert.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_document_id: "doc_1",
        approved: false,
        approved_by: null,
        approved_at: null,
      }),
    );
  });
});
