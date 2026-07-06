import type { ReactNode } from "react";
import {
  adminInputClass,
  adminLabelClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";

// Shared field + list primitives used inside each library drawer's add form
// and item list. Extracted unchanged (same name attributes, same markup)
// from the previous always-open page layout.

export function TextInput({
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

export function TextAreaInput({
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

export function SelectInput({
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

export function ItemList<T extends { id: string | number }>({
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
