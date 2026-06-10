import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const ITER = 10;
const browser = await chromium.launch();
const log = [];
const tally = { registered: 0, ignored: 0, notfound: 0, details: [] };

// Aggressive race variant: navigate, wait only for domcontentloaded, then
// dispatch a raw DOM click on the button immediately (bypassing Playwright's
// actionability auto-wait). If hydration hasn't attached the React onClick yet,
// the click is a no-op and the gate stays. We give 4s for the state to flip.
for (let i = 1; i <= ITER; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "domcontentloaded", timeout: 60000 });

    // Raw click the instant the button node exists in the DOM.
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b = btns.find((x) => (x.textContent || "").trim() === "Start building page");
      if (!b) return "no-button";
      b.click();
      return "clicked";
    });

    if (clicked === "no-button") {
      // Button not yet in DOM at domcontentloaded; wait for it and raw-click once.
      await page.locator("button:has-text('Start building page')").waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll("button")).find((x) => (x.textContent || "").trim() === "Start building page");
        if (b) b.click();
      });
    }

    let gone = false;
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const present = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button")).some((x) => (x.textContent || "").trim() === "Start building page"),
      );
      if (!present) { gone = true; break; }
      await page.waitForTimeout(120);
    }

    if (gone) {
      tally.registered++;
      tally.details.push(`iter ${i}: REGISTERED (first-click=${clicked})`);
    } else {
      tally.ignored++;
      tally.details.push(`iter ${i}: IGNORED (gate persisted; first-click=${clicked}) — hydration race`);
    }
  } catch (e) {
    tally.notfound++;
    tally.details.push(`iter ${i}: ERR (${String(e.message || e).split("\n")[0].slice(0, 120)})`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
log.push(`iterations: ${ITER} (strict raw-click @ domcontentloaded)`);
log.push(`registered: ${tally.registered}  ignored(race): ${tally.ignored}  err: ${tally.notfound}`);
log.push(tally.details.join("\n"));
console.log(log.join("\n"));
