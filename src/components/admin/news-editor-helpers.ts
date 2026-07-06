// Presentational helpers extracted from NewsEditorForm to keep the component
// under the 300-line limit after the I5 autosave / I12 confirm wiring.

export function tabClass(active: boolean): string {
  return `px-4 py-3 text-sm font-medium transition ${
    active
      ? "bg-white text-[#0b63f6]"
      : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
  }`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
