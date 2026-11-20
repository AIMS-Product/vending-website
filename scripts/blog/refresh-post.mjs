#!/usr/bin/env node
/**
 * Rebuilds an existing news article in the blog frame and saves it as a
 * separate DRAFT row `<slug>-v2-draft`. The live article is never touched;
 * swapping the copy onto the live URL is a human step after review.
 *
 *   node --env-file=.env.local scripts/blog/refresh-post.mjs <slug> "<keyword>" [--save]
 *
 * Same writer (claude -p, subscription) and gate as draft-next.mjs. The
 * current article body is part of the source data, so its sourced figures
 * may be kept.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const [slug, keyword] = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"));
const save = process.argv.includes("--save");
if (!slug || !keyword) {
  console.error('Usage: refresh-post.mjs <slug> "<keyword>" [--save]');
  process.exit(1);
}
const OUT_DIR = path.join(ROOT, ".claude/blog-drafts");
const draftSlug = `${slug}-v2-draft`;
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

const current = must(
  await db
    .from("news_posts")
    .select("slug, title, excerpt, body, cover_url, cover_alt, status")
    .eq("slug", slug)
    .single(),
  "current post read",
);
const existingDraft = must(
  await db
    .from("news_posts")
    .select("id, status")
    .eq("slug", draftSlug)
    .maybeSingle(),
  "draft read",
);
if (existingDraft && existingDraft.status !== "draft") {
  console.log(
    `${draftSlug} exists with status ${existingDraft.status}; not touching it.`,
  );
  process.exit(3);
}
const posts = must(
  await db.from("news_posts").select("slug, title, excerpt, status"),
  "news_posts read",
);
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
  current_article: {
    url: `/news/${slug}`,
    title: current.title,
    body: current.body,
  },
  members: cases.map(({ slug: s, ...c }) => ({
    ...c,
    url: `/case-studies/${s}`,
  })),
  live_posts: posts
    .filter((p) => p.status === "published" && p.slug !== slug)
    .map((p) => ({ title: p.title, url: `/news/${p.slug}`, about: p.excerpt })),
  core_pages: CORE_PAGES,
};
const sourceText = JSON.stringify(source, null, 1);
const base = fs
  .readFileSync(path.join(ROOT, "scripts/blog/prompt.md"), "utf8")
  .replaceAll("{{TITLE}}", current.title)
  .replaceAll("{{KEYWORD}}", keyword)
  .replaceAll(
    "{{ANGLE}}",
    "REFRESH of an existing article (current_article in SOURCE DATA). Rebuild it in the frame below. Keep every true fact, sourced link and member example from the current article that still fits; drop filler; add the chart, quick picks, cards and FAQ the frame asks for. Drop any city- or state-specific framing (e.g. Eugene, Oregon) and any statistic or citation the current article does not link to a source; keep linked sources and member figures. The article already ranks on page 2 for this keyword, so answer the searcher's question in the first 100 words.",
  )
  .replaceAll("{{SLUG}}", slug)
  .replace("{{SOURCE}}", sourceText);

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
const gate = (d) => checkPost({ ...d, keyword, groundingText: sourceText });

let draft = parseDraft(writeWithClaude(base));
let result = gate(draft);
if (!result.ok) {
  console.log(`gate failed once: ${result.failures.join("; ")}. Rewriting.`);
  draft = parseDraft(
    writeWithClaude(
      `${base}\n\n## YOUR PREVIOUS DRAFT FAILED THESE CHECKS\n\n${result.failures.map((f) => `- ${f}`).join("\n")}\n\nRewrite the whole article and fix every item. Previous draft:\n\n${draft.markdown}`,
    ),
  );
  result = gate(draft);
}
fs.mkdirSync(OUT_DIR, { recursive: true });
const file = path.join(
  OUT_DIR,
  `${new Date().toISOString().slice(0, 10)}-${draftSlug}.md`,
);
fs.writeFileSync(
  file,
  `<!-- refresh of /news/${slug}\nseo_title: ${draft.seoTitle}\nmeta_description: ${draft.metaDescription}\ngate: ${result.ok ? "PASS" : `FAIL: ${result.failures.join("; ")}`}\nstats: ${JSON.stringify(result.stats)} -->\n\n${draft.markdown}\n`,
);
console.log(
  `gate ${result.ok ? "PASS" : "FAIL"} ${JSON.stringify(result.stats)}`,
);
if (!result.ok) {
  console.log(`failures: ${result.failures.join("; ")}`);
  process.exit(2);
}
if (!save) process.exit(0);
const fields = {
  title: /^# (.+)$/m.exec(draft.markdown)?.[1] ?? current.title,
  excerpt: draft.metaDescription,
  body: draft.markdown.replace(/^# .+\n+/, ""),
  cover_url: current.cover_url,
  cover_alt: current.cover_alt,
};
const write = existingDraft
  ? db
      .from("news_posts")
      .update(fields)
      .eq("slug", draftSlug)
      .eq("status", "draft")
  : db
      .from("news_posts")
      .insert({ slug: draftSlug, status: "draft", ...fields });
const row = must(
  await write.select("id, slug, status, published_at").single(),
  "draft write",
);
console.log(
  `Saved DRAFT ${row.id} (${row.status}, published_at ${row.published_at}) slug ${row.slug}. Live /news/${slug} untouched.`,
);
