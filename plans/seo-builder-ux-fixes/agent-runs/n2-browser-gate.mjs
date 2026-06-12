import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const SHOTS = "plans/seo-builder-ux-fixes/agent-runs/n2-screens";
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

// Throwaway pages can accumulate immutable page_revisions on save, which block
// hard delete. Retire them the product's way: archive (excluded from active
// lists) and null the schedule so the runner never touches them.
async function retire(id) {
  const { error } = await sb.from("seo_pages").update({
    status: "archived", archived_at: new Date().toISOString(),
    archive_behavior: "not_found",
    scheduled_publish_at: null, scheduled_publish_status: "cancelled",
    scheduled_publish_locked_at: null,
  }).eq("id", id);
  // If no revisions exist, prefer a clean hard delete.
  if (!error) {
    const { data: revs } = await sb.from("page_revisions").select("id").eq("page_id", id).limit(1);
    if (!revs || revs.length === 0) {
      await sb.from("seo_pages").delete().eq("id", id);
      return "deleted";
    }
    return "archived";
  }
  return "retire-failed: " + error.message;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
const createdIds = [];

try {
  // ---- Part 1: schedule round-trip + status card + inline cancel
  const { data: created, error } = await sb.from("seo_pages").insert({
    slug: "zzz-n2-gate-scheduled", route_prefix: "/resources",
    route_path: "/resources/zzz-n2-gate-scheduled",
    title: "ZZZ N2 gate scheduled DELETE ME", status: "draft",
    seo_title: "ZZZ N2 gate scheduled", meta_description: "Throwaway N2 gate page.",
    draft_content: { version: 1, sections: [] },
  }).select("id").single();
  if (error) { log("SEED_ERR: " + error.message); throw error; }
  const id = created.id; createdIds.push(id);
  log("SEEDED_DRAFT: " + id);

  await page.goto(`${BASE}/admin/pages/${id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const skip = page.getByRole("button", { name: "Skip walkthrough" });
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(300); }

  const advBefore = page.locator("#advanced-seo-fields");
  const advWasOpen = (await advBefore.count()) ? await advBefore.evaluate((el) => el.open) : false;
  const scheduleField = page.getByLabel("Scheduled publish", { exact: true });
  log("SCHEDULE_REACHABLE_WITHOUT_ADVANCED: " + (((await scheduleField.count()) > 0) && !advWasOpen));

  const d = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T09:00`;
  await scheduleField.fill(val);
  log("SET_SCHEDULE: " + val);
  await page.getByRole("button", { name: /^Save draft/ }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/01-after-save.png` }).catch(() => {});

  await page.goto(`${BASE}/admin/pages/${id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const skip2 = page.getByRole("button", { name: "Skip walkthrough" });
  if (await skip2.count()) { await skip2.click(); await page.waitForTimeout(300); }
  log("FIELD_AFTER_RELOAD: " + await page.getByLabel("Scheduled publish", { exact: true }).inputValue().catch(() => "(not found)"));

  // Read the scheduled card by walking up from its heading to the nearest section.
  const scheduledHeading = page.getByRole("heading", { name: "Scheduled to publish" });
  log("SCHEDULED_CARD_VISIBLE: " + ((await scheduledHeading.count()) > 0));
  if (await scheduledHeading.count()) {
    const cardText = await scheduledHeading.evaluate(
      (el) => el.closest("section")?.innerText ?? "",
    );
    log("SCHEDULED_CARD_HAS_PACIFIC: " + /Pacific Time/.test(cardText));
    log("SCHEDULED_CARD_TEXT: " + cardText.replace(/\n+/g, " | ").slice(0, 240));
  }
  await page.screenshot({ path: `${SHOTS}/02-scheduled-state.png` }).catch(() => {});

  await page.getByRole("button", { name: /Cancel scheduled publish/ }).first().click();
  await page.waitForTimeout(3000);
  log("SCHEDULED_CARD_AFTER_CANCEL_VISIBLE: " + ((await page.getByRole("heading", { name: "Scheduled to publish" }).count()) > 0));
  await page.screenshot({ path: `${SHOTS}/03-after-cancel.png` }).catch(() => {});
  const { data: dbAfter } = await sb.from("seo_pages")
    .select("scheduled_publish_at,scheduled_publish_status").eq("id", id).single();
  log("DB_AFTER_CANCEL: " + JSON.stringify(dbAfter));

  // ---- Part 2: failed-state fixture
  const { data: failed, error: fErr } = await sb.from("seo_pages").insert({
    slug: "zzz-n2-gate-failed", route_prefix: "/resources",
    route_path: "/resources/zzz-n2-gate-failed",
    title: "ZZZ N2 gate failed DELETE ME", status: "draft",
    seo_title: "ZZZ N2 gate failed", meta_description: "Throwaway N2 failed page.",
    draft_content: { version: 1, sections: [] },
    scheduled_publish_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    scheduled_publish_status: "failed",
    scheduled_publish_error: "Slug already taken by a live page.",
  }).select("id").single();
  if (fErr) { log("FAILED_SEED_ERR: " + fErr.message); } else {
    createdIds.push(failed.id);
    await page.goto(`${BASE}/admin/pages/${failed.id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const skip3 = page.getByRole("button", { name: "Skip walkthrough" });
    if (await skip3.count()) { await skip3.click(); await page.waitForTimeout(300); }
    const failHeading = page.getByRole("heading", { name: "Scheduled publish failed" });
    log("FAILED_CARD_VISIBLE: " + ((await failHeading.count()) > 0));
    if (await failHeading.count()) {
      const failText = await failHeading.evaluate((el) => el.closest("section")?.innerText ?? "");
      log("FAILED_CARD_SHOWS_ERROR: " + /Slug already taken/.test(failText));
      log("FAILED_CARD_TEXT: " + failText.replace(/\n+/g, " | ").slice(0, 240));
    }
    await page.screenshot({ path: `${SHOTS}/04-failed-state.png` }).catch(() => {});
  }

  log("DONE");
} catch (e) {
  log("SCRIPT_ERROR: " + String(e.stack || e).slice(0, 500));
  await page.screenshot({ path: `${SHOTS}/99-error.png` }).catch(() => {});
} finally {
  await browser.close();
  for (const cid of createdIds) log(`CLEANUP ${cid} -> ${await retire(cid)}`);
  fs.writeFileSync(`${SHOTS}/../n2-browser-gate.log`, out.join("\n"));
}
