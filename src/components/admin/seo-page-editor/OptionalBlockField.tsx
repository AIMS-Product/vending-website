"use client";

import type { ReactNode } from "react";
import type { PageBlock } from "@/lib/page-builder/blocks";
import {
  isBlockFieldVisible,
  optionalBlockFieldLabels,
  setBlockFieldVisibility,
  type OptionalBlockFieldKey,
} from "@/lib/page-builder/block-field-visibility";

const optionalFieldEyeTrackClass =
  "grid w-full grid-cols-[minmax(0,1fr)_28px] items-start gap-x-2";
const optionalFieldEyeCellClass = "flex justify-end self-start pt-0.5";
export const builderOptionalFieldScopeClass = "w-full max-w-3xl";

function FieldVisibilityEyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      {visible ? (
        <>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </>
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      )}
    </svg>
  );
}

function FieldVisibilityEyeToggle({
  fieldLabel,
  visible,
  onChange,
}: {
  fieldLabel: string;
  visible: boolean;
  onChange: (visible: boolean) => void;
}) {
  const actionLabel = visible
    ? `Hide ${fieldLabel.toLowerCase()}`
    : `Show ${fieldLabel.toLowerCase()}`;

  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-pressed={visible}
      title={actionLabel}
      onClick={() => onChange(!visible)}
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md transition ${
        visible
          ? "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
      }`}
    >
      <FieldVisibilityEyeIcon visible={visible} />
    </button>
  );
}

export function OptionalBlockField({
  block,
  field,
  onChange,
  label,
  compact = false,
  children,
}: {
  block: PageBlock;
  field: OptionalBlockFieldKey;
  onChange: (block: PageBlock) => void;
  label?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  const visible = isBlockFieldVisible(block, field);
  const fieldLabel = label ?? optionalBlockFieldLabels[field];
  const eyeToggle = (
    <FieldVisibilityEyeToggle
      fieldLabel={fieldLabel}
      visible={visible}
      onChange={(checked) =>
        onChange(setBlockFieldVisibility(block, field, checked))
      }
    />
  );

  if (compact) {
    return (
      <div
        className={`${optionalFieldEyeTrackClass} ${visible ? "" : "opacity-70"}`}
      >
        <div className="min-w-0">{children}</div>
        <div className={optionalFieldEyeCellClass}>{eyeToggle}</div>
      </div>
    );
  }

  return (
    <div
      className={`${optionalFieldEyeTrackClass} ${visible ? "" : "opacity-70"}`}
    >
      <div className="min-w-0 space-y-1.5">
        <span className="text-sm font-medium text-slate-700">{fieldLabel}</span>
        {children}
      </div>
      <div className={optionalFieldEyeCellClass}>{eyeToggle}</div>
    </div>
  );
}
