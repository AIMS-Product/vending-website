import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const SHOTS = "plans/seo-builder-ux-fixes/agent-runs/n4-screens";
fs.mkdirSync(SHOTS, { recursive: true });
const env = fs.readFileSync(".env.local", "utf8");
const v = (k) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null;
};
const sb = createClient(v("NEXT_PUBLIC_SUPABASE_URL"), v("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
const out = [];
const log = (m) => { out.push(m); console.log(m); };

async function retire(id) {
  await sb.from("seo_pages").update({
    status: "archived", archived_at: new Date().toISOString(),
    archive_behavior: "not_found", published_revision_id: null,
  }).eq("id", id);
  const { data: revs } = await sb.from("page_revisions").select("id").eq("page_id", id).limit(1);
  if (!revs || revs.length === 0) {
    const { error } = await sb.from("seo_pages").delete().eq("id", id);
    return error ? "archived" : "deleted";
  }
  return "archived";
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
const createdIds = [];

try {
  const { data: created, error } = await sb.from("seo_pages").insert({
    slug: "zzz-n4-autosave-throwaway", route_prefix: "/resources",
    route_path: "/resources/zzz-n4-autosave-throwaway",
    title: "ZZZ N4 autosave throwaway DELETE ME", status: "draft",
    seo_title: "ZZZ N4 autosave", meta_description: "Throwaway page for N4 autosave-failure verification.",
    draft_content: { version: 1, sections: [] },
  }).select("id").single();
  if (error) { log("SEED_ERR: " + error.message); throw error; }
  const id = created.id; createdIds.push(id);
  log("SEEDED_DRAFT: " + id);

  await page.goto(`${BASE}/admin/pages/${id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const skip = page.getByRole("button", { name: "Skip walkthrough" });
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(300); }

  // --- Failure: block the autosave Server Action (POST to the editor route),
  // then edit a field so an autosave fires and fails.
  let blockAutosave = true;
  await page.route(`${BASE}/admin/pages/${id}`, (route) => {
    if (route.request().method() === "POST" && blockAutosave) {
      return route.abort("failed");
    }
    return route.continue();
  });

  await page.getByLabel("Page title", { exact: true }).fill("ZZZ N4 autosave throwaway DELETE ME edited");
  // Wait for debounce (1200ms) + first attempt to fail.
  await page.waitForTimeout(3500);
  const errorIndicator = page.getByText(/Couldn'?t save/i).first();
  const failVisible = (await errorIndicator.count()) > 0;
  log("FAILURE_INDICATOR_VISIBLE: " + failVisible);
  if (failVisible) log("FAILURE_TEXT: " + (await errorIndicator.first().innerText()).replace(/\n/g, " ").slice(0, 120));
  await page.screenshot({ path: `${SHOTS}/01-autosave-failure.png` }).catch(() => {});

  // --- Recovery: stop blocking; a backoff retry (2s/5s/10s) should succeed,
  // OR nudge another edit to trigger a fresh attempt.
  blockAutosave = false;
  await page.waitForTimeout(6000); // allow a backoff retry to land
  let recovered = (await page.getByText(/Autosaved|Saved automatically/i).count()) > 0;
  if (!recovered) {
    // Nudge a fresh edit to force a new attempt now that the network is back.
    await page.getByLabel("Page title", { exact: true }).fill("ZZZ N4 autosave throwaway DELETE ME recovered");
    await page.waitForTimeout(3000);
    recovered = (await page.getByText(/Autosaved|Saved automatically/i).count()) > 0;
  }
  log("RECOVERED_INDICATOR_VISIBLE: " + recovered);
  log("FAILURE_GONE_AFTER_RECOVERY: " + ((await page.getByText(/Couldn'?t save/i).count()) === 0));
  await page.screenshot({ path: `${SHOTS}/02-recovered.png` }).catch(() => {});

  // --- Toast dedupe: one "Draft saved"-style toast per manual save.
  await page.getByRole("button", { name: /^Save draft/ }).first().click();
  await page.waitForTimeout(2500);
  const toastCount = await page.getByRole("status").filter({ hasText: /saved/i }).count();
  const alertCount = await page.getByRole("alert").filter({ hasText: /saved/i }).count();
  log("SAVED_TOAST_COUNT: " + (toastCount + alertCount));
  await page.screenshot({ path: `${SHOTS}/03-manual-save-toast.png` }).catch(() => {});

  log("DONE");
} catch (e) {
  log("SCRIPT_ERROR: " + String(e.stack || e).slice(0, 500));
  await page.screenshot({ path: `${SHOTS}/99-error.png` }).catch(() => {});
} finally {
  await browser.close();
  for (const cid of createdIds) log(`CLEANUP ${cid} -> ${await retire(cid)}`);
  const { data: live } = await sb.from("seo_pages").select("id,status").eq("slug", "zzz-n4-autosave-throwaway").neq("status", "archived");
  log("ACTIVE_THROWAWAY_REMAINING: " + JSON.stringify(live));
  fs.writeFileSync(`${SHOTS}/../n4-browser-gate.log`, out.join("\n"));
}
