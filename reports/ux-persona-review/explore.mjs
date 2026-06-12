// UX Persona Review — automated exploration (Step 2)
// Run: node reports/ux-persona-review/explore.mjs
import { chromium } from "playwright";
import axePkg from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const AxeBuilder = axePkg.default ?? axePkg.AxeBuilder ?? axePkg;

const BASE = "http://localhost:3000";
const DIR = "reports/ux-persona-review";
const SHOTS = path.join(DIR, "screenshots");
const TEXT = path.join(DIR, "text");
const TS = Date.now();
const TEST_EMAIL = `test+ux-review-${TS}@example.com`;

for (const d of [SHOTS, TEXT]) fs.mkdirSync(d, { recursive: true });

const data = {
  base: BASE,
  date: new Date().toISOString(),
  testEmail: TEST_EMAIL,
  pages: [],
  journeys: [],
  created: [],
  skips: [],
  errors: [],
};
const axeResults = [];
const counters = {};

const DESTRUCTIVE =
  /\b(delete|remove|archive|trash|discard|clear all|revoke|disable|deactivate|unpublish|restore default|reset)\b/i;
const EXTERNAL =
  /\b(log ?out|sign ?out|pay\b|subscribe|checkout|billing|invite|publish|send|upload|google|facebook|linkedin|oauth|generate|ai\b|book|calendly|schedule)\b/i;
const CREATION = /\b(create|new|add|submit|save|apply|start|begin|continue|post)\b/i;

const slugOf = (route) =>
  route === "/" ? "home" : route.replace(/^\//, "").replace(/[\/?#&=]+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 60);

function shotName(slug, action) {
  counters[slug] = (counters[slug] || 0) + 1;
  return `${slug}-${String(counters[slug]).padStart(3, "0")}-${action}.png`;
}

async function snap(page, slug, action, opts = {}) {
  const name = shotName(slug, action);
  try {
    await page.screenshot({ path: path.join(SHOTS, name), fullPage: !!opts.fullPage, timeout: 15000 });
  } catch (e) {
    data.errors.push({ page: slug, error: `screenshot failed (${action}): ${e.message.split("\n")[0]}` });
  }
  return name;
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ---------- page-level capture ----------

function attachListeners(page, sink) {
  page.on("console", (m) => {
    if (m.type() === "error") sink.consoleErrors.push(m.text().slice(0, 400));
  });
  page.on("pageerror", (e) => sink.consoleErrors.push(`pageerror: ${String(e).slice(0, 400)}`));
  page.on("response", (r) => {
    const url = r.url();
    if (r.status() >= 400 && url.startsWith(BASE) && !url.includes("_next/static"))
      sink.networkErrors.push(`${r.status()} ${url.replace(BASE, "")}`.slice(0, 250));
  });
}

async function gotoSafe(page, url) {
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    return resp;
  } catch (e) {
    return { __error: e.message.split("\n")[0] };
  }
}

async function metrics(page) {
  try {
    return await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        load: nav ? Math.round(nav.loadEventEnd) : null,
        cls: typeof window.__cls === "number" ? Math.round(window.__cls * 1000) / 1000 : null,
      };
    });
  } catch {
    return { dcl: null, load: null, cls: null };
  }
}

async function textExtract(page, route, slug) {
  try {
    const inner = (await page.innerText("body", { timeout: 8000 })).slice(0, 25000);
    let aria = "";
    try {
      aria = (await page.locator("body").ariaSnapshot({ timeout: 8000 })).slice(0, 25000);
    } catch {
      aria = "(aria snapshot unavailable)";
    }
    fs.writeFileSync(
      path.join(TEXT, `${slug}-text.md`),
      `# Text extract: ${route}\n\n## Visible text\n\n${inner}\n\n## ARIA snapshot\n\n${aria}\n`
    );
    return `text/${slug}-text.md`;
  } catch (e) {
    return null;
  }
}

async function axeScan(page, route) {
  const rec = { page: route, violations: [], tabOrder: [], tabIssues: [] };
  try {
    const res = await new AxeBuilder({ page }).analyze();
    rec.violations = res.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      selectors: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
      count: v.nodes.length,
    }));
  } catch (e) {
    rec.violations = [{ id: "axe-failed", impact: "n/a", description: e.message.split("\n")[0], selectors: [], count: 0 }];
  }
  // keyboard tab walk
  try {
    await page.evaluate(() => document.body && document.body.focus && document.body.focus());
    let prevKey = "";
    let repeat = 0;
    for (let i = 1; i <= 40; i++) {
      await page.keyboard.press("Tab");
      const f = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const name =
          el.getAttribute("aria-label") ||
          (el.innerText || el.value || el.getAttribute("placeholder") || "").trim().slice(0, 60);
        return {
          tag: el.tagName.toLowerCase(),
          name,
          focusVisible:
            cs.outlineStyle !== "none" || cs.boxShadow !== "none" || el.matches(":focus-visible"),
        };
      });
      if (!f) break;
      rec.tabOrder.push({ stop: i, tag: f.tag, name: f.name });
      if (!f.focusVisible) rec.tabIssues.push(`stop ${i} (${f.tag} '${f.name}'): no visible focus indicator`);
      const key = f.tag + "|" + f.name;
      if (key === prevKey) {
        repeat++;
        if (repeat === 2) rec.tabIssues.push(`possible focus trap around stop ${i} on ${f.tag} '${f.name}'`);
      } else repeat = 0;
      prevKey = key;
    }
  } catch {}
  axeResults.push(rec);
  return rec;
}

async function setViewport(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(250);
}

// ---------- element inventory + safe clicking ----------

function classify(text, tag, href) {
  const t = (text || "").trim();
  if (href && /^https?:\/\//.test(href) && !href.startsWith(BASE)) return "external";
  if (DESTRUCTIVE.test(t)) return "destructive";
  if (EXTERNAL.test(t)) return "external";
  if (CREATION.test(t) && tag === "button") return "creation";
  return "safe";
}

async function inventory(page) {
  try {
    return await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("a, button, [role=button], input[type=submit], summary"));
      const out = [];
      const seen = new Set();
      for (const el of els) {
        const r = el.getBoundingClientRect();
        const visible = r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== "hidden";
        if (!visible) continue;
        const text =
          (el.getAttribute("aria-label") || el.innerText || el.value || "").trim().replace(/\s+/g, " ").slice(0, 80);
        const href = el.getAttribute("href") || null;
        const key = el.tagName + "|" + text + "|" + href;
        if (seen.has(key) || (!text && !href)) continue;
        seen.add(key);
        out.push({ tag: el.tagName.toLowerCase(), text, href, w: Math.round(r.width), h: Math.round(r.height) });
      }
      return out.slice(0, 80);
    });
  } catch {
    return [];
  }
}

async function clickSafeButtons(page, route, slug, inv, pageRec, maxClicks = 7) {
  let clicks = 0;
  for (const item of inv) {
    if (clicks >= maxClicks) break;
    if (item.tag === "a") continue; // links verified by route visits
    const bucket = classify(item.text, "button", null);
    if (bucket !== "safe") continue;
    if (!item.text) continue;
    try {
      const loc = page.getByRole("button", { name: item.text, exact: false }).first();
      if (!(await loc.isVisible({ timeout: 1500 }).catch(() => false))) continue;
      await loc.click({ timeout: 5000 });
      await page.waitForTimeout(600);
      clicks++;
      const after = page.url().replace(BASE, "") || "/";
      const shot = await snap(page, slug, `click-${item.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`);
      let result;
      const dialog = await page.locator("[role=dialog], dialog[open]").first().isVisible().catch(() => false);
      if (after !== route) {
        result = `navigated to ${after}`;
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(400);
      } else if (dialog) {
        result = "opened dialog/modal";
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
        const still = await page.locator("[role=dialog], dialog[open]").first().isVisible().catch(() => false);
        if (still) {
          await page
            .locator("[role=dialog] button[aria-label*=lose i], [role=dialog] button:has-text('Cancel'), [role=dialog] button:has-text('Close')")
            .first()
            .click({ timeout: 2000 })
            .catch(() => {});
        }
      } else {
        result = "in-page change or no visible change";
      }
      pageRec.interactions.push({ element: "button", bucket: "safe", text: item.text, result, screenshot: shot });
    } catch (e) {
      pageRec.interactions.push({
        element: "button",
        bucket: "safe",
        text: item.text,
        result: `click failed: ${e.message.split("\n")[0].slice(0, 120)}`,
        screenshot: null,
      });
    }
  }
}

// ---------- forms ----------

async function fillVisibleFields(page, scope) {
  const filled = [];
  const fields = await scope.locator("input:visible, textarea:visible, select:visible").all().catch(() => []);
  for (const f of fields) {
    try {
      const tag = await f.evaluate((el) => el.tagName.toLowerCase());
      const type = (await f.getAttribute("type")) || "text";
      const name = ((await f.getAttribute("name")) || (await f.getAttribute("id")) || (await f.getAttribute("placeholder")) || "").toLowerCase();
      if (["hidden", "submit", "button", "file", "image"].includes(type)) continue;
      if (tag === "select") {
        const n = await f.locator("option").count();
        if (n > 1) await f.selectOption({ index: 1 }).catch(() => {});
        filled.push(name || "select");
        continue;
      }
      if (type === "checkbox") {
        await f.check({ timeout: 2000 }).catch(() => {});
        filled.push(name || "checkbox");
        continue;
      }
      if (type === "radio") {
        await f.check({ timeout: 2000 }).catch(() => {});
        continue;
      }
      const existing = await f.inputValue().catch(() => "");
      if (existing) continue;
      let val = "Test input";
      if (type === "email" || name.includes("email")) val = TEST_EMAIL;
      else if (type === "tel" || name.includes("phone")) val = "0400000000";
      else if (type === "password") val = "TestPassword123!";
      else if (type === "number") val = "42";
      else if (type === "url" || name.includes("url") || name.includes("website")) val = "https://example.com";
      else if (type === "date") val = new Date().toISOString().slice(0, 10);
      else if (name.includes("first")) val = "UX";
      else if (name.includes("last")) val = "Review";
      else if (name.includes("name")) val = "UX Review Test";
      else if (name.includes("slug")) val = `ux-review-test-${TS}`;
      else if (name.includes("title")) val = `UX Review Test ${TS}`;
      else if (tag === "textarea") val = "Test input — exploration-generated test content for UX review.";
      else val = `Test input ${name || "field"}`.slice(0, 60);
      await f.fill(val, { timeout: 3000 }).catch(() => {});
      filled.push(name || type);
    } catch {}
  }
  return filled;
}

async function fillInvalidFields(page, scope) {
  const fields = await scope.locator("input:visible").all().catch(() => []);
  for (const f of fields) {
    try {
      const type = (await f.getAttribute("type")) || "text";
      const name = ((await f.getAttribute("name")) || "").toLowerCase();
      if (type === "email" || name.includes("email")) await f.fill("not-an-email").catch(() => {});
      else if (type === "password") await f.fill("x").catch(() => {});
      else if (type === "number") await f.fill("abc").catch(() => {});
      else if (type === "tel" || name.includes("phone")) await f.fill("abc").catch(() => {});
    } catch {}
  }
}

async function visibleErrors(page) {
  try {
    return await page.evaluate(() => {
      const sel = "[role=alert], [aria-invalid=true] ~ *, [class*=error i], [class*=invalid i], [data-error]";
      return Array.from(document.querySelectorAll(sel))
        .map((e) => (e.innerText || "").trim())
        .filter((t) => t && t.length < 200)
        .slice(0, 10);
    });
  } catch {
    return [];
  }
}

function submitButton(scope) {
  return scope
    .locator("button[type=submit], input[type=submit], button:has-text('Submit'), button:has-text('Apply'), button:has-text('Send'), button:has-text('Save'), button:has-text('Create'), button:has-text('Sign in')")
    .first();
}

// Three-phase form test. mode: 'full' | 'no-valid' | 'fill-only'
async function testForm(page, route, slug, pageRec, mode) {
  const formCount = await page.locator("form").count().catch(() => 0);
  const scope = formCount > 0 ? page.locator("form").first() : page;
  const inputCount = await scope.locator("input:visible, textarea:visible, select:visible").count().catch(() => 0);
  if (inputCount === 0) return;
  const rec = { form: formCount > 0 ? "form#1" : "pseudo-form (no <form> element)", fields: inputCount, mode, phases: {}, screenshots: [] };

  if (mode === "fill-only") {
    await fillVisibleFields(page, scope);
    rec.screenshots.push(await snap(page, slug, "form-filled-not-submitted"));
    rec.phases.note = "external-bucket form: filled for visual review, NOT submitted (outbound side effects)";
    pageRec.forms.push(rec);
    return;
  }

  // Phase 1 — empty submit
  try {
    const btn = submitButton(scope);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ timeout: 4000 });
      await page.waitForTimeout(900);
      const errs = await visibleErrors(page);
      rec.screenshots.push(await snap(page, slug, "form-empty-submit"));
      rec.phases.empty = errs.length ? `errors shown: ${errs.join(" | ").slice(0, 300)}` : "no visible validation errors after empty submit";
      if (page.url().replace(BASE, "") !== route) {
        rec.phases.empty += ` (URL changed to ${page.url().replace(BASE, "")} — empty submit may have gone through!)`;
        await gotoSafe(page, BASE + route);
      }
    } else {
      rec.phases.empty = "no submit button found";
    }
  } catch (e) {
    rec.phases.empty = `error: ${e.message.split("\n")[0].slice(0, 120)}`;
  }

  // Phase 2 — invalid data
  try {
    await fillVisibleFields(page, scope);
    await fillInvalidFields(page, scope);
    const btn = submitButton(scope);
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click({ timeout: 4000 });
      await page.waitForTimeout(900);
      const errs = await visibleErrors(page);
      rec.screenshots.push(await snap(page, slug, "form-invalid-submit"));
      const preserved = await scope
        .locator("input:visible")
        .first()
        .inputValue()
        .catch(() => "");
      rec.phases.invalid =
        (errs.length ? `errors shown: ${errs.join(" | ").slice(0, 300)}` : "no visible validation errors on invalid data") +
        (preserved ? " — entered values preserved" : " — entered values were WIPED");
      if (page.url().replace(BASE, "") !== route) {
        rec.phases.invalid += ` (URL changed to ${page.url().replace(BASE, "")})`;
        await gotoSafe(page, BASE + route);
      }
    }
  } catch (e) {
    rec.phases.invalid = `error: ${e.message.split("\n")[0].slice(0, 120)}`;
  }

  if (mode === "no-valid") {
    rec.phases.valid = "skipped — valid submission covered by journey run (avoids duplicate records)";
  }
  pageRec.forms.push(rec);
}

// ---------- core page exploration ----------

async function explorePage(context, route, opts = {}) {
  const slug = slugOf(route);
  log(`PAGE ${route}`);
  const sink = { consoleErrors: [], networkErrors: [] };
  const page = await context.newPage();
  attachListeners(page, sink);
  await page.addInitScript(() => {
    window.__cls = 0;
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
  });

  const pageRec = {
    route,
    slug,
    status: null,
    finalUrl: null,
    screenshots: {},
    textExtract: null,
    metrics: null,
    axeViolationCount: null,
    interactions: [],
    forms: [],
    skips: [],
    consoleErrors: sink.consoleErrors,
    networkErrors: sink.networkErrors,
    responsive: [],
    notes: opts.note ? [opts.note] : [],
  };
  data.pages.push(pageRec);

  await setViewport(page, 1280, 800);
  const resp = await gotoSafe(page, BASE + route);
  if (resp && resp.__error) {
    pageRec.status = `navigation error: ${resp.__error}`;
    data.errors.push({ page: route, error: resp.__error });
    await page.close();
    return pageRec;
  }
  pageRec.status = resp ? resp.status() : "unknown";
  pageRec.finalUrl = page.url().replace(BASE, "") || "/";

  pageRec.screenshots.load = await snap(page, slug, "load");
  pageRec.screenshots.full = await snap(page, slug, "full", { fullPage: true });
  pageRec.metrics = await metrics(page);
  pageRec.textExtract = await textExtract(page, route, slug);
  const axeRec = await axeScan(page, pageRec.finalUrl);
  pageRec.axeViolationCount = axeRec.violations.reduce((a, v) => a + (v.count || 0), 0);

  // inventory + classification
  const inv = await inventory(page);
  for (const item of inv) {
    const bucket = classify(item.text, item.tag, item.href);
    if (bucket === "destructive" || bucket === "external") {
      pageRec.skips.push({ element: `${item.tag} "${item.text}"`, bucket, reason: bucket === "destructive" ? "destructive on pre-existing data" : "external: outbound side effect / leaves app" });
    } else if (item.tag === "a" && item.href) {
      pageRec.interactions.push({ element: "a", bucket: "safe", text: item.text, result: `links to ${item.href} (verified via route visits)`, screenshot: null });
    }
    if ((item.w < 40 || item.h < 32) && item.text) {
      pageRec.notes.push(`small touch target: ${item.tag} "${item.text}" ${item.w}x${item.h}px`);
    }
  }
  if (pageRec.skips.length) await snap(page, slug, "skips-context");

  if (!opts.skipClicks) await clickSafeButtons(page, route, slug, inv, pageRec, opts.maxClicks ?? 7);

  if (opts.formMode) {
    await gotoSafe(page, BASE + route);
    await testForm(page, route, slug, pageRec, opts.formMode);
  }

  // responsive shots
  try {
    await gotoSafe(page, BASE + route);
    await setViewport(page, 375, 667);
    const mob = await snap(page, slug, "mobile");
    const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4);
    pageRec.responsive.push({ viewport: "mobile-375", screenshot: mob, issues: hscroll ? "horizontal scroll present" : "none detected" });
    await setViewport(page, 768, 1024);
    const tab = await snap(page, slug, "tablet");
    pageRec.responsive.push({ viewport: "tablet-768", screenshot: tab, issues: "see screenshot" });
    await setViewport(page, 1280, 800);
  } catch {}

  await page.close();
  return pageRec;
}

// ---------- journeys ----------

function newJourney(slugName, name) {
  const j = { slug: slugName, name, status: "blocked", clicks: 0, pageLoads: 0, steps: [], wrongTurns: [], notes: [], blockedAt: null };
  data.journeys.push(j);
  return j;
}

async function jStep(page, j, action, fn) {
  j.steps.push({ n: j.steps.length + 1, page: page.url().replace(BASE, "") || "/", action, result: "", screenshot: "" });
  const step = j.steps[j.steps.length - 1];
  try {
    const result = await fn();
    step.result = result || "ok";
  } catch (e) {
    step.result = `FAILED: ${e.message.split("\n")[0].slice(0, 150)}`;
  }
  await page.waitForTimeout(500);
  step.screenshot = await snap(page, `journey-${j.slug}`, `${String(step.n).padStart(2, "0")}-${action.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`);
  return step;
}

async function newJourneyPage(context) {
  const page = await context.newPage();
  attachListeners(page, { consoleErrors: [], networkErrors: [] });
  await page.setViewportSize({ width: 1280, height: 800 });
  return page;
}

async function clickNav(page, j, namePattern, hrefPattern) {
  const link = page.locator(`a[href*="${hrefPattern}"]`).first();
  if (await link.isVisible({ timeout: 3000 }).catch(() => false)) {
    await link.click({ timeout: 5000 });
    j.clicks++;
    j.pageLoads++;
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    return `clicked visible link to ${hrefPattern} → ${page.url().replace(BASE, "")}`;
  }
  // try opening a mobile/hamburger menu
  const menuBtn = page.locator("button[aria-label*=menu i], button:has-text('Menu')").first();
  if (await menuBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await menuBtn.click().catch(() => {});
    j.clicks++;
    await page.waitForTimeout(400);
    const l2 = page.locator(`a[href*="${hrefPattern}"]`).first();
    if (await l2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await l2.click();
      j.clicks++;
      j.pageLoads++;
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      return `via menu → ${page.url().replace(BASE, "")}`;
    }
  }
  throw new Error(`no visible link matching ${hrefPattern} (${namePattern}) on ${page.url().replace(BASE, "")}`);
}

async function journeyDiscoverAndApply(context) {
  const j = newJourney("discover-and-apply", "Discover & Apply");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "load homepage", async () => {
      await gotoSafe(page, BASE + "/");
      j.pageLoads++;
      return "homepage loaded";
    });
    await jStep(page, j, "find and click Apply CTA", async () => clickNav(page, j, "apply", "/apply"));
    if (!page.url().includes("/apply")) {
      j.wrongTurns.push("Apply CTA did not lead to /apply");
    }
    let done = false;
    for (let round = 1; round <= 6 && !done; round++) {
      await jStep(page, j, `fill visible fields (round ${round})`, async () => {
        const filled = await fillVisibleFields(page, page);
        return `filled: ${filled.slice(0, 12).join(", ") || "nothing left to fill"}`;
      });
      await jStep(page, j, `submit/continue (round ${round})`, async () => {
        const btn = page
          .locator("button[type=submit]:visible, button:has-text('Apply'):visible, button:has-text('Submit'):visible, button:has-text('Next'):visible, button:has-text('Continue'):visible, button:has-text('Send'):visible")
          .first();
        if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no submit/continue button visible");
        const label = (await btn.innerText().catch(() => "submit")).trim();
        await btn.click({ timeout: 5000 });
        j.clicks++;
        await page.waitForTimeout(1500);
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        const url = page.url().replace(BASE, "");
        const successText = await page
          .locator("text=/thank you|application received|we.ll be in touch|success/i")
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (url.includes("thank-you") || successText) {
          done = true;
          return `clicked "${label}" → success state (${url})`;
        }
        const errs = await visibleErrors(page);
        return `clicked "${label}" → still on ${url}${errs.length ? `; errors: ${errs.join(" | ").slice(0, 200)}` : ""}`;
      });
    }
    if (done) {
      j.status = "completed";
      data.created.push({ url: "/apply (lead record)", name: `application lead ${TEST_EMAIL}`, source_page: "/apply", type: "lead-form-submission" });
    } else {
      j.status = "blocked";
      j.blockedAt = `${page.url().replace(BASE, "")} — could not reach success state after form submission rounds`;
    }
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function journeyContact(context) {
  const j = newJourney("contact-the-team", "Contact the Team");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "load homepage", async () => {
      await gotoSafe(page, BASE + "/");
      j.pageLoads++;
      return "homepage loaded";
    });
    await jStep(page, j, "find and click Contact link", async () => clickNav(page, j, "contact", "/contact"));
    await jStep(page, j, "fill contact form (not submitted)", async () => {
      const filled = await fillVisibleFields(page, page);
      return `filled: ${filled.slice(0, 10).join(", ")} — submission SKIPPED (safety: outbound email to real recipient)`;
    });
    j.status = "blocked";
    j.blockedAt = "/contact submit — skipped by safety policy (outbound email); path up to submit was followable";
    j.notes.push("Form fill and visual flow verified; actual send not performed per destructive/external safety policy.");
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function journeyReadNews(context) {
  const j = newJourney("read-a-news-article", "Read a News Article");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "load homepage", async () => {
      await gotoSafe(page, BASE + "/");
      j.pageLoads++;
      return "homepage loaded";
    });
    await jStep(page, j, "navigate to News", async () => clickNav(page, j, "news", "/news"));
    await jStep(page, j, "open first article", async () => {
      const card = page.locator("a[href*='/news/']").first();
      if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no article links visible on /news");
      const href = await card.getAttribute("href");
      await card.click();
      j.clicks++;
      j.pageLoads++;
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      return `opened ${href}`;
    });
    await jStep(page, j, "verify article content + scroll", async () => {
      const h1 = await page.locator("h1").first().innerText({ timeout: 3000 }).catch(() => "");
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(400);
      if (!h1) throw new Error("no h1 found on article");
      return `article heading: "${h1.slice(0, 80)}"`;
    });
    await jStep(page, j, "return to news listing", async () => {
      const back = page.locator("a[href='/news']").first();
      if (await back.isVisible({ timeout: 2000 }).catch(() => false)) {
        await back.click();
        j.clicks++;
        j.pageLoads++;
        await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
        return "clicked visible back-to-news link";
      }
      await page.goBack();
      j.pageLoads++;
      j.wrongTurns.push("no visible 'back to news' affordance on article — used browser back");
      return "no in-page back link; used browser back button";
    });
    j.status = j.wrongTurns.length ? "completed-with-friction" : "completed";
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function journeyTrust(context) {
  const j = newJourney("evaluate-trust", "Evaluate Trust Before Committing");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "load homepage", async () => {
      await gotoSafe(page, BASE + "/");
      j.pageLoads++;
      return "homepage loaded";
    });
    for (const [label, href] of [["About", "/about"], ["Case Studies", "/case-studies"], ["Privacy", "/privacy"], ["Terms", "/terms"]]) {
      await jStep(page, j, `navigate to ${label}`, async () => {
        const r = await clickNav(page, j, label, href);
        const h1 = await page.locator("h1, h2").first().innerText({ timeout: 3000 }).catch(() => "(no heading)");
        return `${r}; heading: "${h1.slice(0, 60)}"`;
      });
      await jStep(page, j, `return home from ${label}`, async () => {
        await gotoSafe(page, BASE + "/");
        j.pageLoads++;
        return "back on homepage";
      });
    }
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = failed.length === 0 ? "completed" : failed.length <= 2 ? "completed-with-friction" : "blocked";
    if (failed.length) j.notes.push(`${failed.length} trust pages not reachable from visible navigation: ${failed.map((s) => s.action).join("; ")}`);
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function journeyPreCall(context) {
  const j = newJourney("pre-call-prep", "Pre-Call Resources");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "open pre-call resources (email-link entry)", async () => {
      await gotoSafe(page, BASE + "/pre-call-resources");
      j.pageLoads++;
      const h = await page.locator("h1, h2").first().innerText({ timeout: 3000 }).catch(() => "");
      return `loaded; heading: "${h.slice(0, 70)}"`;
    });
    await jStep(page, j, "scroll through resources", async () => {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(500);
      const vids = await page.locator("iframe, video").count();
      const links = await page.locator("a:visible").count();
      return `${vids} embedded video(s)/iframe(s), ${links} visible links`;
    });
    j.status = "completed";
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function journeyAdminNewsDraft(context) {
  const j = newJourney("admin-create-news-draft", "Admin: Create a News Draft");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "open /admin", async () => {
      await gotoSafe(page, BASE + "/admin");
      j.pageLoads++;
      return `landed on ${page.url().replace(BASE, "")} (dev auth bypass)`;
    });
    await jStep(page, j, "navigate to News section", async () => clickNav(page, j, "news", "/admin/news"));
    await jStep(page, j, "click New post", async () => {
      const btn = page.locator("a[href*='/admin/news/new'], button:has-text('New')").first();
      if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no visible New post button on /admin/news");
      await btn.click();
      j.clicks++;
      j.pageLoads++;
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      return `on ${page.url().replace(BASE, "")}`;
    });
    await jStep(page, j, "fill title and content", async () => {
      const filled = await fillVisibleFields(page, page);
      const editor = page.locator("[contenteditable=true]").first();
      if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editor.click();
        await page.keyboard.type("UX review exploration test content. Safe to delete.", { delay: 5 });
        filled.push("rich-text editor");
      }
      return `filled: ${filled.slice(0, 10).join(", ")}`;
    });
    await jStep(page, j, "save draft (NOT publish)", async () => {
      const save = page.locator("button:has-text('Save draft'), button:has-text('Save Draft'), button:has-text('Save')").first();
      if (!(await save.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no visible Save/Save draft button");
      const label = (await save.innerText()).trim();
      if (/publish/i.test(label)) throw new Error("only a Publish button visible — refusing (would go live)");
      await save.click();
      j.clicks++;
      await page.waitForTimeout(2000);
      return `clicked "${label}" → now on ${page.url().replace(BASE, "")}`;
    });
    await jStep(page, j, "verify draft in news list", async () => {
      await gotoSafe(page, BASE + "/admin/news");
      j.pageLoads++;
      const found = await page.locator(`text=UX Review Test ${TS}`).first().isVisible({ timeout: 4000 }).catch(() => false);
      if (found) {
        data.created.push({ url: page.url().replace(BASE, ""), name: `UX Review Test ${TS}`, source_page: "/admin/news/new", type: "news-draft" });
        return "draft visible in list";
      }
      throw new Error("created draft not found in /admin/news list");
    });
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = failed.length === 0 ? "completed" : "blocked";
    if (failed.length) j.blockedAt = `${failed[0].page} — ${failed[0].result}`;
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function journeyAdminSeoPage(context) {
  const j = newJourney("admin-create-seo-page", "Admin: Create an SEO Page Draft");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "open /admin/pages", async () => {
      await gotoSafe(page, BASE + "/admin/pages");
      j.pageLoads++;
      return "pages list loaded";
    });
    await jStep(page, j, "click New page", async () => {
      const btn = page.locator("a[href*='/admin/pages/new'], button:has-text('New page'), button:has-text('New Page')").first();
      if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no visible New page button");
      await btn.click();
      j.clicks++;
      j.pageLoads++;
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      return `on ${page.url().replace(BASE, "")}`;
    });
    await jStep(page, j, "fill new page form", async () => {
      const filled = await fillVisibleFields(page, page);
      return `filled: ${filled.slice(0, 10).join(", ")}`;
    });
    await jStep(page, j, "create the page", async () => {
      const btn = page.locator("button:has-text('Create'), button[type=submit]").first();
      if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("no Create button visible");
      const label = (await btn.innerText().catch(() => "Create")).trim();
      if (/publish/i.test(label)) throw new Error("refusing publish-labelled action");
      await btn.click();
      j.clicks++;
      await page.waitForTimeout(2500);
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      const url = page.url().replace(BASE, "");
      if (/\/admin\/pages\/[a-z0-9-]+/i.test(url) && !url.endsWith("/new")) {
        data.created.push({ url, name: `ux-review-test-${TS}`, source_page: "/admin/pages/new", type: "seo-page-draft" });
        return `created → editor at ${url}`;
      }
      const errs = await visibleErrors(page);
      return `clicked "${label}" → ${url}${errs.length ? `; errors: ${errs.join(" | ").slice(0, 200)}` : ""}`;
    });
    await jStep(page, j, "try adding a block in editor", async () => {
      const add = page.locator("button:has-text('Add block'), button:has-text('Add Block'), button[aria-label*='add block' i]").first();
      if (!(await add.isVisible({ timeout: 3000 }).catch(() => false))) return "no visible Add block control (noted)";
      await add.click();
      j.clicks++;
      await page.waitForTimeout(800);
      const firstOption = page.locator("[role=dialog] button, [role=listbox] [role=option], [class*=picker i] button").first();
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        const name = (await firstOption.innerText().catch(() => "block")).trim().slice(0, 40);
        await firstOption.click();
        j.clicks++;
        await page.waitForTimeout(800);
        return `added block: "${name}"`;
      }
      return "block picker opened but no selectable option found";
    });
    await jStep(page, j, "save draft", async () => {
      const save = page.locator("button:has-text('Save')").first();
      if (!(await save.isVisible({ timeout: 3000 }).catch(() => false))) return "no separate Save button (may autosave — noted)";
      const label = (await save.innerText()).trim();
      if (/publish/i.test(label)) return "only Publish visible — skipped (would go live)";
      await save.click();
      j.clicks++;
      await page.waitForTimeout(1500);
      return `clicked "${label}"`;
    });
    const created = data.created.some((c) => c.type === "seo-page-draft");
    const failed = j.steps.filter((s) => s.result.startsWith("FAILED"));
    j.status = created && failed.length === 0 ? "completed" : created ? "completed-with-friction" : "blocked";
    if (!created) j.blockedAt = `${page.url().replace(BASE, "")} — page creation did not reach editor`;
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

async function journeyAdminOps(context) {
  const j = newJourney("admin-manage-content-ops", "Admin: Media & Settings Walkthrough");
  const page = await newJourneyPage(context);
  try {
    await jStep(page, j, "open admin studio", async () => {
      await gotoSafe(page, BASE + "/admin/pages");
      j.pageLoads++;
      return "studio loaded";
    });
    for (const [label, href] of [
      ["Media", "/admin/media"],
      ["Libraries", "/admin/libraries"],
      ["Redirects", "/admin/pages/redirects"],
      ["Settings", "/admin/settings"],
      ["Users", "/admin/settings/users"],
    ]) {
      await jStep(page, j, `navigate to ${label}`, async () => {
        try {
          return await clickNav(page, j, label, href);
        } catch (e) {
          await gotoSafe(page, BASE + href);
          j.pageLoads++;
          j.wrongTurns.push(`${label}: no visible nav link from ${page.url().replace(BASE, "")} — required direct URL`);
          return `NO visible nav affordance — direct URL used (${href})`;
        }
      });
    }
    j.status = j.wrongTurns.length === 0 ? "completed" : "completed-with-friction";
  } catch (e) {
    j.blockedAt = `${page.url().replace(BASE, "")} — ${e.message.split("\n")[0]}`;
  }
  await page.close();
}

// ---------- destructive test on session-created records ----------

async function destructiveOnCreated(context) {
  const newsDraft = data.created.find((c) => c.type === "news-draft");
  if (!newsDraft) return;
  const page = await newJourneyPage(context);
  const slug = "cleanup-created";
  try {
    await gotoSafe(page, BASE + "/admin/news");
    const row = page.locator(`tr:has-text("${newsDraft.name}"), [class*=row]:has-text("${newsDraft.name}"), li:has-text("${newsDraft.name}")`).first();
    if (await row.isVisible({ timeout: 4000 }).catch(() => false)) {
      await snap(page, slug, "row-located");
      const del = row.locator("button:has-text('Delete'), [aria-label*=delete i]").first();
      if (await del.isVisible({ timeout: 2000 }).catch(() => false)) {
        await del.click();
        await page.waitForTimeout(700);
        await snap(page, slug, "delete-dialog");
        const confirm = page.locator("[role=dialog] button:has-text('Delete'), [role=dialog] button:has-text('Confirm')").first();
        if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirm.click();
          await page.waitForTimeout(1500);
          await snap(page, slug, "after-delete");
          data.skips.push({ page: "/admin/news", element: `Delete "${newsDraft.name}"`, target: newsDraft.name, reason: "PERFORMED — session-created record" });
        } else {
          data.skips.push({ page: "/admin/news", element: "Delete (created draft)", target: newsDraft.name, reason: "no confirm dialog found after delete click — check screenshots" });
        }
      } else {
        // open the draft editor and look for delete there
        await row.locator("a").first().click().catch(() => {});
        await page.waitForTimeout(1200);
        const del2 = page.locator("button:has-text('Delete')").first();
        if (await del2.isVisible({ timeout: 2000 }).catch(() => false)) {
          await del2.click();
          await page.waitForTimeout(700);
          await snap(page, slug, "delete-dialog-editor");
          const confirm = page.locator("[role=dialog] button:has-text('Delete'), button:has-text('Confirm')").first();
          if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirm.click();
            await page.waitForTimeout(1500);
            await snap(page, slug, "after-delete");
            data.skips.push({ page: "/admin/news", element: `Delete "${newsDraft.name}"`, target: newsDraft.name, reason: "PERFORMED — session-created record (via editor)" });
          }
        } else {
          data.skips.push({ page: "/admin/news", element: "Delete (created draft)", target: newsDraft.name, reason: "no delete control found — draft left in place (named UX Review Test, safe to remove manually)" });
        }
      }
    }
  } catch (e) {
    data.errors.push({ page: "/admin/news", error: `cleanup attempt: ${e.message.split("\n")[0]}` });
  }
  await page.close();
}

// ---------- log generation ----------

function genLogs() {
  fs.writeFileSync(path.join(DIR, "axe-results.json"), JSON.stringify(axeResults, null, 2));
  fs.writeFileSync(
    path.join(DIR, "session-created.json"),
    JSON.stringify({ created: data.created }, null, 2)
  );
  fs.writeFileSync(path.join(DIR, "exploration-data.json"), JSON.stringify(data, null, 2));

  const totalShots = Object.values(counters).reduce((a, b) => a + b, 0);
  const totalInteractions = data.pages.reduce((a, p) => a + p.interactions.length + p.forms.length, 0) + data.journeys.reduce((a, j) => a + j.clicks, 0);

  let md = `# Exploration Log\n\nBase URL: ${BASE}\nDate: ${data.date}\nTest email used: ${TEST_EMAIL}\nPages explored: ${data.pages.length}\nJourneys executed: ${data.journeys.length} (see journeys.md)\nTotal interactions: ~${totalInteractions}\nScreenshots captured: ${totalShots}\nCreated artifacts this session: ${data.created.length} (see session-created.json)\nSkipped destructive/external actions: ${data.pages.reduce((a, p) => a + p.skips.length, 0)}\n\n---\n`;

  for (const p of data.pages) {
    md += `\n## Page: ${p.route}\n\n### Load\n- Status: ${p.status}${p.finalUrl && p.finalUrl !== p.route ? ` (redirected to ${p.finalUrl})` : ""}\n- Screenshot: screenshots/${p.screenshots.load || "n/a"} | fullPage: screenshots/${p.screenshots.full || "n/a"}\n- Text extract: ${p.textExtract || "n/a"}\n- Load time: ${p.metrics?.dcl ?? "?"}ms DCL / ${p.metrics?.load ?? "?"}ms load\n- Layout shift (CLS): ${p.metrics?.cls ?? "?"}\n- Axe violation instances: ${p.axeViolationCount ?? "?"} (see axe-results.json)\n${p.notes.length ? p.notes.map((n) => `- NOTE: ${n}`).join("\n") + "\n" : ""}`;
    if (p.interactions.length) {
      md += `\n### Interactive inventory\n| # | Element | Bucket | Text/Label | Action Result | Screenshot |\n|---|---------|--------|-----------|---------------|------------|\n`;
      p.interactions.forEach((it, i) => {
        md += `| ${i + 1} | ${it.element} | ${it.bucket} | "${(it.text || "").replace(/\|/g, "/")}" | ${(it.result || "").replace(/\|/g, "/")} | ${it.screenshot || "—"} |\n`;
      });
    }
    if (p.forms.length) {
      md += `\n### Forms\n`;
      for (const f of p.forms) {
        md += `- ${f.form} (${f.fields} fields, mode: ${f.mode})\n`;
        for (const [k, v] of Object.entries(f.phases)) md += `  - ${k}: ${v}\n`;
        if (f.screenshots.length) md += `  - screenshots: ${f.screenshots.join(", ")}\n`;
      }
    }
    if (p.skips.length) {
      md += `\n### Destructive / External skips\n| Element | Bucket | Reason |\n|---------|--------|--------|\n`;
      for (const s of p.skips) md += `| ${s.element.replace(/\|/g, "/")} | ${s.bucket} | ${s.reason} |\n`;
    }
    if (p.responsive.length) {
      md += `\n### Responsive\n| Viewport | Screenshot | Issues |\n|----------|------------|--------|\n`;
      for (const r of p.responsive) md += `| ${r.viewport} | ${r.screenshot} | ${r.issues} |\n`;
    }
    if (p.consoleErrors.length) {
      md += `\n### Console Errors\n${[...new Set(p.consoleErrors)].slice(0, 10).map((e) => `- ${e}`).join("\n")}\n`;
    }
    if (p.networkErrors.length) {
      md += `\n### Failed Network Requests\n${[...new Set(p.networkErrors)].slice(0, 10).map((e) => `- ${e}`).join("\n")}\n`;
    }
    md += `\n---\n`;
  }

  md += `\n## Session-created artifacts\n\n| # | URL | Name | Created from |\n|---|-----|------|--------------|\n`;
  data.created.forEach((c, i) => (md += `| ${i + 1} | ${c.url} | ${c.name} | ${c.source_page} |\n`));
  md += `\n## Skipped destructive actions (global)\n\n| Page | Element | Target | Reason |\n|------|---------|--------|--------|\n`;
  for (const s of data.skips) md += `| ${s.page} | ${s.element} | ${s.target || "—"} | ${s.reason} |\n`;
  for (const p of data.pages) for (const s of p.skips) md += `| ${p.route} | ${s.element} | — | ${s.reason} |\n`;
  md += `\n## Exploration errors\n\n| Page | Error |\n|------|-------|\n`;
  for (const e of data.errors) md += `| ${e.page} | ${e.error.replace(/\|/g, "/")} |\n`;

  fs.writeFileSync(path.join(DIR, "exploration-log.md"), md);

  // journeys.md results
  let jm = "";
  for (const j of data.journeys) {
    jm += `\n## Journey results: ${j.name}\n\n- Status: ${j.status}\n- Clicks: ${j.clicks} | Page loads: ${j.pageLoads}\n${j.blockedAt ? `- Blocked at: ${j.blockedAt}\n` : ""}\n| # | Page | Action | Result | Screenshot |\n|---|------|--------|--------|------------|\n`;
    for (const s of j.steps)
      jm += `| ${String(s.n).padStart(2, "0")} | ${s.page} | ${s.action.replace(/\|/g, "/")} | ${s.result.replace(/\|/g, "/").slice(0, 220)} | ${s.screenshot} |\n`;
    if (j.wrongTurns.length) jm += `\n### Wrong turns / dead ends\n${j.wrongTurns.map((w) => `- ${w}`).join("\n")}\n`;
    if (j.notes.length) jm += `\n### Friction notes\n${j.notes.map((n) => `- ${n}`).join("\n")}\n`;
  }
  fs.appendFileSync(path.join(DIR, "journeys.md"), jm);
  log(`LOGS WRITTEN — pages: ${data.pages.length}, journeys: ${data.journeys.length}, shots: ${totalShots}`);
}

// ---------- main ----------

const NEWS_SLUGS = [
  "how-to-choose-the-perfect-location-for-vending-machine",
  "top-5-questions-vending-entrepreneurship-program",
  "top-10-profitable-products-to-stock-in-your-vending-machine",
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  context.setDefaultTimeout(10000);

  // ----- journeys first (first-use state) -----
  log("=== JOURNEYS ===");
  await journeyDiscoverAndApply(context);
  await journeyContact(context);
  await journeyReadNews(context);
  await journeyTrust(context);
  await journeyPreCall(context);
  await journeyAdminNewsDraft(context);
  await journeyAdminSeoPage(context);
  await journeyAdminOps(context);

  // ----- per-page exploration -----
  log("=== PAGES ===");
  const publicPages = [
    ["/", {}],
    ["/about", {}],
    ["/apply", { formMode: "no-valid" }],
    ["/case-studies", {}],
    ["/contact", { formMode: "fill-only" }],
    ["/news", {}],
    [`/news/${NEWS_SLUGS[0]}`, {}],
    [`/news/${NEWS_SLUGS[1]}`, { skipClicks: true }],
    [`/news/${NEWS_SLUGS[2]}`, { skipClicks: true }],
    [`/blog/${NEWS_SLUGS[0]}`, { skipClicks: true, note: "legacy blog path — checking redirect behaviour" }],
    ["/pre-call-resources", {}],
    ["/privacy", { skipClicks: true }],
    ["/terms", { skipClicks: true }],
    ["/thank-you-for-applying", {}],
    ["/resources/vending-sporting-arenas", { skipClicks: true, note: "CMS draft page — expected 404 publicly (no published seo_pages)" }],
    ["/this-page-does-not-exist", { skipClicks: true, note: "404 page check" }],
  ];
  const adminPages = [
    ["/admin/login", { formMode: "no-valid", note: "dev bypass active; form may redirect" }],
    ["/admin/forgot-password", { formMode: "no-valid" }],
    ["/admin/pages", { maxClicks: 6 }],
    ["/admin/pages/new", { formMode: "no-valid", maxClicks: 3 }],
    ["/admin/pages/redirects", { maxClicks: 4 }],
    ["/admin/pages/block-preview-audit", { maxClicks: 2 }],
    ["/admin/news", { maxClicks: 5 }],
    ["/admin/news/new", { formMode: "no-valid", maxClicks: 3 }],
    ["/admin/media", { maxClicks: 5 }],
    ["/admin/libraries", { maxClicks: 5 }],
    ["/admin/settings", { maxClicks: 4 }],
    ["/admin/settings/users", { maxClicks: 3, note: "user management — mutations on real users are skipped" }],
  ];
  for (const [route, opts] of [...publicPages, ...adminPages]) {
    try {
      await explorePage(context, route, opts);
    } catch (e) {
      data.errors.push({ page: route, error: e.message.split("\n")[0] });
      log(`ERROR on ${route}: ${e.message.split("\n")[0]}`);
    }
  }
  // explore the editors of created records
  for (const c of data.created) {
    if (c.type === "seo-page-draft" && c.url.startsWith("/admin/pages/")) {
      await explorePage(context, c.url, { maxClicks: 6, note: "editor of session-created SEO page draft" }).catch(() => {});
    }
  }

  // ----- destructive flow on session-created record -----
  log("=== CLEANUP / DESTRUCTIVE-ON-CREATED ===");
  await destructiveOnCreated(context);

  genLogs();
  await browser.close();
  log("DONE");
})().catch((e) => {
  console.error("FATAL", e);
  try {
    genLogs();
  } catch {}
  process.exit(1);
});
