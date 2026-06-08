import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR ?? "/tmp";

async function screenshot(page, name) {
  const path = `${screenshotDir}/walkthrough-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`screenshot: ${path}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => {
  consoleErrors.push(`pageerror: ${error.message}`);
});

try {
  await context.addInitScript(() => {
    window.localStorage.removeItem("page-builder-editor-walkthrough-seen");
  });

  await page.goto(`${baseUrl}/admin/pages/new`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  await page.locator("#new-page-choice-title").waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await screenshot(page, "01-create-gate-step1");

  await page.getByText("Step 1 of 3").waitFor({ state: "visible" });
  await page.getByText("What kind of page are you creating?").waitFor({
    state: "visible",
  });
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Step 2 of 3").waitFor({ state: "visible" });
  await page.getByText("How would you like to start?").waitFor({
    state: "visible",
  });
  await page.getByRole("button", { name: "Blank page" }).waitFor({
    state: "visible",
  });
  const templateButton = page.getByRole("button", { name: "Template" });
  await templateButton.waitFor({ state: "visible" });
  if (!(await templateButton.isDisabled())) {
    throw new Error("Expected Template option to be disabled when no templates exist.");
  }
  await page.getByText("No templates created").waitFor({ state: "visible" });
  await screenshot(page, "02-create-gate-step2");

  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Step 3 of 3").waitFor({ state: "visible" });
  await page.getByText("Ready to build your page").waitFor({ state: "visible" });
  await screenshot(page, "03-create-gate-step3");

  await page.getByRole("button", { name: "Start building page" }).click();

  await page.getByText("Quick tour · Step 1 of 3").waitFor({
    state: "visible",
    timeout: 15_000,
  });
  await page.getByText("This is where the structure of the page is.").waitFor({
    state: "visible",
  });
  await page.locator('[data-builder-walkthrough="blocks"]').waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await screenshot(page, "04-walkthrough-step1");

  await page.getByRole("dialog").getByRole("button", { name: "Next", exact: true }).click();

  await page.getByText("Quick tour · Step 2 of 3").waitFor({ state: "visible" });
  await page.getByText("This is where all the SEO stuff lives.").waitFor({
    state: "visible",
  });
  await page.locator('[data-builder-walkthrough="seo"]').waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await screenshot(page, "05-walkthrough-step2");

  await page.getByRole("dialog").getByRole("button", { name: "Next", exact: true }).click();

  await page.getByText("Quick tour · Step 3 of 3").waitFor({ state: "visible" });
  await page.getByText(
    "This is your AI helper who can help create the full page for you.",
  ).waitFor({ state: "visible" });
  await page.locator('[data-builder-walkthrough="ai"]').waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByRole("region", { name: "AI page builder assistant" }).waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await screenshot(page, "06-walkthrough-step3");

  await page.getByRole("dialog").getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByText("Quick tour · Step 1 of 3").waitFor({
    state: "hidden",
    timeout: 10_000,
  });
  await screenshot(page, "07-editor-after-walkthrough");

  const seen = await page.evaluate(() =>
    window.localStorage.getItem("page-builder-editor-walkthrough-seen"),
  );
  if (seen !== "1") {
    throw new Error("Walkthrough completion flag was not persisted.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected:\n${consoleErrors.join("\n")}`);
  }

  console.log("SMOKE PASS: create-page wizard and first-time walkthrough verified.");
} catch (error) {
  console.error("SMOKE FAIL:", error);
  await screenshot(page, "failure");
  if (consoleErrors.length > 0) {
    console.error("Console errors:", consoleErrors.join("\n"));
  }
  process.exitCode = 1;
} finally {
  await browser.close();
}
