/**
 * Repairs calendly_bookings rows whose raw_payload has no
 * `payload.created_at` — Calendly's own record of when a call was booked.
 *
 * Every booked-on number reads that one path, so a row without it is in no
 * daily pace figure at all. Two shapes wrote rows without it:
 *
 *   - the first backfill sweep, `{ invitee, scheduledEvent }`
 *   - the chatbot embed confirmation, `{ source, inviteeUri, scheduled_event }`
 *
 * Both carry a recoverable booking time and the scheduled event, so both are
 * rewritten into the canonical shape the live webhook stores. Nothing is
 * invented: a row with no recoverable time is reported and left alone.
 *
 * The writer no longer produces either shape (see `withBookedAt` in
 * lib/services/calendly-bookings.ts); this is the one-off for rows already
 * stored.
 *
 *   node scripts/repair-calendly-booked-at.mjs           # dry run
 *   node scripts/repair-calendly-booked-at.mjs --apply
 */
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [
        line.slice(0, at).trim(),
        line
          .slice(at + 1)
          .trim()
          .replace(/^"|"$/g, ""),
      ];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};
const APPLY = process.argv.includes("--apply");
const PAGE = 1000;

/** Every row, paged: PostgREST silently caps an unordered or unpaged read. */
async function allBookings() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const url =
      `${URL}/rest/v1/calendly_bookings` +
      `?select=invitee_uri,scheduled_event_name,raw_payload` +
      `&order=invitee_uri&limit=${PAGE}&offset=${from}`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) throw new Error(`read failed: ${await response.text()}`);
    const batch = await response.json();
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The canonical raw_payload for a row that has none, or null if unrecoverable. */
function repaired(raw) {
  if (!isRecord(raw)) return null;
  if (isRecord(raw.payload) && raw.payload.created_at) return null; // already fine

  // First backfill sweep: the invitee carries its own created_at.
  if (isRecord(raw.invitee) && raw.invitee.created_at) {
    return {
      event: "invitee.created",
      created_by: "repair-calendly-booked-at",
      payload: {
        ...raw.invitee,
        invitee_scheduled_by: raw.invitee.scheduled_by ?? null,
        scheduled_event: raw.scheduledEvent ?? raw.scheduled_event ?? null,
      },
    };
  }

  // Chatbot embed confirmation: no invitee was stored, but the scheduled
  // event was, and it is created seconds before the confirmation fires.
  if (isRecord(raw.scheduled_event) && raw.scheduled_event.created_at) {
    return {
      event: "invitee.created",
      created_by: "repair-calendly-booked-at",
      payload: {
        uri: raw.inviteeUri ?? null,
        created_at: raw.scheduled_event.created_at,
        invitee_scheduled_by: null,
        scheduled_event: raw.scheduled_event,
      },
    };
  }

  return null;
}

const rows = await allBookings();
const broken = rows.filter(
  (row) => !(isRecord(row.raw_payload) && row.raw_payload?.payload?.created_at),
);
const fixable = broken
  .map((row) => ({ row, raw_payload: repaired(row.raw_payload) }))
  .filter((entry) => entry.raw_payload);

console.log(
  `${rows.length} bookings, ${broken.length} with no booked-at, ${fixable.length} recoverable`,
);
for (const { row, raw_payload } of fixable) {
  console.log(
    `  ${raw_payload.payload.created_at}  ${row.scheduled_event_name ?? "(no name)"}`,
  );
}
for (const { row } of broken.filter((entry) => !repaired(entry.raw_payload))) {
  console.log(`  UNRECOVERABLE  ${row.invitee_uri}`);
}

if (!APPLY) {
  console.log("\ndry run. re-run with --apply to write.");
  process.exit(0);
}

let written = 0;
for (const { row, raw_payload } of fixable) {
  const response = await fetch(
    `${URL}/rest/v1/calendly_bookings?invitee_uri=eq.${encodeURIComponent(row.invitee_uri)}`,
    {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ raw_payload }),
    },
  );
  if (!response.ok) throw new Error(`write failed: ${await response.text()}`);
  written += 1;
}
console.log(`\nwrote ${written} rows.`);
