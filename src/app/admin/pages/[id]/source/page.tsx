import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminPanelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import { buildResourcePageStructuredDataGraphs } from "@/components/sections/resource-page-structured-data";
import { AdminShell } from "@/components/admin/AdminShell";
import { pageContentSchema, type PageContent } from "@/lib/page-builder/blocks";
import { pagePathForSlug } from "@/lib/page-builder/page-paths";
import { renderReadableResourceHtml } from "@/lib/page-builder/readable-source";
import { adminGetSeoPageById } from "@/lib/services/seo-pages";
import type { PublishedSeoPage } from "@/lib/services/seo-page-public";
import { requireAdmin } from "@/lib/supabase/auth";
import { absoluteUrl } from "@/lib/site";

type Params = { id: string };
type AdminSeoPage = NonNullable<
  Awaited<ReturnType<typeof adminGetSeoPageById>>
>;
type SourceBlockTone = "default" | "warning";

type ReadableSourceBlockConfig = {
  code: string;
  description: string;
  title: string;
  tone?: SourceBlockTone;
};

type ReadableSourcePageData = {
  contentError: ReadableSourceBlockConfig | null;
  page: AdminSeoPage;
  publishedContent: PageContent | null;
  publicPath: string;
  sourceBlocks: ReadableSourceBlockConfig[];
};

export const metadata: Metadata = {
  title: "Readable page source",
  robots: { index: false, follow: false },
};

export default async function SeoPageSourcePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const [{ user, role }, { id }] = await Promise.all([requireAdmin(), params]);
  const { contentError, page, publicPath, sourceBlocks } =
    await loadReadableSourcePageData(id);

  return (
    <AdminShell
      activeSection="pages"
      eyebrow="SEO Page Builder"
      title="Readable page source"
      description="Review the published route, metadata, structured data, content JSON, and a readable HTML fragment for manual troubleshooting."
      userEmail={user.email}
      userRole={role}
    >
      <div className="grid gap-5">
        <section className={`${adminPanelClass} p-5`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {page.title}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {publicPath}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                This view is for admin review only. It keeps the live public
                page unchanged while exposing the source in readable blocks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/pages/${page.id}`}
                className={adminSecondaryButtonClass}
              >
                Back to editor
              </Link>
              {page.status === "published" ? (
                <a
                  href={publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className={adminSecondaryButtonClass}
                >
                  Open public page
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {contentError ? <ReadableSourceBlock {...contentError} /> : null}
        {sourceBlocks.map((block) => (
          <ReadableSourceBlock key={block.title} {...block} />
        ))}
      </div>
    </AdminShell>
  );
}

async function loadReadableSourcePageData(
  id: string,
): Promise<ReadableSourcePageData> {
  const page = await adminGetSeoPageById(id);
  if (!page) notFound();

  const parsedContent = page.published_content
    ? pageContentSchema.safeParse(page.published_content)
    : null;
  const publishedContent = parsedContent?.success ? parsedContent.data : null;
  const publicPath =
    page.route_path || pagePathForSlug(page.slug, page.route_prefix);
  const structuredData = publishedContent
    ? buildResourcePageStructuredDataGraphs(
        publishedPageFromAdminPage(page, publishedContent, publicPath),
      )
    : [];

  return {
    contentError: contentValidationBlock(parsedContent),
    page,
    publishedContent,
    publicPath,
    sourceBlocks: readableSourceBlocks({
      page,
      publishedContent,
      publicPath,
      structuredData,
    }),
  };
}

function contentValidationBlock(
  parsedContent: ReturnType<typeof pageContentSchema.safeParse> | null,
): ReadableSourceBlockConfig | null {
  if (!parsedContent || parsedContent.success) return null;

  return {
    title: "Published content validation",
    description:
      "The stored published content did not match the page-builder schema.",
    code: JSON.stringify(
      parsedContent.error.issues.map(({ code, message, path }) => ({
        code,
        path: path.join("."),
        message,
      })),
      null,
      2,
    ),
    tone: "warning",
  };
}

function readableSourceBlocks({
  page,
  publishedContent,
  publicPath,
  structuredData,
}: {
  page: AdminSeoPage;
  publishedContent: PageContent | null;
  publicPath: string;
  structuredData: ReturnType<typeof buildResourcePageStructuredDataGraphs>;
}): ReadableSourceBlockConfig[] {
  return [
    {
      title: "Page summary JSON",
      description:
        "Core public route and metadata values used by the published page.",
      code: JSON.stringify(pageSummary(page, publicPath), null, 2),
    },
    {
      title: "Structured data JSON-LD",
      description:
        "The JSON-LD graph that the public renderer emits for search engines.",
      code: structuredData.length
        ? JSON.stringify(structuredData, null, 2)
        : "No structured data is enabled for the published content.",
    },
    {
      title: "Published content JSON",
      description:
        "The normalized page-builder content snapshot currently serving the public page.",
      code: publishedContent
        ? JSON.stringify(publishedContent, null, 2)
        : "No published content is available for this page.",
    },
    {
      title: "Rendered HTML fragment",
      description:
        "A readable static fragment of the resource-page body. Lead-form blocks use the builder preview placeholder in this admin view.",
      code: publishedContent
        ? renderReadableResourceHtml(publishedContent)
        : "No published content is available for this page.",
    },
  ];
}

function pageSummary(page: AdminSeoPage, publicPath: string) {
  return {
    status: page.status,
    title: page.title,
    routePath: publicPath,
    publicUrl: absoluteUrl(publicPath),
    seoTitle: page.seo_title,
    metaDescription: page.meta_description,
    canonicalUrl: page.canonical_url,
    noindex: page.noindex,
    sitemapEnabled: page.sitemap_enabled,
    publishedAt: page.published_at,
    updatedAt: page.updated_at,
  };
}

function ReadableSourceBlock({
  code,
  description,
  title,
  tone = "default",
}: ReadableSourceBlockConfig) {
  return (
    <section
      className={`${adminPanelClass} ${
        tone === "warning" ? "border-amber-200 bg-amber-50/40" : "bg-white"
      }`}
    >
      <header className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </header>
      <pre className="max-h-[34rem] overflow-auto bg-slate-950 p-5 font-mono text-xs leading-6 break-words whitespace-pre-wrap text-slate-100">
        {code}
      </pre>
    </section>
  );
}

function publishedPageFromAdminPage(
  page: AdminSeoPage,
  publishedContent: PageContent,
  routePath: string,
): PublishedSeoPage {
  return {
    id: page.id,
    slug: page.slug,
    route_prefix: page.route_prefix || "/resources",
    route_path: routePath,
    title: page.title,
    target_keyword: page.target_keyword,
    published_content: publishedContent,
    seo_title: page.seo_title,
    meta_description: page.meta_description,
    canonical_url: page.canonical_url,
    noindex: page.noindex,
    sitemap_enabled: page.sitemap_enabled,
    structured_data_settings: page.structured_data_settings,
    published_at: page.published_at,
    updated_at: page.updated_at,
  };
}
