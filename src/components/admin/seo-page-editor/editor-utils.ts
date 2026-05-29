export function makeBuilderId(prefix: "section" | "column" | "block") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function editorCanvasDividerClass(
  showDivider: boolean,
  spacing: 10 | 14,
) {
  if (!showDivider) return "";
  const spacingClass = spacing === 10 ? "mt-10 pt-10" : "mt-14 pt-14";
  return `border-t border-dashed border-slate-300 ${spacingClass}`;
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
