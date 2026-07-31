"use client";

import { createContext, useContext, type ReactNode } from "react";
import { TextInput } from "@/components/admin/seo-page-editor/EditorInputs";
import { compactInputClass } from "@/components/admin/seo-page-editor/editor-styles";

export type QualificationFormOption = { id: string; name: string };

// Context rather than props because the qualification pickers live at two very
// different depths (page chrome controls, and the lead_form block settings
// panel rendered inside both the sidebar and the settings modal). Same reason
// MediaPickerProvider exists. Default [] so any consumer rendered outside the
// provider — including unit tests — degrades to a plain ID field.
const QualificationFormOptionsContext = createContext<
  QualificationFormOption[]
>([]);

export function QualificationFormOptionsProvider({
  options,
  children,
}: {
  options: QualificationFormOption[];
  children: ReactNode;
}) {
  return (
    <QualificationFormOptionsContext.Provider value={options}>
      {children}
    </QualificationFormOptionsContext.Provider>
  );
}

export function useQualificationFormOptions() {
  return useContext(QualificationFormOptionsContext);
}

export function QualificationFormPicker({
  label,
  emptyLabel,
  value,
  onChange,
}: {
  label: string;
  emptyLabel: string;
  value: string;
  onChange: (formId: string) => void;
}) {
  const options = useQualificationFormOptions();

  // No published forms loaded (provider absent, or none published yet): keep
  // the original free-text ID field rather than showing an empty dropdown that
  // would silently drop an already-configured form.
  if (options.length === 0) {
    return (
      <TextInput
        label={label}
        placeholder="Published form ID"
        value={value}
        onChange={onChange}
      />
    );
  }

  // An ID set before the form was archived/unpublished is still live on the
  // page, so keep it selectable instead of resetting it on first render.
  const hasValue = value.length > 0;
  const isKnown = options.some((option) => option.id === value);

  return (
    <label className="block">
      <span className="text-ui-text-muted text-sm font-medium">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={compactInputClass}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
        {hasValue && !isKnown ? (
          <option value={value}>{`Unpublished form (${value})`}</option>
        ) : null}
      </select>
    </label>
  );
}
