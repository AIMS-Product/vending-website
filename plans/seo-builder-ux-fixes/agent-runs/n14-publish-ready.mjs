import { chromium } from "playwright";

const URL = `http://localhost:3001/admin/pages/${process.argv[2] || "e44f0fc3-0dcf-480f-9c99-f3409c690378"}`;
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
navigated = false; // reset after initial load

const isMac = process.platform === "darwin";
const MOD = isMac ? "Meta" : "Control";

// Focus the canvas (not a field) and press Cmd/Ctrl+Enter.
await page.evaluate(() => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  document.body.focus();
});
await page.keyboard.press(`${MOD}+Enter`);
await page.waitForTimeout(900);

// On a READY page, Cmd+Enter must open the confirm dialog, NOT submit/publish.
const confirmVisible = await page
  .getByText("Confirm publish", { exact: false })
  .first()
  .isVisible()
  .catch(() => false);
const confirmButton = page.getByRole("button", { name: /^confirm publish$/i });
const confirmButtonVisible = await confirmButton.isVisible().catch(() => false);

await page.screenshot({ path: `${DIR}/publish-ready-cmd-enter-confirm.png` });

console.log(JSON.stringify({
  page: URL,
  modifier: MOD,
  confirmDialogShown: confirmVisible,
  confirmButtonPresent: confirmButtonVisible,
  didNotAutoSubmit: !navigated,
}, null, 2));

await browser.close();
