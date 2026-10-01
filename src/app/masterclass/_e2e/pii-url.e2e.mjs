// Regression: contact details in a /masterclass link never reach the address
// bar, history, a server action POST or any other request after hydration.
// Usage: node src/app/masterclass/_e2e/pii-url.e2e.mjs [baseUrl]
//   (default http://localhost:3200; PW_CHROMIUM=<path> to pick a browser)
//
// The submit trips the honeypot field, so the action redirects to the
// confirmed page without calling GoHighLevel: no contact is created and no
// text is sent, while the POST still goes through the app router.
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3200";
const PII = ["email=", "phone="];
const leaks = (url) => PII.some((key) => url.includes(key));

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const failures = [];
try {
  const page = await browser.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto(
    `${BASE}/masterclass?utm_source=qa&email=leak@x.com&phone=5551234567`,
    { waitUntil: "networkidle", timeout: 90_000 },
  );
  // The document request itself carries the params; everything after must not.
  const afterLoad = requests.length;
  await page.waitForTimeout(500);
  if (leaks(page.url())) failures.push(`address bar after load: ${page.url()}`);

  const form = page
    .locator("form")
    .filter({ has: page.locator('input[name="email"]') });
  await form.locator('input[name="firstName"]').fill("Mary Jo");
  await form.locator('input[name="lastName"]').fill("Tester");
  await form.locator('input[name="email"]').fill("qa-pii@example.com");
  await form.locator('input[name="phone"]').fill("3125550123");
  await form.locator('input[name="smsConsent"]').check();
  await form.locator('input[name="mc_hp_field"]').evaluate((input) => {
    input.value = "bot";
  });
  await Promise.all([
    page.waitForURL(/\/masterclass-confirmed/, { timeout: 60_000 }),
    form.locator('button[type="submit"]').click(),
  ]);
  await page.waitForLoadState("networkidle");

  if (leaks(page.url()))
    failures.push(`address bar after submit: ${page.url()}`);
  if (!page.url().includes("utm_source=qa")) {
    failures.push(`attribution lost: ${page.url()}`);
  }
  for (const url of requests.slice(afterLoad)) {
    if (leaks(url)) failures.push(`request: ${url}`);
  }
  const history = await page.evaluate(() => window.history.length);
  await page.goBack({ waitUntil: "networkidle" }).catch(() => null);
  if (leaks(page.url())) {
    failures.push(`history entry (of ${history}): ${page.url()}`);
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(
    `FAIL pii-url (${failures.length})\n- ${failures.join("\n- ")}`,
  );
  process.exit(1);
}
console.log(
  "PASS pii-url: no email= or phone= in the URL, history or requests",
);
