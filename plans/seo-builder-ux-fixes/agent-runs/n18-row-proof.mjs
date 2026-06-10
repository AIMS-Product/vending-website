import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const DIR = "plans/seo-builder-ux-fixes/agent-runs/n18-screens";
const SRC = "/resources/n18-copy-proof-throwaway";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/admin/pages/redirects`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1000);

// Create a throwaway redirect so the row cell + edit-select render with data.
await page.fill("input[name='sourcePath']", SRC);
await page.fill("input[name='destinationPath']", "/resources");
await page.selectOption("select[name='statusCode']", "308");
await page.getByRole("button", { name: /create redirect/i }).click();
await page.waitForTimeout(1500);

// Read the row cell text (should be words-first, e.g. "Permanent redirect (308)").
const rowCells = await page.$$eval("table tbody td", (tds) =>
  tds.map((t) => t.textContent?.trim()),
);
const wordsFirstCell = rowCells.find((t) => /\(308\)/.test(t || ""));

await page.screenshot({ path: `${DIR}/redirects-with-row.png`, fullPage: true });

// Open the row edit form to confirm its select uses words-first labels.
let rowEditOptions = [];
const editBtn = page.getByRole("button", { name: /edit/i }).first();
if (await editBtn.isVisible().catch(() => false)) {
  await editBtn.click();
  await page.waitForTimeout(600);
  rowEditOptions = await page.$$eval("table select[name='statusCode'] option", (os) =>
    os.map((o) => o.textContent?.trim()),
  );
  await page.screenshot({ path: `${DIR}/redirects-row-edit.png` });
}

// CLEAN UP: delete the throwaway redirect.
let deleted = false;
const delBtn = page.getByRole("button", { name: /delete|remove/i }).first();
if (await delBtn.isVisible().catch(() => false)) {
  page.on("dialog", (d) => d.accept().catch(() => {}));
  await delBtn.click();
  await page.waitForTimeout(1500);
  const after = await page.$$eval("table tbody td", (tds) =>
    tds.map((t) => t.textContent?.trim()),
  );
  deleted = !after.some((t) => /n18-copy-proof-throwaway/.test(t || ""));
}

console.log(JSON.stringify({
  rowCellWordsFirst: wordsFirstCell ?? null,
  rowEditSelectOptions: rowEditOptions,
  throwawayDeleted: deleted,
}, null, 2));

await browser.close();
