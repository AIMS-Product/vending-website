import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminIcon,
  AdminMetricPanel,
  AdminMetricStrip,
  AdminStatusBadge,
  adminCardClass,
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import {
  createApprovedClaim,
  createCtaPreset,
  createProofItem,
  createSourceDocument,
  createSourceExcerpt,
} from "./actions";
import { ProofItemMediaField } from "./ProofItemMediaField";
import { toEditorMediaAsset } from "@/lib/media/editor-asset";
import { adminListMediaAssets } from "@/lib/services/media-assets";
import { adminListPageBuilderLibraries } from "@/lib/services/page-builder-libraries";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Reusable content libraries",
  robots: { index: false, follow: false },
};

export default async function AdminLibrariesPage() {
  const { user, role } = await requireAdmin();
  const [libraries, mediaAssets] = await Promise.all([
    adminListPageBuilderLibraries(),
    adminListMediaAssets({ assetTypes: ["image"] }),
  ]);
  const approvedExcerpts = libraries.sourceExcerpts.filter(
    (excerpt) => excerpt.approved,
  );
  const editorMediaAssets = mediaAssets.map(toEditorMediaAsset);

  return (
    <AdminShell
      activeSection="libraries"
      eyebrow="CMS Governance"
      title="Reusable content libraries"
      description="Manage approved claims, source excerpts, proof points, and CTAs before they are reused across page types."
      userEmail={user.email}
      userRole={role}
      actions={
        <>
          <Link href="/admin/media" className={adminSecondaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="image" />
            </span>
            Media library
          </Link>
          <Link href="/admin/pages/new" className={adminPrimaryButtonClass}>
            <span aria-hidden="true">
              <AdminIcon icon="plus" />
            </span>
            New resource page
          </Link>
        </>
      }
    >
      <AdminMetricStrip>
        <AdminMetricPanel
          icon="layers"
          tone="blue"
          label="CTA presets"
          value={libraries.ctaPresets.length}
          caption="reusable actions"
        />
        <AdminMetricPanel
          icon="check"
          tone="green"
          label="Proof"
          value={libraries.proofItems.filter((item) => item.approved).length}
          caption="approved items"
        />
        <AdminMetricPanel
          icon="file"
          tone="slate"
          label="Sources"
          value={libraries.sourceDocuments.length}
          caption="documents"
        />
        <AdminMetricPanel
          icon="pencil"
          tone="amber"
          label="Claims"
          value={libraries.approvedClaims.length}
          caption="governed copy"
        />
      </AdminMetricStrip>

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
            <button type="submit" className={adminPrimaryButtonClass}>
              Save CTA preset
            </button>
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
            <ProofItemMediaField assets={editorMediaAssets} />
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                name="approved"
                type="checkbox"
                aria-label="Approved for publishing"
              />
              Approved for publishing
            </label>
            <button type="submit" className={adminPrimaryButtonClass}>
              Save proof item
            </button>
          </form>
          <ItemList
            items={libraries.proofItems}
            empty="No proof items yet."
            render={(item) => (
              <>
                <strong>{item.name || item.kind}</strong>
                <span>{item.body}</span>
                <span>
                  <AdminStatusBadge
                    status={item.approved ? "approved" : "draft"}
                  />
                </span>
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
            <button type="submit" className={adminPrimaryButtonClass}>
              Save source document
            </button>
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
              <span className={adminLabelClass}>Source document</span>
              <select
                name="sourceDocumentId"
                aria-label="Source document"
                className={adminInputClass}
              >
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
              <input
                name="approved"
                type="checkbox"
                aria-label="Approved source excerpt"
              />
              Approved source excerpt
            </label>
            <button type="submit" className={adminPrimaryButtonClass}>
              Save source excerpt
            </button>
          </form>
          <ItemList
            items={libraries.sourceExcerpts}
            empty="No source excerpts yet."
            render={(item) => (
              <>
                <strong>
                  <AdminStatusBadge
                    status={item.approved ? "approved" : "draft"}
                  />
                </strong>
                <span>{item.excerpt}</span>
                <span>{item.topic_tags.join(", ") || "No tags"}</span>
              </>
            )}
          />
        </LibraryPanel>

        <LibraryPanel title="Approved claims">
          <form action={createApprovedClaim} className="grid gap-4">
            <label>
              <span className={adminLabelClass}>Approved excerpt</span>
              <select
                name="sourceExcerptId"
                aria-label="Approved excerpt"
                className={adminInputClass}
              >
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
            <button type="submit" className={adminPrimaryButtonClass}>
              Save approved claim
            </button>
          </form>
          <ItemList
            items={libraries.approvedClaims}
            empty="No approved claims yet."
            render={(item) => (
              <>
                <strong>{item.claim_type}</strong>
                <span>{item.claim}</span>
                <span>
                  <AdminStatusBadge status={item.risk_level} />
                </span>
              </>
            )}
          />
        </LibraryPanel>
      </div>
    </AdminShell>
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
    <section className={adminCardClass}>
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
      <span className={adminLabelClass}>{label}</span>
      <input
        name={name}
        aria-label={label}
        placeholder={placeholder}
        className={adminInputClass}
      />
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
      <span className={adminLabelClass}>{label}</span>
      <textarea
        name={name}
        aria-label={label}
        rows={rows}
        className={adminTextareaClass}
      />
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
      <span className={adminLabelClass}>{label}</span>
      <select name={name} aria-label={label} className={adminInputClass}>
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
          className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600"
        >
          {render(item)}
        </article>
      ))}
    </div>
  );
}
