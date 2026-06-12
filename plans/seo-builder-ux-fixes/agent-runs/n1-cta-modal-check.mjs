import { chromium } from "playwright";
const BASE = "http://localhost:3001";
const SHOTS = "plans/seo-builder-ux-fixes/agent-runs/n1-screens";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/admin/pages/new`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.getByRole("button", { name: "Continue" }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Continue" }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Start building page" }).click();
await page.waitForTimeout(1000);
const skip = page.getByRole("button", { name: "Skip walkthrough" });
if (await skip.count()) { await skip.click(); await page.waitForTimeout(400); }

// Add a CTA block via the canvas block picker.
const trigger = page.locator('[data-testid="block-picker-trigger"]').first();
await trigger.click();
await page.waitForTimeout(400);
await page.locator('[data-block-picker-type="cta"]').first().click();
await page.waitForTimeout(400);
await page.locator('[data-testid="block-picker-variant"][data-block-picker-type="cta"]').first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${SHOTS}/06-cta-added.png` }).catch(()=>{});

const checklist = page.locator("#publish-blocker-checklist");
const allLabels = await checklist.locator("li > button").allInnerTexts();
console.log("CHECKLIST_WITH_CTA:\n" + allLabels.map(l=>"  - "+l.replace(/\n/g," ")).join("\n"));

// Click the CTA blocker that routes to "Open block settings" and confirm the
// block-settings modal opens at this CTA block.
const ctaItem = checklist.locator("li > button", { hasText: /call-to-action/i }).first();
console.log("CTA_BLOCK_ITEM_COUNT:", await ctaItem.count());
if (await ctaItem.count()) {
  await ctaItem.click();
  await page.waitForTimeout(700);
  const dialog = page.locator('[role="dialog"][aria-modal="true"]');
  const isOpen = await dialog.count() > 0;
  console.log("MODAL_OPEN_AFTER_CTA_CLICK:", isOpen);
  if (isOpen) {
    console.log("MODAL_TITLE:", await dialog.locator("#block-settings-modal-title").innerText().catch(()=>"(none)"));
  }
  await page.screenshot({ path: `${SHOTS}/07-cta-modal-open.png` }).catch(()=>{});

  // Clear the destination URL inside the modal, apply, and confirm a
  // destination-specific blocker now appears and also routes to the modal.
  const hrefField = dialog.getByLabel(/destination url/i).first();
  if (await hrefField.count()) {
    await hrefField.fill("");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    await dialog.getByRole("button", { name: /apply settings/i }).click();
    await page.waitForTimeout(500);
    const destItem = checklist.locator("li > button", { hasText: /destination url to the call/i }).first();
    console.log("CTA_DEST_ITEM_AFTER_CLEAR:", await destItem.count());
    if (await destItem.count()) {
      await destItem.click();
      await page.waitForTimeout(600);
      console.log("MODAL_OPEN_AFTER_DEST_CLICK:", await page.locator('[role="dialog"][aria-modal="true"]').count() > 0);
      await page.screenshot({ path: `${SHOTS}/08-cta-dest-modal.png` }).catch(()=>{});
    }
  }
}
await browser.close();
