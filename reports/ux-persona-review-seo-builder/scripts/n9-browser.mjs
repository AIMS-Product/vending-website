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
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n9-screens");
fs.mkdirSync(SHOTS, { recursive: true });

const slug = `n9-browser-${Date.now()}`;
const content = {
  version: 1,
  sections: [
    {
      id: "s1",
      preset: "standard",
      background: "default",
      spacing: "standard",
      columns: [
        {
          id: "c1",
          width: "full",
          blocks: [
            { id: "b1", type: "heading", level: 2, text: "N9 browser proof" },
          ],
        },
      ],
    },
  ],
};

let pageId;
const log = [];
async function manualSaveCount() {
  const { count } = await sb
    .from("page_revisions")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId)
    .eq("revision_type", "manual_save");
  return count ?? 0;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 300));
});

try {
  const { data: created, error } = await sb
    .from("seo_pages")
    .insert({
      slug,
      route_prefix: "/resources",
      route_path: `/resources/${slug}`,
      title: "N9 Browser Proof",
      status: "draft",
      draft_content: content,
      structured_data_settings: { breadcrumb: true, faq: true },
    })
    .select("id")
    .single();
  if (error) throw error;
  pageId = created.id;
  log.push(`created throwaway draft ${pageId}`);
  log.push(`manual_save before any save: ${await manualSaveCount()}`);

  async function clickSaveDraft(n) {
    await page.goto(`${BASE}/admin/pages/${pageId}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    const saveBtn = page
      .locator('button[type="submit"][name="intent"][value="save"]')
      .first();
    await saveBtn.waitFor({ state: "visible", timeout: 20000 });
    await saveBtn.click();
    // Saving either redirects (?saved=1) or re-renders; wait for the network to settle.
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    log.push(`after manual save #${n}: manual_save rows = ${await manualSaveCount()}`);
    await page.screenshot({
      path: path.join(SHOTS, `0${n}-after-save-${n}.png`),
      fullPage: true,
    });
  }

  await clickSaveDraft(1);
  await clickSaveDraft(2);

  // Verify the revisions panel surfaces "Manual save" entries.
  await page.goto(`${BASE}/admin/pages/${pageId}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  const manualLabelCount = await page.getByText("Manual save", { exact: false }).count();
  log.push(`revision panel "Manual save" labels visible: ${manualLabelCount}`);
  await page.screenshot({
    path: path.join(SHOTS, "03-revisions-panel.png"),
    fullPage: true,
  });

  log.push(`DB manual_save rows final: ${await manualSaveCount()}`);
  log.push(`console errors: ${JSON.stringify(errors)}`);
} catch (e) {
  log.push(`BROWSER_ERROR: ${String(e)}`);
  await page.screenshot({ path: path.join(SHOTS, "zz-error.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  // TEARDOWN: only manual_save rows exist (created via the editor) → prune keep=0, delete page.
  if (pageId) {
    await sb.rpc("prune_seo_page_manual_save_revisions", {
      p_page_id: pageId,
      p_keep: 0,
    });
    const del = await sb.from("seo_pages").delete().eq("id", pageId).select("id");
    log.push(`teardown: manual_save now ${await manualSaveCount()}, page deleted ${(del.data ?? []).length === 1}`);
  }
  console.log(log.join("\n"));
}
