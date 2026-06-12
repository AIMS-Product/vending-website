// Slug derivation for page duplication (issue I13): a duplicate becomes
// `{source-slug}-copy`, then `-copy-2`, `-copy-3`, … on collision — instead of
// the old `draft-{hash}` style. Pure and DB-agnostic: the caller supplies an
// `isTaken` predicate (checked against the real uniqueness scope) so this can
// be unit-tested without Supabase.

// slugSchema caps slugs at 120 chars; keep the derived slug within that so the
// downstream normalizeSlug/route_path checks never reject a duplicate.
const MAX_SLUG_LENGTH = 120;

// Beyond this many sequential candidates we stop guessing and fall back to a
// timestamp suffix — a sane cap so a pathological run of collisions can't loop
// unbounded. In practice -copy through -copy-50 is never reached.
const MAX_SEQUENTIAL_ATTEMPTS = 50;

// Strip a trailing "-copy" or "-copy-<n>" so duplicating a duplicate yields
// "<base>-copy-2", never "<base>-copy-copy".
export function copyBaseSlug(slug: string): string {
  return slug.replace(/-copy(?:-\d+)?$/, "");
}

// Build "<base>-copy" (n=1) or "<base>-copy-<n>" (n>=2), truncating the base so
// the whole slug fits in MAX_SLUG_LENGTH and never ends on a stray hyphen.
function buildCandidate(base: string, n: number): string {
  const suffix = n <= 1 ? "-copy" : `-copy-${n}`;
  const room = MAX_SLUG_LENGTH - suffix.length;
  const trimmedBase = base.slice(0, Math.max(room, 0)).replace(/-+$/, "");
  return `${trimmedBase}${suffix}`;
}

export async function deriveCopySlug(
  sourceSlug: string,
  isTaken: (slug: string) => Promise<boolean>,
  options: { now?: () => number } = {},
): Promise<string> {
  const base = copyBaseSlug(sourceSlug) || sourceSlug;

  for (let n = 1; n <= MAX_SEQUENTIAL_ATTEMPTS; n++) {
    const candidate = buildCandidate(base, n);
    if (!(await isTaken(candidate))) return candidate;
  }

  // Fallback: a timestamp suffix is effectively collision-free. Still re-check
  // once so we never knowingly return a taken slug.
  const now = options.now ?? (() => Date.now());
  const suffix = `-copy-${now()}`;
  const room = MAX_SLUG_LENGTH - suffix.length;
  const trimmedBase = base.slice(0, Math.max(room, 0)).replace(/-+$/, "");
  const fallback = `${trimmedBase}${suffix}`;
  if (!(await isTaken(fallback))) return fallback;
  throw new Error("Could not derive a unique duplicate slug.");
}
