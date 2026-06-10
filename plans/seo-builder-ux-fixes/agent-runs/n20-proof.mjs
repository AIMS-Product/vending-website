import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";
const SHOTS = "plans/seo-builder-ux-fixes/agent-runs/n20-screens";
fs.mkdirSync(SHOTS, { recursive: true });

const TS = Date.now();
const TITLE = `N20 Proof Page ${TS}`;
const out = { ts: TS, base: BASE, publish: {}, schedule: {}, axe: [], cleanup: {}, anomalies: [] };

function rec(name) {
  return { journey: name, steps: [], friction: [] };
}
async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(SHOTS, file), timeout: 15000 }).catch(() => {});
  return file;
}
// N12 reorganized the SEO panel into Readiness/Settings tabs. Title, slug, meta,
// and the schedule field live behind the "Settings" tab; click it before
// touching those fields.
async function openSettingsTab(page) {
  // The SEO panel tabs are role="tab" (SeoPanelTabs.tsx), label "Settings".
  const tab = page.getByRole("tab", { name: /settings/i }).first();
  if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tab.click().catch(() => {});
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}
async function step(J, page, action, fn) {
  const n = J.steps.length + 1;
  let result = "ok";
  try {
    const r = await fn();
    if (typeof r === "string") result = r;
  } catch (e) {
    result = `ERROR: ${String(e.message).slice(0, 140)}`;
  }
  const screenshot = await shot(page, `${J.journey}-${String(n).padStart(2, "0")}-${action}`);
  J.steps.push({ n, action, result, screenshot });
  return result;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

let createdPageUrl = null;
let createdPageId = null;
let publicUrl = null;
let slug = null;

// ============ CREATE A FRESH PAGE (prereq for publish journey) ============
const C = rec("create");
await step(C, page, "open-pages-list", async () => {
  await page.goto(`${BASE}/admin/pages`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
});
await step(C, page, "start-building", async () => {
  await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  // N13 one-step gate: a page type is pre-selected; click "Start building page".
  const start = page.getByRole("button", { name: /start building/i }).first();
  if (!(await start.isVisible({ timeout: 4000 }).catch(() => false))) {
    throw new Error("no 'Start building page' button on new-page gate");
  }
  await start.click();
  await page.waitForTimeout(1500);
  // Editor mounts in place at /admin/pages/new (no nav). Open the Settings tab
  // (N12 tabs) so the title/slug/meta fields are visible.
  await openSettingsTab(page);
  const onEditor = await page.locator("#page-title-field").first().isVisible({ timeout: 5000 }).catch(() => false);
  return onEditor ? "editor mounted; Settings tab open" : "title field not visible after Settings tab";
});
await step(C, page, "fill-title-slug-triggers-autocreate", async () => {
  slug = `n20-proof-${TS}`;
  publicUrl = `/resources/${slug}`;
  await openSettingsTab(page);
  const pageTitle = page.locator("#page-title-field").first();
  await pageTitle.fill(TITLE);
  const slugField = page.locator("#page-slug-field").first();
  if (await slugField.isVisible({ timeout: 2000 }).catch(() => false)) {
    await slugField.fill(slug);
  }
  // Filling triggers the auto-create draft; the controller replaceState's the
  // URL to /admin/pages/{realId}. Wait for that, then capture it.
  await page.waitForURL(/\/admin\/pages\/[0-9a-f-]{36}/, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  createdPageUrl = page.url().replace(BASE, "").split("?")[0];
  // Fallback: read the hidden id input.
  if (!/\/admin\/pages\/[0-9a-f-]{36}/.test(createdPageUrl)) {
    const hiddenId = await page.locator('input[name="id"]').first().inputValue().catch(() => "");
    if (hiddenId) createdPageUrl = `/admin/pages/${hiddenId}`;
  }
  createdPageId = createdPageUrl.split("/").pop() ?? null;
  return `title='${TITLE}' slug='${slug}' -> ${createdPageUrl}`;
});
await step(C, page, "save-draft", async () => {
  await page.getByRole("button", { name: /save draft|^save$/i }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  return `url after save: ${page.url().replace(BASE, "").split("?")[0]}`;
});
out.create = C;
if (!createdPageId || !/^[0-9a-f-]{36}$/.test(createdPageId)) {
  out.anomalies.push(`create flow did not yield a real page id (got '${createdPageId}') — downstream journeys ran against a non-editor URL`);
}

// ============ PUBLISH JOURNEY ============
const P = rec("publish");
// STEP A: observe the publish panel BEFORE doing anything.
await step(P, page, "observe-blockers-upfront", async () => {
  await page.goto(`${BASE}${createdPageUrl}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  // Count blocker checklist items visible at once + verdict + fix-next links.
  const data = await page.evaluate(() => {
    const text = document.body.innerText;
    // checklist items often rendered as list items mentioning Add/Fix/Resolve
    const blockerItems = [...document.querySelectorAll("li, [data-blocker], [role='listitem']")]
      .map((el) => el.textContent?.trim() || "")
      .filter((t) => /^(Add|Fix|Resolve|Write|Choose)\b/.test(t));
    const fixLinks = [...document.querySelectorAll("a, button")]
      .map((el) => el.textContent?.trim() || "")
      .filter((t) => /^(Add|Fix|Go to|Resolve)\b/i.test(t));
    const hasVerdict = /not ready to publish|ready to publish|resolve .* (item|items)|before publishing/i.test(text);
    return {
      blockerCount: blockerItems.length,
      blockerSample: blockerItems.slice(0, 8),
      fixNextCount: fixLinks.length,
      hasVerdict,
    };
  });
  P.upfront = data;
  return `blockers visible upfront: ${data.blockerCount}; verdict=${data.hasVerdict}; fix-next links=${data.fixNextCount}`;
});
// STEP B: resolve blockers (deep links / fields)
await step(P, page, "resolve-blockers", async () => {
  const notes = [];
  for (let i = 0; i < 6; i++) {
    const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
    const disabled = (await pub.getAttribute("aria-disabled").catch(() => null)) === "true" ||
      (await pub.isDisabled().catch(() => false));
    if (!disabled) { notes.push("publish enabled"); break; }
    const blocker = ((await page.locator("text=/^(Add|Fix|Resolve|Write|Choose) /").first().textContent().catch(() => "")) || "").trim();
    notes.push(`blocker: ${blocker}`);
    if (/SEO title/i.test(blocker)) {
      await openSettingsTab(page);
      await page.locator("#seo-title-field").fill(`${TITLE} | Vendingpreneurs`).catch(() => {});
    } else if (/meta description/i.test(blocker)) {
      await openSettingsTab(page);
      await page.locator("#page-meta-description-field").fill("N20 proof meta description with enough length to satisfy the SEO readiness check for this page.").catch(() => {});
    } else if (/headline|hero|heading/i.test(blocker)) {
      const h = page.getByLabel(/^Heading|^Headline/).first();
      await h.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
      await h.fill("N20 Proof Headline").catch(() => {});
    } else if (/content|block|body/i.test(blocker)) {
      // add a rich text block via the picker trigger
      const trig = page.locator('[data-testid="block-picker-trigger"]').first();
      if (await trig.isVisible({ timeout: 2000 }).catch(() => false)) {
        await trig.click().catch(() => {});
        await page.waitForTimeout(500);
        const variant = page.locator('[data-testid="block-picker-variant"]').first();
        await variant.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    } else {
      notes.push("unknown/blank blocker; stop");
      break;
    }
    // Save draft to re-evaluate.
    await page.getByRole("button", { name: /save draft|^save$/i }).first().click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  return notes.join(" | ");
});
await step(P, page, "click-publish", async () => {
  const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
  const disabled = (await pub.getAttribute("aria-disabled").catch(() => null)) === "true";
  if (disabled) throw new Error("Publish still disabled after fixes");
  await pub.click();
  await page.waitForTimeout(800);
  return "publish clicked";
});
await step(P, page, "confirm-step", async () => {
  const confirm = page.getByRole("button", { name: /^confirm publish$/i }).first();
  if (!(await confirm.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no confirm step shown");
  await confirm.click();
  await page.waitForTimeout(3500);
  return "confirm publish clicked";
});
await step(P, page, "verify-success-block", async () => {
  const txt = await page.locator("body").innerText();
  if (!/published/i.test(txt)) throw new Error("no 'Published' success feedback after publish");
  return "Published success feedback visible";
});
await step(P, page, "open-live-page", async () => {
  const live = page.getByRole("link", { name: /Open live page|View live page/i }).first();
  if (!(await live.isVisible({ timeout: 4000 }).catch(() => false))) {
    P.friction.push("No visible 'Open live page' link after publishing");
    throw new Error("no 'Open live page' link (orig friction point)");
  }
  const popupP = context.waitForEvent("page", { timeout: 8000 }).catch(() => null);
  await live.click();
  const popup = await popupP;
  if (popup) {
    await popup.waitForLoadState("domcontentloaded").catch(() => {});
    await popup.waitForTimeout(1500);
    await shot(popup, "publish-live-tab");
    const len = (await popup.locator("body").innerText().catch(() => "")).length;
    await popup.close();
    return `live tab opened (${len} chars)`;
  }
  return "live link clicked (same tab)";
});
await step(P, page, "verify-live-200", async () => {
  const resp = await page.goto(`${BASE}${publicUrl}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const status = resp?.status();
  const txt = await page.locator("body").innerText();
  if (status !== 200) throw new Error(`live route status ${status}`);
  if (/404|not found/i.test(txt.slice(0, 300)) && txt.length < 600) throw new Error("live route looks like 404");
  return `live route 200 (${txt.length} chars)`;
});
await step(P, page, "republish-needs-fresh-confirm", async () => {
  await page.goto(`${BASE}${createdPageUrl}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  const pub = page.getByRole("button", { name: /^Publish( changes| page)?$/i }).first();
  if (!(await pub.isVisible({ timeout: 3000 }).catch(() => false))) return "no re-publish button (already published, no changes)";
  await pub.click();
  await page.waitForTimeout(600);
  const confirm = page.getByRole("button", { name: /^confirm publish$/i }).first();
  const freshConfirm = await confirm.isVisible({ timeout: 2500 }).catch(() => false);
  return freshConfirm ? "re-publish requires a fresh confirm step" : "re-publish did NOT re-prompt confirm";
});
out.publish = P;

// ============ SCHEDULE JOURNEY ============
const S = rec("schedule");
await step(S, page, "open-editor", async () => {
  await page.goto(`${BASE}${createdPageUrl}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
});
await step(S, page, "schedule-control-reachable-without-advanced", async () => {
  // The schedule field lives on the Settings tab. The original failure was that
  // it was buried inside the "Advanced SEO" <details>. Check it is NOT inside
  // that accordion (i.e. reachable without expanding Advanced).
  await openSettingsTab(page);
  const field = page.locator("input[name='scheduledPublishAt'], input[type='datetime-local']").first();
  const visibleAfterSettings = await field.isVisible({ timeout: 3000 }).catch(() => false);
  const inAdvanced = await page.evaluate(() => {
    const f = document.querySelector("input[name='scheduledPublishAt'], input[type='datetime-local']");
    if (!f) return null;
    const det = f.closest("details");
    if (!det) return false;
    const sum = det.querySelector("summary")?.textContent || "";
    return /advanced/i.test(sum);
  });
  S.scheduleReachable = { visibleOnSettingsTab: visibleAfterSettings, insideAdvancedDetails: inAdvanced };
  return `schedule field visible on Settings tab: ${visibleAfterSettings}; inside Advanced <details>: ${inAdvanced}`;
});
await step(S, page, "set-schedule", async () => {
  await openSettingsTab(page);
  const field = page.locator("input[name='scheduledPublishAt'], input[type='datetime-local']").first();
  await field.scrollIntoViewIfNeeded({ timeout: 6000 }).catch(() => {});
  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000);
  const v = `${tomorrow.toISOString().slice(0, 10)}T12:00`;
  await field.fill(v);
  S.scheduledValue = v;
  return `filled ${v}`;
});
await step(S, page, "save-schedule", async () => {
  await page.getByRole("button", { name: /save draft|^save$/i }).first().click();
  await page.waitForTimeout(3000);
});
await step(S, page, "verify-scheduled-indicator", async () => {
  const txt = await page.locator("body").innerText();
  const hasScheduled = /Scheduled to publish|Scheduled for|Scheduled/i.test(txt);
  const hasPacific = /Pacific|PT|PDT|PST/i.test(txt);
  if (!hasScheduled) throw new Error("no 'Scheduled' indicator after saving");
  S.scheduledIndicatorPacific = hasPacific;
  return `scheduled indicator present; Pacific-labelled=${hasPacific}`;
});
await step(S, page, "reload-persists", async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await openSettingsTab(page);
  const field = page.locator("input[name='scheduledPublishAt'], input[type='datetime-local']").first();
  const val = await field.inputValue().catch(() => "");
  const txt = await page.locator("body").innerText();
  const stillScheduled = /Scheduled/i.test(txt);
  if (!val && !stillScheduled) throw new Error("schedule did not persist across reload");
  return `after reload: field='${val}'; indicator=${stillScheduled}`;
});
await step(S, page, "cancel-schedule", async () => {
  const cancel = page.getByRole("button", { name: /Cancel scheduled publish|Cancel schedule/i }).first();
  const cancelLink = page.getByText(/Cancel scheduled publish/i).first();
  if (await cancel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cancel.click();
  } else if (await cancelLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cancelLink.click();
  } else {
    throw new Error("no inline Cancel scheduled publish control");
  }
  await page.waitForTimeout(2500);
  // may require a save
  const save = page.getByRole("button", { name: /save draft|^save$/i }).first();
  if (await save.isVisible({ timeout: 1500 }).catch(() => false)) { await save.click(); await page.waitForTimeout(2500); }
  return "cancel triggered";
});
await step(S, page, "verify-cleared", async () => {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await openSettingsTab(page);
  const field = page.locator("input[name='scheduledPublishAt'], input[type='datetime-local']").first();
  const val = await field.inputValue().catch(() => "");
  const txt = await page.locator("body").innerText();
  const stillScheduled = /Scheduled to publish|Scheduled for/i.test(txt);
  if (val || stillScheduled) throw new Error(`schedule not cleared (field='${val}', indicator=${stillScheduled})`);
  return "schedule visibly cleared after cancel";
});
out.schedule = S;

// ============ AXE SWEEP ============
async function axe(label, url, prep) {
  if (!url || /null|undefined/.test(url)) {
    out.axe.push({ label, url: "(skipped: no url)", byImpact: {}, violations: [], note: "url unavailable" });
    return;
  }
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  if (prep) await prep();
  const r = await new AxeBuilder({ page }).analyze().catch((e) => ({ violations: [], error: String(e.message) }));
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const ids = [];
  for (const v of r.violations || []) {
    byImpact[v.impact] = (byImpact[v.impact] || 0) + v.nodes.length;
    ids.push({ id: v.id, impact: v.impact, count: v.nodes.length });
  }
  await shot(page, `axe-${label}`);
  out.axe.push({ label, url: url.replace(BASE, ""), byImpact, violations: ids });
}
await axe("editor", createdPageUrl ? `${BASE}${createdPageUrl}` : null);
await axe("pages-list", `${BASE}/admin/pages`);
await axe("redirects", `${BASE}/admin/pages/redirects`);
await axe("revisions-list", createdPageId ? `${BASE}/admin/pages/${createdPageId}/revisions` : null);
// revision detail: open first revision if present
await page.goto(`${BASE}/admin/pages/${createdPageId}/revisions`, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1000);
const revLink = page.locator(`a[href*="/revisions/"]`).first();
if (await revLink.isVisible({ timeout: 3000 }).catch(() => false)) {
  const href = await revLink.getAttribute("href");
  await axe("revision-detail", `${BASE}${href}`);
} else {
  out.axe.push({ label: "revision-detail", url: "(no revision link found)", byImpact: {}, violations: [], note: "no revision to open" });
}

// ============ CLEANUP: unpublish/archive the throwaway page ============
const CL = { steps: [] };
async function cleanupStep(action, fn) {
  let result = "ok";
  try { const r = await fn(); if (typeof r === "string") result = r; } catch (e) { result = `ERROR: ${String(e.message).slice(0, 120)}`; }
  CL.steps.push({ action, result });
}
await cleanupStep("archive-throwaway-page", async () => {
  await page.goto(`${BASE}/admin/pages`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1000);
  // find the row for our page by title, open actions, archive
  const row = page.locator("table tbody tr", { hasText: TITLE }).first();
  if (!(await row.isVisible({ timeout: 4000 }).catch(() => false))) {
    // search
    await page.goto(`${BASE}/admin/pages?q=${encodeURIComponent(String(TS))}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  }
  const row2 = page.locator("table tbody tr", { hasText: String(TS) }).first();
  const target = (await row2.isVisible({ timeout: 2000 }).catch(() => false)) ? row2 : row;
  await target.locator("summary").first().click().catch(() => {});
  await page.waitForTimeout(400);
  const archive = target.getByRole("button", { name: /archive page/i }).first();
  if (await archive.isVisible({ timeout: 2000 }).catch(() => false)) {
    await archive.click();
    await page.waitForTimeout(500);
    const confirm = page.getByRole("button", { name: /archive|confirm/i }).last();
    if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) { await confirm.click(); await page.waitForTimeout(2000); }
    return "archived";
  }
  return "archive control not found";
});
await cleanupStep("verify-no-active-throwaway", async () => {
  await page.goto(`${BASE}/admin/pages?q=${encodeURIComponent(String(TS))}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  // active list should not contain our throwaway by TS
  const present = await page.locator("table tbody", { hasText: String(TS) }).isVisible({ timeout: 2000 }).catch(() => false);
  await shot(page, "cleanup-active-list");
  return present ? `STILL PRESENT in active list (TS ${TS})` : "no active throwaway row (archived/removed)";
});
out.cleanup = CL;

fs.writeFileSync("plans/seo-builder-ux-fixes/agent-runs/n20-results.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  createdPageUrl, publicUrl, slug,
  publishSteps: P.steps.map((s) => `${s.n}.${s.action}: ${s.result}`),
  publishUpfront: P.upfront,
  publishFriction: P.friction,
  scheduleSteps: S.steps.map((s) => `${s.action}: ${s.result}`),
  scheduleReachable: S.scheduleReachable,
  axe: out.axe.map((a) => `${a.label}: ${JSON.stringify(a.byImpact)} ${a.violations.map((v) => v.id + "(" + v.impact + ")").join(",")}`),
  cleanup: CL.steps,
}, null, 2));

await browser.close();
