import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const PAGE_ID = process.argv[2] || "e44f0fc3-0dcf-480f-9c99-f3409c690378";
const URL = `${BASE}/admin/pages/${PAGE_ID}`;
const DIR = "plans/seo-builder-ux-fixes/agent-runs/n14-screens";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Detect the native beforeunload / save dialog suppression: if Cmd+S triggers
// the browser save dialog, Playwright would see a download or print dialog.
// We assert preventDefault by checking our save indicator fires and no dialog.
let dialogSeen = false;
page.on("dialog", async (d) => { dialogSeen = true; await d.dismiss().catch(() => {}); });

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);

const isMac = process.platform === "darwin";
const MOD = isMac ? "Meta" : "Control";

// ---- Test 1: Cmd/Ctrl+S triggers manual save ----
// Click on the page body (canvas) to ensure focus is not in a field.
await page.mouse.click(720, 300);
await page.waitForTimeout(200);
await page.keyboard.press(`${MOD}+s`);
await page.waitForTimeout(2500);
// A manual save surfaces the "Saved automatically"/save status or autosave text.
const bodyText1 = await page.locator("body").innerText();
const saveIndicator =
  /saved automatically|autosaved|saved\b|saving/i.test(bodyText1);
await page.screenshot({ path: `${DIR}/save-after-cmd-s.png` });

// ---- Test 2: "/" opens the block picker when canvas-focused ----
await page.mouse.click(720, 400);
await page.waitForTimeout(150);
await page.keyboard.press("/");
await page.waitForTimeout(700);
const pickerOpen = await page
  .getByRole("heading", { name: "Add page content" })
  .first()
  .isVisible()
  .catch(() => false);
await page.screenshot({ path: `${DIR}/slash-opens-picker.png` });
// close it
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// ---- Test 3: "/" suppressed while typing in a text field ----
// Focus a text input (the SEO panel title field, or any visible input). Open SEO panel first.
const seoToggle = page.getByRole("button", { name: /SEO/i }).first();
await seoToggle.click().catch(() => {});
await page.waitForTimeout(500);
const anyInput = page.locator('input[type="text"], input:not([type]), textarea').first();
let slashTypedNotPicker = null;
if (await anyInput.isVisible().catch(() => false)) {
  await anyInput.click();
  await anyInput.fill("");
  await page.keyboard.press("/");
  await page.waitForTimeout(500);
  const val = await anyInput.inputValue().catch(() => "");
  const pickerOpenedWhileTyping = await page
    .getByRole("heading", { name: "Add page content" })
    .first()
    .isVisible()
    .catch(() => false);
  slashTypedNotPicker = { fieldValue: val, pickerOpenedWhileTyping };
}
await page.screenshot({ path: `${DIR}/slash-in-field.png` });

console.log(JSON.stringify({
  page: URL,
  modifier: MOD,
  test1_saveIndicatorAfterCmdS: saveIndicator,
  test1_noBrowserDialog: !dialogSeen,
  test2_slashOpensPicker: pickerOpen,
  test3_slashWhileTyping: slashTypedNotPicker,
}, null, 2));

await browser.close();
