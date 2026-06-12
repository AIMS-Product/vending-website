import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3001";
const SHOTS = path.resolve("plans/ux-verified-technical-fixes/agent-runs/shots");
fs.mkdirSync(SHOTS, { recursive: true });

const ITER = 20;
const browser = await chromium.launch();
const log = [];
const tally = { success: 0, miss: 0, error: 0, details: [] };

// "Registered" = the choice gate disappears (Start building page button gone)
// AND/OR a builder canvas affordance appears, indicating the onClick handler ran.
for (let i = 1; i <= ITER; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    // Fresh navigation, wait only for the load event (no extra settle time) to
    // maximise the chance of catching a hydration race.
    await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "load", timeout: 60000 });

    const btn = page.getByRole("button", { name: "Start building page" });
    // Click as soon as the element exists. Short timeout so we don't mask a race
    // by waiting for hydration to settle.
    await btn.click({ timeout: 5000 });

    // After a successful click the choice gate should be replaced by the editor.
    // Poll briefly for the gate to disappear.
    let gone = false;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const stillThere = await page
        .getByRole("button", { name: "Start building page" })
        .isVisible({ timeout: 200 })
        .catch(() => false);
      if (!stillThere) { gone = true; break; }
      await page.waitForTimeout(150);
    }

    if (gone) {
      tally.success++;
      tally.details.push(`iter ${i}: SUCCESS (gate dismissed, url=${page.url()})`);
    } else {
      tally.miss++;
      tally.details.push(`iter ${i}: MISS (gate still present after click, url=${page.url()})`);
      await page.screenshot({ path: path.join(SHOTS, `s16-c-miss-${i}.png`) }).catch(() => {});
    }
  } catch (e) {
    const msg = String(e.message || e).split("\n")[0];
    // A click timeout / element-not-actionable is itself a form of miss/race.
    if (/Timeout|not.*(visible|attached|stable|enabled)|intercept/i.test(msg)) {
      tally.miss++;
      tally.details.push(`iter ${i}: MISS-CLICK-FAIL (${msg.slice(0, 140)})`);
    } else {
      tally.error++;
      tally.details.push(`iter ${i}: ERROR (${msg.slice(0, 140)})`);
    }
    await page.screenshot({ path: path.join(SHOTS, `s16-c-err-${i}.png`) }).catch(() => {});
  } finally {
    await ctx.close();
  }
}

await browser.close();
log.push(`iterations: ${ITER}`);
log.push(`success: ${tally.success}  miss: ${tally.miss}  error: ${tally.error}`);
log.push(tally.details.join("\n"));
console.log(log.join("\n"));
