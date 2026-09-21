/**
 * Splitting a list of ids into request-sized batches.
 *
 * PostgREST puts an `in` list in the query string, so one request carrying
 * every id in a 90-day window builds a URL long enough that it never comes
 * back. Every caller that filters by a set of ids of unbounded size has to
 * page, so the size and the split live in one place rather than being
 * rediscovered — the live Video tab hung on exactly this.
 */

/**
 * How many ids go in one `in` list. Well inside every proxy's URL ceiling at a
 * UUID apiece, and small enough that one slow batch cannot stall a page.
 */
export const ID_BATCH = 200;

export function chunk<T>(items: T[], size: number = ID_BATCH): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
