// Cleanup for the N6 browser-gate throwaway rows on PROD Supabase. Deletes
// only rows whose title matches the N6 verify prefix AND that pass the same
// never-saved safety floor the production action enforces (draft, never
// published, no revisions). Run: node plans/.../n6-cleanup.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, key, { auth: { persistSession: false } });

const { data: rows, error } = await client
  .from("seo_pages")
  .select("id, title, status, published_at, published_revision_id")
  .ilike("title", "N6 % Throwaway %");

if (error) {
  console.error("[n6-cleanup] load failed", error.message);
  process.exit(1);
}

let deleted = 0;
let kept = 0;
for (const row of rows ?? []) {
  const { count } = await client
    .from("page_revisions")
    .select("id", { count: "exact", head: true })
    .eq("page_id", row.id);

  const deletable =
    row.status === "draft" &&
    row.published_at === null &&
    row.published_revision_id === null &&
    (count ?? 0) === 0;

  if (!deletable) {
    kept += 1;
    console.log(`[n6-cleanup] KEPT (protected) ${row.id} "${row.title}"`);
    continue;
  }

  const { error: delErr } = await client
    .from("seo_pages")
    .delete()
    .eq("id", row.id);
  if (delErr) {
    console.error(`[n6-cleanup] delete failed ${row.id}`, delErr.message);
    continue;
  }
  deleted += 1;
  console.log(`[n6-cleanup] DELETED ${row.id} "${row.title}"`);
}

console.log(`[n6-cleanup] done — deleted ${deleted}, kept ${kept}`);
