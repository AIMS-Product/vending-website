import {
  adminPrimaryButtonClass,
  AdminStatusBadge,
} from "@/components/admin/AdminUi";
import { createCtaPreset, createProofItem } from "./actions";
import {
  ItemList,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "./LibraryFormFields";
import { ProofItemMediaField } from "./ProofItemMediaField";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import type {
  CtaPreset,
  ProofItem,
} from "@/lib/services/page-builder-libraries";

// Drawer contents for the two independent libraries (CTA presets, Proof
// items). Fields, names, and server actions are unchanged from the previous
// always-open panels — only the surrounding chrome (drawer vs. static panel)
// changed.

export function CtaPresetDrawerContent({ items }: { items: CtaPreset[] }) {
  return (
    <div className="grid gap-6">
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
        items={items}
        empty="No CTA presets yet."
        render={(item) => (
          <>
            <strong>{item.label}</strong>
            <span>{item.href}</span>
            <span>{item.style_preset}</span>
          </>
        )}
      />
    </div>
  );
}

export function ProofItemDrawerContent({
  items,
  editorMediaAssets,
}: {
  items: ProofItem[];
  editorMediaAssets: EditorMediaAsset[];
}) {
  return (
    <div className="grid gap-6">
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
        <TextInput name="sourceRightsNotes" label="Source and rights notes" />
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
        items={items}
        empty="No proof items yet."
        render={(item) => (
          <>
            <strong>{item.name || item.kind}</strong>
            <span>{item.body}</span>
            <span>
              <AdminStatusBadge status={item.approved ? "approved" : "draft"} />
            </span>
          </>
        )}
      />
    </div>
  );
}
