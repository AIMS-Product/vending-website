import {
  compactInputClass,
  textareaClass,
} from "@/components/admin/seo-page-editor/editor-styles";

export function EditorCharLimit({
  value,
  max,
}: {
  value: string;
  max: number;
}) {
  const count = value.length;
  const warnAt = Math.floor(max * 0.8);

  const toneClass =
    count >= max
      ? "font-semibold text-red-600"
      : count >= warnAt
        ? "font-medium text-amber-600"
        : "font-medium text-emerald-600";

  return (
    <p
      aria-live="polite"
      className={`mt-1 text-right text-xs tabular-nums ${toneClass}`}
    >
      {count}/{max}
    </p>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hideLabel?: boolean;
}) {
  return (
    <label className="block">
      {hideLabel ? null : (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder ?? label}
        onChange={(event) => onChange(event.target.value)}
        className={compactInputClass}
      />
    </label>
  );
}

export function TextAreaInput({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  hideLabel?: boolean;
}) {
  return (
    <label className="block">
      {hideLabel ? null : (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <textarea
        aria-label={label}
        value={value}
        placeholder={placeholder ?? label}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className={textareaClass}
      />
      {maxLength !== undefined ? (
        <EditorCharLimit value={value} max={maxLength} />
      ) : null}
    </label>
  );
}
