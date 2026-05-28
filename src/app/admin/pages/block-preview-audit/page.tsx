import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { BlockVariantPreviewSkeleton } from "@/components/admin/SeoPageBlockVariantPreview";
import { ResourcePageContentView } from "@/components/sections/ResourcePageContent";
import {
  blockPreviewCases,
  getBlockPreviewParityMarkers,
} from "@/lib/page-builder/block-preview-cases";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Block preview audit",
  robots: { index: false, follow: false },
};

export default async function BlockPreviewAuditPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { user, role } = await requireAdmin();

  return (
    <>
      <span
        hidden
        aria-hidden="true"
        data-hide-site-header="true"
        data-hide-site-footer="true"
      />
      <AdminShell
        activeSection="pages"
        eyebrow="SEO Page Builder"
        title="Block preview audit"
        description="Compare every picker preview against the real resource-page render using mocked block content."
        userEmail={user.email}
        userRole={role}
      >
        <section className="grid gap-5" data-testid="block-preview-audit">
          {blockPreviewCases.map((previewCase) => {
            return (
              <article
                key={previewCase.id}
                data-testid="block-preview-case"
                data-block-type={previewCase.type}
                data-block-variant={previewCase.variant}
                data-parity-markers={JSON.stringify(
                  getBlockPreviewParityMarkers(previewCase.block),
                )}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <header className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      {previewCase.blockLabel}
                    </p>
                    <h2 className="text-base font-semibold text-slate-950">
                      {previewCase.variantLabel}
                    </h2>
                  </div>
                  <p className="max-w-xl text-sm text-slate-500">
                    {previewCase.description}
                  </p>
                </header>

                <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div
                    className="border-b border-slate-200 p-4 xl:border-r xl:border-b-0"
                    data-testid="picker-preview"
                  >
                    <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Picker preview
                    </p>
                    <div
                      className="h-48 overflow-hidden rounded-lg border border-slate-200 bg-white p-4"
                      aria-hidden="true"
                      inert
                    >
                      <BlockVariantPreviewSkeleton
                        type={previewCase.type}
                        variant={previewCase.variant}
                      />
                    </div>
                  </div>

                  <div className="p-4" data-testid="actual-render">
                    <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Actual resource render
                    </p>
                    <div
                      className="overflow-hidden rounded-lg border border-[#d8effb] bg-[#f5fbff] p-5"
                      aria-hidden="true"
                      inert
                    >
                      <ResourcePageContentView
                        content={previewCase.content}
                        linkMode="disabled"
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </AdminShell>
    </>
  );
}
