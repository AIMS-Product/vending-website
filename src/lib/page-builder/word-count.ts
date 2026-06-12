import type { PageContent } from "@/lib/page-builder/blocks";

// Canonical word-count helpers shared by the editor's thin-page advisory
// (`SeoReadinessHelpers.thinPageWarning`) and the revision history stats
// (`revision-display.revisionBlockStats`). One source of truth so "word count"
// never drifts between the editor and the revision surfaces.

// Walk a value collecting words from string leaves only. Bounded by data
// already in memory; ignores non-string scalars and structure, so it is safe
// to point at a block's `props` or any defensive `unknown` snapshot fragment.
export function countWordsInValue(value: unknown): number {
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

// Rough word count over the text leaves of every block's props in a validated
// page content tree. Ignores structure and non-string values.
export function countContentWords(content: PageContent): number {
  let total = 0;
  for (const section of content.sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) {
        total += countWordsInValue(block.props);
      }
    }
  }
  return total;
}
