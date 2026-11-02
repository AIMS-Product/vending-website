/**
 * One-off: adds in-article links from published news posts to the /resources
 * guides, which Google had not indexed and which had almost no internal links.
 * Safe to re-run: a post that already links to the guide is skipped.
 *
 *   npx --yes tsx --env-file=.env.local scripts/add-guide-links-to-news.mts           # dry run
 *   npx --yes tsx --env-file=.env.local scripts/add-guide-links-to-news.mts --apply
 *
 * --apply writes the original bodies to ~/vp-news-links-backup-<timestamp>.json first.
 */
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { addInlineLink } from "../src/lib/news/add-inline-link";

const COST = "/resources/how-much-does-a-vending-machine-cost";
const LLC = "/resources/llc-for-vending-machine-business";
const NEGOTIATE = "/resources/negotiate-vending-machine-deals";
const COMBO = "/resources/combo-vending-machine";

const LINKS: ReadonlyArray<readonly [string, string, string]> = [
  [
    "how-much-money-do-vending-machines-make-2026",
    "biggest upfront cost",
    COST,
  ],
  [
    "how-much-money-do-vending-machines-make-2026",
    "commissions paid to the location owner",
    NEGOTIATE,
  ],
  [
    "expected-costs-earnings-roi-vending-machines-2025",
    "lease fees or commissions",
    NEGOTIATE,
  ],
  [
    "from-zero-to-first-vending-machine-guide",
    "Estimating startup costs",
    COST,
  ],
  ["from-zero-to-first-vending-machine-guide", "An LLC", LLC],
  [
    "from-zero-to-first-vending-machine-guide",
    "Negotiating placement agreements",
    NEGOTIATE,
  ],
  ["top-8-vendpreneur-mistakes-how-to-fix-them", "combo machines", COMBO],
  ["top-8-vendpreneur-mistakes-how-to-fix-them", "commission rates", NEGOTIATE],
  ["vending-business-taxes-us-beginners-guide", "single-member LLC", LLC],
  ["vending-machine-business-legal-tax-licensing-2025", "An LLC", LLC],
  ["top-5-questions-vending-entrepreneurship-program", "startup costs", COST],
  [
    "top-10-profitable-products-to-stock-in-your-vending-machine",
    "combo machines",
    COMBO,
  ],
  [
    "how-to-build-a-self-managed-route-so-you-can-work-less",
    "negotiating agreements",
    NEGOTIATE,
  ],
  ["vending-machine-business-passive-income", "paying a commission", NEGOTIATE],
];

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
  .select("id, slug, body")
  .eq("status", "published");
if (error) throw new Error(`Could not read news_posts: ${error.message}`);

const updates = rows.flatMap((row) => {
  let body = row.body;
  for (const [slug, phrase, href] of LINKS) {
    if (slug !== row.slug) continue;
    const next = addInlineLink(body, phrase, href);
    if (!next) {
      console.warn(`SKIP ${slug}: "${phrase}"`);
      continue;
    }
    const at = next.indexOf(`[${phrase}](${href})`);
    console.log(
      `${slug}\n  ...${next.slice(Math.max(0, at - 60), at + phrase.length + href.length + 60).replace(/\n/g, " ")}...`,
    );
    body = next;
  }
  return body === row.body ? [] : [{ id: row.id, slug: row.slug, body }];
});
console.log(`\n${updates.length} posts to update.`);

if (!apply) {
  console.log("Dry run. Re-run with --apply to write.");
  process.exit(0);
}

const backup = join(homedir(), `vp-news-links-backup-${Date.now()}.json`);
writeFileSync(backup, JSON.stringify(rows, null, 2));
console.log(`Originals saved to ${backup}`);

for (const { id, slug, body } of updates) {
  const { error: updateError } = await supabase
    .from("news_posts")
    .update({ body })
    .eq("id", id);
  if (updateError) {
    throw new Error(`Could not update ${slug}: ${updateError.message}`);
  }
  console.log(`updated ${slug}`);
}
