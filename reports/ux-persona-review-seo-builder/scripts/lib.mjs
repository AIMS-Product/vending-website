import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

export const BASE_URL = "http://localhost:3000";
export const ROOT = path.resolve("reports/ux-persona-review-seo-builder");
export const SHOTS = path.join(ROOT, "screenshots");
export const TEXT = path.join(ROOT, "text");

export function slugify(route) {
  const s = route.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9-]/g, "_");
  return s || "home";
}

export async function launch() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  return { browser, context };
}

export function attachConsoleCapture(page, sink) {
  page.on("console", (msg) => {
    if (msg.type() === "error") sink.consoleErrors.push(msg.text().slice(0, 500));
  });
  page.on("pageerror", (err) => sink.consoleErrors.push(`pageerror: ${String(err).slice(0, 500)}`));
  page.on("response", (res) => {
    if (res.status() >= 400) sink.failedRequests.push(`${res.status()} ${res.url().slice(0, 200)}`);
  });
}

export async function shot(page, name, opts = {}) {
  const file = path.join(SHOTS, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: !!opts.fullPage, timeout: 15000 });
  } catch (e) {
    // page may have navigated mid-shot; retry once without animations wait
    try { await page.screenshot({ path: file, timeout: 15000 }); } catch {}
  }
  return `${name}.png`;
}

export async function extractText(page, routeSlug) {
  try {
    const inner = await page.innerText("body", { timeout: 10000 });
    let aria = "";
    try { aria = await page.locator("body").ariaSnapshot({ timeout: 10000 }); } catch { aria = "(aria snapshot failed)"; }
    const route = page.url().replace(BASE_URL, "") || "/";
    fs.writeFileSync(
      path.join(TEXT, `${routeSlug}-text.md`),
      `# Text extract: ${route}\n\n## Visible text\n\n${inner}\n\n## ARIA snapshot\n\n\`\`\`\n${aria}\n\`\`\`\n`
    );
    return `${routeSlug}-text.md`;
  } catch (e) {
    return `(text extract failed: ${e.message})`;
  }
}

export async function axeScan(page) {
  try {
    const results = await new AxeBuilder({ page }).analyze();
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      selectors: v.nodes.slice(0, 10).map((n) => n.target.join(" ")),
      count: v.nodes.length,
    }));
  } catch (e) {
    return [{ id: "axe-scan-failed", impact: "n/a", description: String(e.message).slice(0, 200), selectors: [], count: 0 }];
  }
}

export async function tabWalk(page, maxStops = 50) {
  const stops = [];
  const issues = [];
  try {
    await page.locator("body").click({ position: { x: 1, y: 1 }, timeout: 3000 }).catch(() => {});
    for (let i = 1; i <= maxStops; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const name =
          el.getAttribute("aria-label") ||
          el.textContent?.trim().slice(0, 60) ||
          el.getAttribute("placeholder") ||
          el.getAttribute("name") ||
          "";
        const hasIndicator =
          style.outlineStyle !== "none" ||
          style.boxShadow !== "none" ||
          el.matches(":focus-visible");
        return { tag: el.tagName.toLowerCase(), name, hasIndicator };
      });
      if (!info) { stops.push({ stop: i, tag: "(body)", name: "" }); continue; }
      stops.push({ stop: i, tag: info.tag, name: info.name });
      if (!info.hasIndicator) issues.push(`stop ${i} (${info.tag} '${info.name}'): no visible focus indicator`);
      const last3 = stops.slice(-3);
      if (last3.length === 3 && last3.every((s) => s.tag === info.tag && s.name === info.name)) {
        issues.push(`possible focus trap: stops ${i - 2}-${i} all on ${info.tag} '${info.name}'`);
        break;
      }
    }
  } catch (e) {
    issues.push(`tab walk aborted: ${e.message}`);
  }
  return { stops, issues };
}

export async function perfMetrics(page) {
  try {
    return await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      let cls = 0;
      try {
        for (const e of performance.getEntriesByType("layout-shift")) {
          if (!e.hadRecentInput) cls += e.value;
        }
      } catch {}
      return {
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        load: nav ? Math.round(nav.loadEventEnd) : null,
        cls: Math.round(cls * 1000) / 1000,
      };
    });
  } catch {
    return { domContentLoaded: null, load: null, cls: null };
  }
}

// Click a confirming button if a confirmation dialog/modal appeared.
export async function confirmIfAsked(page, namePattern) {
  try {
    const dlg = page.getByRole("dialog").last();
    if (await dlg.isVisible({ timeout: 2500 }).catch(() => false)) {
      const btn = dlg.getByRole("button", { name: namePattern }).first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click();
        return "confirmed via dialog";
      }
      return "dialog visible but no matching confirm button";
    }
  } catch {}
  return "no dialog";
}

export function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
export function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
