import {
  adminInputClass,
  adminLabelClass,
  adminPrimaryButtonClass,
  AdminStatusBadge,
} from "@/components/admin/AdminUi";
import {
  createApprovedClaim,
  createSourceDocument,
  createSourceExcerpt,
} from "./actions";
import {
  ItemList,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "./LibraryFormFields";
import type {
  ApprovedClaim,
  SourceDocument,
  SourceExcerpt,
} from "@/lib/services/page-builder-libraries";

// Drawer contents for the dependent library chain: source documents ->
// source excerpts -> approved claims. Fields, names, and server actions are
// unchanged from the previous always-open panels.

export function SourceDocumentDrawerContent({
  items,
}: {
  items: SourceDocument[];
}) {
  return (
    <div className="grid gap-6">
      <form action={createSourceDocument} className="grid gap-4">
        <TextInput name="title" label="Title" />
        <SelectInput
          name="sourceType"
          label="Source type"
          options={["paste", "file", "url_reference", "existing_site_content"]}
        />
        <TextAreaInput name="body" label="Body" rows={5} />
        <TextInput name="tags" label="Tags" placeholder="seo, vending" />
        <button type="submit" className={adminPrimaryButtonClass}>
          Save source document
        </button>
      </form>
      <ItemList
        items={items}
        empty="No source documents yet."
        render={(item) => (
          <>
            <strong>{item.title}</strong>
            <span>{item.source_type}</span>
            <span>{item.tags.join(", ") || "No tags"}</span>
          </>
        )}
      />
    </div>
  );
}

export function SourceExcerptDrawerContent({
  items,
  sourceDocuments,
}: {
  items: SourceExcerpt[];
  sourceDocuments: SourceDocument[];
}) {
  return (
    <div className="grid gap-6">
      <form action={createSourceExcerpt} className="grid gap-4">
        <label>
          <span className={adminLabelClass}>Source document</span>
          <select
            name="sourceDocumentId"
            aria-label="Source document"
            className={adminInputClass}
          >
            <option value="">Choose a source document</option>
            {sourceDocuments.map((document) => (
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
        items={items}
        empty="No source excerpts yet."
        render={(item) => (
          <>
            <strong>
              <AdminStatusBadge status={item.approved ? "approved" : "draft"} />
            </strong>
            <span>{item.excerpt}</span>
            <span>{item.topic_tags.join(", ") || "No tags"}</span>
          </>
        )}
      />
    </div>
  );
}

export function ApprovedClaimDrawerContent({
  items,
  approvedExcerpts,
}: {
  items: ApprovedClaim[];
  approvedExcerpts: SourceExcerpt[];
}) {
  return (
    <div className="grid gap-6">
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
        items={items}
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
    </div>
  );
}
