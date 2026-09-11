import "server-only";

/**
 * Reading a table past PostgREST's response cap.
 *
 * Hosted Supabase sets `max_rows` to 1,000 (`supabase/config.toml` matches it
 * locally). Every response is truncated there, a larger `.limit()` is ignored,
 * and nothing in the payload says so — no error, no flag, no short-read signal.
 * A query that asks for 50,000 rows and gets 1,000 looks exactly like a table
 * that only holds 1,000.
 *
 * That has now shipped twice. The YouTube funnel read 585 visits against a real
 * 1,339, and the analytics Overview reported 861 bookings against a real 1,746
 * — the oldest 1,000 of 2,004 rows, so every booking from the most recent
 * eighteen days was missing from the page.
 *
 * Any read that can exceed 1,000 rows has to page. Mocked tests cannot catch a
 * missing page unless the mock models the cap, so the fakes here do.
 */

/** PostgREST's `max_rows`. Pages are sized to it exactly. */
export const PAGE_ROWS = 1_000;

/** Pages fetched at once. Modest: these run on an admin page render. */
const PAGE_CONCURRENCY = 6;

export type PagedReadResult<T> = {
  rows: T[];
  /**
   * True when the read stopped at `limit` with more rows still behind it.
   *
   * The caller decides what to do about it. Reporting a truncated total as if
   * it were complete is the failure this whole module exists to prevent, so
   * this is never silently dropped.
   */
  capped: boolean;
};

/**
 * Every row a query matches, one page at a time.
 *
 * `page` is handed an inclusive `[from, to]` and must apply it with `.range()`
 * plus a **stable, total ordering** — otherwise two pages can overlap or skip.
 * Returns null from the error path to let the caller degrade.
 */
export async function readAllRows<T>(
  limit: number,
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  onError?: (error: unknown) => void,
): Promise<PagedReadResult<T> | null> {
  const rows: T[] = [];
  let reachedEnd = false;

  while (!reachedEnd && rows.length < limit) {
    const starts = Array.from(
      { length: PAGE_CONCURRENCY },
      (_, index) => rows.length + index * PAGE_ROWS,
    ).filter((from) => from < limit);

    const pages = await Promise.all(
      starts.map((from) => page(from, from + PAGE_ROWS - 1)),
    );

    // In page order, so rows land in the order the query asked for.
    for (const { data, error } of pages) {
      if (error) {
        onError?.(error);
        return null;
      }
      const batch = (data ?? []) as T[];
      rows.push(...batch);
      // A short page is the end of the table. Anything this batch read past
      // that point is empty by definition, so it is dropped rather than
      // appended.
      if (batch.length < PAGE_ROWS) {
        reachedEnd = true;
        break;
      }
    }
  }

  return { rows: rows.slice(0, limit), capped: !reachedEnd };
}
