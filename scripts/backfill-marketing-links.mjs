#!/usr/bin/env node
/**
 * Fill the link registry (`marketing_links`, /admin/links) with every tagged
 * link we already have evidence of, so each one shows its leads and bookings
 * next to the links built in the builder.
 *
 * Origins, best evidence first:
 *   webinar-links  vp-webinars Bitly short links, expanded by their redirect
 *   youtube        youtube_videos.bitly_url, expanded by their redirect
 *   social-posts   metricool_posts.link, followed to our own domain
 *   leads          distinct five-tag sets on lead_submissions
 *   calendly       distinct five-tag sets on calendly_bookings
 *
 * Short links expand with a plain HTTP request; no Bitly token is needed.
 * Rows are marked `created_by = 'backfill:<origin>'`, so link coverage and the
 * Channels "Going out" list ignore them, and they are trivially undone:
 *   delete from marketing_links where created_by like 'backfill:%';
 * Inserts only. Never updates or deletes an existing row, and skips any link
 * the registry already holds. Re-running adds only what is new.
 *
 *   node scripts/backfill-marketing-links.mjs            # dry run, prints the plan
 *   node scripts/backfill-marketing-links.mjs --apply    # writes
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  mergeCandidates,
  mostCommon,
  splitUrl,
  toRow,
  tupleKey,
  tupleOf,
} from "./lib/marketing-link-backfill.mjs";

const APPLY = process.argv.includes("--apply");
const planArg = process.argv.indexOf("--plan");
/** Every row the run would write, one per line, for review before --apply. */
const PLAN_FILE =
  planArg > -1
    ? process.argv[planArg + 1]
    : "marketing-links-backfill-plan.tsv";
const SITE = "https://www.vendingpreneurs.com";
const OUR_HOSTS = /(^|\.)vendingpreneurs\.(com|ai)$/;

/** Short links the webinar team publishes (vp-webinars), on Bitly's custom domain. */
const WEBINAR_SHORT_LINKS = [
  "3OG50Mx",
  "4dXHpRS",
  "adnb-booking-calendar",
  "adnb-replay",
  "adnb-sms",
  "ak-bio-live-training",
  "book-my-discovery-call",
  "dna",
  "dna-book-your-call",
  "dna-replay",
  "dna-sms-replay",
  "free-advisory-call",
  "ghl-book-meeting",
  "masterclass",
  "my-free-advisory-call",
  "postclass-booking",
  "ready-for-my-call",
  "register-for-training",
  "replay-adnb",
  "resave-seat",
  "signup-for-masterclass",
  "training-call",
  "vending-class",
  "watch-replay",
  "watch-the-replay",
  "watch-training-replay",
].map((slug) => `booking.vendingpreneurs.com/${slug}`);

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local is optional when the vars are already in the environment.
  }
  return env;
}

const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY || KEY.length < 100) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and a real SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function readAll(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
      headers: { ...headers, Range: `${from}-${from + 999}` },
    });
    if (!res.ok)
      throw new Error(`${path} read failed: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

/** Where a short link points, from its redirect. Null when it does not redirect. */
async function expand(shortUrl) {
  try {
    const res = await fetch(shortUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    return res.headers.get("location");
  } catch (error) {
    console.warn(`  could not expand ${shortUrl}: ${error.message}`);
    return null;
  }
}

/** Follows every hop (t.co and friends) to the final URL. */
async function follow(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    // Only the final URL matters; drop the body.
    await res.body?.cancel();
    return res.url;
  } catch (error) {
    console.warn(`  could not follow ${url}: ${error.message}`);
    return null;
  }
}

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

async function fromShortLinks(ids, origin, labelFor) {
  return (
    await inBatches(ids, 8, async ({ id, label, firstSeen, ownsClicks }) => {
      const shortUrl = `https://${id}`;
      const target = await expand(shortUrl);
      const split = target ? splitUrl(target) : null;
      if (!split) return null;
      return {
        origin,
        tuple: split.tuple,
        baseUrl: split.baseUrl,
        bitlyUrl: shortUrl,
        // youtube_videos already syncs its own clicks; a second owner would
        // sync them twice. The registry reads clicks by bitly_url instead.
        bitlyId: ownsClicks ? id : null,
        label: labelFor(label ?? id),
        firstSeen,
      };
    })
  ).filter(Boolean);
}

async function main() {
  console.log(
    APPLY
      ? "APPLY: writing to marketing_links"
      : "DRY RUN (pass --apply to write)",
  );

  const existing = await readAll(
    "marketing_links?select=utm_source,utm_medium,utm_campaign,utm_content,utm_term,bitly_id&order=id",
  );
  const existingKeys = new Set(existing.map((row) => tupleKey(tupleOf(row))));
  const existingBitly = new Set(
    existing.map((row) => row.bitly_id).filter(Boolean),
  );
  console.log(`registry now: ${existing.length} links`);

  const [leads, bookings, videos, posts] = await Promise.all([
    readAll(
      "lead_submissions?select=created_at,source_path,utm_source,utm_medium,utm_campaign,utm_content,utm_term&order=created_at,id",
    ),
    readAll(
      "calendly_bookings?select=created_at,scheduled_event_name,utm_source,utm_medium,utm_campaign,utm_content,utm_term&order=created_at,id",
    ),
    readAll(
      "youtube_videos?select=title,bitly_url,published_at&bitly_url=not.is.null&order=video_id",
    ),
    readAll(
      "metricool_posts?select=network,link,published_at&link=not.is.null&order=network,post_id,brand_id",
    ),
  ]);

  const candidates = [];

  // Site leads: one candidate per tag set, based on the page most of them landed on.
  const leadGroups = groupByTuple(leads);
  for (const group of leadGroups.values()) {
    // source_path is visitor-supplied; keep it short and path-shaped.
    const raw = mostCommon(group.rows.map((row) => row.source_path)) ?? "/";
    const path = /^\/[A-Za-z0-9/_.-]{0,80}$/.test(raw) ? raw : "/";
    candidates.push({
      origin: "leads",
      tuple: group.tuple,
      baseUrl: `${SITE}${path.startsWith("/") ? path : "/"}`,
      label: `Imported from site leads: landed on ${path}`,
      firstSeen: group.rows[0].created_at,
    });
  }

  // Calendly: links that booked straight onto a calendar (webinar CTAs, setters).
  for (const group of groupByTuple(bookings).values()) {
    // Calendly sees every calendar in the org, personal ones included, so a
    // tag set used for a single booking is more often a test than a link.
    if (group.rows.length < 2) continue;
    const event = mostCommon(group.rows.map((row) => row.scheduled_event_name));
    candidates.push({
      origin: "calendly",
      tuple: group.tuple,
      baseUrl: "https://calendly.com/",
      label: `Imported from Calendly bookings${event ? `: ${event}` : ""}`,
      firstSeen: group.rows[0].created_at,
    });
  }

  console.log(`expanding ${videos.length} YouTube short links...`);
  candidates.push(
    ...(await fromShortLinks(
      videos.map((video) => ({
        id: video.bitly_url.replace(/^https?:\/\//, ""),
        label: video.title,
        firstSeen: video.published_at,
        ownsClicks: false,
      })),
      "youtube",
      (title) => `Imported from YouTube: ${title}`,
    )),
  );

  console.log(`expanding ${WEBINAR_SHORT_LINKS.length} webinar short links...`);
  candidates.push(
    ...(await fromShortLinks(
      WEBINAR_SHORT_LINKS.filter((id) => !existingBitly.has(id)).map((id) => ({
        id,
        ownsClicks: true,
      })),
      "webinar-links",
      (id) => `Imported short link: ${id.split("/").at(-1)}`,
    )),
  );

  // One request per distinct URL, not per post.
  const distinctPosts = [
    ...new Map(posts.map((post) => [post.link, post])).values(),
  ];
  console.log(`following ${distinctPosts.length} social post links...`);
  const followed = await inBatches(distinctPosts, 8, async (post) => {
    const final = await follow(post.link);
    if (!final) return null;
    const split = splitUrl(final);
    if (!split || !OUR_HOSTS.test(new URL(final).hostname)) return null;
    return {
      origin: "social-posts",
      tuple: split.tuple,
      baseUrl: split.baseUrl,
      label: `Imported from a ${post.network} post`,
      firstSeen: post.published_at,
    };
  });
  candidates.push(...followed.filter(Boolean));

  const dropped = [];
  const merged = mergeCandidates(candidates, existingKeys, (candidate, why) =>
    dropped.push(`${candidate.origin} ${candidate.bitlyUrl ?? ""} ${why}`),
  );
  // Guards the unique index marketing_links_bitly_id_idx. The webinar list is
  // filtered before expansion today, but that filter may change.
  const rows = merged
    .map(toRow)
    .filter((row) => !row.bitly_id || !existingBitly.has(row.bitly_id));

  const byOrigin = {};
  for (const row of rows)
    byOrigin[row.created_by] = (byOrigin[row.created_by] ?? 0) + 1;
  console.log(`\ncandidates seen: ${candidates.length}`);
  console.log(`new links to add: ${rows.length}`, byOrigin);
  for (const row of rows.slice(0, 12)) {
    console.log(`  ${row.created_by.padEnd(22)} ${row.url}`);
  }
  for (const line of dropped) console.log(`  skipped: ${line}`);
  writeFileSync(
    PLAN_FILE,
    rows
      .map((row) => [row.created_by, row.url, row.label ?? ""].join("\t"))
      .join("\n") + "\n",
  );
  console.log(`full plan (${rows.length} rows): ${PLAN_FILE}`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with --apply to write.");
    return;
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const res = await fetch(`${URL_BASE}/rest/v1/marketing_links`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      throw new Error(
        `insert failed after ${written} rows: ${res.status} ${await res.text()}`,
      );
    }
    written += batch.length;
  }
  console.log(
    `\nwrote ${written} links. Undo: delete from marketing_links where created_by like 'backfill:%';`,
  );
}

function groupByTuple(rows) {
  const groups = new Map();
  for (const row of rows) {
    const tuple = tupleOf(row);
    const key = tupleKey(tuple);
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { tuple, rows: [row] });
  }
  return groups;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
