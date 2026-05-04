#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SITE_ORIGIN = "https://www.vendingpreneurs.com";
const INVENTORY_PATH = "docs/cutover/webflow-url-inventory.md";
const REPORT_PATH = "docs/news-cms/import-report.md";

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const paths = await readNewsPaths(options.inventoryPath);
  const drafts = [];

  for (const newsPath of paths) {
    const response = await fetch(`${SITE_ORIGIN}${newsPath}`);
    const html = await response.text();
    drafts.push({
      path: newsPath,
      status: response.status,
      draft: extractNewsDraftFromHtml(html, newsPath),
    });
  }

  let writeResults = [];
  if (options.write) {
    writeResults = await writeDrafts(drafts, options);
  }

  await fs.mkdir(path.dirname(options.reportPath), { recursive: true });
  await fs.writeFile(
    options.reportPath,
    formatReport({
      drafts,
      writeResults,
      mode: options.write ? "write" : "dry-run",
    }),
  );

  console.log(`news_paths=${paths.length}`);
  console.log(`mode=${options.write ? "write" : "dry-run"}`);
  console.log(`report=${options.reportPath}`);
  console.log(
    `parse_failures=${drafts.filter(({ draft }) => draft.parseWarnings.length > 0).length}`,
  );
}

export function parseArgs(argv) {
  return {
    write: argv.includes("--write"),
    overwriteDrafts: argv.includes("--overwrite-drafts"),
    inventoryPath: valueAfter(argv, "--inventory") ?? INVENTORY_PATH,
    reportPath: valueAfter(argv, "--report") ?? REPORT_PATH,
  };
}

export async function readNewsPaths(inventoryPath = INVENTORY_PATH) {
  const markdown = await fs.readFile(inventoryPath, "utf8");
  return [
    ...markdown.matchAll(
      /\| `([^`]+)`\s+\|\s+200\s+\| same path after CMS import \| draft import \|/g,
    ),
  ].map((match) => match[1]);
}

export function extractNewsDraftFromHtml(html, newsPath) {
  const slug = newsPath.split("/").filter(Boolean).at(-1);
  const contentHtml = extractContentHtml(html);
  const h1 = textContent(firstMatch(contentHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const title =
    h1 ||
    metaContent(html, "og:title") ||
    textContent(firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)) ||
    slugToTitle(slug);
  const description =
    metaContent(html, "description") || metaContent(html, "og:description");
  const coverUrl = metaContent(html, "og:image") || firstImageSrc(contentHtml);
  const body = htmlToMarkdown(contentHtml, title);
  const excerpt = truncate(
    description || firstParagraph(body) || `Draft import for ${title}.`,
    235,
  );
  const parseWarnings = [];

  if (!slug) parseWarnings.push("missing slug");
  if (!h1 && !metaContent(html, "og:title"))
    parseWarnings.push("title fallback");
  if (body.length < 400) parseWarnings.push("short body");

  return {
    slug,
    title: truncate(title, 160),
    excerpt,
    body,
    cover_url: coverUrl || null,
    cover_alt: coverUrl ? truncate(title, 180) : null,
    author: "Mike",
    status: "draft",
    published_at: null,
    parseWarnings,
  };
}

export function decideDraftWrite(existingRow, overwriteDrafts = false) {
  if (!existingRow) return "insert";
  if (existingRow.status === "draft" && overwriteDrafts) {
    return "overwrite-draft";
  }
  return "skip-existing";
}

async function writeDrafts(drafts, options) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --write.",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  for (const { path: oldPath, draft } of drafts) {
    const { data: existing, error: lookupError } = await supabase
      .from("news_posts")
      .select("id,slug,status")
      .eq("slug", draft.slug)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const decision = decideDraftWrite(existing, options.overwriteDrafts);
    if (decision === "skip-existing") {
      results.push({ oldPath, slug: draft.slug, action: decision });
      continue;
    }

    const row = {
      slug: draft.slug,
      title: draft.title,
      excerpt: draft.excerpt,
      body: draft.body,
      cover_url: draft.cover_url,
      cover_alt: draft.cover_alt,
      author: draft.author,
      status: "draft",
      published_at: null,
    };

    if (decision === "overwrite-draft") {
      const { error } = await supabase
        .from("news_posts")
        .update(row)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("news_posts").insert(row);
      if (error) throw error;
    }

    results.push({ oldPath, slug: draft.slug, action: decision });
  }
  return results;
}

export function formatReport({ drafts, writeResults, mode }) {
  const failures = drafts.filter(({ draft }) => draft.parseWarnings.length > 0);
  const lines = [
    "# Webflow News Draft Import Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${mode}`,
    `Source: ${SITE_ORIGIN}/sitemap.xml via ${INVENTORY_PATH}`,
    `Articles checked: ${drafts.length}`,
    `Parse warnings: ${failures.length}`,
    "",
  ];

  if (mode === "dry-run") {
    lines.push(
      "No database writes were performed. Write mode inserts drafts only and never publishes articles.",
      "",
    );
  }

  if (writeResults.length) {
    lines.push("## Write Results", "");
    lines.push("| Old path | Slug | Action |");
    lines.push("| --- | --- | --- |");
    for (const result of writeResults) {
      lines.push(
        `| \`${result.oldPath}\` | \`${result.slug}\` | ${result.action} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Draft Candidates", "");
  lines.push("| Old path | Slug | Title | Body chars | Cover | Warnings |");
  lines.push("| --- | --- | --- | ---: | --- | --- |");
  for (const { path: oldPath, status, draft } of drafts) {
    lines.push(
      `| \`${oldPath}\` | \`${draft.slug}\` | ${escapeTable(draft.title)} | ${draft.body.length} | ${draft.cover_url ? "yes" : "no"} | ${status === 200 ? draft.parseWarnings.join(", ") || "none" : `HTTP ${status}`} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function extractContentHtml(html) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "");

  return (
    firstMatch(withoutNoise, /<article[^>]*>([\s\S]*?)<\/article>/i) ||
    firstMatch(withoutNoise, /<main[^>]*>([\s\S]*?)<\/main>/i) ||
    firstMatch(withoutNoise, /<body[^>]*>([\s\S]*?)<\/body>/i) ||
    withoutNoise
  );
}

function htmlToMarkdown(html, title) {
  let content = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, "")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n")
    .replace(/<a[^>]*href=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(
      /<img[^>]*src=\"([^\"]+)\"[^>]*alt=\"([^\"]*)\"[^>]*>/gi,
      "\n\n![$2]($1)\n\n",
    )
    .replace(/<img[^>]*src=\"([^\"]+)\"[^>]*>/gi, "\n\n![]($1)\n\n")
    .replace(/<[^>]+>/g, " ");

  content = decodeEntities(content)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return content || `# ${title}\n\nDraft imported from Webflow.`;
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeEntities(
    firstMatch(
      html,
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i",
      ),
    ),
  );
}

function firstImageSrc(html) {
  return decodeEntities(firstMatch(html, /<img[^>]*src=\"([^\"]+)\"[^>]*>/i));
}

function firstParagraph(markdown) {
  return markdown
    .split(/\n{2,}/)
    .find((block) => block && !block.startsWith("#") && !block.startsWith("!"));
}

function textContent(value) {
  return decodeEntities((value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value, pattern) {
  return value.match(pattern)?.[1] ?? "";
}

function decodeEntities(value = "") {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function slugToTitle(slug = "untitled") {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function truncate(value, max) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1).trim()}...` : value;
}

function escapeTable(value) {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const currentFile = pathToFileURL(fileURLToPath(import.meta.url)).href;
if (import.meta.url === currentFile && process.argv[1]) {
  const invokedFile = pathToFileURL(path.resolve(process.argv[1])).href;
  if (invokedFile === currentFile) {
    main().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}
