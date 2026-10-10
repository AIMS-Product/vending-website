import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const GOOGLE_ADS_REPORTS = [
  "campaign",
  "ad",
  "asset",
  "search_term",
  "keyword",
  "conversion_action",
] as const;

/** The script sends at most this many rows per request. */
export const MAX_ROWS_PER_BATCH = 2_000;

export class GoogleAdsIngestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "GoogleAdsIngestError";
    this.status = status;
  }
}

const batchSchema = z.object({
  report: z.enum(GOOGLE_ADS_REPORTS),
  rows: z
    .array(
      z.object({
        key: z.string().min(1).max(500),
        day: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1)
    .max(MAX_ROWS_PER_BATCH),
});

export type GoogleAdsBatch = z.infer<typeof batchSchema>;

type IngestClient = Pick<SupabaseClient, "from">;

/** Validate one batch from the Google Ads Script and upsert it. Reruns overwrite. */
export async function ingestGoogleAdsBatch(
  body: unknown,
  client: IngestClient = createAdminClient() as unknown as IngestClient,
): Promise<{ report: string; upserted: number }> {
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    throw new GoogleAdsIngestError("Batch does not match the expected shape.");
  }
  const { report, rows } = parsed.data;
  const syncedAt = new Date().toISOString();
  const records = rows.map((row) => ({
    report,
    row_key: row.key,
    day: row.day,
    data: row.data,
    synced_at: syncedAt,
  }));

  const { error } = await client
    .from("google_ads_rows")
    .upsert(records, { onConflict: "report,row_key" });
  if (error) {
    console.error("google ads ingest: upsert failed", {
      report,
      rows: records.length,
      code: error.code,
      message: error.message,
    });
    throw new GoogleAdsIngestError("Could not store the batch.", 500);
  }
  return { report, upserted: records.length };
}
