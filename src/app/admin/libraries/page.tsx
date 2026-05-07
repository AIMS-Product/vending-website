import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  createApprovedClaim,
  createCtaPreset,
  createProofItem,
  createSourceDocument,
  createSourceExcerpt,
} from "./actions";
import { adminListPageBuilderLibraries } from "@/lib/services/page-builder-libraries";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Reusable content libraries",
  robots: { index: false, follow: false },
};

const cardClass = "rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200";
const labelClass = "text-sm font-medium text-slate-700";
const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const buttonClass =
  "rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600";

export default async function AdminLibrariesPage() {
  await requireAdmin();
  const libraries = await adminListPageBuilderLibraries();
  const approvedExcerpts = libraries.sourceExcerpts.filter(
    (excerpt) => excerpt.approved,
  );

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-12 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-500 text-sm font-medium">SEO Page Builder</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Reusable content libraries
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/media"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Media
          </Link>
          <Link
            href="/admin/pages"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Resource pages
          </Link>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <LibraryPanel title="CTA presets">
          <form action={createCtaPreset} className="grid gap-4">
            <TextInput name="label" label="Label" />
            <TextInput name="href" label="Href" placeholder="/apply" />
            <SelectInput
              name="stylePreset"
              label="Style"
              options={["primary", "secondary", "text"]}
            />
            <TextInput name="trackingName" label="Tracking name" />
            <button className={buttonClass}>Save CTA preset</button>
          </form>
          <ItemList
            items={libraries.ctaPresets}
            empty="No CTA presets yet."
            render={(item) => (
              <>
                <strong>{item.label}</strong>
                <span>{item.href}</span>
                <span>{item.style_preset}</span>
              </>
            )}
          />
        </LibraryPanel>

        <LibraryPanel title="Proof items">
          <form action={createProofItem} className="grid gap-4">
            <SelectInput
              name="kind"
              label="Kind"
              options={["testimonial", "stat", "case_study", "quote"]}
            />
            <TextAreaInput name="body" label="Proof body" rows={3} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput name="name" label="Name" />
              <TextInput name="roleOrContext" label="Role or context" />
            </div>
            <TextInput
              name="sourceRightsNotes"
              label="Source and rights notes"
            />
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input name="approved" type="checkbox" />
              Approved for publishing
            </label>
            <button className={buttonClass}>Save proof item</button>
          </form>
          <ItemList
            items={libraries.proofItems}
            empty="No proof items yet."
            render={(item) => (
              <>
                <strong>{item.name || item.kind}</strong>
                <span>{item.body}</span>
                <span>{item.approved ? "Approved" : "Draft"}</span>
              </>
            )}
          />
        </LibraryPanel>

        <LibraryPanel title="Source documents">
          <form action={createSourceDocument} className="grid gap-4">
            <TextInput name="title" label="Title" />
            <SelectInput
              name="sourceType"
              label="Source type"
              options={[
                "paste",
                "file",
                "url_reference",
                "existing_site_content",
              ]}
            />
            <TextAreaInput name="body" label="Body" rows={5} />
            <TextInput name="tags" label="Tags" placeholder="seo, vending" />
            <button className={buttonClass}>Save source document</button>
          </form>
          <ItemList
            items={libraries.sourceDocuments}
            empty="No source documents yet."
            render={(item) => (
              <>
                <strong>{item.title}</strong>
                <span>{item.source_type}</span>
                <span>{item.tags.join(", ") || "No tags"}</span>
              </>
            )}
          />
        </LibraryPanel>

        <LibraryPanel title="Source excerpts">
          <form action={createSourceExcerpt} className="grid gap-4">
            <label>
              <span className={labelClass}>Source document</span>
              <select name="sourceDocumentId" className={inputClass}>
                <option value="">Choose a source document</option>
                {libraries.sourceDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.title}
                  </option>
                ))}
              </select>
            </label>
            <TextAreaInput name="excerpt" label="Excerpt" rows={4} />
            <TextInput
              name="topicTags"
              label="Topic tags"
              placeholder="locations, operators"
            />
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input name="approved" type="checkbox" />
              Approved source excerpt
            </label>
            <button className={buttonClass}>Save source excerpt</button>
          </form>
          <ItemList
            items={libraries.sourceExcerpts}
            empty="No source excerpts yet."
            render={(item) => (
              <>
                <strong>{item.approved ? "Approved" : "Draft"}</strong>
                <span>{item.excerpt}</span>
                <span>{item.topic_tags.join(", ") || "No tags"}</span>
              </>
            )}
          />
        </LibraryPanel>

        <LibraryPanel title="Approved claims">
          <form action={createApprovedClaim} className="grid gap-4">
            <label>
              <span className={labelClass}>Approved excerpt</span>
              <select name="sourceExcerptId" className={inputClass}>
                <option value="">Choose an approved excerpt</option>
                {approvedExcerpts.map((excerpt) => (
                  <option key={excerpt.id} value={excerpt.id}>
                    {excerpt.excerpt.slice(0, 90)}
                  </option>
                ))}
              </select>
            </label>
            <TextAreaInput name="claim" label="Claim" rows={3} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput name="claimType" label="Claim type" />
              <SelectInput
                name="riskLevel"
                label="Risk"
                options={["low", "medium", "high"]}
              />
            </div>
            <TextAreaInput name="usageNotes" label="Usage notes" rows={3} />
            <button className={buttonClass}>Save approved claim</button>
          </form>
          <ItemList
            items={libraries.approvedClaims}
            empty="No approved claims yet."
            render={(item) => (
              <>
                <strong>{item.claim_type}</strong>
                <span>{item.claim}</span>
                <span>{item.risk_level} risk</span>
              </>
            )}
          />
        </LibraryPanel>
      </div>
    </section>
  );
}

function LibraryPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={cardClass}>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 grid gap-5">{children}</div>
    </section>
  );
}

function TextInput({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input name={name} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function TextAreaInput({
  name,
  label,
  rows,
}: {
  name: string;
  label: string;
  rows: number;
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <textarea name={name} rows={rows} className={inputClass} />
    </label>
  );
}

function SelectInput({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <select name={name} className={inputClass}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ItemList<T extends { id: string | number }>({
  items,
  empty,
  render,
}: {
  items: T[];
  empty: string;
  render: (item: T) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }

  return (
    <div className="grid gap-3">
      {items.slice(0, 8).map((item) => (
        <article
          key={item.id}
          className="grid gap-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200"
        >
          {render(item)}
        </article>
      ))}
    </div>
  );
}
