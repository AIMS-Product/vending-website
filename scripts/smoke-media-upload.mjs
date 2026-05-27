import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const imagePath = join(process.cwd(), "tmp-smoke-image.png");
const imageTitle = "Tmp smoke image";

writeFileSync(
  imagePath,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleMessages = [];
page.on("console", (message) => {
  consoleMessages.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => {
  consoleMessages.push(`pageerror: ${error.message}`);
});

try {
  await page.goto(`${baseUrl}/admin/pages/new`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  await page.getByRole("button", { name: "From scratch" }).click();
  await page.getByRole("button", { name: "Add page content" }).click();
  await page.getByRole("button", { name: /^Image\b/ }).click();
  await page.getByRole("button", { name: "Standard image" }).click();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(imagePath);
  await page
    .locator("article img.object-cover")
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
  await page.getByText(imageTitle).first().waitFor({
    state: "visible",
    timeout: 10_000,
  });

  await page.goto(`${baseUrl}/admin/media`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.getByRole("heading", { name: imageTitle }).first().waitFor({
    state: "visible",
    timeout: 60_000,
  });

  console.log("SMOKE PASS: editor upload created media library asset.");
} catch (error) {
  console.error("SMOKE FAIL:", error);
  console.error("Console messages:", consoleMessages.slice(-20).join("\n"));
  await page.screenshot({ path: "tmp-smoke-failure.png", fullPage: true });
  console.error("Saved screenshot to tmp-smoke-failure.png");
  process.exitCode = 1;
} finally {
  await browser.close();
}
