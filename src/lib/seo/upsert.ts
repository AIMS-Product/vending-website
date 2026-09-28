import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database";
import { isMissingTable } from "@/lib/seo/db";

type Tables = Database["public"]["Tables"];
type SeoWriteClient = Pick<SupabaseClient<Database>, "from">;

export type ChunkedUpsertResult = {
  written: number;
  failed: number;
  /** The table does not exist yet (migration not pasted). */
  missing: boolean;
};

const CHUNK = 500;

/** Upserts in chunks; a failed chunk is logged and counted, not thrown. */
export async function upsertInChunks<Name extends keyof Tables & string>(
  client: SeoWriteClient,
  table: Name,
  rows: TablesInsert<Name>[],
  onConflict: string,
): Promise<ChunkedUpsertResult> {
  const result: ChunkedUpsertResult = { written: 0, failed: 0, missing: false };
  for (let index = 0; index < rows.length; index += CHUNK) {
    const chunk = rows.slice(index, index + CHUNK);
    const { error } = await client
      .from(table)
      // Supabase's generic upsert types do not narrow on a generic table name.
      .upsert(chunk as never, { onConflict });
    if (isMissingTable(error)) return { ...result, missing: true };
    if (error) {
      console.error(`${table} upsert failed`, {
        chunkRows: chunk.length,
        code: error.code,
        message: error.message,
      });
      result.failed += chunk.length;
      continue;
    }
    result.written += chunk.length;
  }
  return result;
}
