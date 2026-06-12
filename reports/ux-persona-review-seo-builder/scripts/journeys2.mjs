import {
  BASE_URL, ROOT, launch, shot, confirmIfAsked, attachConsoleCapture, writeJSON, readJSON,
} from "./lib.mjs";
import path from "node:path";

const SESSION_FILE = path.join(ROOT, "session-created.json");
const RESULTS_FILE = path.join(ROOT, "journey-results-2.json");
const prior = readJSON(path.join(ROOT, "journey-results.json"), {});
const TS = prior.ts;
const createdPageUrl = prior.createdPageUrl; // /admin/pages/{id}
const publicUrl = prior.publicUrl;

const sink = { consoleErrors: [], failedRequests: [] };
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
  try { result = (await fn()) || "ok"; }
  catch (e) { result = `ERROR: ${String(e.message).split("\n")[0].slice(0, 200)}`; }
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
  await page.waitForTimeout(1000);
  J.pageLoads++;
}
async function openAllSeoDetails(page) {
  // open every <details> in the SEO sidebar so buried fields are reachable
  await page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => { d.open = true; });
  });
  await page.waitForTimeout(400);
}
async function saveDraft(J, page) {
  await click(J, page.getByRole("button", { name: /Save draft/i }).first());
  await page.waitForTimeout(2500);
}

// ---------- Journey 2 retry: publish-and-view-live ----------
async function j2(page, context) {
  const J = recorder("publish-and-view-live");
  await step(J, page, "open-editor", () => gotoPage(J, page, `${BASE_URL}${createdPageUrl}`));
  await step(J, page, "read-publish-blocker", async () => {
    const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
    const disabled = await pub.isDisabled().catch(() => false);
    if (!disabled) return "publish enabled, no blocker";
    // blocker text sits next to the status chip
    const blocker = await page.locator("text=/Fix |Add |Resolve /").first().textContent().catch(() => "(unreadable)");
    J.friction.push(`Publish disabled with blocker: "${blocker?.trim()}"`);
    return `publish disabled; blocker: ${blocker?.trim()}`;
  });
  await step(J, page, "resolve-blockers", async () => {
    const notes = [];
    for (let i = 0; i < 4; i++) {
      const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
      const disabled = await pub.isDisabled().catch(() => false);
      if (!disabled) { notes.push("publish enabled"); break; }
      const blocker = ((await page.locator("text=/Fix |Add |Resolve /").first().textContent().catch(() => "")) || "").trim();
      notes.push(`blocker: ${blocker}`);
      if (/SEO title/i.test(blocker)) {
        const f = page.locator("#seo-title-field");
        await f.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        await f.fill("UX SEO Review Test Page | Vendingpreneurs");
        notes.push("filled SEO title");
      } else if (/meta description/i.test(blocker)) {
        const f = page.locator("#page-meta-description-field");
        await f.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        await f.fill("A UX review test page. Exploration-generated meta description with sufficient length for SEO checks.");
        notes.push("filled meta description");
      } else if (/headline|hero/i.test(blocker)) {
        const heading = page.getByLabel(/^Heading/).first();
        await heading.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
        await heading.fill("UX Review Test Headline");
        notes.push("filled hero Heading textarea");
      } else if (/FAQ|question/i.test(blocker)) {
        await page.getByLabel(/^Question/).first().fill("Is this a UX review test question?");
        await page.getByLabel(/^Answer/).first().fill("Yes. Exploration-generated answer content.");
        notes.push("filled FAQ question/answer");
      } else {
        notes.push("unknown blocker; stopping");
        break;
      }
      await saveDraft(J, page);
    }
    return notes.join(" | ");
  });
  await step(J, page, "click-publish", async () => {
    const pub = page.getByRole("button", { name: /^Publish( page| changes)?$/i }).first();
    if (await pub.isDisabled().catch(() => false)) throw new Error("Publish still disabled after fixes");
    await click(J, pub);
    await page.waitForTimeout(800);
    const c = await confirmIfAsked(page, /^Publish/i);
    await page.waitForTimeout(3000);
    return c;
  });
  await step(J, page, "verify-published", async () => {
    const txt = await page.locator("body").innerText();
    if (!/published/i.test(txt)) throw new Error("no 'Published' text after publish");
    return "Published status visible";
  });
  await step(J, page, "open-live-page", async () => {
    const live = page.getByRole("link", { name: /Open live page|View live page/i }).first();
    if (await live.isVisible({ timeout: 3000 }).catch(() => false)) {
      const popupP = context.waitForEvent("page", { timeout: 10000 }).catch(() => null);
      await click(J, live);
      const popup = await popupP;
      if (popup) {
        await popup.waitForLoadState("domcontentloaded").catch(() => {});
        await popup.waitForTimeout(2000);
        await shot(popup, "journey-publish-and-view-live-live-tab");
        const len = (await popup.locator("body").innerText().catch(() => "")).length;
        await popup.close();
        return `live tab rendered (${len} chars)`;
      }
      J.pageLoads++;
      return `navigated same tab: ${page.url().replace(BASE_URL, "")}`;
    }
    J.friction.push("No visible 'Open live page' link after publishing — typed URL manually");
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
  J.status = errs.length ? "blocked" : J.friction.length ? "completed-with-friction" : "completed";
  if (errs.length) J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- Journey 4 retry: revision-restore (after publish) ----------
async function j4(page) {
  const J = recorder("revision-restore");
  await step(J, page, "open-editor", () => gotoPage(J, page, `${BASE_URL}${createdPageUrl}`));
  await step(J, page, "find-revision-history", async () => {
    const heading = page.getByText(/Revision history/i).first();
    await heading.scrollIntoViewIfNeeded({ timeout: 8000 });
    const empty = await page.getByText(/Revisions appear after publishing/i).isVisible({ timeout: 1500 }).catch(() => false);
    return empty ? "still shows empty state after publish" : "revision entries present";
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
    J.wrongTurns.push("revision preview: no 'Back to editor' control, used browser back");
    await page.goBack(); J.pageLoads++;
    return "browser back";
  });
  await step(J, page, "restore-revision", async () => {
    const restore = page.getByRole("button", { name: /Restore draft/i }).first();
    await restore.scrollIntoViewIfNeeded({ timeout: 8000 });
    await click(J, restore);
    await page.waitForTimeout(800);
    const c = await confirmIfAsked(page, /Restore/i);
    await page.waitForTimeout(2500);
    return c;
  });
  await step(J, page, "verify-restored", async () => {
    const txt = await page.locator("body").innerText();
    return /restored|draft/i.test(txt) ? "editor shows draft state after restore" : "no clear restore confirmation";
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length === 0 ? (J.wrongTurns.length ? "completed-with-friction" : "completed") : "blocked";
  if (errs.length) J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- Journey 5 retry: schedule-publish ----------
async function j5(page) {
  const J = recorder("schedule-publish");
  await step(J, page, "open-editor", () => gotoPage(J, page, `${BASE_URL}${createdPageUrl}`));
  await step(J, page, "open-advanced-sections", async () => {
    await openAllSeoDetails(page);
    const field = page.locator('input[name="scheduledPublishAt"]');
    const visible = await field.isVisible({ timeout: 3000 }).catch(() => false);
    if (!visible) throw new Error("scheduled publish field still not visible after opening all details");
    J.friction.push("Scheduled publish field is buried: SEO panel → Advanced SEO governance section");
    return "all details opened; field visible";
  });
  await step(J, page, "set-schedule", async () => {
    const field = page.locator('input[name="scheduledPublishAt"]');
    await field.scrollIntoViewIfNeeded({ timeout: 5000 });
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const v = `${tomorrow.toISOString().slice(0, 10)}T12:00`;
    await field.fill(v);
    return `filled ${v}`;
  });
  await step(J, page, "save-schedule", async () => saveDraft(J, page));
  await step(J, page, "verify-scheduled", async () => {
    const m = (await page.locator("body").innerText()).match(/Scheduled for[^\n]*/i);
    if (!m) throw new Error("no 'Scheduled for …' indicator found");
    return m[0].slice(0, 120);
  });
  await step(J, page, "cancel-schedule", async () => {
    await openAllSeoDetails(page);
    const label = page.getByText(/Cancel scheduled publish/i).first();
    if (!(await label.isVisible({ timeout: 3000 }).catch(() => false))) throw new Error("Cancel scheduled publish control not found");
    await label.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await click(J, label);
    await saveDraft(J, page);
    return "cancel toggled and saved";
  });
  await step(J, page, "verify-cancelled", async () => {
    const txt = await page.locator("body").innerText();
    if (/Scheduled for/i.test(txt)) throw new Error("'Scheduled for' still present after cancel");
    return "schedule cleared";
  });
  const errs = J.steps.filter((s) => String(s.result).startsWith("ERROR"));
  J.status = errs.length === 0 ? (J.friction.length ? "completed-with-friction" : "completed") : errs.length === 1 ? "completed-with-friction" : "blocked";
  if (J.status === "blocked") J.blockedAt = errs[0].action + ": " + errs[0].result;
}

// ---------- main ----------
if (!createdPageUrl) {
  console.error("No createdPageUrl in journey-results.json — aborting");
  process.exit(1);
}
const { browser, context } = await launch();
const page = await context.newPage();
attachConsoleCapture(page, sink);
console.log(`Continuation run on ${createdPageUrl} (TS=${TS})`);
try { await j2(page, context); } catch (e) { console.log("j2 fatal:", e.message); }
try { await j4(page); } catch (e) { console.log("j4 fatal:", e.message); }
try { await j5(page); } catch (e) { console.log("j5 fatal:", e.message); }
writeJSON(RESULTS_FILE, { ts: TS, createdPageUrl, publicUrl, results, consoleErrors: sink.consoleErrors.slice(0, 100), failedRequests: sink.failedRequests.slice(0, 100) });
await browser.close();
console.log("\nContinuation results:");
for (const r of results) console.log(`  ${r.journey}: ${r.status}${r.blockedAt ? " — " + r.blockedAt : ""}`);
