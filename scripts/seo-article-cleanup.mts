/**
 * One-off, Step 2 of the 2026-11-02 SEO audit:
 *  - removes unverified Eugene/Oregon content from published news posts
 *  - adds an at-a-glance table to the income article, using its own figures
 *  - relabels the cost guide's flattened table as readable list items
 *
 *   tsx --env-file=.env.local scripts/seo-article-cleanup.mts           # dry run, writes the diff to /tmp
 *   tsx --env-file=.env.local scripts/seo-article-cleanup.mts --apply
 *
 * --apply writes the original rows to ~/vp-seo-cleanup-backup-<timestamp>.json first.
 */
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { stripLocalContent } from "../src/lib/news/strip-local-content";

type Swap = readonly [string, string];

const BODY_SWAPS: Readonly<Record<string, readonly Swap[]>> = {
  "vending-machine-business-passive-income": [
    ["in Eugene's busy offices", "in busy offices"],
    [
      "## Getting Started with Vending Preneurs in Eugene and Beyond",
      "## Getting Started with Vending Preneurs",
    ],
  ],
  "top-5-questions-vending-entrepreneurship-program": [
    ["whether you are in Eugene, Oregon, or New York City", "wherever you are"],
    ["secure profitable Eugene spots", "secure profitable spots"],
  ],
  "vending-business-taxes-us-beginners-guide": [
    [
      "key taxes, deductions, Oregon variations, and pitfalls",
      "key taxes, deductions, state variations, and pitfalls",
    ],
    [
      "### State-Specific Variations (Including Oregon)",
      "### State-Specific Variations",
    ],
  ],
  "how-much-money-do-vending-machines-make-2026": [
    ["Another example is a duo in Oregon who", "Another example is a duo who"],
  ],
  "top-8-vendpreneur-mistakes-how-to-fix-them": [
    ["Use apps like VendSoft or Parlevel telemetry", "Use telemetry software"],
  ],
};

const EXCERPT_SWAPS: Readonly<Record<string, readonly Swap[]>> = {
  "vending-machine-business-passive-income": [
    ["property owners in Eugene true", "property owners true"],
  ],
  "vending-business-taxes-us-beginners-guide": [
    [" Oregon has no state sales tax.", ""],
  ],
};

const INCOME_SLUG = "how-much-money-do-vending-machines-make-2026";
const INCOME_ANCHOR =
  "To scale, you simply multiply these unit economics across a fleet of machines.";
// Replaces the local FAQ. Every figure is already stated in this article.
const INCOME_FAQ = `## Frequently Asked Questions

### How much does a vending machine make a month?

On average, a single machine generates between $100 and $500 a month in profit after expenses. A standard snack or drink machine in a high-traffic location can bring in over $1,200 a month in revenue.

### How much does a vending machine cost to start?

A simple bulk machine might cost $200 to $1,500, a premium coffee machine $3,000 to $8,000, and a healthy cold food machine $5,000 to $12,000. See [how much a vending machine costs](/resources/how-much-does-a-vending-machine-cost) for every type.`;

const INCOME_TABLE = `

| Machine and location | What to expect |
| --- | --- |
| Single machine, average location | $100 to $500 a month in profit after expenses |
| Snack or drink machine, high-traffic location | About $300 a week in revenue, over $1,200 a month |
| Healthy cold food machine | $5,000 to $12,000 upfront, $6 to $12 average sale, 35% to 50% margin |`;

function swapAll(text: string, swaps: readonly Swap[], label: string) {
  return swaps.reduce((current, [from, to]) => {
    if (!current.includes(from)) {
      console.warn(`NOT FOUND ${label}: "${from}"`);
      return current;
    }
    return current.replace(from, to);
  }, text);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}
const apply = process.argv.includes("--apply");
const supabase = createClient(url, key);

const { data: posts, error } = await supabase
  .from("news_posts")
  .select("id, slug, excerpt, body")
  .eq("status", "published");
if (error) throw new Error(`Could not read news_posts: ${error.message}`);

let report = "";
const postUpdates = posts.flatMap((post) => {
  let body = swapAll(
    post.body,
    BODY_SWAPS[post.slug] ?? [],
    `${post.slug} body`,
  );
  body = stripLocalContent(body);
  if (post.slug === INCOME_SLUG && !body.includes("| Machine and location |")) {
    if (!body.includes(INCOME_ANCHOR))
      throw new Error("Income table anchor not found");
    body = body.replace(INCOME_ANCHOR, `${INCOME_ANCHOR}${INCOME_TABLE}`);
    body = `${body.trimEnd()}\n\n${INCOME_FAQ}\n`;
  }
  const excerpt = swapAll(
    post.excerpt ?? "",
    EXCERPT_SWAPS[post.slug] ?? [],
    `${post.slug} excerpt`,
  );
  if (body === post.body && excerpt === (post.excerpt ?? "")) return [];

  const after = new Set(body.split(/\n{2,}/));
  const removed = post.body
    .split(/\n{2,}/)
    .filter((p: string) => !after.has(p));
  const before = new Set(post.body.split(/\n{2,}/));
  const added = body.split(/\n{2,}/).filter((p: string) => !before.has(p));
  report += `\n\n#### ${post.slug}\n${removed.map((p: string) => `- ${p}`).join("\n")}\n${added.map((p: string) => `+ ${p}`).join("\n")}`;
  const left = (`${excerpt}\n${body}`.match(/Eugene|Lane County|Oregon/g) ?? [])
    .length;
  console.log(
    `${post.slug}: body ${post.body.length} -> ${body.length}, Oregon/Eugene mentions left ${left}`,
  );
  return [{ id: post.id, slug: post.slug, body, excerpt }];
});

// Cost guide: "Snack machine: $3,000 to $6,500, $1,000 to $3,000, note" lost its
// column headers on import. Say what each number is.
const COST_PATH = "/resources/how-much-does-a-vending-machine-cost";
const { data: page, error: pageError } = await supabase
  .from("seo_pages")
  .select("id, draft_content, published_content")
  .eq("route_path", COST_PATH)
  .single();
if (pageError)
  throw new Error(`Could not read cost guide: ${pageError.message}`);

const COST_ITEMS: Readonly<Record<string, string>> = {
  "Snack machine: $3,000 to $6,500, $1,000 to $3,000, The classic spiral machine":
    "Snack machine: New $3,000 to $6,500. Used $1,000 to $3,000. The classic spiral machine.",
  "Soda / drink machine: $3,000 to $6,500, $1,000 to $3,000, Refrigeration adds repair risk when used":
    "Soda / drink machine: New $3,000 to $6,500. Used $1,000 to $3,000. Refrigeration adds repair risk when used.",
  "Combo (snack + drink): $3,000 to $7,000, $1,500 to $3,000, One footprint. A popular first machine.":
    "Combo (snack + drink): New $3,000 to $7,000. Used $1,500 to $3,000. One footprint. A popular first machine.",
  "Smart cooler / AI vending machine: $5,000 to $12,000, Rare, Card and phone tap, larger and fresh items":
    "Smart cooler / AI vending machine: New $5,000 to $12,000. Rarely sold used. Card and phone tap, larger and fresh items.",
  "Coffee / hot beverage: $3,000 to $15,000+, $1,000 to $5,000, Highest-margin category":
    "Coffee / hot beverage: New $3,000 to $15,000+. Used $1,000 to $5,000. Highest-margin category.",
  "Fresh / frozen / hot food: $5,000 to $15,000+, Varies, Health permits usually required":
    "Fresh / frozen / hot food: New $5,000 to $15,000+. Used prices vary. Health permits usually required.",
  "Healthy vending machine: $4,000 to $12,000, Varies, Often a smart cooler or refrigerated combo":
    "Healthy vending machine: New $4,000 to $12,000. Used prices vary. Often a smart cooler or refrigerated combo.",
  "Bulk candy / gumball: $100 to $500, $50 to $200, Low cost, low revenue per unit":
    "Bulk candy / gumball: New $100 to $500. Used $50 to $200. Low cost, low revenue per unit.",
  "Ice / water kiosk: $15,000 to $25,000+, Varies, Plus $5,000 to $20,000 in site work":
    "Ice / water kiosk: New $15,000 to $25,000+. Used prices vary. Plus $5,000 to $20,000 in site work.",
  "Micro market (full setup): $15,000 to $50,000, n/a, Shelves, coolers, kiosk, security":
    "Micro market (full setup): $15,000 to $50,000. Shelves, coolers, kiosk, security.",
  "Machine cost: $3,000 to $6,500, $5,000 to $12,000":
    "Machine cost: traditional $3,000 to $6,500, smart $5,000 to $12,000",
  "Payment: Add a card reader ($200 to $500), Built in":
    "Payment: traditional needs a card reader ($200 to $500), smart has one built in",
  "Monthly software / telemetry: Low, Often $20 to $60+ a month":
    "Monthly software / telemetry: traditional low, smart often $20 to $60+ a month",
  "Typical revenue, same location: About $1,200/mo, About $2,500/mo":
    "Typical revenue, same location: traditional about $1,200/mo, smart about $2,500/mo",
  "Best for: Budget, moderate traffic, Upscale, secure, higher traffic":
    "Best for: traditional suits a budget and moderate traffic, smart suits upscale, secure, higher-traffic spots",
};

const relabelled = new Set<string>();

function relabelContent(content: unknown) {
  const copy = structuredClone(content) as {
    sections: {
      columns: {
        blocks: {
          type: string;
          props: {
            body?: { nodes?: { type: string; items?: string[] }[] };
            heading?: string;
          };
        }[];
      }[];
    }[];
  };
  for (const section of copy.sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) {
        if (block.type !== "rich_text") continue;
        for (const node of block.props.body?.nodes ?? []) {
          if (node.type !== "list" || !node.items) continue;
          node.items = node.items.map((item) => {
            if (!COST_ITEMS[item]) return item;
            relabelled.add(item);
            return COST_ITEMS[item];
          });
        }
      }
    }
  }
  return copy;
}

const nextPublished = relabelContent(page.published_content);
const nextDraft = page.draft_content
  ? relabelContent(page.draft_content)
  : page.draft_content;
const missing = Object.keys(COST_ITEMS).filter((item) => !relabelled.has(item));
report += `\n\n#### cost guide\n${[...relabelled].map((item) => `+ ${COST_ITEMS[item]}`).join("\n")}`;
console.log(
  `cost guide: ${relabelled.size} of ${Object.keys(COST_ITEMS).length} items relabelled`,
);
if (missing.length > 0) console.warn("NOT FOUND in cost guide:", missing);

const reportPath = "/tmp/vp-seo-cleanup-diff.md";
writeFileSync(reportPath, report);
console.log(
  `\n${postUpdates.length} posts to update. Full diff: ${reportPath}`,
);

if (!apply) {
  console.log("Dry run. Re-run with --apply to write.");
  process.exit(0);
}

const backup = join(homedir(), `vp-seo-cleanup-backup-${Date.now()}.json`);
writeFileSync(backup, JSON.stringify({ posts, page }, null, 2));
console.log(`Originals saved to ${backup}`);

for (const { id, slug, body, excerpt } of postUpdates) {
  const { error: updateError } = await supabase
    .from("news_posts")
    .update({ body, excerpt })
    .eq("id", id);
  if (updateError)
    throw new Error(`Could not update ${slug}: ${updateError.message}`);
  console.log(`updated ${slug}`);
}
const { error: guideError } = await supabase
  .from("seo_pages")
  .update({ published_content: nextPublished, draft_content: nextDraft })
  .eq("id", page.id);
if (guideError)
  throw new Error(`Could not update cost guide: ${guideError.message}`);
console.log("updated cost guide");
