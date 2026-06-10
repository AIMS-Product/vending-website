import pw from "/Users/jamesaims/Desktop/Development/vending-website/node_modules/playwright/index.js";
const { chromium } = pw;

const SHOTS =
  "/Users/jamesaims/Desktop/Development/vending-website/plans/ux-review-fixes/agent-runs/shots";
const BASE = "http://localhost:3000";
const ts = Date.now();
const applyEmail = `test+uxfix-apply-${ts}@example.com`;
const contactEmail = `test+uxfix-contact-${ts}@example.com`;

async function selectByName(page, name, value) {
  await page.selectOption(`select[name="${name}"]`, { label: value });
}

async function fillApply(page, email) {
  await page.fill('input[name="full_name"]', "UX Fix Test");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', "0400000000");
  await page.fill('input[name="city"]', "Austin");
  await selectByName(page, "state_region", "Texas");
  await selectByName(page, "business_stage", "Researching vending");
  await selectByName(page, "budget", "$5k-$10k");
  await selectByName(page, "timeline", "Next 30 days");
}

async function run() {
  const browser = await chromium.launch();
  const results = {};
  try {
    const page = await browser.newPage();

    // ---- APPLY: success -> redirect to /thank-you-for-applying ----
    await page.goto(`${BASE}/apply`, { waitUntil: "networkidle" });
    await fillApply(page, applyEmail);
    await Promise.all([
      page.waitForURL("**/thank-you-for-applying", { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    results.applyUrl = page.url();
    await page.screenshot({ path: `${SHOTS}/n2-apply-redirect.png`, fullPage: true });

    // ---- APPLY idempotency: submit identical data again -> still lands on thank-you ----
    await page.goto(`${BASE}/apply`, { waitUntil: "networkidle" });
    await fillApply(page, applyEmail); // identical email = same business data
    // Note: idempotency_key is a fresh randomUUID per page load, so this is a
    // second distinct submission; the real idempotency guard is covered by
    // leads.test.ts. This proves a repeat apply still redirects cleanly.
    await Promise.all([
      page.waitForURL("**/thank-you-for-applying", { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    results.applyUrl2 = page.url();

    // ---- CONTACT: success -> in-place success panel (no redirect) ----
    await page.goto(`${BASE}/contact`, { waitUntil: "networkidle" });
    await page.fill('input[name="full_name"]', "UX Fix Test");
    await page.fill('input[name="email"]', contactEmail);
    await page.fill('input[name="phone"]', "0400000000");
    await page.fill('input[name="city"]', "Austin");
    await page.fill('textarea[name="message"]', "UX fix automated test message.");
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    await page.waitForFunction(
      () => /message sent/i.test(document.body.innerText),
      { timeout: 15000 },
    );
    results.contactUrl = page.url();
    results.panelText = await page.locator('[role="status"]').innerText();
    results.formGone = (await page.locator("form").count()) === 0;
    results.panelEchoesEmail = results.panelText.includes(contactEmail);
    await page.screenshot({ path: `${SHOTS}/n2-contact-panel.png`, fullPage: true });

    results.applyEmail = applyEmail;
    results.contactEmail = contactEmail;
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error("BROWSER_GATE_FAILED", e);
  process.exit(1);
});
