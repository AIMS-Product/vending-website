// Presentational + parsing helpers extracted from CaseStudyEditorForm, mirroring
// news-editor-helpers.ts. Pure functions only — importable from both the
// client editor (for live preview / pre-submit validation) and the server
// actions (for the authoritative save-time normalization), so the two never
// drift apart.

import { parseYouTubeVideoId } from "@/lib/page-builder/video-embeds";

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

const bareYoutubeIdPattern = /^[A-Za-z0-9_-]{6,}$/;

/**
 * Accepts either a bare YouTube video id or a full YouTube URL and resolves
 * it to the bare id the DB check constraint expects. Returns `null` for a
 * blank input and `undefined` when the input is non-blank but unresolvable
 * (a validation error, not a silently-dropped value).
 */
export function resolveYoutubeVideoId(raw: string): string | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (bareYoutubeIdPattern.test(trimmed)) return trimmed;
  return parseYouTubeVideoId(trimmed) ?? undefined;
}

/** Comma-separated input -> trimmed, deduped, empty-dropped string[]. */
export function parseCommaList(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function joinCommaList(values: readonly string[]): string {
  return values.join(", ");
}

/** Optional-integer form field: "" -> null, otherwise a whole number or `undefined` (invalid). */
export function parseOptionalInt(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^-?\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}
