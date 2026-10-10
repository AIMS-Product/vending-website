import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import {
  GoogleAdsIngestError,
  ingestGoogleAdsBatch,
} from "./google-ads-ingest";

function fakeClient(error: { code: string; message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  return { client: { from: vi.fn(() => ({ upsert })) }, upsert };
}

const row = {
  key: "2026-10-08|123",
  day: "2026-10-08",
  data: { costMicros: "1500000" },
};

describe("ingestGoogleAdsBatch", () => {
  it("upserts on (report, row_key) so reruns overwrite", async () => {
    const { client, upsert } = fakeClient();
    const result = await ingestGoogleAdsBatch(
      { report: "campaign", rows: [row] },
      client as never,
    );
    expect(result).toEqual({ report: "campaign", upserted: 1 });
    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          report: "campaign",
          row_key: row.key,
          day: row.day,
          data: row.data,
        }),
      ],
      { onConflict: "report,row_key" },
    );
  });

  it("rejects an unknown report or a bad date", async () => {
    const { client } = fakeClient();
    await expect(
      ingestGoogleAdsBatch({ report: "nope", rows: [row] }, client as never),
    ).rejects.toBeInstanceOf(GoogleAdsIngestError);
    await expect(
      ingestGoogleAdsBatch(
        { report: "ad", rows: [{ ...row, day: "10/08/2026" }] },
        client as never,
      ),
    ).rejects.toBeInstanceOf(GoogleAdsIngestError);
  });

  it("surfaces a storage failure as a 500", async () => {
    const { client } = fakeClient({ code: "42P01", message: "missing table" });
    await expect(
      ingestGoogleAdsBatch(
        { report: "campaign", rows: [row] },
        client as never,
      ),
    ).rejects.toMatchObject({ status: 500 });
  });
});
