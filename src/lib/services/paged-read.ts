import "server-only";

export type PageError = { message: string; code?: string };

type PageResult<Row> = {
  data: Row[] | null;
  count?: number | null;
  error: PageError | null;
};

/** PostgREST's own default page. */
const DEFAULT_PAGE_SIZE = 1000;
/** Range requests in flight at once. Enough to finish a 30k table in 3 waves. */
const WIDTH = 12;

/**
 * Every row of a paged PostgREST read, in a couple of round trips instead of
 * one per page. The first page asks for the exact count, and the remaining
 * ranges are then issued concurrently.
 *
 * Partial rows come back alongside the error rather than throwing, because
 * every caller here has its own failure policy: a short read silently shortens
 * a denominator, which reads as a collapse rather than as an outage.
 *
 * Pass the `count` argument straight through to `select`'s options — it is
 * `"exact"` only on the probe, so the later pages do not each recount.
 */
export async function readAllPages<Row>(
  query: (
    from: number,
    to: number,
    count: "exact" | undefined,
  ) => PromiseLike<PageResult<Row>>,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<{ rows: Row[]; error: PageError | null }> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxRows = options.maxRows ?? 200_000;

  const probe = await query(0, pageSize - 1, "exact");
  if (probe.error) return { rows: [], error: probe.error };
  const rows: Row[] = [...(probe.data ?? [])];
  if (rows.length < pageSize) return { rows, error: null };

  // A client that reports no count still finishes, by paging concurrently up to
  // the cap and stopping at the first short page.
  const total = Math.min(probe.count ?? maxRows, maxRows);
  const starts: number[] = [];
  for (let from = pageSize; from < total; from += pageSize) starts.push(from);

  for (let index = 0; index < starts.length; index += WIDTH) {
    const wave = await Promise.all(
      starts
        .slice(index, index + WIDTH)
        .map((from) => query(from, from + pageSize - 1, undefined)),
    );
    let reachedEnd = false;
    for (const page of wave) {
      if (page.error) return { rows, error: page.error };
      const batch = page.data ?? [];
      rows.push(...batch);
      if (batch.length < pageSize) reachedEnd = true;
    }
    if (reachedEnd) break;
  }
  return { rows, error: null };
}
