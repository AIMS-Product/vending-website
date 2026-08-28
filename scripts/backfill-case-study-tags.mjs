/**
 * Push `tags` from data/case-studies/*.json to the matching Supabase rows.
 *
 * Deliberately NOT `import-case-studies.mjs --overwrite`. That script rewrites
 * every column including `status`, and all 25 rows are currently `published` —
 * a re-run would silently unpublish the whole collection and discard any edit
 * made in the admin. This one touches a single column.
 *
 *   node scripts/backfill-case-study-tags.mjs          # dry run, prints a diff
 *   node scripts/backfill-case-study-tags.mjs --write
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const CONTENT_DIR = "data/case-studies";

export function diffTags(local, remote) {
  const added = local.filter((tag) => !remote.includes(tag));
  const removed = remote.filter((tag) => !local.includes(tag));
  return { added, removed, changed: added.length > 0 || removed.length > 0 };
}

async function readLocalTags() {
  const files = (await fs.readdir(CONTENT_DIR)).filter((f) => f.endsWith(".json"));
  const out = new Map();
  for (const file of files) {
    const raw = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
    const data = JSON.parse(raw);
    out.set(data.slug, data.tags ?? []);
  }
  return out;
}

export async function main(argv = process.argv.slice(2)) {
  const write = argv.includes("--write");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const local = await readLocalTags();

  const { data: rows, error } = await supabase
    .from("case_studies")
    .select("slug, tags, status");
  if (error) throw new Error(`read failed: ${error.message}`);

  const remote = new Map(rows.map((row) => [row.slug, row]));
  let changed = 0;
  let missing = 0;
  const failed = [];

  for (const [slug, tags] of local) {
    const row = remote.get(slug);
    // A local file with no row is a real problem worth naming, not a silent
    // skip — it means the collection and the database have drifted.
    if (!row) {
      console.log(`MISSING  ${slug} — no row in Supabase`);
      missing++;
      continue;
    }
    const { added, removed, changed: isChanged } = diffTags(tags, row.tags ?? []);
    if (!isChanged) continue;
    changed++;
    console.log(
      `${write ? "WRITE  " : "WOULD  "} ${slug} (${row.status})` +
        (added.length ? `\n    + ${added.join(", ")}` : "") +
        (removed.length ? `\n    - ${removed.join(", ")}` : ""),
    );
    if (write) {
      const { error: updateError } = await supabase
        .from("case_studies")
        .update({ tags })
        .eq("slug", slug);
      if (updateError) failed.push({ slug, error: updateError.message });
    }
  }

  console.log(
    `\n${changed} row(s) ${write ? "updated" : "would change"}` +
      (missing ? `, ${missing} missing` : "") +
      (failed.length ? `, ${failed.length} FAILED` : ""),
  );
  for (const f of failed) console.log(`  FAILED ${f.slug}: ${f.error}`);
  if (!write) console.log("Dry run. Re-run with --write to apply.");
  return { changed, missing, failed };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
