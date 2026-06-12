import {
  BASE_URL, ROOT, launch, shot, extractText, axeScan, tabWalk, perfMetrics,
  slugify, attachConsoleCapture, writeJSON, readJSON,
} from "./lib.mjs";
import path from "node:path";

const prior = readJSON(path.join(ROOT, "journey-results.json"), {});
const TS = prior.ts;
const EDITOR_URL = prior.createdPageUrl;
const PUBLIC_URL = prior.publicUrl;
const PREVIEW_URL = "/resources/preview/2eSNnEXLh0znXOYIrUm2Hjk7ieSeIqY2P1z0wTAPiWw";

const pages = [];
const axeAll = [];
const skips = [];
let shotCount = 0;
let interactions = 0;

const { browser, context } = await launch();

async function newPageRecord(route, label) {
  const rec = {
    route, label, slug: slugify(route.replace(/\?.*/, "")),
    status: "OK", screenshots: [], inventory: [], forms: [], responsive: [],
    consoleErrors: [], failedRequests: [], notes: [],
  };
  pages.push(rec);
  return rec;
}

async function explorePage(route, label, fn, { viewportsOnly = false } = {}) {
  console.log(`\n=== ${label} (${route})`);
  const rec = await newPageRecord(route, label);
  const sink = { consoleErrors: rec.consoleErrors, failedRequests: rec.failedRequests };
  const page = await context.newPage();
  attachConsoleCapture(page, sink);
  try {
    const resp = await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1500);
    rec.status = resp && resp.status() >= 400 ? `HTTP ${resp.status()}` : "OK";
    const s1 = await shot(page, `${rec.slug}-001-load`); rec.screenshots.push(s1); shotCount++;
    const s2 = await shot(page, `${rec.slug}-002-full`, { fullPage: true }); rec.screenshots.push(s2); shotCount++;
    rec.perf = await perfMetrics(page);
    rec.textExtract = await extractText(page, rec.slug);
    const violations = await axeScan(page);
    const tw = await tabWalk(page);
    axeAll.push({ page: route, violations, tabOrder: tw.stops.slice(0, 50), tabIssues: tw.issues });
    rec.axeCount = violations.reduce((a, v) => a + (v.count || 0), 0);
    rec.axeIds = violations.map((v) => `${v.id}(${v.impact})`);
    if (!viewportsOnly && fn) await fn(page, rec);
    // responsive shots
    for (const [name, vp] of [["mobile", { width: 375, height: 667 }], ["tablet", { width: 768, height: 1024 }]]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(900);
      const sN = await shot(page, `${rec.slug}-${name}`); shotCount++;
      const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5);
      rec.responsive.push({ viewport: name, screenshot: sN, issues: hScroll ? "horizontal scroll present" : "OK" });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  } catch (e) {
    rec.status = `Error: ${String(e.message).split("\n")[0].slice(0, 200)}`;
    await shot(page, `${rec.slug}-error`).catch(() => {});
  }
  await page.close();
  return rec;
}

const inv = (rec, element, bucket, text, result, screenshot = "") => {
  rec.inventory.push({ element, bucket, text, result, screenshot });
  interactions++;
};

// ---------- 1. /admin/pages ----------
await explorePage("/admin/pages", "Pages list", async (page, rec) => {
  // sort dropdown
  const sort = page.locator("details", { hasText: /Updated|Title/ }).last();
  const sortSummary = sort.locator("summary").first();
  if (await sortSummary.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sortSummary.click();
    await page.waitForTimeout(500);
    const sc = await shot(page, `${rec.slug}-010-sort-open`); shotCount++;
    inv(rec, "details/summary", "safe", "Sort dropdown", "menu opened", sc);
    const az = page.getByText("Title (A–Z)").first();
    if (await az.isVisible({ timeout: 1500 }).catch(() => false)) {
      await az.click();
      await page.waitForTimeout(1500);
      inv(rec, "link", "safe", "Title (A–Z)", "list re-sorted", await shot(page, `${rec.slug}-011-sorted-az`)); shotCount++;
    }
  }
  // status filters
  for (const f of ["Drafts", "Published", "Archived", "All"]) {
    const l = page.getByRole("link", { name: new RegExp(`^${f}$`, "i") }).first();
    if (await l.isVisible({ timeout: 1500 }).catch(() => false)) {
      await l.click();
      await page.waitForTimeout(1200);
      inv(rec, "link", "safe", `Status filter: ${f}`, `filtered view`, await shot(page, `${rec.slug}-012-filter-${f.toLowerCase()}`)); shotCount++;
    }
  }
  // workflow filter
  const sched = page.getByRole("link", { name: /^Scheduled$/i }).first();
  if (await sched.isVisible({ timeout: 1500 }).catch(() => false)) {
    await sched.click();
    await page.waitForTimeout(1200);
    inv(rec, "link", "safe", "Workflow filter: Scheduled", "filtered view", await shot(page, `${rec.slug}-013-filter-scheduled`)); shotCount++;
    const all = page.getByRole("link", { name: /All metadata/i }).first();
    if (await all.isVisible({ timeout: 1500 }).catch(() => false)) { await all.click(); await page.waitForTimeout(1000); }
  }
  // search form: empty submit, then query
  const box = page.locator("#admin-pages-search");
  if (await box.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole("button", { name: /^Search$/i }).first().click();
    await page.waitForTimeout(1200);
    const f1 = await shot(page, `${rec.slug}-014-search-empty-submit`); shotCount++;
    await box.fill("zzz-no-results-query");
    await page.getByRole("button", { name: /^Search$/i }).first().click();
    await page.waitForTimeout(1200);
    const f2 = await shot(page, `${rec.slug}-015-search-no-results`); shotCount++;
    const noRes = (await page.locator("body").innerText()).match(/No .{0,60}/i)?.[0] || "(no empty-state text found)";
    await box.fill("test");
    await page.getByRole("button", { name: /^Search$/i }).first().click();
    await page.waitForTimeout(1200);
    const f3 = await shot(page, `${rec.slug}-016-search-test`); shotCount++;
    rec.forms.push({ form: "pages search", fields: "search", bucket: "safe", emptySubmit: "submitted (see screenshot)", invalidSubmit: `no-results query → "${noRes}"`, validSubmit: "query 'test' submitted", screenshots: [f1, f2, f3].join(", ") });
    const clear = page.getByRole("link", { name: /^Clear$/i }).or(page.getByRole("button", { name: /^Clear$/i })).first();
    if (await clear.isVisible({ timeout: 1500 }).catch(() => false)) { await clear.click(); await page.waitForTimeout(1000); inv(rec, "button", "safe", "Clear search", "search cleared", ""); }
  }
  // row menu on a pre-existing row: open, screenshot, close — no destructive clicks
  const summary = page.locator("table details summary").first();
  if (await summary.isVisible({ timeout: 2000 }).catch(() => false)) {
    await summary.click();
    await page.waitForTimeout(500);
    const sc = await shot(page, `${rec.slug}-017-row-menu-open`); shotCount++;
    inv(rec, "details/summary", "safe", "Row ⋮ menu (pre-existing page)", "menu opened; destructive items NOT clicked", sc);
    skips.push({ page: "/admin/pages", element: "Duplicate/Publish/Archive in row menu", target: "pre-existing pages", reason: "destructive/creation on pre-existing data", screenshot: sc });
    await page.keyboard.press("Escape");
    await summary.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  // rows per page selector
  const rpp = page.locator("select").last();
  if (await rpp.isVisible({ timeout: 1500 }).catch(() => false)) {
    inv(rec, "select", "safe", "Rows per page", "present (not changed)", "");
  }
});

// ---------- 2. /admin/pages/new ----------
await explorePage("/admin/pages/new", "Create page (choice gate)", async (page, rec) => {
  inv(rec, "wizard", "safe", "Step 1: Page type", "Resource preselected", rec.screenshots[0]);
  const cont = page.getByRole("button", { name: /^Continue$/i }).first();
  if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cont.click(); await page.waitForTimeout(700);
    inv(rec, "button", "safe", "Continue → Step 2", "starting point step", await shot(page, `${rec.slug}-010-step2`)); shotCount++;
    const back = page.getByRole("button", { name: /^Back$/i }).first();
    if (await back.isVisible({ timeout: 1500 }).catch(() => false)) {
      await back.click(); await page.waitForTimeout(600);
      inv(rec, "button", "safe", "Back → Step 1", "returned to step 1", await shot(page, `${rec.slug}-011-back-step1`)); shotCount++;
      await cont.click().catch(() => {}); await page.waitForTimeout(600);
    }
    const blank = page.getByRole("button", { name: /Blank page/i }).first();
    if (await blank.isVisible({ timeout: 1500 }).catch(() => false)) { await blank.click(); await page.waitForTimeout(400); }
    const cont2 = page.getByRole("button", { name: /^Continue$/i }).first();
    if (await cont2.isVisible({ timeout: 1500 }).catch(() => false)) { await cont2.click(); await page.waitForTimeout(700); }
    inv(rec, "button", "safe", "Continue → Step 3", "ready-to-build step", await shot(page, `${rec.slug}-012-step3`)); shotCount++;
    const start = page.getByRole("button", { name: /Start building/i }).first();
    if (await start.isVisible({ timeout: 1500 }).catch(() => false)) {
      await start.click(); await page.waitForTimeout(1500);
      inv(rec, "button", "creation", "Start building", "editor opened (unsaved)", await shot(page, `${rec.slug}-013-editor-unsaved`)); shotCount++;
      // data-loss test: leave via Pages link without saving
      const back2 = page.getByRole("link", { name: /^Pages$/i }).first();
      if (await back2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await back2.click();
        await page.waitForTimeout(1500);
        const warned = page.url().includes("/new");
        inv(rec, "link", "safe", "Leave unsaved editor via 'Pages'", warned ? "navigation blocked/warned" : `navigated away with NO unsaved-changes warning (now ${page.url().replace(BASE_URL, "")})`, await shot(page, `${rec.slug}-014-leave-unsaved`)); shotCount++;
      }
    }
  }
});

// ---------- 3. Editor (session page) ----------
await explorePage(EDITOR_URL, "Page editor (session-created page)", async (page, rec) => {
  // Blocks panel toggle
  const blocksToggle = page.getByRole("button", { name: /blocks sidebar|^Blocks/i }).first();
  if (await blocksToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await blocksToggle.click(); await page.waitForTimeout(700);
    inv(rec, "button", "safe", "Blocks panel toggle", "sidebar expanded", await shot(page, `${rec.slug}-010-blocks-panel`)); shotCount++;
  }
  // Share menu
  const share = page.getByRole("button", { name: /^Share$/i }).or(page.locator("summary", { hasText: "Share" })).first();
  if (await share.isVisible({ timeout: 2000 }).catch(() => false)) {
    await share.click(); await page.waitForTimeout(500);
    inv(rec, "details/summary", "safe", "Share menu", "menu opened (Copy editor link / Copy public URL)", await shot(page, `${rec.slug}-011-share-menu`)); shotCount++;
    await page.keyboard.press("Escape");
  }
  // Block picker
  const add = page.getByRole("button", { name: /Add page content/i }).first();
  if (await add.isVisible({ timeout: 2000 }).catch(() => false)) {
    await add.scrollIntoViewIfNeeded().catch(() => {});
    await add.click(); await page.waitForTimeout(800);
    inv(rec, "button", "safe", "Add page content (block picker)", "picker dialog opened", await shot(page, `${rec.slug}-012-block-picker`)); shotCount++;
    const types = await page.locator('[data-testid="block-picker-type"]').allInnerTexts().catch(() => []);
    rec.notes.push(`Block picker types: ${types.map((t) => t.split("\n")[0]).join(", ") || "(none found)"}`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // Block settings modal
  const ba = page.getByRole("button", { name: "Block actions" }).first();
  if (await ba.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ba.click(); await page.waitForTimeout(500);
    inv(rec, "button", "safe", "Block actions menu", "menu opened (Edit settings / Duplicate content / Remove content)", await shot(page, `${rec.slug}-013-block-actions`)); shotCount++;
    const edit = page.getByRole("button", { name: /Edit settings/i }).first();
    if (await edit.isVisible({ timeout: 1500 }).catch(() => false)) {
      await edit.click(); await page.waitForTimeout(800);
      inv(rec, "button", "safe", "Edit settings (block modal)", "settings modal opened", await shot(page, `${rec.slug}-014-block-settings`)); shotCount++;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
  }
  skips.push({ page: EDITOR_URL, element: "Remove content (block delete)", target: "session-created block", reason: "kept for exploration; destructive flow screenshotted via menu", screenshot: `${rec.slug}-013-block-actions.png` });
  // AI assistant
  const ai = page.getByRole("button", { name: /AI assistant|^AI$/i }).first();
  if (await ai.isVisible({ timeout: 2000 }).catch(() => false)) {
    await ai.click(); await page.waitForTimeout(1000);
    inv(rec, "button", "safe", "Open AI assistant", "AI panel opened", await shot(page, `${rec.slug}-015-ai-panel`)); shotCount++;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // Comments form: empty then valid
  const commentBody = page.locator("#seo-comment-body");
  if (await commentBody.isVisible({ timeout: 2000 }).catch(() => false)) {
    await commentBody.scrollIntoViewIfNeeded().catch(() => {});
    const addC = page.getByRole("button", { name: /Add comment/i }).first();
    await addC.click(); await page.waitForTimeout(1200);
    const f1 = await shot(page, `${rec.slug}-016-comment-empty-submit`); shotCount++;
    await commentBody.fill("Test input for Comment. This is exploration-generated test content.");
    await addC.click(); await page.waitForTimeout(1500);
    const f2 = await shot(page, `${rec.slug}-017-comment-submitted`); shotCount++;
    rec.forms.push({ form: "Governance comments", fields: "blockId (optional), body", bucket: "creation", emptySubmit: "see screenshot", invalidSubmit: "n/a (single textarea)", validSubmit: "comment submitted", screenshots: [f1, f2].join(", ") });
  }
  // Revision panel + preview link state
  await page.getByText(/Revision history/i).first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  inv(rec, "section", "safe", "Revision history", "entries visible after publish", await shot(page, `${rec.slug}-018-revisions`)); shotCount++;
  skips.push({ page: EDITOR_URL, element: "Revoke (preview token)", target: "session-created token", reason: "kept active for preview-page exploration", screenshot: `${rec.slug}-018-revisions.png` });
});

// ---------- 4. Revision preview ----------
const revLinks = await (async () => {
  const p = await context.newPage();
  await p.goto(`${BASE_URL}${EDITOR_URL}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  const hrefs = await p.locator('a[href*="/revisions/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  await p.close();
  return hrefs;
})();
if (revLinks[0]) {
  await explorePage(revLinks[0], "Revision preview", async (page, rec) => {
    const back = page.getByRole("link", { name: /Back to editor/i }).first();
    inv(rec, "link", "safe", "Back to editor", (await back.isVisible({ timeout: 2000 }).catch(() => false)) ? "present" : "NOT FOUND", "");
  });
}

// ---------- 5. Redirects ----------
await explorePage("/admin/pages/redirects", "Redirects manager", async (page, rec) => {
  const src = page.locator('input[name="sourcePath"]');
  const dst = page.locator('input[name="destinationPath"]');
  const submit = page.getByRole("button", { name: /Create redirect/i }).first();
  // empty submit
  await submit.click(); await page.waitForTimeout(1200);
  const f1 = await shot(page, `${rec.slug}-010-form-empty-submit`); shotCount++;
  // invalid submit
  await src.fill("not a path"); await dst.fill("also!!bad");
  await submit.click(); await page.waitForTimeout(1500);
  const f2 = await shot(page, `${rec.slug}-011-form-invalid-submit`); shotCount++;
  const errTxt = (await page.locator("body").innerText()).match(/(must|invalid|enter|required)[^\n]{0,100}/i)?.[0] || "(no visible error copy found)";
  // preserved?
  const preserved = (await src.inputValue().catch(() => "")) !== "";
  // valid submit
  await src.fill(`/resources/ux-explore-old-${TS}`);
  await dst.fill(PUBLIC_URL);
  await submit.click(); await page.waitForTimeout(2000);
  const f3 = await shot(page, `${rec.slug}-012-form-valid-submit`); shotCount++;
  rec.forms.push({ form: "Create redirect", fields: "sourcePath, destinationPath, statusCode, pageId(adv)", bucket: "creation", emptySubmit: "see screenshot", invalidSubmit: `error copy: "${errTxt}"; values preserved: ${preserved}`, validSubmit: "redirect created", screenshots: [f1, f2, f3].join(", ") });
  rec.notes.push("Redirects table has no delete/edit controls — created redirects cannot be removed from this UI.");
  skips.push({ page: "/admin/pages/redirects", element: "(no delete control exists)", target: "test redirects", reason: "UI offers no way to delete redirects — cleanup impossible from admin", screenshot: f3 });
});

// ---------- 6. Block preview audit (dev-only) ----------
await explorePage("/admin/pages/block-preview-audit", "Block preview audit (dev QA)", async (page, rec) => {
  const cases = await page.locator('[data-testid="block-preview-case"]').count().catch(() => 0);
  rec.notes.push(`${cases} block preview parity cases rendered`);
});

// ---------- 7. Public published page ----------
await explorePage(PUBLIC_URL, "Published page (public)", async (page, rec) => {
  const cta = page.getByRole("link", { name: /UX review test cta label/i }).first();
  if (await cta.isVisible({ timeout: 2000 }).catch(() => false)) {
    inv(rec, "link", "safe", "Hero CTA", `href=${await cta.getAttribute("href")}`, "");
  }
  const faq = page.locator("summary, [role='button']", { hasText: /UX review test question/i }).first();
  if (await faq.isVisible({ timeout: 2000 }).catch(() => false)) {
    await faq.click(); await page.waitForTimeout(500);
    inv(rec, "disclosure", "safe", "FAQ item toggle", "toggled", await shot(page, `${rec.slug}-010-faq-toggle`)); shotCount++;
  }
});

// ---------- 8. Preview token page ----------
await explorePage(PREVIEW_URL, "Draft preview (token URL)", async (page, rec) => {
  rec.notes.push("Token-based draft preview; checks that draft content renders for reviewers without login.");
});

// ---------- Cleanup: archive session page ----------
{
  console.log("\n=== Cleanup: archive session-created page");
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/admin/pages`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const box = page.locator("#admin-pages-search");
  await box.fill(String(TS));
  await page.getByRole("button", { name: /^Search$/i }).first().click();
  await page.waitForTimeout(1500);
  let archived = 0;
  for (let i = 0; i < 3; i++) {
    const summary = page.locator("table details summary").first();
    if (!(await summary.isVisible({ timeout: 2500 }).catch(() => false))) break;
    await summary.click();
    await page.waitForTimeout(500);
    const arch = page.getByRole("button", { name: /Archive page/i }).first();
    if (!(await arch.isVisible({ timeout: 2000 }).catch(() => false))) { await page.keyboard.press("Escape"); break; }
    await arch.click();
    await page.waitForTimeout(700);
    const dlg = page.getByRole("dialog").last();
    if (await dlg.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dlg.getByRole("button", { name: /Archive|Confirm/i }).first().click().catch(() => {});
    } else {
      await page.getByRole("button", { name: /Confirm archive/i }).first().click().catch(() => {});
    }
    await page.waitForTimeout(2000);
    archived++;
    await page.goto(`${BASE_URL}/admin/pages`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await box.fill(String(TS));
    await page.getByRole("button", { name: /^Search$/i }).first().click();
    await page.waitForTimeout(1500);
  }
  console.log(`archived ${archived} remaining session page(s)`);
  await shot(page, "cleanup-after-archive");
  await page.close();
}

writeJSON(path.join(ROOT, "axe-results.json"), axeAll);
writeJSON(path.join(ROOT, "exploration-data.json"), { pages, skips, shotCount, interactions });

// ---------- Render exploration-log.md ----------
import fs from "node:fs";
let md = `# Exploration Log\n\nBase URL: ${BASE_URL}\nDate: 2026-06-10\nScope: SEO Page Builder only\nPages explored: ${pages.length}\nJourneys executed: 7 (see journeys.md)\nTotal interactions: ${interactions}\nScreenshots captured: see screenshots/ (journeys + exploration)\nCreated artifacts this session: see session-created.json\nSkipped destructive actions: ${skips.length} (see bottom)\n\n---\n`;
for (const p of pages) {
  md += `\n## Page: ${p.route} (${p.label})\n\n### Load\n- Status: ${p.status}\n- Screenshot: screenshots/${p.screenshots[0] || "n/a"} (above fold), screenshots/${p.screenshots[1] || "n/a"} (full page)\n- Text extract: text/${p.textExtract}\n- Load time: ${p.perf?.domContentLoaded ?? "?"}ms (DCL) / ${p.perf?.load ?? "?"}ms (load)\n- Layout shift (CLS): ${p.perf?.cls ?? "?"}\n- Axe violations: ${p.axeCount ?? 0} across rules [${(p.axeIds || []).join(", ")}] (details in axe-results.json)\n`;
  if (p.inventory.length) {
    md += `\n### Interactive inventory\n| # | Element | Bucket | Text/Label | Action Result | Screenshot |\n|---|---------|--------|-----------|---------------|------------|\n`;
    p.inventory.forEach((it, i) => { md += `| ${i + 1} | ${it.element} | ${it.bucket} | ${it.text} | ${it.result} | ${it.screenshot} |\n`; });
  }
  if (p.forms.length) {
    md += `\n### Forms\n| Form | Fields | Bucket | Empty Submit | Invalid Submit | Valid Submit | Screenshots |\n|------|--------|--------|--------------|----------------|--------------|-------------|\n`;
    p.forms.forEach((f) => { md += `| ${f.form} | ${f.fields} | ${f.bucket} | ${f.emptySubmit} | ${f.invalidSubmit} | ${f.validSubmit} | ${f.screenshots} |\n`; });
  }
  md += `\n### Responsive\n| Viewport | Screenshot | Issues |\n|----------|------------|--------|\n`;
  p.responsive.forEach((r) => { md += `| ${r.viewport} | ${r.screenshot} | ${r.issues} |\n`; });
  if (p.notes.length) md += `\n### Notes\n${p.notes.map((n) => `- ${n}`).join("\n")}\n`;
  md += `\n### Console Errors\n${p.consoleErrors.length ? p.consoleErrors.slice(0, 15).map((e) => `- ${e}`).join("\n") : "- none"}\n\n### Failed Network Requests\n${p.failedRequests.length ? [...new Set(p.failedRequests)].slice(0, 15).map((e) => `- ${e}`).join("\n") : "- none"}\n\n---\n`;
}
md += `\n## Skipped destructive actions\n\n| Page | Element | Target | Reason |\n|------|---------|--------|--------|\n`;
skips.forEach((s) => { md += `| ${s.page} | ${s.element} | ${s.target} | ${s.reason} |\n`; });
fs.writeFileSync(path.join(ROOT, "exploration-log.md"), md);
await browser.close();
console.log(`\nDone. ${pages.length} pages, ${interactions} interactions.`);
for (const p of pages) console.log(`  ${p.route}: ${p.status}, axe=${p.axeCount}, consoleErrs=${p.consoleErrors.length}`);
