#!/usr/bin/env node
/**
 * Import the written case studies in `data/case-studies/` into the
 * `case_studies` collection.
 *
 * Every row lands as a DRAFT. The revenue figures in these stories are what
 * members said out loud in an interview and have not been audited, so nothing
 * goes live until someone at Vendingpreneurs has checked it and pressed
 * publish in the admin.
 *
 * Re-runnable. Matching is by slug. An existing row is only overwritten when
 * `--overwrite` is passed, so a re-run cannot silently discard an edit made in
 * the admin.
 *
 *   node scripts/import-case-studies.mjs            # dry-run
 *   node scripts/import-case-studies.mjs --write
 *   node scripts/import-case-studies.mjs --write --overwrite
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const CONTENT_DIR = "data/case-studies";
const REPORT_PATH = "docs/case-studies/import-report.md";

const REQUIRED_FIELDS = ["slug", "video_id", "title", "member_name", "body"];
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const entries = await readContentFiles(options.contentDir);
  const { valid, invalid } = validateEntries(entries);

  if (invalid.length > 0) {
    for (const problem of invalid) console.error(`invalid: ${problem}`);
    throw new Error(
      `${invalid.length} content file(s) failed validation. Nothing was written.`,
    );
  }

  const existingSlugs = options.write
    ? new Set((await readExistingSlugs()).map((row) => row.slug))
    : new Set();

  const entriesToImport = valid.map(toImportEntry);
  let applied = { inserted: 0, updated: 0, skipped: 0, failed: [] };
  if (options.write) {
    applied = await applyRows(
      entriesToImport.map((entry) => entry.row),
      existingSlugs,
      options.overwrite,
    );
  }

  await fs.mkdir(path.dirname(options.reportPath), { recursive: true });
  await fs.writeFile(
    options.reportPath,
    formatReport({
      entries: entriesToImport,
      applied,
      mode: options.write ? "write" : "dry-run",
    }),
  );

  console.log(`content_files=${entries.length}`);
  console.log(`mode=${options.write ? "write" : "dry-run"}`);
  if (options.write) {
    console.log(`inserted=${applied.inserted}`);
    console.log(`updated=${applied.updated}`);
    console.log(`skipped_existing=${applied.skipped}`);
    console.log(`failed=${applied.failed.length}`);
  }
  console.log(
    `needs_review=${entriesToImport.filter((entry) => entry.reviewNotes.length > 0).length}`,
  );
  console.log(`report=${options.reportPath}`);
  if (applied.failed.length > 0) process.exitCode = 1;
}

export function parseArgs(argv) {
  return {
    write: argv.includes("--write"),
    overwrite: argv.includes("--overwrite"),
    contentDir: valueAfter(argv, "--content") ?? CONTENT_DIR,
    reportPath: valueAfter(argv, "--report") ?? REPORT_PATH,
  };
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function readContentFiles(contentDir) {
  const files = (await fs.readdir(contentDir))
    .filter((file) => file.endsWith(".json") && file !== "manifest.json")
    .sort();

  const entries = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(contentDir, file), "utf8");
    try {
      entries.push({ file, data: JSON.parse(raw) });
    } catch (error) {
      entries.push({ file, data: null, parseError: error.message });
    }
  }
  return entries;
}

/**
 * Validation is deliberately strict and runs across the whole set before
 * anything is written. A half-imported collection with one malformed row is
 * far more annoying to unpick than a run that refuses to start.
 */
export function validateEntries(entries) {
  const valid = [];
  const invalid = [];
  const seenSlugs = new Set();
  const seenVideoIds = new Set();

  for (const entry of entries) {
    const problems = [];
    if (entry.parseError) {
      invalid.push(`${entry.file}: ${entry.parseError}`);
      continue;
    }
    const data = entry.data;

    for (const field of REQUIRED_FIELDS) {
      if (!data?.[field] || String(data[field]).trim() === "") {
        problems.push(`missing ${field}`);
      }
    }
    if (data?.slug && `${data.slug}.json` !== entry.file) {
      problems.push(`slug "${data.slug}" does not match filename`);
    }
    if (data?.video_id && !VIDEO_ID_PATTERN.test(data.video_id)) {
      problems.push(`video_id "${data.video_id}" is not a bare YouTube id`);
    }
    if (data?.slug && seenSlugs.has(data.slug)) problems.push("duplicate slug");
    if (data?.video_id && seenVideoIds.has(data.video_id)) {
      problems.push("duplicate video_id");
    }
    if (data?.stats !== undefined && !isStatArray(data.stats)) {
      problems.push("stats must be an array of {label, value} strings");
    }
    if (
      data?.quote &&
      data?.body &&
      quoteIsRepeatedInBody(data.quote, data.body)
    ) {
      problems.push(
        "the pull quote is repeated as a blockquote in the body — it would " +
          "render twice on the page",
      );
    }
    for (const field of [
      "monthly_revenue_usd",
      "machine_count",
      "location_count",
      "months_to_result",
    ]) {
      const value = data?.[field];
      if (value !== undefined && value !== null && !Number.isInteger(value)) {
        problems.push(`${field} must be an integer or null`);
      }
    }

    if (problems.length > 0) {
      invalid.push(`${entry.file}: ${problems.join("; ")}`);
      continue;
    }
    seenSlugs.add(data.slug);
    seenVideoIds.add(data.video_id);
    valid.push(data);
  }

  return { valid, invalid };
}

/**
 * The pull quote renders in its own block above the story. If the same words
 * also appear as a body blockquote the visitor reads them twice, which looks
 * like a bug. Compared on letters and digits only, so punctuation cleanup
 * between the two copies does not hide the duplication.
 */
export function quoteIsRepeatedInBody(quote, body) {
  const normalize = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const normalizedQuote = normalize(quote);
  if (normalizedQuote.length < 40) return false;
  const head = normalizedQuote.slice(0, 60);

  return [...body.matchAll(/^> "?(.+?)"?$/gm)].some((match) => {
    const blockquote = normalize(match[1]);
    return blockquote === normalizedQuote || blockquote.includes(head);
  });
}

function isStatArray(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.label === "string" &&
        typeof entry.value === "string",
    )
  );
}

export function toCaseStudyRow(data) {
  return {
    slug: data.slug,
    title: data.title,
    member_name: data.member_name,
    member_role: data.member_role ?? null,
    excerpt: data.excerpt ?? null,
    youtube_video_id: data.video_id,
    quote: data.quote ?? null,
    quote_attribution: data.quote_attribution ?? data.member_name,
    body: data.body,
    stats: data.stats ?? [],
    monthly_revenue_usd: data.monthly_revenue_usd ?? null,
    machine_count: data.machine_count ?? null,
    location_count: data.location_count ?? null,
    months_to_result: data.months_to_result ?? null,
    prior_occupation: data.prior_occupation ?? null,
    location_types: normalizeList(data.location_types),
    tags: normalizeList(data.tags),
    // Left empty on purpose. The page falls back to the most recent other
    // stories, so an editor curates these only where the default is wrong.
    related_slugs: [],
    status: "draft",
  };
}

/**
 * Review notes live beside the row rather than on it. They are editorial
 * guidance for whoever publishes, not a column, and putting them on the row
 * object only invites someone to send them to Postgres.
 */
export function toImportEntry(data) {
  return {
    row: toCaseStudyRow(data),
    reviewNotes: Array.isArray(data.review_notes) ? data.review_notes : [],
  };
}

export function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const trimmed = entry.trim().toLowerCase();
    if (!trimmed || seen.has(trimmed)) return [];
    seen.add(trimmed);
    return [trimmed];
  });
}

function createServiceClient() {
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

async function readExistingSlugs() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("case_studies").select("slug");
  if (error) throw error;
  return data ?? [];
}

async function applyRows(rows, existingSlugs, overwrite) {
  const supabase = createServiceClient();
  const failed = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const columns of rows) {
    const exists = existingSlugs.has(columns.slug);

    if (exists && !overwrite) {
      skipped += 1;
      continue;
    }

    const { error } = exists
      ? await supabase
          .from("case_studies")
          .update(columns)
          .eq("slug", columns.slug)
      : await supabase.from("case_studies").insert(columns);

    if (error) {
      failed.push({ slug: columns.slug, error: error.message });
    } else if (exists) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  return { inserted, updated, skipped, failed };
}

function formatReport({ entries, applied, mode }) {
  const lines = [
    "# Case study import",
    "",
    `Mode: ${mode}`,
    `Rows: ${entries.length}`,
    "",
    "Every row is imported as a **draft**. Revenue figures are self-reported",
    "by members and have not been audited — check each story before publishing.",
    "",
    "## Needs review before publish",
    "",
  ];

  const flagged = entries.filter((entry) => entry.reviewNotes.length > 0);
  if (flagged.length === 0) {
    lines.push("_None flagged._");
  } else {
    for (const { row, reviewNotes } of flagged) {
      lines.push(`### \`${row.slug}\` — ${row.member_name}`, "");
      for (const note of reviewNotes) lines.push(`- ${note}`);
      lines.push("");
    }
  }

  lines.push("## All rows", "");
  lines.push("| Slug | Member | Video | Monthly revenue | Tags |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const { row } of entries) {
    lines.push(
      `| \`${row.slug}\` | ${row.member_name} | \`${row.youtube_video_id}\` | ${
        row.monthly_revenue_usd === null
          ? "—"
          : `$${row.monthly_revenue_usd.toLocaleString("en-US")}`
      } | ${row.tags.join(", ") || "—"} |`,
    );
  }

  if (applied.failed.length > 0) {
    lines.push("", `## Failed (${applied.failed.length})`, "");
    for (const failure of applied.failed) {
      lines.push(`- \`${failure.slug}\`: ${failure.error}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
