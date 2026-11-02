/**
 * Repairs the nine published news articles whose Webflow import saved the old site header
 * and footer into `body`, the logo as `cover_url` and `[` as `excerpt`.
 * Rows are matched on that excerpt, so a re-run finds nothing. Archived rows
 * with the same damage are left alone: nothing serves them.
 *
 *   npx --yes tsx --env-file=.env.local scripts/repair-webflow-news-bodies.mts           # dry run
 *   npx --yes tsx --env-file=.env.local scripts/repair-webflow-news-bodies.mts --apply
 *
 * --apply writes the original rows to ~/vp-news-repair-backup-<timestamp>.json first.
 */
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cleanWebflowBody } from "../src/lib/news/clean-webflow-body";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}
const apply = process.argv.includes("--apply");
const supabase = createClient(url, key);

const { data: rows, error } = await supabase
  .from("news_posts")
  .select("id, slug, excerpt, cover_url, body")
  .eq("excerpt", "[")
  .eq("status", "published");
if (error) throw new Error(`Could not read news_posts: ${error.message}`);

const repairs = rows.flatMap((row) => {
  const cleaned = cleanWebflowBody(row.body);
  if (!cleaned) {
    console.warn(`SKIP ${row.slug}: body is not in the scraped shape`);
    return [];
  }
  const leftovers = [
    "](#)",
    "vendhub.ai",
    "/about-us",
    "/booking-website",
  ].filter((text) => cleaned.body.includes(text));
  console.log(
    `${row.slug}\n  body ${row.body.length} -> ${cleaned.body.length} chars` +
      `\n  cover ${cleaned.coverUrl ?? "(none, keeps current)"}` +
      `\n  excerpt ${cleaned.excerpt.length} chars: ${cleaned.excerpt.slice(0, 110)}...` +
      `\n  starts ${JSON.stringify(cleaned.body.slice(0, 50))}` +
      `\n  leftovers ${leftovers.join(", ") || "none"}`,
  );
  return [{ row, cleaned }];
});
console.log(`\n${repairs.length} of ${rows.length} repairable.`);

if (!apply) {
  console.log("Dry run. Re-run with --apply to write.");
  process.exit(0);
}

const backup = join(homedir(), `vp-news-repair-backup-${Date.now()}.json`);
writeFileSync(backup, JSON.stringify(rows, null, 2));
console.log(`Originals saved to ${backup}`);

for (const { row, cleaned } of repairs) {
  const { error: updateError } = await supabase
    .from("news_posts")
    .update({
      body: cleaned.body,
      excerpt: cleaned.excerpt,
      cover_url: cleaned.coverUrl ?? row.cover_url,
    })
    .eq("id", row.id);
  if (updateError) {
    throw new Error(`Could not update ${row.slug}: ${updateError.message}`);
  }
  console.log(`updated ${row.slug}`);
}
