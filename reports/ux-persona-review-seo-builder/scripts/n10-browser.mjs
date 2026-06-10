import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

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

const BASE = "http://localhost:3001";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n10-screens");
fs.mkdirSync(SHOTS, { recursive: true });

const sourceSlug = `n10-source-${Date.now()}`;
const content = { version: 1, sections: [] };
const createdIds = [];
const log = [];

async function slugOf(id) {
  const { data } = await sb
    .from("seo_pages")
    .select("slug, route_path")
    .eq("id", id)
    .maybeSingle();
  return data;
}

async function newestCopyId(baseSlug) {
  // The duplicate action redirects to /admin/pages/<newId>; we also confirm via DB.
  const { data } = await sb
    .from("seo_pages")
    .select("id, slug, created_at")
    .like("slug", `${baseSlug}-copy%`)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0];
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});

async function duplicateFromList(pageId, shotName) {
  await page.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle", timeout: 60000 });
  // Each row's actions live in a <details> menu (a "more" summary toggle).
  // Find the row's PageActionsMenu by the duplicate form it contains, open the
  // enclosing <details>, then click "Duplicate page" → "Confirm".
  // Two variants render per page (table + card); pick the VISIBLE menu.
  const menus = page.locator(
    `details:has(form:has(input[name="id"][value="${pageId}"]):has(button:has-text("Duplicate page")))`,
  );
  const count = await menus.count();
  let opened = false;
  for (let i = 0; i < count; i++) {
    const details = menus.nth(i);
    const summary = details.locator("summary").first();
    if (await summary.isVisible()) {
      await summary.scrollIntoViewIfNeeded();
      await summary.click();
      opened = true;
      break;
    }
  }
  if (!opened) throw new Error(`no visible actions menu for ${pageId}`);
  const dupButton = page
    .locator(
      `details[open]:has(input[name="id"][value="${pageId}"]) button:has-text("Duplicate page")`,
    )
    .first();
  await dupButton.waitFor({ state: "visible", timeout: 15000 });
  await dupButton.click();
  // Confirm dialog is portaled to <body>; wait for it explicitly.
  const confirm = page.getByRole("button", { name: "Confirm" });
  await confirm.waitFor({ state: "visible", timeout: 10000 });
  log.push(`URL before confirm: ${page.url()}`);
  await Promise.all([
    page.waitForURL((u) => /\/admin\/pages\/[0-9a-f-]{36}/.test(u.toString()), {
      timeout: 30000,
    }).catch(() => {}),
    confirm.click(),
  ]);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  log.push(`URL after confirm: ${page.url()}`);
  await page.screenshot({ path: path.join(SHOTS, shotName), fullPage: true });
}

try {
  const { data: src, error } = await sb
    .from("seo_pages")
    .insert({
      slug: sourceSlug,
      route_prefix: "/resources",
      route_path: `/resources/${sourceSlug}`,
      title: "N10 Source Page",
      status: "draft",
      page_type: "resource",
      template_key: "blank",
      draft_content: content,
      structured_data_settings: { breadcrumb: true, faq: true },
    })
    .select("id")
    .single();
  if (error) throw error;
  createdIds.push(src.id);
  log.push(`source page ${src.id} slug=${sourceSlug}`);

  // ---- Duplicate #1: expect {source}-copy ----
  await duplicateFromList(src.id, "01-duplicate-1.png");
  const copy1 = await newestCopyId(sourceSlug);
  if (copy1) createdIds.push(copy1.id);
  log.push(`after duplicate #1: new slug = ${copy1?.slug} (expect ${sourceSlug}-copy)`);

  // ---- Duplicate #2: duplicate the DUPLICATE → expect {source}-copy-2 ----
  if (copy1) {
    await duplicateFromList(copy1.id, "02-duplicate-2.png");
    const copy2 = await newestCopyId(sourceSlug);
    if (copy2 && copy2.id !== copy1.id) createdIds.push(copy2.id);
    log.push(`after duplicate #2 (of the duplicate): new slug = ${copy2?.slug} (expect ${sourceSlug}-copy-2)`);
  }

  // Final state snapshot of all n10 pages
  const { data: all } = await sb
    .from("seo_pages")
    .select("slug")
    .like("slug", `${sourceSlug}%`)
    .order("created_at", { ascending: true });
  log.push(`all n10 slugs: ${JSON.stringify((all ?? []).map((r) => r.slug))}`);
  log.push(`console errors: ${JSON.stringify(errors)}`);
} catch (e) {
  log.push(`BROWSER_ERROR: ${String(e)}`);
  await page.screenshot({ path: path.join(SHOTS, "zz-error.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  // TEARDOWN: delete every throwaway page we created (drafts, no revisions).
  const deleted = [];
  for (const id of createdIds) {
    const del = await sb.from("seo_pages").delete().eq("id", id).select("id");
    if ((del.data ?? []).length === 1) deleted.push(id);
  }
  // sweep any stragglers by slug prefix
  const { data: strays } = await sb
    .from("seo_pages")
    .select("id")
    .like("slug", `${sourceSlug}%`);
  for (const s of strays ?? []) {
    await sb.from("seo_pages").delete().eq("id", s.id);
  }
  const { data: remaining } = await sb
    .from("seo_pages")
    .select("slug")
    .like("slug", `${sourceSlug}%`);
  log.push(`teardown deleted ${deleted.length} pages; remaining n10 pages: ${JSON.stringify((remaining ?? []).map((r) => r.slug))}`);
  console.log(log.join("\n"));
}
