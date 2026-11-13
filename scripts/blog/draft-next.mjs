#!/usr/bin/env node
/**
 * Drafts the next Vendingpreneurs news article. NEVER publishes: the only
 * write is a news_posts row with status "draft" (published_at null).
 *
 *   node --env-file=.env.local scripts/blog/draft-next.mjs            # dry run
 *   node --env-file=.env.local scripts/blog/draft-next.mjs --save     # save draft row
 *   ... --topic <slug>                                                 # pick a topic
 *
 * Steps: first "queued" topic in scripts/blog/topics.json with no news_posts
 * row for its slug -> skip it if a live post already targets the keyword ->
 * source data (published case studies, live posts, core pages) -> claude -p
 * on the Claude Code subscription ($0; ANTHROPIC_API_KEY removed from its env)
 * -> quality gate (src/lib/blog/quality-gate.ts), one rewrite on failure ->
 * markdown in .claude/blog-drafts/ -> with --save, a draft news_posts row.
 * Spec: .claude/specs/2026-11-13-blog-frame.md
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const save = args.includes("--save");
const topicArg = args.includes("--topic")
  ? args[args.indexOf("--topic") + 1]
  : null;
// --from <file>: gate and save a draft written earlier (e.g. a dry run you edited) instead of writing a new one.
const fromArg = args.includes("--from") ? args[args.indexOf("--from") + 1] : null;
const OUT_DIR = path.join(ROOT, ".claude/blog-drafts");
// Live, indexable core pages (checked 2026-11-13). /solutions and /process are noindex.
const CORE_PAGES = [
  { title: "Book a strategy call", url: "/contact" },
  { title: "Member case studies", url: "/case-studies" },
  { title: "News and guides", url: "/news" },
  { title: "Resources hub", url: "/resources" },
  {
    title: "90-Day Vending Business Blueprint (free)",
    url: "/vending-business-blueprint",
  },
  { title: "About Vendingpreneurs", url: "/about" },
];

const jiti = createJiti(import.meta.url, {
  alias: { "@": path.join(ROOT, "src") },
  interopDefault: true,
});
const { checkPost } = await jiti.import(
  path.join(ROOT, "src/lib/blog/quality-gate.ts"),
);

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const must = (res, what) => {
  if (res.error) throw new Error(`${what} failed: ${res.error.message}`);
  return res.data;
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "for",
  "of",
  "to",
  "and",
  "in",
  "on",
  "how",
  "what",
  "best",
  "vending",
  "machine",
  "machines",
  "business",
]);
const tokens = (s) =>
  new Set(
    (s ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t && !STOP.has(t)),
  );
function overlap(keyword, other) {
  const a = tokens(keyword);
  const b = tokens(other);
  if (a.size === 0) return 0;
  return [...a].filter((t) => b.has(t)).length / a.size;
}

const posts = must(
  await db.from("news_posts").select("slug, title, excerpt, status"),
  "news_posts read",
);
const queue = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts/blog/topics.json"), "utf8"),
).topics;

function nextTopic() {
  const taken = new Set(posts.map((p) => p.slug));
  const candidates = topicArg
    ? queue.filter((t) => t.slug === topicArg)
    : queue.filter((t) => t.status === "queued");
  for (const t of candidates) {
    if (taken.has(t.slug)) continue;
    const clash = posts.find(
      (p) =>
        p.status === "published" &&
        overlap(t.keyword, `${p.title} ${p.slug}`) >= 0.8,
    );
    if (clash && !topicArg) {
      console.log(
        `skip ${t.slug} "${t.keyword}": overlaps /news/${clash.slug}; refresh that post instead`,
      );
      continue;
    }
    return t;
  }
  return null;
}

function writeWithClaude(prompt) {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // subscription only, never a paid key
  const run = spawnSync(
    "claude",
    [
      "-p",
      "--output-format",
      "text",
      "--tools",
      "",
      "--no-session-persistence",
    ],
    {
      input: prompt,
      env,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15 * 60 * 1000,
    },
  );
  if (run.status !== 0)
    throw new Error(
      `claude -p exited ${run.status}: ${(run.stderr || "").slice(0, 500)}`,
    );
  return run.stdout.trim();
}

function parseDraft(text) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(
    text.replace(/^```\w*\n|\n```$/g, "").trim(),
  );
  if (!m) throw new Error("draft has no front matter block");
  const meta = Object.fromEntries(
    m[1]
      .split("\n")
      .map((l) => l.split(/:\s(.+)/))
      .filter((p) => p[1])
      .map(([k, v]) => [k.trim(), v.trim()]),
  );
  return {
    seoTitle: meta.seo_title ?? "",
    metaDescription: meta.meta_description ?? "",
    markdown: m[2].trim(),
  };
}

const topic = nextTopic();
if (!topic) {
  console.log("Queue empty: no queued topic left without a news_posts row.");
  process.exit(0);
}
console.log(`topic ${topic.slug} ("${topic.keyword}")`);

const cases = must(
  await db
    .from("case_studies")
    .select(
      "slug, member_name, prior_occupation, location_types, machine_count, location_count, monthly_revenue_usd, months_to_result, excerpt",
    )
    .eq("status", "published"),
  "case_studies read",
);
const source = {
  members: cases.map(({ slug, ...c }) => ({
    ...c,
    url: `/case-studies/${slug}`,
  })),
  live_posts: posts
    .filter((p) => p.status === "published")
    .map((p) => ({ title: p.title, url: `/news/${p.slug}`, about: p.excerpt })),
  core_pages: CORE_PAGES,
};
const sourceText = JSON.stringify(source, null, 1);
const prompt = fs
  .readFileSync(path.join(ROOT, "scripts/blog/prompt.md"), "utf8")
  .replaceAll("{{TITLE}}", topic.title)
  .replaceAll("{{KEYWORD}}", topic.keyword)
  .replaceAll("{{ANGLE}}", topic.angle)
  .replaceAll("{{SLUG}}", topic.slug)
  .replace("{{SOURCE}}", sourceText);

const gate = (d) =>
  checkPost({ ...d, keyword: topic.keyword, groundingText: sourceText });

let draft;
let result;
if (fromArg) {
  const text = fs.readFileSync(fromArg, "utf8");
  const meta = /seo_title: (.+)\nmeta_description: (.+)\n/.exec(text);
  draft = {
    seoTitle: meta?.[1]?.trim() ?? "",
    metaDescription: meta?.[2]?.trim() ?? "",
    markdown: text.replace(/^<!--[\s\S]*?-->\s*/, "").trim(),
  };
  result = gate(draft);
} else {
  draft = parseDraft(writeWithClaude(prompt));
  result = gate(draft);
  if (!result.ok) {
    console.log(`gate failed once: ${result.failures.join("; ")}. Rewriting.`);
    const fix = `${prompt}\n\n## YOUR PREVIOUS DRAFT FAILED THESE CHECKS\n\n${result.failures.map((f) => `- ${f}`).join("\n")}\n\nRewrite the whole article and fix every item. Previous draft:\n\n${draft.markdown}`;
    draft = parseDraft(writeWithClaude(fix));
    result = gate(draft);
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(
  OUT_DIR,
  `${new Date().toISOString().slice(0, 10)}-${topic.slug}.md`,
);
fs.writeFileSync(
  file,
  `<!-- seo_title: ${draft.seoTitle}\nmeta_description: ${draft.metaDescription}\ngate: ${result.ok ? "PASS" : `FAIL: ${result.failures.join("; ")}`}\nstats: ${JSON.stringify(result.stats)} -->\n\n${draft.markdown}\n`,
);
console.log(
  `gate ${result.ok ? "PASS" : "FAIL"} ${JSON.stringify(result.stats)}`,
);
if (!result.ok) console.log(`failures: ${result.failures.join("; ")}`);
console.log(`markdown: ${path.relative(ROOT, file)}`);

if (!result.ok) process.exit(2);
if (!save) {
  console.log(
    "Dry run: nothing saved. Re-run with --save to create the draft row.",
  );
  process.exit(0);
}

// The news page shows the title as H1, so the body starts after it.
const h1 = /^# (.+)$/m.exec(draft.markdown)?.[1] ?? topic.title;
const body = draft.markdown.replace(/^# .+\n+/, "");
const row = must(
  await db
    .from("news_posts")
    .insert({
      slug: topic.slug,
      title: h1,
      excerpt: draft.metaDescription,
      body,
      status: "draft",
    })
    .select("id, slug, status, published_at")
    .single(),
  "news_posts insert",
);
console.log(
  `Saved DRAFT ${row.id} (${row.status}, published_at ${row.published_at}) slug ${row.slug}. Not published.`,
);
