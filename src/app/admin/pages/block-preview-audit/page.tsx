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
        <section
          className="grid max-w-full min-w-0 gap-5 overflow-x-hidden"
          data-testid="block-preview-audit"
        >
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
                className="border-ui-line min-w-0 overflow-hidden rounded-lg border bg-white shadow-sm"
              >
                <header className="border-ui-line bg-ui-canvas flex min-w-0 flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-ui-text-subtle text-xs font-semibold tracking-wide uppercase">
                      {previewCase.blockLabel}
                    </p>
                    <h2 className="text-ui-text text-base font-semibold">
                      {previewCase.variantLabel}
                    </h2>
                  </div>
                  <p className="text-ui-text-subtle max-w-xl min-w-0 text-sm">
                    {previewCase.description}
                  </p>
                </header>

                <div className="grid max-w-full min-w-0 gap-0 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div
                    className="border-ui-line min-w-0 border-b p-4 xl:border-r xl:border-b-0"
                    data-testid="picker-preview"
                  >
                    <p className="text-ui-text-subtle mb-3 text-xs font-semibold tracking-wide uppercase">
                      Picker preview
                    </p>
                    <div
                      className="border-ui-line h-48 max-w-full overflow-hidden rounded-lg border bg-white p-4"
                      aria-hidden="true"
                      inert
                    >
                      <BlockVariantPreviewSkeleton
                        type={previewCase.type}
                        variant={previewCase.variant}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 p-4" data-testid="actual-render">
                    <p className="text-ui-text-subtle mb-3 text-xs font-semibold tracking-wide uppercase">
                      Actual resource render
                    </p>
                    <div
                      className="max-w-full overflow-hidden rounded-lg border border-[#d8effb] bg-[#f5fbff] p-5"
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
