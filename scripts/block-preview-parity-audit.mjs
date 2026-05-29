/**
 * SEO block preview parity audit — picker vs actual render on block-preview-audit.
 *
 * Usage:
 *   ADMIN_DEV_AUTH_BYPASS=1 npm run dev   # separate terminal
 *   node scripts/block-preview-parity-audit.mjs
 *
 * Options:
 *   SMOKE_BASE_URL=http://localhost:3000
 *   BLOCK_PREVIEW_SKIP_TYPES=hero        # comma-separated type:variant or type
 *   BLOCK_PREVIEW_MOBILE_SAMPLE=3        # mobile screenshots for first N failures
 */
import { join } from "node:path";
import { writeFileSync } from "node:fs";

const { chromium } = await import(
  process.env.PLAYWRIGHT_IMPORT_PATH ?? "playwright"
);
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const root = process.cwd();
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const skipPatterns = (process.env.BLOCK_PREVIEW_SKIP_TYPES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const mobileSampleLimit = Number(
  process.env.BLOCK_PREVIEW_MOBILE_SAMPLE ?? "5",
);

function shouldSkip(type, variant) {
  const id = `${type}:${variant}`;
  return skipPatterns.some(
    (pattern) =>
      pattern === type || pattern === id || pattern === `${type}-${variant}`,
  );
}

function slug(type, variant) {
  return `${type}-${variant}`;
}

async function countText(locator, value) {
  return locator.getByText(value, { exact: false }).count();
}

async function countImgAlt(locator, alt) {
  return locator.getByAltText(alt, { exact: true }).count();
}

async function evaluateMarkers(picker, actual, markers) {
  const details = [];

  for (const marker of markers) {
    let pickerCount = 0;
    let actualCount = 0;

    if (marker.kind === "text") {
      pickerCount = await countText(picker, marker.value);
      actualCount = await countText(actual, marker.value);
    } else if (marker.kind === "img-alt") {
      pickerCount = await countImgAlt(picker, marker.value);
      actualCount = await countImgAlt(actual, marker.value);
    }

    const ok =
      pickerCount > 0 && actualCount > 0 && pickerCount === actualCount;

    details.push({
      label: marker.label,
      kind: marker.kind,
      value: marker.value,
      pickerCount,
      actualCount,
      ok,
    });
  }

  const failed = details.filter((d) => !d.ok);
  return { details, failed, parity: failed.length === 0 && details.length > 0 };
}

async function auditCase(page, caseLocator, viewportSuffix) {
  const type = await caseLocator.getAttribute("data-block-type");
  const variant = await caseLocator.getAttribute("data-block-variant");
  const markersRaw = await caseLocator.getAttribute("data-parity-markers");
  const markers = JSON.parse(markersRaw ?? "[]");

  await caseLocator.scrollIntoViewIfNeeded();
  const picker = caseLocator.locator('[data-testid="picker-preview"]');
  const actual = caseLocator.locator('[data-testid="actual-render"]');

  const { details, failed, parity } = await evaluateMarkers(
    picker,
    actual,
    markers,
  );

  return {
    type,
    variant,
    id: `${type}:${variant}`,
    viewportSuffix,
    parity,
    details,
    failed,
  };
}

async function captureFailureScreenshots(page, type, variant) {
  const fileSlug = slug(type, variant);
  const caseLocator = page.locator(
    `[data-block-type="${type}"][data-block-variant="${variant}"]`,
  );
  await caseLocator.scrollIntoViewIfNeeded();
  const picker = caseLocator.locator('[data-testid="picker-preview"]');
  const actual = caseLocator.locator('[data-testid="actual-render"]');

  await picker.screenshot({
    path: join(root, `tmp-${fileSlug}-picker.png`),
  });
  await actual.screenshot({
    path: join(root, `tmp-${fileSlug}-actual.png`),
  });
}

function verdictFor(desktopParity, mobileParity) {
  if (desktopParity && mobileParity) return "PASS";
  if (desktopParity || mobileParity) return "NEEDS_HUMAN";
  return "FAIL";
}

function reasonFor(result) {
  if (result.verdict === "PASS")
    return "Content markers match on desktop and mobile";
  const failed = result.desktop?.failed ?? result.failed ?? [];
  if (failed.length === 0) {
    return result.desktop?.parity
      ? "Desktop OK; mobile marker mismatch"
      : "Mobile OK; desktop marker mismatch";
  }
  const labels = failed
    .slice(0, 4)
    .map(
      (f) => `${f.label} (picker ${f.pickerCount} / actual ${f.actualCount})`,
    );
  const suffix = failed.length > 4 ? ` +${failed.length - 4} more` : "";
  return labels.join("; ") + suffix;
}

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const results = [];
let mobileFailureSamples = 0;

try {
  await page.goto(`${baseUrl}/admin/pages/block-preview-audit`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });

  await page
    .locator('[data-testid="block-preview-case"]')
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });

  const caseLocators = page.locator('[data-testid="block-preview-case"]');
  const count = await caseLocators.count();

  for (let i = 0; i < count; i += 1) {
    const caseLocator = caseLocators.nth(i);
    const type = await caseLocator.getAttribute("data-block-type");
    const variant = await caseLocator.getAttribute("data-block-variant");

    if (shouldSkip(type, variant)) {
      results.push({
        type,
        variant,
        verdict: "SKIP",
        reason: "Skipped via BLOCK_PREVIEW_SKIP_TYPES",
      });
      continue;
    }

    const desktop = await auditCase(page, caseLocator, "desktop");
    await page.setViewportSize({ width: 390, height: 1200 });
    const mobile = await auditCase(page, caseLocator, "mobile");
    await page.setViewportSize({ width: 1440, height: 1200 });

    const verdict = verdictFor(desktop.parity, mobile.parity);
    const entry = {
      type,
      variant,
      verdict,
      desktop,
      mobile,
      failed: desktop.failed.length > 0 ? desktop.failed : mobile.failed,
    };
    entry.reason = reasonFor({
      verdict,
      desktop,
      mobile,
      failed: entry.failed,
    });
    results.push(entry);

    if (verdict !== "PASS") {
      await captureFailureScreenshots(page, type, variant);
      if (
        mobileFailureSamples < mobileSampleLimit &&
        desktop.parity !== mobile.parity
      ) {
        await page.setViewportSize({ width: 390, height: 1200 });
        await captureFailureScreenshots(page, type, variant);
        await page.setViewportSize({ width: 1440, height: 1200 });
        mobileFailureSamples += 1;
      }
    }
  }

  const pass = results.filter((r) => r.verdict === "PASS").length;
  const fail = results.filter((r) => r.verdict === "FAIL").length;
  const needsHuman = results.filter((r) => r.verdict === "NEEDS_HUMAN").length;
  const skip = results.filter((r) => r.verdict === "SKIP").length;

  const summary = { pass, fail, needsHuman, skip, total: results.length };
  const report = { summary, results };

  writeFileSync(
    join(root, "tmp-block-preview-parity-report.json"),
    JSON.stringify(report, null, 2),
  );

  console.log("\n| Block | Variant | Verdict | Reason |");
  console.log("| --- | --- | --- | --- |");
  for (const r of results) {
    console.log(
      `| ${r.type} | ${r.variant} | ${r.verdict} | ${r.reason ?? ""} |`,
    );
  }

  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  console.log("\nReport: tmp-block-preview-parity-report.json");

  if (fail > 0) process.exitCode = 1;
} catch (error) {
  console.error("BLOCK PREVIEW PARITY AUDIT FAIL:", error);
  await page.screenshot({
    path: join(root, "tmp-block-preview-parity-failure.png"),
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
