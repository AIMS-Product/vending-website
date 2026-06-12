import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const BASE = process.env.N7_BASE_URL ?? "http://localhost:3001";
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n7-screens");

const log = (...a) => console.log("[n7]", ...a);
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }).catch(() => {});
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/admin/pages`, { waitUntil: "networkidle" });

    // Legend present and names every state.
    const legend = page.locator('[aria-label="Status and readiness legend"]');
    await legend.waitFor({ state: "visible", timeout: 8000 });
    const legendText = await legend.innerText();
    check("Status/readiness legend visible", await legend.isVisible());
    for (const word of ["Published", "Draft", "Archived", "Strong", "Needs work", "Blocked"]) {
      check(`Legend names "${word}"`, legendText.includes(word));
    }
    check("Legend labels Status group", legendText.toLowerCase().includes("status"));
    check("Legend labels Readiness group", legendText.toLowerCase().includes("readiness"));

    // Desktop table: a Status column cell shows a visible word, not just a dot.
    const statusCellText = await page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(3)
      .innerText();
    check(
      "Desktop Status cell shows visible label text",
      /Published|Draft|Archived/.test(statusCellText),
      statusCellText.trim(),
    );

    const readinessCellText = await page
      .locator("table tbody tr")
      .first()
      .locator("td")
      .nth(2)
      .innerText();
    check(
      "Desktop Readiness cell shows visible label text",
      /Strong|Opportunities|Needs work|Blocked/.test(readinessCellText),
      readinessCellText.trim(),
    );

    await shot(page, "desktop-list-labels-legend");

    // Mobile fallback: labels visible in stacked cards too.
    await page.setViewportSize({ width: 390, height: 900 });
    await page.reload({ waitUntil: "networkidle" });
    const mobileBody = await page.locator("body").innerText();
    check(
      "Mobile cards show status/readiness label words",
      /Published|Draft|Archived/.test(mobileBody) &&
        /Strong|Opportunities|Needs work|Blocked/.test(mobileBody),
    );
    await shot(page, "mobile-list-labels");

    // Axe: no new serious/critical violations on the list.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.reload({ waitUntil: "networkidle" });
    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    check(
      "Axe: no serious/critical violations on the list",
      serious.length === 0,
      serious.map((v) => `${v.id}(${v.impact})x${v.nodes.length}`).join(", ") || "clean",
    );
    if (axe.violations.length) {
      log("axe (all impacts):", axe.violations.map((v) => `${v.id}:${v.impact}`).join(", "));
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  log("=========================================");
  log(`TOTAL ${results.length}  PASS ${results.length - failed.length}  FAIL ${failed.length}`);
  if (failed.length) {
    for (const f of failed) log("FAILED:", f.name, f.detail);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("[n7] script error", e);
  process.exit(2);
});
