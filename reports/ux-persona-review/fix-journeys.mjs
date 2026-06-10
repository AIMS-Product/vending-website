// Re-run of journeys that misfired due to script mechanics (scroll-reveal, wizard, URL-read timing).
// Writes corrected results to journeys-rerun.md. Does NOT resubmit the apply form.
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
  return `${slug}-r${String(counters[slug]).padStart(2, "0")}-${action}.png`;
}
async function snap(page, slug, action) {
  const name = shotName(slug, action);
  await page.screenshot({ path: path.join(SHOTS, name), timeout: 15000 }).catch(() => {});
  return name;
}
const log = (m) => console.log(m);

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
async function clickAndWaitForPath(page, j, locator, expectedPath) {
  await locator.click({ timeout: 5000 });
  j.clicks++;
  await page.waitForURL(`**${expectedPath}**`, { timeout: 8000 });
  j.pageLoads++;
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  return `navigated to ${page.url().replace(BASE, "")}`;
}

// J3 — read a news article, with scrolling (scroll-reveal cards)
async function readNews(context) {
  const j = newJourney("read-a-news-article", "Read a News Article");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  try {
    await jStep(page, j, "load homepage", async () => {
      await gotoSafe(page, BASE + "/");
      j.pageLoads++;
      return "homepage loaded";
    });
    await jStep(page, j, "navigate to News via nav", async () =>
      clickAndWaitForPath(page, j, page.locator("nav a[href='/news'], a[href='/news']").first(), "/news"));
    await jStep(page, j, "scroll to reveal article cards", async () => {
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 700);
        await page.waitForTimeout(450);
      }
      const n = await page.locator("a[href*='/news/']").count();
      return `after scrolling, ${n} article link(s) present (cards are scroll-reveal animated — invisible before scroll)`;
    });
    await jStep(page, j, "open first article", async () => {
      const card = page.locator("a[href*='/news/']").first();
      const href = await card.getAttribute("href");
      await card.scrollIntoViewIfNeeded();
      return clickAndWaitForPath(page, j, card, href);
    });
    await jStep(page, j, "verify article content + scroll", async () => {
      const h1 = await page.locator("h1").first().innerText({ timeout: 4000 }).catch(() => "");
      await page.mouse.wheel(0, 1800);
      await page.waitForTimeout(500);
      if (!h1) throw new Error("no h1 on article");
      return `article heading: "${h1.replace(/\n/g, " ").slice(0, 90)}"`;
    });
    await jStep(page, j, "return to news listing", async () => {
      const back = page.locator("a[href='/news']:visible").first();
      if (await back.isVisible({ timeout: 2000 }).catch(() => false)) {
        return clickAndWaitForPath(page, j, back, "/news");
      }
      await page.goBack();
      j.pageLoads++;
      j.wrongTurns.push("article page: no obvious back-to-listing link other than top nav NEWS");
      return "used browser back";
    });
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = failed.length === 0 ? (j.wrongTurns.length ? "completed-with-friction" : "completed") : "blocked";
    if (failed.length) j.blockedAt = `${failed[0].page} — ${failed[0].result}`;
    j.notes.push("Article cards on /news render as blank boxes until scrolled into view (scroll-reveal animation); above-the-fold shows 3 empty card outlines.");
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

// J4 — trust pages with accurate URL waits
async function trust(context) {
  const j = newJourney("evaluate-trust", "Evaluate Trust Before Committing");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  try {
    await jStep(page, j, "load homepage", async () => {
      await gotoSafe(page, BASE + "/");
      j.pageLoads++;
      return "homepage loaded";
    });
    for (const [label, href, fromFooter] of [
      ["About", "/about", false],
      ["Case Studies", "/case-studies", false],
      ["Privacy Policy", "/privacy", true],
      ["Terms", "/terms", true],
    ]) {
      await jStep(page, j, `navigate to ${label}`, async () => {
        if (fromFooter) {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(600);
        }
        const link = page.locator(`a[href='${href}']:visible`).first();
        if (!(await link.isVisible({ timeout: 3000 }).catch(() => false)))
          throw new Error(`no visible link to ${href}${fromFooter ? " (checked footer)" : ""}`);
        const r = await clickAndWaitForPath(page, j, link, href);
        const h = await page.locator("h1, h2").first().innerText({ timeout: 4000 }).catch(() => "(no heading)");
        return `${r}; heading: "${h.replace(/\n/g, " ").slice(0, 70)}"${fromFooter ? " (link found in footer)" : ""}`;
      });
      await jStep(page, j, `back home from ${label}`, async () => {
        await gotoSafe(page, BASE + "/");
        j.pageLoads++;
        return "home";
      });
    }
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = failed.length === 0 ? "completed" : failed.length <= 2 ? "completed-with-friction" : "blocked";
    if (failed.length) j.notes.push(failed.map((s) => s.action + ": " + s.result).join("; "));
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

// J6 — admin news draft. Nav discoverability already proven broken; use direct URL as fallback and test the flow.
async function adminNews(context) {
  const j = newJourney("admin-create-news-draft", "Admin: Create a News Draft");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const title = `UX Review Test ${TS}`;
  try {
    await jStep(page, j, "open /admin", async () => {
      await gotoSafe(page, BASE + "/admin");
      j.pageLoads++;
      return `landed on ${page.url().replace(BASE, "")}`;
    });
    await jStep(page, j, "look for News in studio nav", async () => {
      const link = page.locator("a[href*='/admin/news']:visible").first();
      if (await link.isVisible({ timeout: 2500 }).catch(() => false)) return "News nav link found";
      j.wrongTurns.push("Admin sidebar has no News section — only 'SEO pages' and 'Media library' under CONTENT. /admin/news is unreachable from visible UI.");
      await gotoSafe(page, BASE + "/admin/news");
      j.pageLoads++;
      return "NO News nav item in sidebar — used direct URL /admin/news to continue testing the flow";
    });
    await jStep(page, j, "click New post", async () => {
      const btn = page.locator("a[href*='/admin/news/new']:visible, button:has-text('New'):visible").first();
      if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no New post control on /admin/news");
      return clickAndWaitForPath(page, j, btn, "/admin/news/new");
    });
    await jStep(page, j, "fill title, slug, content", async () => {
      const filled = [];
      for (const sel of ["input[name*=title i], input[id*=title i], input[placeholder*=title i]", "input[name*=slug i], input[id*=slug i]"]) {
        const f = page.locator(sel).first();
        if (await f.isVisible({ timeout: 1500 }).catch(() => false)) {
          const isSlug = sel.includes("slug");
          await f.fill(isSlug ? `ux-review-test-${TS}` : title).catch(() => {});
          filled.push(isSlug ? "slug" : "title");
        }
      }
      const editor = page.locator("[contenteditable=true]").first();
      if (await editor.isVisible({ timeout: 1500 }).catch(() => false)) {
        await editor.click();
        await page.keyboard.type("UX review exploration test content. Safe to delete.", { delay: 5 });
        filled.push("rich-text editor");
      } else {
        const ta = page.locator("textarea:visible").first();
        if (await ta.isVisible({ timeout: 1000 }).catch(() => false)) {
          await ta.fill("UX review exploration test content. Safe to delete.");
          filled.push("textarea");
        }
      }
      return `filled: ${filled.join(", ") || "NOTHING — no recognizable fields"}`;
    });
    await jStep(page, j, "save draft (NOT publish)", async () => {
      const save = page
        .locator("button:has-text('Save draft'), button:has-text('Save Draft'), button:has-text('Save'), button[type=submit]")
        .first();
      if (!(await save.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no visible Save control");
      const label = (await save.innerText().catch(() => "Save")).trim();
      if (/publish/i.test(label)) throw new Error(`only "${label}" available — refusing (would go live)`);
      await save.click();
      j.clicks++;
      await page.waitForTimeout(2500);
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      return `clicked "${label}" → ${page.url().replace(BASE, "")}`;
    });
    await jStep(page, j, "verify draft in news list", async () => {
      await gotoSafe(page, BASE + "/admin/news");
      j.pageLoads++;
      const found = await page.locator(`text=${title}`).first().isVisible({ timeout: 4000 }).catch(() => false);
      if (!found) throw new Error("draft not visible in /admin/news list");
      created.push({ url: "/admin/news", name: title, source_page: "/admin/news/new", type: "news-draft" });
      return "draft visible in list";
    });
    // destructive on session-created record
    await jStep(page, j, "delete the created draft (session-created — permitted)", async () => {
      if (!created.length) return "skipped — nothing created";
      const row = page.locator(`tr:has-text("${title}"), li:has-text("${title}"), [class*=card]:has-text("${title}"), [class*=row i]:has-text("${title}")`).first();
      let del = row.locator("button:has-text('Delete'), [aria-label*=delete i]").first();
      if (!(await del.isVisible({ timeout: 2000 }).catch(() => false))) {
        await row.locator("a").first().click({ timeout: 3000 });
        await page.waitForTimeout(1500);
        del = page.locator("button:has-text('Delete'):visible").first();
      }
      if (!(await del.isVisible({ timeout: 2500 }).catch(() => false)))
        return "no Delete control found in list or editor — draft left in place (titled 'UX Review Test', safe to remove manually)";
      await del.click();
      j.clicks++;
      await page.waitForTimeout(800);
      await snap(page, `journey-${j.slug}`, "delete-confirm-dialog");
      const confirm = page.locator("[role=dialog] button:has-text('Delete'), [role=dialog] button:has-text('Confirm'), [role=alertdialog] button:has-text('Delete')").first();
      if (await confirm.isVisible({ timeout: 2500 }).catch(() => false)) {
        await confirm.click();
        j.clicks++;
        await page.waitForTimeout(2000);
        return "deleted with confirmation dialog (PERFORMED on session-created record)";
      }
      return "delete clicked — no confirmation dialog appeared (check screenshots; flag if record deleted without confirm)";
    });
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = j.wrongTurns.length || failed.length ? (created.length ? "completed-with-friction" : "blocked") : "completed";
    if (!created.length && failed.length) j.blockedAt = `${failed[0].page} — ${failed[0].result}`;
    if (j.wrongTurns.length && created.length)
      j.notes.push("Flow works end-to-end ONLY via direct URL — the News section is not discoverable from the admin sidebar.");
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

// J7 — SEO page wizard (3 steps: page type → starting point → ready to build)
async function adminSeoPage(context) {
  const j = newJourney("admin-create-seo-page", "Admin: Create an SEO Page Draft");
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  try {
    await jStep(page, j, "open /admin/pages", async () => {
      await gotoSafe(page, BASE + "/admin/pages");
      j.pageLoads++;
      return "SEO pages list loaded";
    });
    await jStep(page, j, "click Create page", async () => {
      const btn = page.locator("a[href*='/admin/pages/new']:visible, button:has-text('Create page'):visible").first();
      if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no Create page button");
      return clickAndWaitForPath(page, j, btn, "/admin/pages/new");
    });
    await jStep(page, j, "wizard step 1: choose page type", async () => {
      const opt = page.locator("text=SEO / Resource page").first();
      if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await opt.click();
        j.clicks++;
      }
      const cont = page.locator("button:has-text('Continue')").first();
      if (!(await cont.isVisible({ timeout: 2000 }).catch(() => false))) throw new Error("no Continue button on step 1");
      await cont.click();
      j.clicks++;
      await page.waitForTimeout(900);
      return "selected 'SEO / Resource page' → Continue";
    });
    await jStep(page, j, "wizard step 2: starting point + details", async () => {
      const filled = [];
      const inputs = await page.locator("input:visible, textarea:visible").all();
      for (const f of inputs) {
        const name = (((await f.getAttribute("name")) || (await f.getAttribute("id")) || (await f.getAttribute("placeholder"))) || "").toLowerCase();
        const existing = await f.inputValue().catch(() => "");
        if (existing) continue;
        let val = null;
        if (name.includes("slug")) val = `ux-review-test-${TS}`;
        else if (name.includes("title") || name.includes("name")) val = `UX Review Test Page ${TS}`;
        else if (name.includes("keyword")) val = "ux review test keyword";
        else val = `Test input ${name || "field"}`;
        await f.fill(val).catch(() => {});
        filled.push(name || "field");
      }
      const cont = page.locator("button:has-text('Continue'):visible, button:has-text('Next'):visible").first();
      if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cont.click();
        j.clicks++;
        await page.waitForTimeout(900);
      }
      return `filled: ${filled.join(", ") || "no inputs on this step"}; advanced`;
    });
    await jStep(page, j, "wizard step 3: create the page", async () => {
      for (const sel of ["button:has-text('Create page')", "button:has-text('Create')", "button:has-text('Start building')", "button:has-text('Build')", "button:has-text('Continue')"]) {
        const btn = page.locator(`${sel}:visible`).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          const label = (await btn.innerText().catch(() => "")).trim();
          if (/publish/i.test(label)) continue;
          await btn.click();
          j.clicks++;
          await page.waitForTimeout(3000);
          await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
          const url = page.url().replace(BASE, "");
          if (/\/admin\/pages\/(?!new)[A-Za-z0-9-]+/.test(url)) {
            created.push({ url, name: `UX Review Test Page ${TS}`, source_page: "/admin/pages/new", type: "seo-page-draft" });
            return `clicked "${label}" → editor at ${url}`;
          }
          return `clicked "${label}" → ${url}`;
        }
      }
      throw new Error("no create/continue control found on final wizard step");
    });
    await jStep(page, j, "editor: add a block + save", async () => {
      const add = page.locator("button:has-text('Add block'):visible, button[aria-label*='add block' i]").first();
      let note = "no Add block control visible";
      if (await add.isVisible({ timeout: 3000 }).catch(() => false)) {
        await add.click();
        j.clicks++;
        await page.waitForTimeout(900);
        const opt = page.locator("[role=dialog] button:visible, [role=option]:visible, [class*=picker i] button:visible").first();
        if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) {
          const name = (await opt.innerText().catch(() => "block")).trim().slice(0, 40);
          await opt.click();
          j.clicks++;
          await page.waitForTimeout(900);
          note = `added block: "${name}"`;
        } else note = "block picker opened, no option clickable";
      }
      const save = page.locator("button:has-text('Save'):visible").first();
      if (await save.isVisible({ timeout: 2000 }).catch(() => false)) {
        const label = (await save.innerText()).trim();
        if (!/publish/i.test(label)) {
          await save.click();
          j.clicks++;
          await page.waitForTimeout(1500);
          note += `; clicked "${label}"`;
        }
      } else note += "; no separate Save button (may autosave)";
      return note;
    });
    // cleanup: archive/delete the created page (session-created — permitted)
    await jStep(page, j, "cleanup: archive/delete created page", async () => {
      const rec = created.find((c) => c.type === "seo-page-draft");
      if (!rec) return "nothing created — skip";
      await gotoSafe(page, BASE + "/admin/pages");
      j.pageLoads++;
      const row = page.locator(`tr:has-text("UX Review Test Page ${TS}")`).first();
      if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) return "created page not found in list (left in place)";
      const menu = row.locator("button[aria-label*=action i], button:has-text('⋮'), [class*=action i] button").last();
      if (await menu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menu.click();
        j.clicks++;
        await page.waitForTimeout(600);
        await snap(page, `journey-${j.slug}`, "row-actions-menu");
        const destroy = page.locator("[role=menu] >> text=/archive|delete/i, [role=menuitem]:has-text('Archive'), [role=menuitem]:has-text('Delete')").first();
        if (await destroy.isVisible({ timeout: 2000 }).catch(() => false)) {
          const label = (await destroy.innerText()).trim();
          await destroy.click();
          j.clicks++;
          await page.waitForTimeout(800);
          const confirm = page.locator("[role=dialog] button:has-text('Archive'), [role=dialog] button:has-text('Delete'), [role=dialog] button:has-text('Confirm')").first();
          if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirm.click();
            j.clicks++;
            await page.waitForTimeout(1500);
            return `"${label}" performed with confirmation (session-created record)`;
          }
          return `"${label}" clicked — no confirm dialog seen`;
        }
        return "actions menu opened but no archive/delete item — page left in place (titled UX Review Test Page)";
      }
      return "no row actions control found — page left in place (titled UX Review Test Page, safe to archive manually)";
    });
    const rec = created.find((c) => c.type === "seo-page-draft");
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = rec && failed.length === 0 ? "completed" : rec ? "completed-with-friction" : "blocked";
    if (!rec) j.blockedAt = failed.length ? `${failed[0].page} — ${failed[0].result}` : `${page.url().replace(BASE, "")} — wizard did not produce a page`;
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  context.setDefaultTimeout(10000);
  await readNews(context);
  await trust(context);
  await adminNews(context);
  await adminSeoPage(context);
  await browser.close();

  let md = `# Journey re-run (corrected mechanics) — ${new Date().toISOString()}\n`;
  for (const j of journeys) {
    md += `\n## Journey results: ${j.name} (RE-RUN)\n\n- Status: ${j.status}\n- Clicks: ${j.clicks} | Page loads: ${j.pageLoads}\n${j.blockedAt ? `- Blocked at: ${j.blockedAt}\n` : ""}\n| # | Page | Action | Result | Screenshot |\n|---|------|--------|--------|------------|\n`;
    for (const s of j.steps) md += `| ${String(s.n).padStart(2, "0")} | ${s.page} | ${s.action.replace(/\|/g, "/")} | ${s.result.replace(/\|/g, "/").slice(0, 240)} | ${s.screenshot} |\n`;
    if (j.wrongTurns.length) md += `\n### Wrong turns / dead ends\n${j.wrongTurns.map((w) => `- ${w}`).join("\n")}\n`;
    if (j.notes.length) md += `\n### Friction notes\n${j.notes.map((n) => `- ${n}`).join("\n")}\n`;
  }
  md += `\n## Created in re-run\n${created.map((c) => `- ${c.type}: ${c.name} (${c.url})`).join("\n") || "- none"}\n`;
  fs.writeFileSync(path.join(DIR, "journeys-rerun.md"), md);
  console.log("RERUN DONE", JSON.stringify({ statuses: journeys.map((j) => [j.slug, j.status]), created }, null, 2));
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
