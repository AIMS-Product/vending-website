import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const SHOTS = "plans/seo-builder-ux-fixes/agent-runs/n12-screens";
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

async function openEditor(id) {
  await page.goto(`${BASE}/admin/pages/${id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const skip = page.getByRole("button", { name: "Skip walkthrough" });
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(300); }
}

try {
  // --- Blocked draft (blank meta + no conversion block) → "Not ready" verdict.
  const { data: blocked, error: bErr } = await sb.from("seo_pages").insert({
    slug: "zzz-n12-blocked", route_prefix: "/resources",
    route_path: "/resources/zzz-n12-blocked",
    title: "ZZZ N12 blocked DELETE ME", status: "draft",
    seo_title: "", meta_description: "",
    draft_content: { version: 1, sections: [] },
  }).select("id").single();
  if (bErr) { log("BLOCKED_SEED_ERR: " + bErr.message); throw bErr; }
  createdIds.push(blocked.id);
  await openEditor(blocked.id);

  const verdict = page.getByText(/Not ready —/i).first();
  log("VERDICT_NOT_READY_VISIBLE: " + ((await verdict.count()) > 0));
  if (await verdict.count()) {
    const verdictText = await verdict.evaluate((el) => el.closest("section")?.innerText ?? "");
    log("VERDICT_TEXT: " + verdictText.replace(/\n+/g, " | ").slice(0, 200));
    log("VERDICT_HAS_FIX_NEXT: " + /Fix next:/i.test(verdictText));
  }
  await page.screenshot({ path: `${SHOTS}/01-blocked-verdict.png` }).catch(() => {});

  // --- Tabs: roles + switch.
  const tablist = page.getByRole("tablist", { name: /SEO panel sections/i });
  log("TABLIST_PRESENT: " + ((await tablist.count()) > 0));
  const tabs = page.getByRole("tab");
  log("TAB_COUNT: " + (await tabs.count()));
  const readinessTab = page.getByRole("tab", { name: "Readiness" });
  const settingsTab = page.getByRole("tab", { name: "Settings" });
  log("READINESS_SELECTED_DEFAULT: " + (await readinessTab.getAttribute("aria-selected")));
  // Switch to Settings; the slug field (in Settings) becomes visible.
  await settingsTab.click();
  await page.waitForTimeout(300);
  log("SETTINGS_SELECTED_AFTER_CLICK: " + (await settingsTab.getAttribute("aria-selected")));
  const slugLabel = page.getByText("URL ending (slug)", { exact: true });
  log("SLUG_RELABELED_VISIBLE: " + ((await slugLabel.count()) > 0));
  const govLabel = page.getByText("Internal & social", { exact: true });
  log("GOVERNANCE_RELABELED_VISIBLE: " + ((await govLabel.count()) > 0));
  await page.screenshot({ path: `${SHOTS}/02-settings-tab.png` }).catch(() => {});

  // Arrow-key nav: focus Settings tab, ArrowLeft → Readiness selected.
  await settingsTab.focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  log("ARROW_NAV_SELECTS_READINESS: " + (await readinessTab.getAttribute("aria-selected")));

  // --- Publish button has the N14 testid.
  log("PUBLISH_TESTID_PRESENT: " + ((await page.locator('[data-testid="seo-publish-button"]').count()) > 0));

  // --- axe on the panel (blocked state).
  try {
    const results = await new AxeBuilder({ page }).include('[data-builder-walkthrough="seo"]').analyze();
    const serious = results.violations.filter((vi) => vi.impact === "serious" || vi.impact === "critical");
    log("AXE_SERIOUS_CRITICAL: " + JSON.stringify(serious.map((vi) => ({ id: vi.id, impact: vi.impact, n: vi.nodes.length }))));
  } catch (e) { log("AXE_ERROR: " + String(e.message).slice(0, 160)); }

  // --- Ready page → "Ready to publish" verdict.
  const { data: ready, error: rErr } = await sb.from("seo_pages").insert({
    slug: "zzz-n12-ready", route_prefix: "/resources",
    route_path: "/resources/zzz-n12-ready",
    title: "ZZZ N12 ready DELETE ME", status: "draft",
    seo_title: "ZZZ N12 ready page", target_keyword: "zzz n12 ready",
    meta_description: "A throwaway ready page for N12 verdict verification with a complete description.",
    draft_content: {
      version: 1,
      sections: [{
        id: "s1", preset: "standard", background: "default", spacing: "standard",
        columns: [{ id: "c1", width: "1/1", blocks: [
          { id: "h1", type: "hero", variant: "standard", props: { eyebrow: "", heading: "ZZZ N12 ready page about zzz n12 ready", body: "Plenty of supporting body copy for the ready verdict test goes right here so the page has substance.", ctaLabel: "Start", ctaHref: "/apply", ctaTrackingName: "n12_hero", mediaSrc: "", mediaAltText: "", mediaCaption: "", proofText: "" } },
          { id: "c-cta", type: "cta", variant: "primary", props: { label: "Get the zzz n12 ready guide", href: "/apply", trackingName: "n12_cta" } },
        ] }],
      }],
    },
  }).select("id").single();
  if (rErr) { log("READY_SEED_ERR: " + rErr.message); } else {
    createdIds.push(ready.id);
    await openEditor(ready.id);
    const readyVerdict = page.getByText(/Ready to publish/i).first();
    log("VERDICT_READY_VISIBLE: " + ((await readyVerdict.count()) > 0));
    if (await readyVerdict.count()) log("READY_VERDICT_TEXT: " + (await readyVerdict.evaluate((el) => el.closest("section")?.innerText ?? "")).replace(/\n+/g, " | ").slice(0, 160));
    await page.screenshot({ path: `${SHOTS}/03-ready-verdict.png` }).catch(() => {});
  }

  log("DONE");
} catch (e) {
  log("SCRIPT_ERROR: " + String(e.stack || e).slice(0, 500));
  await page.screenshot({ path: `${SHOTS}/99-error.png` }).catch(() => {});
} finally {
  await browser.close();
  for (const cid of createdIds) log(`CLEANUP ${cid} -> ${await retire(cid)}`);
  const { data: live } = await sb.from("seo_pages").select("id,status").or("slug.ilike.%zzz-n12%").neq("status", "archived");
  log("ACTIVE_THROWAWAY_REMAINING: " + JSON.stringify(live));
  fs.writeFileSync(`${SHOTS}/../n12-browser-gate.log`, out.join("\n"));
}
