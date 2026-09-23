import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** The paged reader the audit's checks share. */

export type AuditClient = Pick<SupabaseClient<Database>, "from">;

export type TableName = keyof Database["public"]["Tables"];

export type PostgrestQuery = {
  gte(column: string, value: string): PostgrestQuery;
  gt(column: string, value: string): PostgrestQuery;
  lte(column: string, value: string): PostgrestQuery;
  lt(column: string, value: string): PostgrestQuery;
  eq(column: string, value: string): PostgrestQuery;
  is(column: string, value: null): PostgrestQuery;
  not(column: string, operator: string, value: null): PostgrestQuery;
  in(column: string, values: readonly string[]): PostgrestQuery;
  order(column: string, options?: { ascending: boolean }): PostgrestQuery;
  range(from: number, to: number): PostgrestQuery;
};

const PAGE = 1000;

/**
 * Reads every matching row, a page at a time. `orderBy` should be the table's
 * primary key: paging on a column with repeats can skip or repeat rows at a
 * page boundary.
 */
export async function pageAll<T>(
  client: AuditClient,
  table: TableName,
  columns: string,
  apply: (query: PostgrestQuery) => PostgrestQuery,
  orderBy: string | readonly string[] = "day",
): Promise<T[]> {
  const order = typeof orderBy === "string" ? [orderBy] : orderBy;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const ordered = order.reduce(
      (query, column) => query.order(column),
      apply(client.from(table).select(columns) as unknown as PostgrestQuery),
    );
    const query = ordered.range(from, from + PAGE - 1);
    const { data, error } = (await (query as unknown as Promise<unknown>)) as {
      data: T[] | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    // PostgREST caps a read silently; stop only on a short page.
    if (batch.length < PAGE) break;
  }
  return rows;
}
