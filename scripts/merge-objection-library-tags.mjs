#!/usr/bin/env node
/**
 * Merge the Objection Library's hand-made objection + ICP tags onto the
 * written case studies, joining on YouTube video id.
 *
 * The library (a separate Supabase project) is the system of record for
 * "which objection does this story kill" and "which ICP is this". Someone
 * tagged all 24 videos there by hand. 23 of them are the same people as our
 * written case studies, so those tags are inherited rather than re-derived.
 *
 * ADD-ONLY, by design. It never removes a tag and never touches any other
 * column, so an editor's work in /admin survives a re-run. Matching is by
 * `video_id`; a case study with no library video is left alone.
 *
 *   node scripts/merge-objection-library-tags.mjs           # dry-run, prints a table
 *   node scripts/merge-objection-library-tags.mjs --write   # writes data/case-studies/*.json
 *   node scripts/merge-objection-library-tags.mjs --write --db  # also patches Supabase
 */

import fs from "node:fs/promises";
import path from "node:path";

const CONTENT_DIR = "data/case-studies";

// Public read-only credentials, lifted from the library's own client bundle.
// Read-only use here; nothing in this script writes to the library.
const LIBRARY_URL = "https://akqtwejnmtlpylpianub.supabase.co";
const LIBRARY_KEY = "sb_publishable_gVvze64zzuM74t3Q6ZmUgA_L15IzfZI";

/** Library display names -> our kebab tag vocabulary. */
export const OBJECTION_TAGS = {
  "Contract / Legal": "objection-contract",
  "DIY or Competitor": "objection-diy",
  "Implementation Concerns": "objection-implementation",
  "Need / Fit": "objection-need-fit",
  "Price / Budget": "objection-price",
  "ROI Skepticism": "objection-roi",
  "Spouse / Decision Maker": "objection-spouse",
  "Status Quo": "objection-status-quo",
  Timing: "objection-timing",
  "Trust / Credibility": "objection-trust",
};

export const ICP_TAGS = {
  "Blue Collar": "icp-blue-collar",
  Entrepreneur: "icp-entrepreneur",
  "Family Biz": "icp-family-biz",
  "Female VP": "icp-female",
  Investor: "icp-investor",
  "Laid Off": "icp-laid-off",
  "Leaving Corp America / W-2": "icp-leaving-w2",
  "Military / Law Enforcement": "icp-military",
  Retired: "icp-retired",
  "Serial Entrepreneur": "icp-serial-entrepreneur",
  "Stay At Home Parent": "icp-stay-at-home-parent",
  "Young Professional": "icp-young-professional",
};

/**
 * The four stories the library could not supply, tagged by hand from their own
 * body copy. Every entry carries the sentence that justifies it so a reviewer
 * can reject a line without re-reading the story.
 */
export const MANUAL_TAGS = {
  "john-and-lauren-sanchez": {
    reason: "No library video.",
    tags: {
      "objection-spouse":
        "Built with his wife Lauren after she left work to raise their kids.",
      "objection-timing":
        "Ran it alongside a personal training business and a real estate license.",
      "objection-implementation":
        "Story turns on route logistics and servicing as they added machines.",
      "icp-family-biz": "Husband-and-wife operation.",
      "icp-entrepreneur":
        "Already owned a personal training business before vending.",
      "icp-stay-at-home-parent": "Lauren was a stay-at-home mom.",
    },
  },
  "john-real-estate-agent": {
    reason: "No library video.",
    tags: {
      "objection-roi":
        "Compares vending returns against the rental properties he already owns.",
      "objection-timing":
        "Fitted around a 14-year real estate career he did not leave.",
      "objection-implementation":
        "Story covers placing and servicing machines around showings.",
      "icp-investor":
        "Owns rental properties; frames vending as another income asset.",
      "icp-entrepreneur": "Self-employed real estate agent for 14 years.",
    },
  },
  // Library gave objections for these two but left ICP empty.
  "lane-200k-per-year": {
    reason: "Library row has objections but no ICP.",
    tags: {
      "icp-blue-collar":
        "Geologist working 12-hour rotating shifts in an underground mine.",
    },
  },
  "musa-sadi": {
    reason:
      "Library row has objections but no ICP. FLAGGED — see review notes.",
    tags: {},
  },
};

export function tagsFor(video) {
  const out = [];
  for (const name of video?.objections ?? []) {
    const tag = OBJECTION_TAGS[name];
    if (tag) out.push(tag);
    else throw new Error(`Unknown objection type from library: ${name}`);
  }
  for (const name of video?.icps ?? []) {
    const tag = ICP_TAGS[name];
    if (tag) out.push(tag);
    else throw new Error(`Unknown ICP from library: ${name}`);
  }
  return out;
}

export function youtubeId(url) {
  const match = /(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/.exec(url ?? "");
  return match ? match[1] : null;
}

/** Add-only union that preserves existing order, so diffs stay readable. */
export function mergeTags(existing, incoming) {
  const seen = new Set(existing);
  return [...existing, ...incoming.filter((tag) => !seen.has(tag))];
}

async function fetchLibraryVideos() {
  const response = await fetch(
    `${LIBRARY_URL}/rest/v1/videos?select=title,url,presenter,objections,icps&limit=500`,
    {
      headers: { apikey: LIBRARY_KEY, Authorization: `Bearer ${LIBRARY_KEY}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Objection Library read failed: ${response.status}`);
  }
  return response.json();
}

export async function main(argv = process.argv.slice(2)) {
  const write = argv.includes("--write");
  const db = argv.includes("--db");

  const videos = await fetchLibraryVideos();
  const byVideoId = new Map();
  for (const video of videos) {
    const id = youtubeId(video.url);
    if (id) byVideoId.set(id, video);
  }

  const files = (await fs.readdir(CONTENT_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort();

  const rows = [];
  const matchedVideoIds = new Set();

  for (const file of files) {
    const filePath = path.join(CONTENT_DIR, file);
    const study = JSON.parse(await fs.readFile(filePath, "utf8"));
    const video = byVideoId.get(study.video_id);
    if (video) matchedVideoIds.add(study.video_id);

    const manual = MANUAL_TAGS[study.slug];
    const incoming = [
      ...(video ? tagsFor(video) : []),
      ...Object.keys(manual?.tags ?? {}),
    ];
    const before = study.tags ?? [];
    const after = mergeTags(before, incoming);
    const added = after.filter((tag) => !before.includes(tag));

    rows.push({
      slug: study.slug,
      source: video ? "library" : "manual",
      added,
      // The full desired set, not just what was new to the JSON file. The
      // database is a separate destination that drifts on its own, so it has
      // to diff against itself — using `added` here made a re-run after the
      // JSON was written silently patch nothing.
      desired: after,
      total: after.length,
      note: manual?.reason ?? null,
    });

    if (write && added.length > 0) {
      study.tags = after;
      await fs.writeFile(filePath, `${JSON.stringify(study, null, 2)}\n`);
    }
  }

  const orphans = videos.filter((v) => !matchedVideoIds.has(youtubeId(v.url)));

  report(rows, orphans);
  if (db) await patchDatabase(rows);
  if (!write) console.log("\nDry run. Nothing written. Pass --write to apply.");
  return { rows, orphans };
}

function report(rows, orphans) {
  console.log(`\n${"slug".padEnd(26)} ${"src".padEnd(8)} added  tags`);
  for (const row of rows) {
    console.log(
      `${row.slug.padEnd(26)} ${row.source.padEnd(8)} ${String(row.added.length).padStart(5)}  ${row.added.join(" ") || "-"}`,
    );
  }
  const touched = rows.filter((row) => row.added.length > 0).length;
  console.log(`\n${touched} of ${rows.length} case studies gain tags.`);
  if (orphans.length > 0) {
    console.log(`\nLibrary videos with no case study (${orphans.length}):`);
    for (const video of orphans) console.log(`  ${video.title}`);
  }
}

/**
 * Patches `tags` on the live rows. Read-modify-write per slug rather than a
 * blind upsert: the admin is the system of record for everything else on the
 * row, and this must not clobber an editor's edit.
 */
async function patchDatabase(rows) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "--db needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  let patched = 0;
  for (const row of rows) {
    if (row.desired.length === 0) continue;
    const readResponse = await fetch(
      `${url}/rest/v1/case_studies?slug=eq.${encodeURIComponent(row.slug)}&select=tags`,
      { headers },
    );
    const [existing] = await readResponse.json();
    if (!existing) {
      console.log(`  skip (not in db): ${row.slug}`);
      continue;
    }
    const next = mergeTags(existing.tags ?? [], row.desired);
    if (next.length === (existing.tags ?? []).length) continue;
    const patchResponse = await fetch(
      `${url}/rest/v1/case_studies?slug=eq.${encodeURIComponent(row.slug)}`,
      { method: "PATCH", headers, body: JSON.stringify({ tags: next }) },
    );
    if (!patchResponse.ok) {
      throw new Error(
        `PATCH ${row.slug} failed: ${patchResponse.status} ${await patchResponse.text()}`,
      );
    }
    patched += 1;
  }
  console.log(`\nDatabase: ${patched} row(s) patched.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
