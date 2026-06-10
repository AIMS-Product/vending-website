import {
  BASE_URL, ROOT, launch, shot, confirmIfAsked, attachConsoleCapture, writeJSON, readJSON,
} from "./lib.mjs";
import path from "node:path";

const TS = Date.now();
const PAGE_TITLE = `UX SEO Review Test ${TS}`;
const PAGE_SLUG = `ux-seo-review-test-${TS}`;
const SESSION_FILE = path.join(ROOT, "session-created.json");
const RESULTS_FILE = path.join(ROOT, "journey-results.json");

const sink = { consoleErrors: [], failedRequests: [] };
const session = readJSON(SESSION_FILE, { created: [] });
const results = [];

function recorder(slug) {
  const r = { journey: slug, status: "blocked", clicks: 0, pageLoads: 0, steps: [], wrongTurns: [], friction: [], blockedAt: null };
  results.push(r);
  return r;
}

async function step(J, page, action, fn) {
  const n = J.steps.length + 1;
  const nn = String(n).padStart(2, "0");
  let result = "ok";
  try {
    result = (await fn()) || "ok";
  } catch (e) {
    result = `ERROR: ${String(e.message).split("\n")[0].slice(0, 200)}`;
  }
  const sc = await shot(page, `journey-${J.journey}-${nn}-${action.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 50)}`);
  J.steps.push({ n, page: page.url().replace(BASE_URL, ""), action, result, screenshot: sc });
  console.log(`  [${J.journey}] ${nn} ${action} -> ${result}`);
  return result;
}

async function click(J, locator, opts = {}) {
  await locator.click({ timeout: opts.timeout ?? 8000 });
  J.clicks++;
}

async function gotoPage(J, page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(800);
  J.pageLoads++;
}

let createdPageUrl = null; // editor URL /admin/pages/{id}
let createdPageId = null;
let publicUrl = `/resources/${PAGE_SLUG}`;

async function ensureSeoPanel(page) {
  const titleField = page.locator("#page-title-field");
  if (await titleField.isVisible({ timeout: 2000 }).catch(() => false)) return "already open";
  const toggle = page.getByRole("button", { name: /SEO/ }).first();
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await toggle.click();
    await page.waitForTimeout(500);
    return "opened via toggle";
  }
  return "title field not found and no SEO toggle";
}

// ---------- Journey 1: create-first-page ----------
async function j1(page) {
  const J = recorder("create-first-page");
  await step(J, page, "open-pages-list", async () => {
    await gotoPage(J, page, `${BASE_URL}/admin/pages`);
  });
  await step(J, page, "click-create-page", async () => {
    await click(J, page.getByRole("link", { name: /Create page/i }).first());
    await page.waitForURL(/\/admin\/pages\/new/, { timeout: 15000 });
    J.pageLoads++;
  });
  // Choice gate: 3-step wizard — page type → starting point → ready to build
  await step(J, page, "choice-gate", async () => {
    const notes = [];
    const tryClick = async (locator, label) => {
      if (await locator.isVisible({ timeout: 2500 }).catch(() => false)) {
        await click(J, locator);
        notes.push(label);
        await page.waitForTimeout(700);
        return true;
      }
      return false;
    };
    // Step 1 (page type, Resource preselected) → Continue
    await tryClick(page.getByRole("button", { name: /^Continue$/i }).first(), "Continue (step 1)");
    // Step 2: choose Blank page, then Continue
    await tryClick(page.getByRole("button", { name: /Blank page/i }).first(), "chose Blank page");
    await tryClick(page.getByRole("button", { name: /^Continue$/i }).first(), "Continue (step 2)");
    // Step 3: Start building
    await tryClick(page.getByRole("button", { name: /Start building/i }).first(), "Start building");
    await page.waitForTimeout(1200);
    return notes.join("; ") || "no choice gate visible (editor direct)";
  });
  await step(J, page, "open-seo-panel", () => ensureSeoPanel(page));
  await step(J, page, "fill-title-slug-keyword", async () => {
    await page.locator("#page-title-field").fill(PAGE_TITLE, { timeout: 8000 });
    const slugField = page.locator("#page-slug-field");
    if (await slugField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await slugField.fill(PAGE_SLUG);
    }
    const kw = page.locator("#seo-target-keyword-field");
    if (await kw.isVisible({ timeout: 2000 }).catch(() => false)) await kw.fill("vending machine ux review");
    const meta = page.locator("#page-meta-description-field");
    if (await meta.isVisible({ timeout: 2000 }).catch(() => false)) {
      await meta.fill("Test input for meta description. This is exploration-generated test content.");
    }
  });
  await step(J, page, "add-rich-text-block", async () => {
    await click(J, page.getByRole("button", { name: /Add page content/i }).first());
    await page.waitForTimeout(600);
    const types = page.locator('[data-testid="block-picker-type"]');
    const rich = page.locator('[data-block-picker-type="richText"][data-testid="block-picker-type"], [data-testid="block-picker-type"][data-block-picker-type="rich-text"]');
    if (await rich.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await click(J, rich.first());
    } else {
      await click(J, types.first());
    }
    await page.waitForTimeout(500);
    await click(J, page.locator('[data-testid="block-picker-variant"]').first());
    await page.waitForTimeout(800);
    return "block added";
  });
  await step(J, page, "add-faq-block", async () => {
    const addBtn = page.getByRole("button", { name: /Add page content/i }).first();
    if (!(await addBtn.isVisible({ timeout: 3000 }).catch(() => false))) return "no second Add page content button";
    await click(J, addBtn);
    await page.waitForTimeout(600);
    const faq = page.locator('[data-testid="block-picker-type"][data-block-picker-type*="faq" i]');
    if (await faq.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await click(J, faq.first());
      await page.waitForTimeout(500);
      await click(J, page.locator('[data-testid="block-picker-variant"]').first());
      return "faq block added";
    }
    // close the picker
    await page.keyboard.press("Escape");
    return "faq type not found; picker closed";
  });
  await step(J, page, "save-draft", async () => {
    await click(J, page.getByRole("button", { name: /Save draft/i }).first());
    await page.waitForTimeout(2500);
    return `url after save: ${page.url().replace(BASE_URL, "")}`;
  });
  await step(J, page, "verify-in-list", async () => {
    const url = page.url();
    if (/\/admin\/pages\/[^/]+$/.test(url) && !/\/new$/.test(url)) {
      createdPageUrl = url.replace(BASE_URL, "");
      createdPageId = createdPageUrl.split("/").pop();
    }
    await gotoPage(J, page, `${BASE_URL}/admin/pages?search=${encodeURIComponent(String(TS))}`);
    const row = page.getByText(PAGE_TITLE).first();
    const found = await row.isVisible({ timeout: 5000 }).catch(() => false);
    if (!found) {
      // try the search box manually
      const box = page.locator("#admin-pages-search");
      if (await box.isVisible({ timeout: 2000 }).catch(() => false)) {
        await box.fill(String(TS));
        await click(J, page.getByRole("button", { name: /^Search$/i }).first());
        await page.waitForTimeout(1500);
        J.pageLoads++;
      }
    }
    const visible = await page.getByText(PAGE_TITLE).first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) throw new Error("created page not found in list");
    if (!createdPageUrl) {
      const editLink = page.getByRole("link", { name: /Edit page/i }).first();
      const href = await editLink.getAttribute("href").catch(() => null);
      if (href) { createdPageUrl = href; createdPageId = href.split("/").pop(); }
    }
    return `page in list; editor url: ${createdPageUrl}`;
  });
  if (createdPageUrl) {
    session.created.push({ url: createdPageUrl, public_url: publicUrl, name: PAGE_TITLE, source_page: "/admin/pages/new", created_at_step: J.steps.length });
    writeJSON(SESSION_FILE, session);
    J.status = J.steps.some((s) => String(s.result).startsWith("ERROR")) ? "completed-with-friction" : "completed";
  } else {
    J.status = "blocked";
    J.blockedAt = "save-draft: no editor URL captured after saving";
  }
}

// ---------- Journey 2: publish-and-view-live ----------
async function j2(page, context) {
  const J = recorder("publish-and-view-live");
  if (!createdPageUrl) { J.blockedAt = "depends on Journey 1 page"; return; }
  await step(J, page, "open-editor", () => gotoPage(J, page, `${BASE_URL}${createdPageUrl}`));
  await step(J, page, "find-publish-button", async () => {
    const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
    if (await pub.isVisible({ timeout: 3000 }).catch(() => false)) return "visible";
    // maybe the publish status section is collapsed
    const statusToggle = page.getByRole("button", { name: /Publish status/i }).first();
    if (await statusToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await click(J, statusToggle);
      return "expanded publish status section";
    }
    return "publish button not directly visible";
  });
  await step(J, page, "click-publish", async () => {
    const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
    await click(J, pub);
    await page.waitForTimeout(800);
    const confirmed = await confirmIfAsked(page, /^Publish/i);
    await page.waitForTimeout(2500);
    return confirmed;
  });
  await step(J, page, "verify-published", async () => {
    const txt = await page.locator("body").innerText();
    if (!/Published/i.test(txt)) throw new Error("no 'Published' text found after publish");
    return "status text contains Published";
  });
  await step(J, page, "open-live-page", async () => {
    const live = page.getByRole("link", { name: /Open live page|View live page/i }).first();
    if (await live.isVisible({ timeout: 3000 }).catch(() => false)) {
      const popupP = context.waitForEvent("page", { timeout: 10000 }).catch(() => null);
      await click(J, live);
      const popup = await popupP;
      if (popup) {
        await popup.waitForLoadState("domcontentloaded").catch(() => {});
        await popup.waitForTimeout(1500);
        await shot(popup, `journey-publish-and-view-live-live-tab`);
        const ok = (await popup.locator("body").innerText()).length > 100;
        await popup.close();
        return ok ? "live page opened in new tab and rendered" : "live tab opened but looks empty";
      }
      // same-tab navigation
      J.pageLoads++;
      return `navigated: ${page.url().replace(BASE_URL, "")}`;
    }
    J.friction.push("No visible 'Open live page' link after publishing — had to type the URL manually");
    await gotoPage(J, page, `${BASE_URL}${publicUrl}`);
    return `manual goto ${publicUrl}`;
  });
  await step(J, page, "verify-live-content", async () => {
    await gotoPage(J, page, `${BASE_URL}${publicUrl}`);
    const txt = await page.locator("body").innerText();
    if (/404|not found/i.test(txt.slice(0, 300)) && txt.length < 600) throw new Error("public URL looks like 404");
    return `public page renders (${txt.length} chars)`;
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length === 0 ? (J.friction.length || J.wrongTurns.length ? "completed-with-friction" : "completed")
    : errs.some((s) => /verify/.test(s.action)) ? "blocked" : "completed-with-friction";
  if (J.status === "blocked") J.blockedAt = errs[0]?.action + ": " + errs[0]?.result;
}

// ---------- Journey 3: preview-draft ----------
async function j3(page, context) {
  const J = recorder("preview-draft");
  if (!createdPageUrl) { J.blockedAt = "depends on Journey 1 page"; return; }
  await step(J, page, "open-editor", () => gotoPage(J, page, `${BASE_URL}${createdPageUrl}`));
  await step(J, page, "make-small-edit", async () => {
    await ensureSeoPanel(page);
    const meta = page.locator("#page-meta-description-field");
    if (await meta.isVisible({ timeout: 3000 }).catch(() => false)) {
      await meta.fill("Updated meta description for preview test. Exploration-generated.");
      return "meta description edited";
    }
    return "meta field not found; skipping edit";
  });
  await step(J, page, "click-live-preview", async () => {
    const btn = page.getByRole("button", { name: /Live preview|Save & preview/i }).first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no Live preview button visible");
    const popupP = context.waitForEvent("page", { timeout: 15000 }).catch(() => null);
    await click(J, btn);
    const popup = await popupP;
    await page.waitForTimeout(1500);
    if (popup) {
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      await popup.waitForTimeout(2000);
      await shot(popup, `journey-preview-draft-preview-tab`);
      const url = popup.url();
      const len = (await popup.locator("body").innerText().catch(() => "")).length;
      await popup.close();
      return `preview tab: ${url.replace(BASE_URL, "")} (${len} chars)`;
    }
    // maybe an "Open preview" link appeared instead
    const open = page.getByRole("link", { name: /Open preview/i }).first();
    if (await open.isVisible({ timeout: 3000 }).catch(() => false)) {
      const p2 = context.waitForEvent("page", { timeout: 10000 }).catch(() => null);
      await click(J, open);
      const popup2 = await p2;
      if (popup2) {
        await popup2.waitForTimeout(2000);
        await shot(popup2, `journey-preview-draft-preview-tab`);
        await popup2.close();
        return "preview opened via Open preview link";
      }
    }
    throw new Error("no preview tab opened");
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length ? "blocked" : "completed";
  if (errs.length) J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- Journey 4: revision-restore ----------
async function j4(page) {
  const J = recorder("revision-restore");
  if (!createdPageUrl) { J.blockedAt = "depends on Journey 1 page"; return; }
  await step(J, page, "open-editor", () => gotoPage(J, page, `${BASE_URL}${createdPageUrl}`));
  await step(J, page, "edit-and-save", async () => {
    await ensureSeoPanel(page);
    const title = page.locator("#page-title-field");
    await title.fill(`${PAGE_TITLE} v2`, { timeout: 8000 });
    await click(J, page.getByRole("button", { name: /Save draft/i }).first());
    await page.waitForTimeout(2500);
  });
  await step(J, page, "find-revision-history", async () => {
    const heading = page.getByText(/Revision history/i).first();
    await heading.scrollIntoViewIfNeeded({ timeout: 8000 });
    return "revision history section found";
  });
  await step(J, page, "preview-revision", async () => {
    const prev = page.getByRole("link", { name: /^Preview$/i }).first();
    if (!(await prev.isVisible({ timeout: 4000 }).catch(() => false))) throw new Error("no revision Preview link");
    await click(J, prev);
    await page.waitForURL(/\/revisions\//, { timeout: 15000 });
    J.pageLoads++;
    await page.waitForTimeout(1500);
    return `revision preview: ${page.url().replace(BASE_URL, "")}`;
  });
  await step(J, page, "back-to-editor", async () => {
    const back = page.getByRole("link", { name: /Back to editor/i }).first();
    if (await back.isVisible({ timeout: 3000 }).catch(() => false)) {
      await click(J, back);
      await page.waitForURL(/\/admin\/pages\/[^/]+$/, { timeout: 15000 });
      J.pageLoads++;
      return "back via button";
    }
    J.wrongTurns.push("revision preview: no Back to editor control found, used browser back");
    await page.goBack();
    J.pageLoads++;
    return "used browser back";
  });
  await step(J, page, "restore-revision", async () => {
    const restore = page.getByRole("button", { name: /Restore draft/i }).first();
    await restore.scrollIntoViewIfNeeded({ timeout: 8000 });
    await click(J, restore);
    await page.waitForTimeout(800);
    const confirmed = await confirmIfAsked(page, /Restore/i);
    await page.waitForTimeout(2000);
    return confirmed;
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length ? (errs.length > 2 ? "blocked" : "completed-with-friction") : (J.wrongTurns.length ? "completed-with-friction" : "completed");
  if (J.status === "blocked") J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- Journey 5: schedule-publish ----------
async function j5(page) {
  const J = recorder("schedule-publish");
  if (!createdPageUrl) { J.blockedAt = "depends on Journey 1 page"; return; }
  await step(J, page, "open-editor", () => gotoPage(J, page, `${BASE_URL}${createdPageUrl}`));
  await step(J, page, "open-advanced-seo", async () => {
    await ensureSeoPanel(page);
    const adv = page.locator("details", { has: page.getByText(/Advanced/i) }).first();
    const summary = page.getByText(/Advanced SEO|Advanced/i).first();
    if (await summary.isVisible({ timeout: 3000 }).catch(() => false)) {
      await summary.scrollIntoViewIfNeeded().catch(() => {});
      await click(J, summary);
      await page.waitForTimeout(500);
      return "advanced section toggled";
    }
    return "no Advanced summary found";
  });
  await step(J, page, "set-schedule", async () => {
    const field = page.locator("#seo-scheduled-publish-field");
    await field.scrollIntoViewIfNeeded({ timeout: 8000 });
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const v = `${tomorrow.toISOString().slice(0, 10)}T12:00`;
    await field.fill(v);
    return `filled ${v}`;
  });
  await step(J, page, "save-schedule", async () => {
    await click(J, page.getByRole("button", { name: /Save draft/i }).first());
    await page.waitForTimeout(2500);
  });
  await step(J, page, "verify-scheduled", async () => {
    const txt = await page.locator("body").innerText();
    if (!/Scheduled/i.test(txt)) throw new Error("no 'Scheduled' indicator found after saving schedule");
    return "Scheduled indicator present";
  });
  await step(J, page, "cancel-schedule", async () => {
    const cancel = page.getByText(/Cancel scheduled publish/i).first();
    if (!(await cancel.isVisible({ timeout: 3000 }).catch(() => false))) {
      const adv = page.getByText(/Advanced SEO|Advanced/i).first();
      if (await adv.isVisible({ timeout: 2000 }).catch(() => false)) { await click(J, adv); await page.waitForTimeout(500); }
    }
    const box = page.locator('input[type="checkbox"]').filter({ has: page.locator(":scope") });
    const label = page.getByText(/Cancel scheduled publish/i).first();
    if (!(await label.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("Cancel scheduled publish control not found");
    await click(J, label);
    await click(J, page.getByRole("button", { name: /Save draft/i }).first());
    await page.waitForTimeout(2500);
    return "cancel checkbox toggled and saved";
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length === 0 ? "completed" : errs.length === 1 ? "completed-with-friction" : "blocked";
  if (J.status === "blocked") J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- Journey 6: create-redirect ----------
async function j6(page) {
  const J = recorder("create-redirect");
  await step(J, page, "open-pages-list", () => gotoPage(J, page, `${BASE_URL}/admin/pages`));
  await step(J, page, "click-redirects", async () => {
    await click(J, page.getByRole("link", { name: /Redirects/i }).first());
    await page.waitForURL(/redirects/, { timeout: 15000 });
    J.pageLoads++;
    await page.waitForTimeout(800);
  });
  const oldPath = `/resources/ux-old-test-${TS}`;
  await step(J, page, "fill-redirect-form", async () => {
    await page.locator('input[name="sourcePath"]').fill(oldPath);
    await page.locator('input[name="destinationPath"]').fill(publicUrl);
    const sel = page.locator('select[name="statusCode"]');
    if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) await sel.selectOption({ index: 0 });
  });
  await step(J, page, "submit-redirect", async () => {
    await click(J, page.getByRole("button", { name: /Create redirect/i }).first());
    await page.waitForTimeout(2000);
  });
  await step(J, page, "verify-redirect-listed", async () => {
    const txt = await page.locator("body").innerText();
    if (!txt.includes(oldPath)) throw new Error("new redirect not visible in table");
    session.created.push({ url: "/admin/pages/redirects", name: `redirect ${oldPath}`, source_page: "/admin/pages/redirects", created_at_step: J.steps.length });
    writeJSON(SESSION_FILE, session);
    return "redirect row present";
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length ? "blocked" : "completed";
  if (errs.length) J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- Journey 7: find-duplicate-archive ----------
async function j7(page) {
  const J = recorder("find-duplicate-archive");
  if (!createdPageUrl) { J.blockedAt = "depends on Journey 1 page"; return; }
  await step(J, page, "search-for-page", async () => {
    await gotoPage(J, page, `${BASE_URL}/admin/pages`);
    const box = page.locator("#admin-pages-search");
    await box.fill(String(TS));
    await click(J, page.getByRole("button", { name: /^Search$/i }).first());
    await page.waitForTimeout(1500);
    J.pageLoads++;
    const found = await page.getByText(new RegExp(String(TS))).first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!found) throw new Error("search did not surface the session page");
    return "page found via search";
  });
  await step(J, page, "open-row-menu", async () => {
    const menu = page.getByRole("button", { name: /Open actions for/i }).first()
    if (await menu.isVisible({ timeout: 3000 }).catch(() => false)) { await click(J, menu); return "menu opened via aria button"; }
    const summary = page.locator("table details summary").first();
    if (await summary.isVisible({ timeout: 3000 }).catch(() => false)) { await click(J, summary); return "menu opened via details summary"; }
    throw new Error("row menu trigger not found");
  });
  await step(J, page, "duplicate-page", async () => {
    const dup = page.getByRole("button", { name: /Duplicate page/i }).first();
    if (!(await dup.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("Duplicate page item not visible in menu");
    await click(J, dup);
    await page.waitForTimeout(800);
    const c = await confirmIfAsked(page, /Duplicate|Confirm/i);
    await page.waitForTimeout(2500);
    return c;
  });
  await step(J, page, "verify-duplicate", async () => {
    await gotoPage(J, page, `${BASE_URL}/admin/pages?search=${encodeURIComponent(String(TS))}`);
    const box = page.locator("#admin-pages-search");
    if (await box.isVisible({ timeout: 2000 }).catch(() => false)) {
      const val = await box.inputValue().catch(() => "");
      if (!val) {
        await box.fill(String(TS));
        await click(J, page.getByRole("button", { name: /^Search$/i }).first());
        await page.waitForTimeout(1500);
      }
    }
    const rows = await page.getByText(new RegExp(String(TS))).count();
    session.created.push({ url: "(duplicate)", name: `Duplicate of ${PAGE_TITLE}`, source_page: "/admin/pages", created_at_step: J.steps.length });
    writeJSON(SESSION_FILE, session);
    return `${rows} matching row text nodes after duplicate`;
  });
  // Archive every row matching our timestamp — all session-created
  await step(J, page, "archive-session-pages", async () => {
    let archived = 0;
    for (let i = 0; i < 4; i++) {
      const menu = page.getByRole("button", { name: /Open actions for/i }).first();
      const summary = page.locator("table details summary").first();
      let opened = false;
      if (await menu.isVisible({ timeout: 2500 }).catch(() => false)) { await click(J, menu); opened = true; }
      else if (await summary.isVisible({ timeout: 2500 }).catch(() => false)) { await click(J, summary); opened = true; }
      if (!opened) break;
      const arch = page.getByRole("button", { name: /Archive page/i }).first();
      if (!(await arch.isVisible({ timeout: 2500 }).catch(() => false))) { await page.keyboard.press("Escape"); break; }
      await click(J, arch);
      await page.waitForTimeout(600);
      await confirmIfAsked(page, /Archive|Confirm/i);
      await page.waitForTimeout(2000);
      archived++;
      // re-run search to refresh list
      await gotoPage(J, page, `${BASE_URL}/admin/pages`);
      const box = page.locator("#admin-pages-search");
      await box.fill(String(TS));
      await click(J, page.getByRole("button", { name: /^Search$/i }).first());
      await page.waitForTimeout(1500);
      const remaining = await page.getByRole("button", { name: /Open actions for/i }).count().catch(() => 0);
      if (remaining === 0) break;
    }
    if (archived === 0) throw new Error("no session pages archived");
    return `archived ${archived} session-created page(s)`;
  });
  await step(J, page, "verify-archived", async () => {
    const archivedTab = page.getByRole("link", { name: /^Archived/i }).first();
    if (await archivedTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await click(J, archivedTab);
      await page.waitForTimeout(1500);
      J.pageLoads++;
    }
    const txt = await page.locator("body").innerText();
    return txt.includes(String(TS)) ? "session pages visible under Archived" : "archived list does not show session pages (may need search)";
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length === 0 ? "completed" : errs.length === 1 ? "completed-with-friction" : "blocked";
  if (J.status === "blocked") J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- main ----------
const { browser, context } = await launch();
const page = await context.newPage();
attachConsoleCapture(page, sink);

console.log(`Journey run: TS=${TS} title="${PAGE_TITLE}"`);
try { await j1(page); } catch (e) { console.log("j1 fatal:", e.message); }
try { await j2(page, context); } catch (e) { console.log("j2 fatal:", e.message); }
try { await j3(page, context); } catch (e) { console.log("j3 fatal:", e.message); }
try { await j4(page); } catch (e) { console.log("j4 fatal:", e.message); }
try { await j5(page); } catch (e) { console.log("j5 fatal:", e.message); }
try { await j6(page); } catch (e) { console.log("j6 fatal:", e.message); }
try { await j7(page); } catch (e) { console.log("j7 fatal:", e.message); }

writeJSON(RESULTS_FILE, { ts: TS, pageTitle: PAGE_TITLE, slug: PAGE_SLUG, publicUrl, createdPageUrl, results, consoleErrors: sink.consoleErrors.slice(0, 100), failedRequests: sink.failedRequests.slice(0, 100) });
await browser.close();
console.log("\nJourney results:");
for (const r of results) console.log(`  ${r.journey}: ${r.status}${r.blockedAt ? " — " + r.blockedAt : ""} (clicks=${r.clicks})`);
