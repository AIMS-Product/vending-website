#!/usr/bin/env node
/**
 * Turns one SEO draft (the vp-seo-output format: "## B. SEO Metadata" table,
 * "## A. Draft" body) into a /resources page in the page builder.
 *
 * Usage: node --env-file=.env.local scripts/seo/publish-draft.mjs <draft.md> [--publish]
 * Dry run by default: prints the blocks and the SEO readiness result.
 * --publish creates the page (or updates the draft of an existing page with
 * the same slug) and publishes it through adminPublishSeoPage.
 *
 * Rules applied to the copy:
 *  - a link to a /resources page that is not live becomes plain text (no
 *    links to unpublished pages); every other link is kept
 *  - markdown tables become one list item per row ("A: b, c")
 *  - "**" and blockquote markers are dropped (rich text has no bold)
 *  - known name fixes (NAME_FIXES) match the published case studies
 *  - a draft with an unresolved VERIFY flag or {{PLACEHOLDER}} is refused
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createJiti } from "jiti";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const [file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const publish = process.argv.includes("--publish");
if (!file) {
  console.error("Usage: publish-draft.mjs <draft.md> [--publish]");
  process.exit(1);
}
const NAME_FIXES = [[/\bDuvall\b/g, "Duval"]];

const jiti = createJiti(import.meta.url, {
  alias: {
    "@": path.join(ROOT, "src"),
    "server-only": path.join(ROOT, "vitest.server-only-shim.ts"),
  },
  interopDefault: true,
});
const { pageBlockSchema } = await jiti.import(path.join(ROOT, "src/lib/page-builder/blocks.ts"));

let raw = fs.readFileSync(file, "utf8");
for (const [re, to] of NAME_FIXES) raw = raw.replace(re, to);
// The community and training are joined through a strategy call.
raw = raw.replace(/\{\{(JOIN_COMMUNITY_URL|TRAINING_URL)\}\}/g, "/contact");

const meta = {};
for (const m of raw.matchAll(/^\| ([^|]+?) \| (.+?) \|$/gm)) meta[m[1].trim()] = m[2].trim();
const slugPath = meta["URL slug"];
if (!slugPath?.startsWith("/resources/")) throw new Error(`No /resources slug in ${file}`);
const slug = slugPath.replace("/resources/", "");
const body = raw.slice(raw.indexOf("## A. Draft") + 11, raw.indexOf("## C. Interlinking"));
if (/VERIFY|\{\{[A-Z_]+\}\}/.test(body)) {
  throw new Error("Draft still has a VERIFY flag or {{PLACEHOLDER}}; resolve it first.");
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const live = await db.from("published_seo_pages").select("route_path");
if (live.error) throw new Error(`published_seo_pages read failed: ${live.error.message}`);
const livePaths = new Set(live.data.map((r) => r.route_path));
livePaths.add(slugPath); // a page may link to itself

const unlinked = new Set();
const clean = (s) => s.replace(/\*\*/g, "").replace(/^>\s?/, "").trim();
/** Paragraph text to spans, links kept only when their target is live. */
function spans(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    // /booking is not an approved builder route; the site's booking page is /contact.
    const href = m[2] === "/booking" ? "/contact" : m[2];
    const keep = !href.startsWith("/resources/") || livePaths.has(href);
    if (!keep) unlinked.add(href);
    out.push(keep ? { text: m[1], href } : { text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.filter((s) => s.text.length > 0);
}
const plain = (text) => spans(text).map((s) => s.text).join("");

function nodesOf(lines) {
  const nodes = [];
  let list = null;
  let table = null;
  const flush = () => {
    if (list) nodes.push(list);
    if (table) nodes.push(table);
    list = null;
    table = null;
  };
  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;
    if (/^\|/.test(line)) {
      const cells = line.split("|").slice(1, -1).map((c) => plain(clean(c)));
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      if (!table) {
        flush();
        table = { type: "list", style: "bullet", items: [], header: cells };
        continue;
      }
      const [first, ...rest] = cells;
      table.items.push(`${first}: ${rest.filter(Boolean).join(", ")}`.slice(0, 300));
      continue;
    }
    const li = /^(?:[-*]|(\d+)[.)])\s+(.+)$/.exec(line);
    if (li) {
      const style = li[1] ? "numbered" : "bullet";
      if (!list || list.style !== style) {
        flush();
        list = { type: "list", style, items: [] };
      }
      list.items.push(plain(li[2]).slice(0, 300));
      continue;
    }
    flush();
    const h = /^(#{3,4})\s+(.+)$/.exec(line);
    if (h) {
      nodes.push({ type: "heading", level: h[1].length, text: plain(h[2]).slice(0, 180) });
      continue;
    }
    const s = spans(line);
    nodes.push(s.some((x) => x.href) ? { type: "paragraph", spans: s } : { type: "paragraph", text: plain(line) });
  }
  flush();
  // Lists hold at most 12 items; tables drop their header row.
  return nodes.flatMap((n) => {
    if (n.type !== "list") return [n];
    const { header, ...rest } = n;
    const chunks = [];
    for (let i = 0; i < rest.items.length; i += 12) chunks.push({ ...rest, items: rest.items.slice(i, i + 12) });
    return chunks;
  });
}

const id = (p) => `${p}_${randomUUID().slice(0, 12)}`;
const block = (type, props, variant) =>
  pageBlockSchema.parse({ id: id("block"), type, ...(variant ? { variant } : {}), props });
const section = (blocks) => ({
  id: id("section"),
  preset: "standard",
  spacing: "standard",
  background: "default",
  columns: [{ id: id("column"), width: "1/1", blocks }],
});

// Split the body at "## " into the lead-in (under the H1) and sections.
const lines = body.split("\n");
const h1 = plain(clean((lines.find((l) => /^# /.test(l)) ?? "").replace(/^# /, "")));
const parts = [];
let current = { heading: null, lines: [] };
for (const l of lines) {
  if (/^# /.test(l)) continue;
  const h2 = /^## (.+)$/.exec(l);
  if (h2) {
    parts.push(current);
    current = { heading: plain(clean(h2[1])), lines: [] };
  } else current.lines.push(l);
}
parts.push(current);

const lead = parts.shift();
const leadParas = lead.lines.map(clean).filter((l) => l && !/^#/.test(l));
const heroBody = plain(leadParas[0] ?? "").slice(0, 500);
const cta = { label: "Book a free strategy call", href: "/contact" };
const sections = [
  section([
    block("hero", {
      heading: (meta.H1 ? plain(meta.H1) : h1).slice(0, 180),
      body: heroBody,
      ctaLabel: cta.label,
      ctaHref: cta.href,
      ctaTrackingName: `resources-${slug}-hero`,
    }),
    ...chunked(null, nodesOf(lead.lines.slice(lead.lines.findIndex((l) => clean(l) === leadParas[0]) + 1))),
  ]),
];
function chunked(heading, nodes) {
  const out = [];
  for (let i = 0; i < nodes.length; i += 30) {
    out.push(block("rich_text", { heading: i === 0 && heading ? heading : "", body: { version: 1, nodes: nodes.slice(i, i + 30) } }));
  }
  return out;
}
let faq = null;
for (const part of parts) {
  if (/frequently asked questions/i.test(part.heading ?? "")) {
    const items = [];
    let q = null;
    // Questions are "### Q" or a whole-line "**Q?**" (checked before clean()).
    for (const rawLine of part.lines.filter((l) => l.trim())) {
      const bold = /^\*\*(.+\?)\*\*\s*$/.exec(rawLine.trim());
      const l = clean(rawLine);
      const m = bold ? [null, bold[1]] : /^#{3,4}\s+(.+)$/.exec(l);
      if (m) {
        q = { question: plain(m[1]).slice(0, 240), answer: "" };
        items.push(q);
      } else if (q) q.answer = `${q.answer} ${plain(l)}`.trim().slice(0, 1200);
    }
    faq = block("faq", { heading: "Frequently asked questions", items });
    continue;
  }
  sections.push(section(chunked(part.heading, nodesOf(part.lines))));
}
if (faq) sections.push(section([faq]));
sections.push(section([block("cta", { label: cta.label, href: cta.href, trackingName: `resources-${slug}-footer` })]));
const content = { version: 1, sections };

const blocks = sections.flatMap((s) => s.columns[0].blocks);
console.log(`${slug}: ${sections.length} sections, ${blocks.length} blocks (${blocks.map((b) => b.type).join(", ")})`);
console.log(`title: ${meta["Meta title"]} (${meta["Meta title"]?.length})`);
console.log(`description: ${meta["Meta description"]?.length} chars; FAQ items: ${faq?.props.items.length ?? 0}`);
console.log(`links made plain (target not live): ${[...unlinked].join(", ") || "none"}`);

const svc = await jiti.import(path.join(ROOT, "src/lib/services/seo-pages.ts"));
const existing = await db.from("seo_pages").select("id, status").eq("slug", slug).eq("route_prefix", "/resources").maybeSingle();
if (existing.error) throw new Error(`seo_pages read failed: ${existing.error.message}`);
if (!publish) {
  console.log(existing.data ? `Would update the draft of page ${existing.data.id} and publish.` : "Would create and publish the page.");
  process.exit(0);
}
const seo = {
  title: (meta.H1 ? plain(meta.H1) : h1).slice(0, 180),
  seoTitle: meta["Meta title"],
  metaDescription: meta["Meta description"],
  targetKeyword: meta["Primary KW"]?.replace(/\s*\(.*$/, ""),
};
const page = existing.data
  ? await svc.adminSaveSeoPageDraft(existing.data.id, { draftContent: content, ...seo }, { client: db })
  : await svc.adminCreateSeoPage({ slug, routePrefix: "/resources", pageType: "resource", templateKey: "blank", draftContent: content, ...seo }, { client: db });
const { page: published } = await svc.adminPublishSeoPage(page.id, { client: db });
console.log(`Published ${published.route_path} (page ${published.id}).`);
