#!/usr/bin/env node
/**
 * Import `data/youtube-registry.json` into the `youtube_videos` table.
 *
 * The registry is the marketing team's Master Registry spreadsheet, exported so
 * a campaign slug on a lead row can be reported as a video title. It is the
 * only place the video title and publish date exist — a lead row knows its
 * `utm_campaign` and has never seen a video ID.
 *
 * Re-runnable. Matching is by `utm_campaign`. Click-sync bookkeeping
 * (`clicks_synced_at`) is never touched, so a re-import does not send the Bitly
 * sync back to the start of its queue, and a row whose link was discovered
 * after the last import keeps it — see `splitByBitlyLink`.
 *
 *   node scripts/import-youtube-registry.mjs            # dry-run
 *   node scripts/import-youtube-registry.mjs --write
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REGISTRY_PATH = path.join("data", "youtube-registry.json");

/**
 * Campaign slugs that appear on real leads but not in the registry, mapped to
 * the registry row they mean.
 *
 * Each one becomes its own `youtube_videos` row pointing at the same video, so
 * every rollup downstream stays a plain join with no special cases. Listed
 * explicitly rather than resolved by prefix or fuzzy match: "vending-machine-
 * location" is a genuine truncation of one slug, but guessing that from a
 * shared prefix would just as happily merge two unrelated videos.
 *
 * Verified against production on 2026-09-10: this was the only one of 43
 * lead-bearing YouTube slugs with no registry match.
 */
const ALIASES = {
  "vending-machine-location": "vending-machine-location-strategy",
};

const UPSERT_CHUNK = 200;

export async function main(argv = process.argv.slice(2)) {
  const write = argv.includes("--write");
  const rows = expandAliases(await readRegistry());

  const withoutBitly = rows.filter((row) => !row.bitly_id).length;
  console.log(
    `registry: ${rows.length} rows · ${rows.length - withoutBitly} with a Bitly link · ${withoutBitly} without`,
  );

  if (!write) {
    console.log("dry-run — pass --write to import.");
    console.log("first row:", rows[0]);
    return 0;
  }

  const client = createSupabaseClient();
  const { linked, unlinked } = splitByBitlyLink(rows);
  let imported = 0;

  for (const group of [linked, unlinked]) {
    for (let index = 0; index < group.length; index += UPSERT_CHUNK) {
      const chunk = group.slice(index, index + UPSERT_CHUNK);
      const { error } = await client
        .from("youtube_videos")
        .upsert(chunk, { onConflict: "utm_campaign" });

      if (error) {
        console.error(`upsert failed at row ${index}: ${error.message}`);
        return 1;
      }
      imported += chunk.length;
    }
  }

  console.log(
    `imported ${imported} rows into youtube_videos (${unlinked.length} left their Bitly columns alone).`,
  );
  return 0;
}

/**
 * Splits the registry into rows that carry a Bitly link and rows that do not.
 *
 * The rows with `bitly_id: null` must not send that null: `map-missing-links`
 * fills them in by discovery, and an upsert carrying an explicit null resets
 * them — after which `claimBatch` never claims a null-id row again and those
 * links silently stop syncing. The 604 rows that DO carry a link still seed it,
 * so a first import is unaffected.
 *
 * Two payloads rather than one with the columns dropped per row: PostgREST
 * requires every object in a bulk upsert to carry the same keys.
 *
 * Returns new objects; the caller's rows are never mutated.
 */
export function splitByBitlyLink(rows) {
  const linked = [];
  const unlinked = [];

  for (const row of rows) {
    if (row.bitly_id) {
      linked.push(row);
      continue;
    }
    // A copy, then drop the two columns: the caller's row is left as it was.
    const withoutLink = { ...row };
    delete withoutLink.bitly_id;
    delete withoutLink.bitly_url;
    unlinked.push(withoutLink);
  }

  return { linked, unlinked };
}

async function readRegistry() {
  const raw = await fs.readFile(REGISTRY_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${REGISTRY_PATH} is empty or not an array.`);
  }
  return parsed;
}

/**
 * Duplicates a registry row under each known alias slug.
 *
 * Exported for the test: the aliased row must keep the target's title and video
 * so the report names the right video, while carrying the alias slug as its
 * own key.
 */
export function expandAliases(rows) {
  const byCampaign = new Map(rows.map((row) => [row.utm_campaign, row]));
  const aliased = [];

  for (const [alias, target] of Object.entries(ALIASES)) {
    if (byCampaign.has(alias)) continue;
    const source = byCampaign.get(target);
    if (!source) {
      console.warn(`alias "${alias}" points at unknown slug "${target}"`);
      continue;
    }
    aliased.push({ ...source, utm_campaign: alias });
  }

  return [...rows, ...aliased];
}

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
