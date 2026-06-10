import { formatPacificDateTime } from "@/lib/page-builder/datetime-format";

// N16 / issue I18: shared presentation for the revision history (list panel +
// detail page) so labels and timestamps are consistent in one place.

// Marketer-facing label for every revision_type the schema CHECK allows
// (autosave, manual_save, publish, rollback, ai_insert). admin-studio.md: no
// raw schema values in the UI.
export function revisionTypeLabel(type: string): string {
  if (type === "publish") return "Published";
  if (type === "manual_save") return "Manual save";
  if (type === "autosave") return "Autosave";
  if (type === "rollback") return "Restored";
  if (type === "ai_insert") return "AI edit";
  // Unknown future type: humanise without exposing underscores.
  const spaced = type.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// N21: the Pacific-anchored timestamp formatter now lives in a neutral lib
// location (`@/lib/page-builder/datetime-format`) so the editor's own save-time
// displays (top rail + mobile action bar) share the exact same source as these
// revision surfaces. Re-exported here under the original name to keep the
// revision surfaces' import sites and public API unchanged.
export const formatRevisionDateTime = formatPacificDateTime;

export type RevisionBlockStats = {
  blockCount: number;
  wordCount: number;
};

// Cheap context derived from an already-loaded content_snapshot: how many
// blocks the revision held and a rough word count of their text. No new DB
// columns, no extra query — just summarises data the revision row already
// carries. Defensive against malformed snapshots (older/foreign shapes).
export function revisionBlockStats(snapshot: unknown): RevisionBlockStats {
  const empty: RevisionBlockStats = { blockCount: 0, wordCount: 0 };
  if (!snapshot || typeof snapshot !== "object") return empty;

  const sections = (snapshot as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return empty;

  let blockCount = 0;
  let wordCount = 0;

  for (const section of sections) {
    const columns = (section as { columns?: unknown })?.columns;
    if (!Array.isArray(columns)) continue;
    for (const column of columns) {
      const blocks = (column as { blocks?: unknown })?.blocks;
      if (!Array.isArray(blocks)) continue;
      for (const block of blocks) {
        blockCount += 1;
        wordCount += countWordsInValue((block as { props?: unknown })?.props);
      }
    }
  }

  return { blockCount, wordCount };
}

// Walk a block's props collecting words from string leaves only. Bounded by the
// snapshot size already in memory; ignores non-string scalars and structure.
function countWordsInValue(value: unknown): number {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countWordsInValue(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce(
      (sum, item) => sum + countWordsInValue(item),
      0,
    );
  }
  return 0;
}
