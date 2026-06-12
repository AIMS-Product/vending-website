import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs
  .readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((a, l) => {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) a[m[1]] = m[2].replace(/^["']|["']$/g, "").replace(/\\n$/, "");
    return a;
  }, {});

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const PROBE_PAGE_ID = process.argv[2]; // existing residue page that holds a publish row
const emptyContent = { version: 1, sections: [] };

async function makePage(slug) {
  const { data, error } = await sb
    .from("seo_pages")
    .insert({
      slug,
      route_prefix: "/resources",
      route_path: `/resources/${slug}`,
      title: `N9 proof ${slug}`,
      status: "draft",
      draft_content: emptyContent,
      structured_data_settings: { breadcrumb: true, faq: true },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function insertRevision(pageId, type, i) {
  const createdAt = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
  const { data, error } = await sb
    .from("page_revisions")
    .insert({
      page_id: pageId,
      revision_type: type,
      label: `${type} #${i}`,
      content_snapshot: emptyContent,
      seo_snapshot: {},
      created_at: createdAt,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;
  return data;
}

async function manualSave(pageId) {
  const { data } = await sb
    .from("page_revisions")
    .select("id, label, created_at")
    .eq("page_id", pageId)
    .eq("revision_type", "manual_save")
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function countType(pageId, type) {
  const { count } = await sb
    .from("page_revisions")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId)
    .eq("revision_type", type);
  return count ?? 0;
}

async function prune(pageId, keep) {
  const { data, error } = await sb.rpc(
    "prune_seo_page_manual_save_revisions",
    { p_page_id: pageId, p_keep: keep },
  );
  if (error) throw error;
  return data;
}

const out = {};
try {
  // ---- A. ordering + keep-20 on a fresh manual_save-only page ----
  const pageA = await makePage(`n9-order-${Date.now()}`);
  const ids = [];
  for (let i = 1; i <= 22; i++) ids.push((await insertRevision(pageA, "manual_save", i)).id);
  out.A_before = (await manualSave(pageA)).length;
  out.A_pruned = await prune(pageA, 20);
  const aAfter = await manualSave(pageA);
  out.A_after = aAfter.length;
  out.A_oldest_two_deleted = !aAfter.some((r) => r.id === ids[0] || r.id === ids[1]);
  out.A_newest_kept_label = aAfter[0]?.label; // should be "manual_save #22"

  // ---- B. page-scoping: a second page is untouched by pruning pageA ----
  const pageB = await makePage(`n9-scope-${Date.now()}`);
  for (let i = 1; i <= 3; i++) await insertRevision(pageB, "manual_save", i);
  await prune(pageA, 20); // prune A again
  out.B_pageB_manual_save_after_pruning_A = (await manualSave(pageB)).length; // expect 3

  // ---- C. type-scoping on the existing residue probe page ----
  // Probe page already holds 1 publish revision (undeletable). Add manual_save,
  // prune, prove publish survives and manual_save is capped.
  if (PROBE_PAGE_ID) {
    for (let i = 1; i <= 22; i++) await insertRevision(PROBE_PAGE_ID, "manual_save", i);
    out.C_publish_before = await countType(PROBE_PAGE_ID, "publish");
    out.C_manual_before = (await manualSave(PROBE_PAGE_ID)).length;
    out.C_pruned = await prune(PROBE_PAGE_ID, 20);
    out.C_publish_after = await countType(PROBE_PAGE_ID, "publish"); // unchanged
    out.C_manual_after = (await manualSave(PROBE_PAGE_ID)).length; // 20
  }

  // ---- TEARDOWN: clear all manual_save we created (keep=0), delete clean pages ----
  await prune(pageA, 0);
  await prune(pageB, 0);
  if (PROBE_PAGE_ID) await prune(PROBE_PAGE_ID, 0);
  out.teardown_pageA_manual = (await manualSave(pageA)).length; // 0
  out.teardown_pageB_manual = (await manualSave(pageB)).length; // 0
  const delA = await sb.from("seo_pages").delete().eq("id", pageA).select("id");
  const delB = await sb.from("seo_pages").delete().eq("id", pageB).select("id");
  out.teardown_deleted_pageA = (delA.data ?? []).length === 1;
  out.teardown_deleted_pageB = (delB.data ?? []).length === 1;
  out.note_probe_residue = PROBE_PAGE_ID
    ? `probe page ${PROBE_PAGE_ID} still holds its original publish revision (undeletable from JS by the no-delete trigger)`
    : "no probe page used";

  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  console.error("PROOF_ERROR:", e);
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = 1;
}
