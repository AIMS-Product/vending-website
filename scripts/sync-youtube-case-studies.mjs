#!/usr/bin/env node
/**
 * Sync the Vendingpreneurs member-story YouTube playlist into the
 * `case_studies` collection.
 *
 * For every video in the playlist that has no row yet, this creates a DRAFT
 * stub carrying the video id, the title and the thumbnail. A human still
 * writes the story, the pull quote and the stats — this only removes the
 * copy-paste step and guarantees the video id is never typed by hand.
 *
 * It never overwrites editorial copy. An existing row is only touched to fill
 * a field that is still empty.
 *
 * Dry-run by default, matching scripts/import-webflow-news-drafts.mjs:
 *   node scripts/sync-youtube-case-studies.mjs
 *   node scripts/sync-youtube-case-studies.mjs --write
 *
 * Metadata source:
 *   * YOUTUBE_API_KEY set -> YouTube Data API v3 (reliable, paginated).
 *   * otherwise          -> playlist page scrape for ids + oEmbed per video
 *                           for titles. No key required, but the scrape
 *                           depends on YouTube's page shape and can break.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PLAYLIST_ID = "PL1EJfe7669LmATj9lVIM602c9sEnr5k4z";
const REPORT_PATH = "docs/case-studies/youtube-sync-report.md";

/**
 * Videos on the channel that are NOT member case studies. Sourced from the
 * case-study pack's HANDOFF-README. Keeping them out here means a re-run never
 * resurrects a stub an editor already deleted.
 */
const NOT_MEMBER_STORIES = new Set([
  "jMGaFncjZFI", // Mike + Chelsea Hoffman — founder story
  "PB5PGT2XnY4", // Mike Hoffman — founder story
  "85trHdJFSnE", // Anthony — scripted explainer, no member
  "rGtdOh0AILQ", // Mike telling Anthony's story secondhand; fsRX7K_Hg08 is Anthony's own
]);

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const videos = (await fetchPlaylistVideos(options.playlistId)).filter(
    (video) => !NOT_MEMBER_STORIES.has(video.videoId),
  );

  if (videos.length === 0) {
    throw new Error(
      "Playlist returned no videos. Refusing to continue — this is almost " +
        "always a scrape breakage or a private playlist, not an empty playlist.",
    );
  }

  const existing = await readExistingCaseStudies();
  const plan = planSync(videos, existing);

  let applied = { created: 0, updated: 0, failed: [] };
  if (options.write) applied = await applyPlan(plan);

  await fs.mkdir(path.dirname(options.reportPath), { recursive: true });
  await fs.writeFile(
    options.reportPath,
    formatReport({
      plan,
      applied,
      videos,
      mode: options.write ? "write" : "dry-run",
    }),
  );

  console.log(`playlist_videos=${videos.length}`);
  console.log(`mode=${options.write ? "write" : "dry-run"}`);
  console.log(`to_create=${plan.creates.length}`);
  console.log(`to_update=${plan.updates.length}`);
  console.log(`unchanged=${plan.unchanged.length}`);
  if (options.write) {
    console.log(`created=${applied.created}`);
    console.log(`updated=${applied.updated}`);
    console.log(`failed=${applied.failed.length}`);
  }
  console.log(`report=${options.reportPath}`);
  if (applied.failed.length > 0) process.exitCode = 1;
}

export function parseArgs(argv) {
  return {
    write: argv.includes("--write"),
    playlistId: valueAfter(argv, "--playlist") ?? PLAYLIST_ID,
    reportPath: valueAfter(argv, "--report") ?? REPORT_PATH,
  };
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchPlaylistVideos(playlistId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  return apiKey
    ? fetchViaDataApi(playlistId, apiKey)
    : fetchViaScrapeAndOembed(playlistId);
}

async function fetchViaDataApi(playlistId, apiKey) {
  const videos = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `YouTube Data API ${response.status}: ${await response.text()}`,
      );
    }
    const body = await response.json();
    for (const item of body.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      if (!videoId) continue;
      videos.push({ videoId, title: (item.snippet?.title ?? "").trim() });
    }
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);

  return dedupeByVideoId(videos);
}

async function fetchViaScrapeAndOembed(playlistId) {
  const response = await fetch(
    `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    { headers: { "accept-language": "en-US,en;q=0.9" } },
  );
  if (!response.ok) {
    throw new Error(`Playlist page returned ${response.status}`);
  }
  const ids = extractPlaylistVideoIds(await response.text());

  const videos = [];
  for (const videoId of ids) {
    // Serial on purpose: this is a handful of requests against an
    // unauthenticated endpoint, and a burst is the fastest way to get a 429.
    videos.push({ videoId, title: await fetchOembedTitle(videoId) });
  }
  return dedupeByVideoId(videos);
}

async function fetchOembedTitle(videoId) {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);
  url.searchParams.set("format", "json");
  const response = await fetch(url);
  if (!response.ok) return "";
  const body = await response.json();
  return (body.title ?? "").trim();
}

/**
 * Pulls video ids out of the playlist page in playlist order.
 *
 * YouTube embeds its state as `ytInitialData`, and every playlist entry
 * carries `"videoId":"..."`. Scanning for that in document order is far more
 * robust than walking the (frequently reshaped) renderer tree.
 */
export function extractPlaylistVideoIds(html) {
  const seen = new Set();
  const ids = [];
  for (const match of html.matchAll(/"videoId":"([A-Za-z0-9_-]{6,})"/g)) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function dedupeByVideoId(videos) {
  const seen = new Set();
  return videos.filter((video) => {
    if (seen.has(video.videoId)) return false;
    seen.add(video.videoId);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Planning (pure — this is the part worth testing)
// ---------------------------------------------------------------------------

/**
 * Decides what to do with each playlist video.
 *
 * The only field ever overwritten is one that is currently empty. Titles in
 * particular are edited for the site and must not be reset to the YouTube
 * title on the next run.
 */
export function planSync(videos, existingRows) {
  const byVideoId = new Map(
    existingRows
      .filter((row) => row.youtube_video_id)
      .map((row) => [row.youtube_video_id, row]),
  );
  const usedSlugs = new Set(existingRows.map((row) => row.slug));

  const creates = [];
  const updates = [];
  const unchanged = [];

  for (const video of videos) {
    const row = byVideoId.get(video.videoId);

    if (!row) {
      const slug = uniqueSlug(
        slugFromTitle(video.title || video.videoId),
        usedSlugs,
      );
      usedSlugs.add(slug);
      creates.push({
        slug,
        title: video.title || "Untitled member story",
        // Deliberately a placeholder an editor must replace: we cannot infer a
        // member's name from a video title without guessing, and a guessed
        // name on a testimonial page is worse than an obvious blank.
        member_name: "TBC",
        youtube_video_id: video.videoId,
        body: "",
        status: "draft",
      });
      continue;
    }

    const patch = {};
    if (!row.title?.trim() && video.title) patch.title = video.title;
    if (Object.keys(patch).length > 0) {
      updates.push({ id: row.id, slug: row.slug, patch });
    } else {
      unchanged.push({ id: row.id, slug: row.slug });
    }
  }

  return { creates, updates, unchanged };
}

export function slugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .slice(0, 8)
    .join("-");
  return slug || "member-story";
}

export function uniqueSlug(base, taken) {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

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

async function readExistingCaseStudies() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("case_studies")
    .select("id, slug, title, youtube_video_id");
  if (error) throw error;
  return data ?? [];
}

async function applyPlan(plan) {
  const supabase = createServiceClient();
  const failed = [];
  let created = 0;
  let updated = 0;

  for (const row of plan.creates) {
    const { error } = await supabase.from("case_studies").insert(row);
    if (error)
      failed.push({ slug: row.slug, action: "create", error: error.message });
    else created += 1;
  }

  for (const entry of plan.updates) {
    const { error } = await supabase
      .from("case_studies")
      .update(entry.patch)
      .eq("id", entry.id);
    if (error)
      failed.push({ slug: entry.slug, action: "update", error: error.message });
    else updated += 1;
  }

  return { created, updated, failed };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function formatReport({ plan, applied, videos, mode }) {
  const lines = [
    "# YouTube case-study sync",
    "",
    `Mode: ${mode}`,
    `Playlist videos considered: ${videos.length}`,
    `Metadata source: ${process.env.YOUTUBE_API_KEY ? "YouTube Data API" : "playlist scrape + oEmbed"}`,
    "",
    `## Created (${plan.creates.length})`,
    "",
  ];
  for (const row of plan.creates) {
    lines.push(`- \`${row.slug}\` — ${row.youtube_video_id} — ${row.title}`);
  }
  lines.push("", `## Updated (${plan.updates.length})`, "");
  for (const entry of plan.updates) {
    lines.push(`- \`${entry.slug}\` — ${Object.keys(entry.patch).join(", ")}`);
  }
  lines.push("", `## Unchanged (${plan.unchanged.length})`, "");
  if (applied.failed.length > 0) {
    lines.push("", `## Failed (${applied.failed.length})`, "");
    for (const failure of applied.failed) {
      lines.push(`- \`${failure.slug}\` (${failure.action}): ${failure.error}`);
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
