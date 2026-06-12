import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.N16_BASE_URL ?? "http://localhost:3001";
const PAGE_ID = process.env.N16_PAGE_ID;
const SHOTS = path.resolve("plans/seo-builder-ux-fixes/agent-runs/n16-screens");

const log = (...a) => console.log("[n16]", ...a);
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }).catch(() => {});
}

async function run() {
  if (!PAGE_ID) throw new Error("Set N16_PAGE_ID to a page that has revisions.");
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("page-builder-editor-walkthrough-seen", "1");
    } catch {}
  });
  const page = await context.newPage();

  try {
    // Read-only: open the editor for a page that already has revisions.
    await page.goto(`${BASE}/admin/pages/${PAGE_ID}`, { waitUntil: "networkidle" });

    // The revision history panel renders human labels. Scope to the panel
    // section via its heading to avoid matching the outer shell region.
    const heading = page.getByRole("heading", { name: "Revision history" });
    await heading.waitFor({ state: "visible", timeout: 10000 });
    const history = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Revision history" }) })
      .last();
    const historyText = await history.innerText();

    check(
      "Revision label is human, not a raw enum",
      /Published|Manual save|Autosave|Restored|AI edit/.test(historyText) &&
        !/manual_save|ai_insert|revision_type/.test(historyText),
      historyText.split("\n").slice(0, 6).join(" | "),
    );

    // AM/PM consistency: the revision time and the editor autosave hint both
    // render 12-hour AM/PM. Capture both for the side-by-side record.
    const revTimeMatch = historyText.match(/\b\d{1,2}:\d{2}\s?[AP]M\b/);
    check("Revision time shows 12-hour AM/PM", Boolean(revTimeMatch), revTimeMatch?.[0] ?? "none");

    // A Pacific zone label (PDT/PST) is present — proves the deterministic zone.
    check(
      "Revision time is zone-qualified (Pacific PDT/PST)",
      /\b(PDT|PST)\b/.test(historyText),
      (historyText.match(/\b(PDT|PST)\b/) ?? ["none"])[0],
    );

    // Context line (blocks/words) present for at least one revision.
    check(
      "Per-revision context line (blocks/words) renders",
      /\d+ (block|blocks) · \d+ (word|words)/.test(historyText),
    );

    await shot(page, "A1-revision-history-labels");

    // Editor autosave time format (for the consistency record) — may be absent
    // if no autosave has happened this session; capture whatever is shown.
    const railTime = await page
      .locator("text=/Saved automatically · /")
      .first()
      .innerText()
      .catch(() => "(no autosave hint shown)");
    log(`EDITOR autosave hint: ${railTime}`);
    await shot(page, "A2-editor-toprail-time");
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
  console.error("[n16] script error", e);
  process.exit(2);
});
