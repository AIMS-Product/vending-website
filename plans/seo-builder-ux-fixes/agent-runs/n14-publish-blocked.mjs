import { chromium } from "playwright";

const ID = process.argv[2] || "bb27a586-a967-49a1-8f2d-c1a0fed87e98";
const URL = `http://localhost:3001/admin/pages/${ID}`;
const DIR = "plans/seo-builder-ux-fixes/agent-runs/n14-screens";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

let navigated = false;
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) navigated = true;
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1800);
navigated = false;

const isMac = process.platform === "darwin";
const MOD = isMac ? "Meta" : "Control";

await page.evaluate(() => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  document.body.focus();
});
await page.keyboard.press(`${MOD}+Enter`);
await page.waitForTimeout(900);

// On a BLOCKED page: NO confirm dialog, NO publish/submit; the blocker
// checklist should be surfaced (it is rendered when blockers exist; the
// reveal also focuses the next-step reason).
const confirmShown = await page
  .getByRole("button", { name: /^confirm publish$/i })
  .isVisible()
  .catch(() => false);

const blockersVisible = await page
  .getByText(/resolve .* (item|items) in the checklist|checklist before publishing/i)
  .first()
  .isVisible()
  .catch(() => false);

// Detect that the publish-blocker checklist region or next-step is present.
const blockerRegion = await page.evaluate(() => {
  const txt = document.body.innerText;
  return /publish blocker|before you can publish|resolve \d+ item|add seo title|add .* before publishing/i.test(txt);
});

await page.screenshot({ path: `${DIR}/publish-blocked-cmd-enter.png` });

console.log(JSON.stringify({
  page: URL,
  modifier: MOD,
  confirmDialogShown: confirmShown,
  didNotPublishOrSubmit: !navigated && !confirmShown,
  blockerMessagingVisible: blockersVisible || blockerRegion,
}, null, 2));

await browser.close();
