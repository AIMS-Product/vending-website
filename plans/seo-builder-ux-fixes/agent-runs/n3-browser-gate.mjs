import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3001";
const SHOTS = "plans/seo-builder-ux-fixes/agent-runs/n3-screens";
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

// Retire a throwaway: archive if it has immutable revisions, else hard delete.
async function retire(id) {
  await sb.from("seo_pages").update({
    status: "archived", archived_at: new Date().toISOString(),
    archive_behavior: "not_found",
    scheduled_publish_at: null, scheduled_publish_status: "cancelled",
    scheduled_publish_locked_at: null, published_revision_id: null,
  }).eq("id", id);
  const { data: revs } = await sb.from("page_revisions").select("id").eq("page_id", id).limit(1);
  if (!revs || revs.length === 0) {
    const { error } = await sb.from("seo_pages").delete().eq("id", id);
    return error ? "archived(delete-failed:" + error.message + ")" : "deleted";
  }
  return "archived";
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
const createdIds = [];
const slug = "zzz-n3-publish-throwaway";

try {
  // Seed a publish-ready draft: a CTA conversion block + hero heading + all SEO
  // meta so there are no publish blockers.
  const { data: created, error } = await sb.from("seo_pages").insert({
    slug, route_prefix: "/resources", route_path: `/resources/${slug}`,
    title: "ZZZ N3 publish throwaway DELETE ME", status: "draft",
    seo_title: "ZZZ N3 publish throwaway", target_keyword: "vending throwaway",
    meta_description: "Throwaway page for N3 publish-success verification only, please ignore.",
    draft_content: {
      version: 1,
      sections: [{
        id: "section-n3", preset: "standard", background: "default", spacing: "standard",
        columns: [{ id: "col-n3", width: "1/1", blocks: [
          { id: "hero-n3", type: "hero", variant: "standard", props: {
            eyebrow: "", heading: "Throwaway hero heading for vending throwaway", body: "Body copy for the throwaway page used in N3 verification.",
            ctaLabel: "Start now", ctaHref: "/apply", ctaTrackingName: "n3_hero_cta", mediaSrc: "", mediaAltText: "", mediaCaption: "", proofText: "" } },
          { id: "cta-n3", type: "cta", variant: "primary", props: {
            label: "Get the vending throwaway guide", href: "/apply", trackingName: "n3_cta" } },
        ] }],
      }],
    },
  }).select("id").single();
  if (error) { log("SEED_ERR: " + error.message); throw error; }
  const id = created.id; createdIds.push(id);
  log("SEEDED_DRAFT: " + id);

  await page.goto(`${BASE}/admin/pages/${id}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1800);
  const skip = page.getByRole("button", { name: "Skip walkthrough" });
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(300); }

  // Confirm publish is NOT blocked (no blocker checklist), then publish.
  const publishBtn = page.getByRole("button", { name: "Publish", exact: true }).first();
  log("PUBLISH_DISABLED_BEFORE: " + await publishBtn.getAttribute("aria-disabled"));
  await page.screenshot({ path: `${SHOTS}/01-ready-to-publish.png` }).catch(() => {});

  // Click Publish -> confirm card appears (INVARIANT: confirm before publish).
  await publishBtn.click();
  await page.waitForTimeout(400);
  const confirm1 = page.getByRole("alertdialog", { name: /Confirm publish/i });
  log("CONFIRM_CARD_BEFORE_FIRST_PUBLISH: " + ((await confirm1.count()) > 0));
  await page.screenshot({ path: `${SHOTS}/02-confirm-card.png` }).catch(() => {});

  // Confirm -> publish.
  await page.getByRole("button", { name: "Confirm publish" }).click();
  await page.waitForTimeout(4000); // publish + refresh + poll

  // Confirm card gone; success block present.
  log("CONFIRM_CARD_AFTER_PUBLISH: " + ((await page.getByRole("alertdialog", { name: /Confirm publish/i }).count()) > 0));
  const successHeading = page.getByRole("heading", { name: "Published" });
  log("SUCCESS_BLOCK_VISIBLE: " + ((await successHeading.count()) > 0));
  await page.screenshot({ path: `${SHOTS}/03-success-block.png` }).catch(() => {});

  // Wait for the live link to resolve (poll backoff up to ~12s).
  const openLive = page.getByRole("link", { name: "Open live page" });
  let linkAppeared = false;
  for (let i = 0; i < 12; i++) {
    if (await openLive.count()) { linkAppeared = true; break; }
    await page.waitForTimeout(1500);
  }
  log("OPEN_LIVE_LINK_APPEARED: " + linkAppeared);
  if (linkAppeared) {
    const href = await openLive.getAttribute("href");
    log("OPEN_LIVE_HREF: " + href);
    // Verify it actually resolves 200.
    const resp = await page.request.get(`${BASE}${href}`);
    log("OPEN_LIVE_STATUS: " + resp.status());
  }
  await page.screenshot({ path: `${SHOTS}/04-live-link.png` }).catch(() => {});

  // Re-publish must require a FRESH confirm (confirm not still armed).
  const publishBtn2 = page.getByRole("button", { name: /^Publish/ }).filter({ hasNotText: "status" }).first();
  // The page is now published; the button label is "Publish changes".
  const republishBtn = page.getByRole("button", { name: "Publish changes", exact: true }).first();
  const btn = (await republishBtn.count()) ? republishBtn : publishBtn2;
  log("CONFIRM_ARMED_BEFORE_RECLICK: " + ((await page.getByRole("alertdialog", { name: /Confirm publish/i }).count()) > 0));
  await btn.click();
  await page.waitForTimeout(400);
  log("CONFIRM_CARD_AFTER_RECLICK: " + ((await page.getByRole("alertdialog", { name: /Confirm publish/i }).count()) > 0));
  await page.screenshot({ path: `${SHOTS}/05-fresh-confirm.png` }).catch(() => {});

  log("DONE");
} catch (e) {
  log("SCRIPT_ERROR: " + String(e.stack || e).slice(0, 500));
  await page.screenshot({ path: `${SHOTS}/99-error.png` }).catch(() => {});
} finally {
  await browser.close();
  // Unpublish + retire so nothing junk stays live on prod.
  for (const cid of createdIds) {
    const unp = await sb.from("seo_pages")
      .update({ status: "draft", published_at: null, published_content: null })
      .eq("id", cid);
    if (unp.error) log(`UNPUBLISH ${cid} -> ${unp.error.message}`);
    log(`CLEANUP ${cid} -> ${await retire(cid)}`);
  }
  // Confirm no live throwaway remains.
  const { data: live } = await sb.from("seo_pages").select("id,slug,status").eq("slug", slug).neq("status", "archived");
  log("ACTIVE_THROWAWAY_REMAINING: " + JSON.stringify(live));
  fs.writeFileSync(`${SHOTS}/../n3-browser-gate.log`, out.join("\n"));
}
