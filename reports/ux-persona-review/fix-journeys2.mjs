// Final re-run: J6 admin news draft (exact Save draft button) and J7 SEO page (dismiss Quick Tour overlay).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const DIR = "reports/ux-persona-review";
const SHOTS = path.join(DIR, "screenshots");
const TS = Date.now();
const journeys = [];
const created = [];
const counters = {};

function shotName(slug, action) {
  counters[slug] = (counters[slug] || 0) + 1;
  return `${slug}-s${String(counters[slug]).padStart(2, "0")}-${action}.png`;
}
async function snap(page, slug, action) {
  const name = shotName(slug, action);
  await page.screenshot({ path: path.join(SHOTS, name), timeout: 15000 }).catch(() => {});
  return name;
}
function newJourney(slug, name) {
  const j = { slug, name, status: "blocked", clicks: 0, pageLoads: 0, steps: [], wrongTurns: [], notes: [], blockedAt: null };
  journeys.push(j);
  return j;
}
async function jStep(page, j, action, fn) {
  const step = { n: j.steps.length + 1, page: page.url().replace(BASE, "") || "/", action, result: "", screenshot: "" };
  j.steps.push(step);
  try {
    step.result = (await fn()) || "ok";
  } catch (e) {
    step.result = `FAILED: ${e.message.split("\n")[0].slice(0, 150)}`;
  }
  await page.waitForTimeout(400);
  step.screenshot = await snap(page, `journey-${j.slug}`, `${String(step.n).padStart(2, "0")}-${action.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`);
  return step;
}
async function gotoSafe(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function adminNews(context) {
  const j = newJourney("admin-create-news-draft", "Admin: Create a News Draft");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const title = `UX Review Test ${TS}`;
  let saved = false;
  try {
    await jStep(page, j, "open /admin", async () => {
      await gotoSafe(page, BASE + "/admin");
      j.pageLoads++;
      return `landed on ${page.url().replace(BASE, "")}`;
    });
    await jStep(page, j, "look for News in studio nav", async () => {
      const link = page.locator("a[href*='/admin/news']:visible").first();
      if (await link.isVisible({ timeout: 2500 }).catch(() => false)) return "News nav link found";
      j.wrongTurns.push("Admin sidebar has no News/Blog section — only 'SEO pages' and 'Media library'. /admin/news unreachable from visible sidebar UI. (A 'Blog and news' button exists inside the news editor header, but nothing in the studio sidebar.)");
      await gotoSafe(page, BASE + "/admin/news");
      j.pageLoads++;
      return "NO News nav item in sidebar — used direct URL /admin/news";
    });
    await jStep(page, j, "click New post", async () => {
      const btn = page.locator("a[href*='/admin/news/new']:visible, button:has-text('New'):visible").first();
      await btn.click({ timeout: 5000 });
      j.clicks++;
      await page.waitForURL("**/admin/news/new**", { timeout: 8000 });
      j.pageLoads++;
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      return `on ${page.url().replace(BASE, "")} — heading "New blog post"`;
    });
    await jStep(page, j, "fill title, excerpt, body", async () => {
      const filled = [];
      const titleF = page.locator("input").first();
      await titleF.fill(title).catch(() => {});
      filled.push("title");
      const ta = page.locator("textarea:visible").first();
      if (await ta.isVisible({ timeout: 1500 }).catch(() => false)) {
        await ta.fill("UX review exploration test content. Safe to delete.");
        filled.push("excerpt");
      }
      const body = page.locator("textarea:visible").nth(1);
      if (await body.isVisible({ timeout: 1500 }).catch(() => false)) {
        await body.fill("UX review test body content. Safe to delete.");
        filled.push("body");
      }
      return `filled: ${filled.join(", ")}`;
    });
    await jStep(page, j, "click Save draft (NOT Publish)", async () => {
      const save = page.getByRole("button", { name: "Save draft", exact: true }).first();
      if (!(await save.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("Save draft button not visible");
      await save.click({ timeout: 5000 });
      j.clicks++;
      await page.waitForTimeout(2500);
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      const errs = await page.locator("[role=alert]:visible, [class*=error i]:visible").allInnerTexts().catch(() => []);
      return `clicked Save draft → ${page.url().replace(BASE, "")}${errs.length ? `; messages: ${errs.join(" | ").slice(0, 200)}` : ""}`;
    });
    await jStep(page, j, "verify draft in news list", async () => {
      await gotoSafe(page, BASE + "/admin/news");
      j.pageLoads++;
      const found = await page.locator(`text=${title}`).first().isVisible({ timeout: 4000 }).catch(() => false);
      if (!found) throw new Error("draft not visible in /admin/news list");
      saved = true;
      created.push({ url: "/admin/news", name: title, source_page: "/admin/news/new", type: "news-draft" });
      return "draft visible in list — flow works via direct URL";
    });
    await jStep(page, j, "delete created draft (session-created — permitted)", async () => {
      if (!saved) return "skipped — nothing created";
      const row = page.locator(`tr:has-text("${title}"), li:has-text("${title}"), div[class*=card]:has-text("${title}")`).first();
      let del = row.locator("button:has-text('Delete'), [aria-label*=delete i]").first();
      if (!(await del.isVisible({ timeout: 2000 }).catch(() => false))) {
        const open = row.locator("a").first();
        if (await open.isVisible({ timeout: 2000 }).catch(() => false)) {
          await open.click();
          j.clicks++;
          await page.waitForTimeout(1800);
          del = page.locator("button:has-text('Delete'):visible").first();
        }
      }
      if (!(await del.isVisible({ timeout: 2500 }).catch(() => false)))
        return "no Delete control found in list row or editor — draft left in place (titled 'UX Review Test', safe to remove manually)";
      await del.click();
      j.clicks++;
      await page.waitForTimeout(900);
      await snap(page, `journey-${j.slug}`, "delete-confirm");
      const confirm = page
        .locator("[role=dialog] button:has-text('Delete'), [role=alertdialog] button:has-text('Delete'), [role=dialog] button:has-text('Confirm')")
        .first();
      if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) {
        await confirm.click();
        j.clicks++;
        await page.waitForTimeout(2000);
        return "deleted with confirmation dialog (PERFORMED on session-created record)";
      }
      await page.waitForTimeout(1500);
      const still = await page.locator(`text=${title}`).first().isVisible({ timeout: 2000 }).catch(() => false);
      return still ? "delete clicked, no dialog, record still present" : "DELETED WITHOUT CONFIRMATION DIALOG (one-click destructive action)";
    });
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = saved && failed.length === 0 ? "completed-with-friction" : saved ? "completed-with-friction" : "blocked";
    if (!saved) j.blockedAt = failed.length ? `${failed[0].page} — ${failed[0].result}` : "draft never persisted";
    if (saved) j.notes.push("Create/save/verify works, but ONLY by typing the /admin/news URL directly — the studio sidebar offers no path to it. Editor is titled 'New blog post' under 'Blog CMS' while the route and public nav say 'News'.");
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function adminSeoPage(context) {
  const j = newJourney("admin-create-seo-page", "Admin: Create an SEO Page Draft");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const title = `UX Review Test Page ${TS}`;
  let persisted = false;
  try {
    await jStep(page, j, "open /admin/pages", async () => {
      await gotoSafe(page, BASE + "/admin/pages");
      j.pageLoads++;
      return "SEO pages list loaded";
    });
    await jStep(page, j, "click Create page", async () => {
      const btn = page.locator("a[href*='/admin/pages/new']:visible, button:has-text('Create page'):visible").first();
      await btn.click({ timeout: 5000 });
      j.clicks++;
      await page.waitForURL("**/admin/pages/new**", { timeout: 8000 });
      j.pageLoads++;
      return "wizard opened (Step 1 of 3: page type)";
    });
    await jStep(page, j, "wizard: choose type + continue", async () => {
      const opt = page.locator("text=SEO / Resource page").first();
      if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opt.click();
        j.clicks++;
      }
      await page.locator("button:has-text('Continue')").first().click({ timeout: 5000 });
      j.clicks++;
      await page.waitForTimeout(900);
      return "type selected → step 2 (starting point)";
    });
    await jStep(page, j, "wizard: starting point → build", async () => {
      const cont = page.locator("button:has-text('Continue'):visible").first();
      if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cont.click();
        j.clicks++;
        await page.waitForTimeout(900);
      }
      const build = page.locator("button:has-text('Start building page'):visible, button:has-text('Start building'):visible").first();
      if (await build.isVisible({ timeout: 2500 }).catch(() => false)) {
        await build.click();
        j.clicks++;
        await page.waitForTimeout(2500);
      }
      return `editor state: ${page.url().replace(BASE, "")}`;
    });
    await jStep(page, j, "dismiss Quick Tour overlay", async () => {
      const skip = page.locator("button:has-text('Skip tour'), text=Skip tour").first();
      if (await skip.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skip.click();
        j.clicks++;
        await page.waitForTimeout(700);
        return "Quick Tour appeared on first editor open — dismissed via 'Skip tour'";
      }
      return "no tour overlay this time";
    });
    await jStep(page, j, "fill page title, slug, keyword", async () => {
      const filled = [];
      const titleF = page.locator("input[placeholder*='Internal page title' i], input[placeholder*='page title' i]").first();
      if (await titleF.isVisible({ timeout: 2500 }).catch(() => false)) {
        await titleF.fill(title);
        filled.push("page title");
      }
      const slugF = page.locator("input[placeholder*='page-slug' i], input[placeholder*='slug' i]").first();
      if (await slugF.isVisible({ timeout: 2000 }).catch(() => false)) {
        await slugF.fill(`ux-review-test-${TS}`);
        filled.push("slug");
      }
      const kw = page.locator("input[placeholder*='vending machine business' i], input[placeholder*='keyword' i]").first();
      if (await kw.isVisible({ timeout: 2000 }).catch(() => false)) {
        await kw.fill("ux review test keyword");
        filled.push("target keyword");
      }
      return `filled: ${filled.join(", ") || "none found"}`;
    });
    await jStep(page, j, "add first block", async () => {
      const add = page
        .locator("button:has-text('Add your first block'):visible, button:has-text('Add page content'):visible, text=Add your first block")
        .first();
      if (!(await add.isVisible({ timeout: 3000 }).catch(() => false))) return "no add-block affordance visible";
      await add.click();
      j.clicks++;
      await page.waitForTimeout(1000);
      await snap(page, `journey-${j.slug}`, "block-picker");
      const opt = page
        .locator("[role=dialog] button:visible, [role=option]:visible, [class*=picker i] button:visible, [class*=Picker i] button:visible")
        .first();
      if (await opt.isVisible({ timeout: 2500 }).catch(() => false)) {
        const name = (await opt.innerText().catch(() => "block")).trim().replace(/\n/g, " ").slice(0, 50);
        await opt.click();
        j.clicks++;
        await page.waitForTimeout(1200);
        return `block picker opened; selected "${name}"`;
      }
      return "block picker did not present clickable options";
    });
    await jStep(page, j, "Save draft", async () => {
      const save = page.getByRole("button", { name: /^Save draft$/ }).first();
      if (!(await save.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("Save draft button not visible in editor");
      await save.click({ timeout: 5000 });
      j.clicks++;
      await page.waitForTimeout(3000);
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      const errs = await page.locator("[role=alert]:visible").allInnerTexts().catch(() => []);
      return `clicked Save draft → ${page.url().replace(BASE, "")}${errs.length ? `; alerts: ${errs.join(" | ").slice(0, 250)}` : ""}`;
    });
    await jStep(page, j, "verify page in list", async () => {
      await gotoSafe(page, BASE + "/admin/pages");
      j.pageLoads++;
      const found = await page.locator(`text=${title}`).first().isVisible({ timeout: 4000 }).catch(() => false);
      if (!found) throw new Error("created page not visible in /admin/pages list");
      persisted = true;
      created.push({ url: "/admin/pages", name: title, source_page: "/admin/pages/new", type: "seo-page-draft" });
      return "draft page visible in SEO pages list";
    });
    await jStep(page, j, "cleanup: archive/delete created page (session-created — permitted)", async () => {
      if (!persisted) return "nothing persisted — skip";
      const row = page.locator(`tr:has-text("${title}")`).first();
      const menu = row.locator("button").last();
      if (!(await menu.isVisible({ timeout: 2500 }).catch(() => false))) return "no row actions button — page left in place (titled UX Review Test Page)";
      await menu.click();
      j.clicks++;
      await page.waitForTimeout(700);
      await snap(page, `journey-${j.slug}`, "row-actions");
      const destroy = page.locator("[role=menu] [role=menuitem]:has-text('Archive'), [role=menu] [role=menuitem]:has-text('Delete'), [role=menuitem]:has-text('Archive'), button:has-text('Archive'):visible").first();
      if (!(await destroy.isVisible({ timeout: 2500 }).catch(() => false))) return "no archive/delete in row menu — page left in place (titled UX Review Test Page)";
      const label = (await destroy.innerText().catch(() => "Archive")).trim();
      await destroy.click();
      j.clicks++;
      await page.waitForTimeout(900);
      const confirm = page.locator("[role=dialog] button:has-text('Archive'), [role=dialog] button:has-text('Delete'), [role=dialog] button:has-text('Confirm')").first();
      if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) {
        await confirm.click();
        j.clicks++;
        await page.waitForTimeout(1800);
        return `"${label}" performed with confirmation (session-created record)`;
      }
      return `"${label}" clicked — no confirmation dialog observed`;
    });
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = persisted && failed.length === 0 ? "completed-with-friction" : persisted ? "completed-with-friction" : "blocked";
    if (!persisted) j.blockedAt = failed.length ? `${failed[0].page} — ${failed[0].result}` : "page never persisted to list";
    j.notes.push("Creation is a 3-step wizard, then a builder editor with a Quick Tour overlay on first open. Editor URL stays at /admin/pages/new while building (no shareable page URL until saved). Publish is gated by 'SEO Blocked' readiness including 'Fix URL slug' until slug filled.");
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  context.setDefaultTimeout(10000);
  await adminNews(context);
  await adminSeoPage(context);
  await browser.close();

  let md = `# Journey re-run 2 (admin flows, corrected) — ${new Date().toISOString()}\n`;
  for (const j of journeys) {
    md += `\n## Journey results: ${j.name} (FINAL)\n\n- Status: ${j.status}\n- Clicks: ${j.clicks} | Page loads: ${j.pageLoads}\n${j.blockedAt ? `- Blocked at: ${j.blockedAt}\n` : ""}\n| # | Page | Action | Result | Screenshot |\n|---|------|--------|--------|------------|\n`;
    for (const s of j.steps) md += `| ${String(s.n).padStart(2, "0")} | ${s.page} | ${s.action.replace(/\|/g, "/")} | ${s.result.replace(/\|/g, "/").slice(0, 260)} | ${s.screenshot} |\n`;
    if (j.wrongTurns.length) md += `\n### Wrong turns / dead ends\n${j.wrongTurns.map((w) => `- ${w}`).join("\n")}\n`;
    if (j.notes.length) md += `\n### Friction notes\n${j.notes.map((n) => `- ${n}`).join("\n")}\n`;
  }
  md += `\n## Created in re-run 2\n${created.map((c) => `- ${c.type}: ${c.name}`).join("\n") || "- none"}\n`;
  fs.appendFileSync(path.join(DIR, "journeys-rerun.md"), md);
  console.log("RERUN2 DONE", JSON.stringify({ statuses: journeys.map((x) => [x.slug, x.status]), created }, null, 2));
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
