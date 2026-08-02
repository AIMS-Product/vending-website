import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApprovedClaim,
  createCtaPreset,
  createProofItem,
  createSourceDocument,
  createSourceExcerpt,
} from "./actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  adminCreateCtaPreset: vi.fn(),
  adminCreateProofItem: vi.fn(),
  adminCreateSourceDocument: vi.fn(),
  adminCreateSourceExcerpt: vi.fn(),
  adminCreateApprovedClaim: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/services/page-builder-libraries", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/page-builder-libraries")
  >("@/lib/services/page-builder-libraries");
  return {
    ...actual,
    adminCreateCtaPreset: mocks.adminCreateCtaPreset,
    adminCreateProofItem: mocks.adminCreateProofItem,
    adminCreateSourceDocument: mocks.adminCreateSourceDocument,
    adminCreateSourceExcerpt: mocks.adminCreateSourceExcerpt,
    adminCreateApprovedClaim: mocks.adminCreateApprovedClaim,
  };
});

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("library server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin_1" } });
  });

  it("creates a CTA preset from the posted fields", async () => {
    await createCtaPreset(
      form({
        label: "Book a call",
        href: "/contact",
        stylePreset: "primary",
        trackingName: "hero_book",
      }),
    );

    expect(mocks.adminCreateCtaPreset).toHaveBeenCalledWith({
      label: "Book a call",
      href: "/contact",
      stylePreset: "primary",
      trackingName: "hero_book",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/libraries");
  });

  it("reads a missing field as an empty string rather than the literal null", async () => {
    // FormData.get returns null for an absent field; String(null) is "null",
    // which would be stored as a real value.
    await createCtaPreset(form({ label: "Book a call" }));

    expect(mocks.adminCreateCtaPreset).toHaveBeenCalledWith(
      expect.objectContaining({ href: "", trackingName: "" }),
    );
  });

  it("treats an unchecked approval checkbox as not approved", async () => {
    // An unchecked checkbox is absent from FormData entirely. Anything other
    // than an exact "on" must not approve a proof item for publication.
    await createProofItem(form({ kind: "testimonial", body: "It works." }));

    expect(mocks.adminCreateProofItem).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false }),
    );
  });

  it("approves a proof item only for a checked box", async () => {
    await createProofItem(
      form({ kind: "testimonial", body: "It works.", approved: "on" }),
    );

    expect(mocks.adminCreateProofItem).toHaveBeenCalledWith(
      expect.objectContaining({ approved: true }),
    );
  });

  it("splits, trims, and caps document tags at twenty", async () => {
    await createSourceDocument(
      form({
        title: "Route economics",
        sourceType: "internal",
        body: "…",
        tags: ` a, b ,, ${Array.from({ length: 25 }, (_, i) => `t${i}`).join(",")}`,
      }),
    );

    const call = mocks.adminCreateSourceDocument.mock.calls[0]?.[0];
    expect(call.tags.slice(0, 3)).toEqual(["a", "b", "t0"]);
    expect(call.tags).toHaveLength(20);
    expect(call.tags).not.toContain("");
    expect(call.createdBy).toBe("admin_1");
  });

  it("records the approver on an excerpt only when it is approved", async () => {
    await createSourceExcerpt(
      form({ sourceDocumentId: "doc_1", excerpt: "…", approved: "on" }),
    );
    expect(mocks.adminCreateSourceExcerpt).toHaveBeenCalledWith(
      expect.objectContaining({ approved: true, approvedBy: "admin_1" }),
    );

    await createSourceExcerpt(
      form({ sourceDocumentId: "doc_1", excerpt: "…" }),
    );
    expect(mocks.adminCreateSourceExcerpt).toHaveBeenLastCalledWith(
      expect.objectContaining({ approved: false, approvedBy: undefined }),
    );
  });

  it("always stamps the approver on a claim", async () => {
    await createApprovedClaim(
      form({ claim: "Operators keep 100% of revenue.", claimType: "outcome" }),
    );

    expect(mocks.adminCreateApprovedClaim).toHaveBeenCalledWith(
      expect.objectContaining({ approvedBy: "admin_1" }),
    );
  });

  it("requires an admin before every one of these writes", async () => {
    // These are public HTTP endpoints, and they write the claims and proof the
    // marketing pages then quote as approved.
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));

    for (const action of [
      createCtaPreset,
      createProofItem,
      createSourceDocument,
      createSourceExcerpt,
      createApprovedClaim,
    ]) {
      await expect(action(form({}))).rejects.toThrow("Unauthorized");
    }

    expect(mocks.adminCreateCtaPreset).not.toHaveBeenCalled();
    expect(mocks.adminCreateProofItem).not.toHaveBeenCalled();
    expect(mocks.adminCreateSourceDocument).not.toHaveBeenCalled();
    expect(mocks.adminCreateSourceExcerpt).not.toHaveBeenCalled();
    expect(mocks.adminCreateApprovedClaim).not.toHaveBeenCalled();
  });
});
