import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(() => { try { localStorage.setItem("page-builder-editor-walkthrough-seen","1"); } catch {} });
const page = await ctx.newPage();
await page.goto("http://localhost:3001/admin/pages/e44f0fc3-0dcf-480f-9c99-f3409c690378", { waitUntil: "networkidle" });
const res = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
for (const v of res.violations) {
  for (const n of v.nodes.slice(0,6)) {
    console.log("TARGET:", n.target.join(" "));
    console.log("  HTML:", (n.html||"").slice(0,160));
    console.log("  SUMMARY:", (n.failureSummary||"").replace(/\n/g," ").slice(0,220));
  }
}
await browser.close();
